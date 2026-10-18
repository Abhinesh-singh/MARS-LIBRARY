
const pool = require('../config/database');
const { validationResult } = require('express-validator');
const {
  calculateFine,
  getFineRate
} = require('../utils/calculateFine');

// Get all transactions with pagination and status filter
const getTransactions = async (req, res, next) => {
  try {
    const { status } = req.query;

    // Validate pagination values
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(req.query.limit, 10) || 10)
    );
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (status) {
      whereClause += ' AND t.status = ?';
      params.push(status);
    }

    // Use validated integers in LIMIT and OFFSET for TiDB
    const [transactions] = await pool.query(
      `SELECT
        t.id, t.book_id, t.member_id,
        t.issue_date, t.due_date, t.return_date,
        t.status, t.fine_amount,
        b.title AS book_title,
        b.author AS book_author,
        b.isbn,
        m.member_id AS member_code,
        m.full_name AS member_name
       FROM transactions t
       JOIN books b ON t.book_id = b.id
       JOIN members m ON t.member_id = m.id
       ${whereClause}
       ORDER BY t.issue_date DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    const [total] = await pool.query(
      `SELECT COUNT(*) AS count
       FROM transactions t
       ${whereClause}`,
      params
    );

    const totalCount = Number(total[0].count);

    res.json({
      success: true,
      data: transactions,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

// Issue a book to an active member
const issueBook = async (req, res, next) => {
  let connection;
  let transactionStarted = false;
  let transactionCommitted = false;

  try {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { book_id, member_id, issue_date, due_date } = req.body;

    const issueDate = issue_date ||
      new Date().toISOString().slice(0, 10);

    const dueDate = due_date ||
      new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
        .toISOString().slice(0, 10);

    if (
      !Number.isFinite(Date.parse(issueDate)) ||
      !Number.isFinite(Date.parse(dueDate)) ||
      dueDate < issueDate
    ) {
      return res.status(400).json({
        success: false,
        message: 'Please provide valid issue and due dates.'
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;

    // Lock book row to prevent issuing the last copy twice
    const [books] = await connection.query(
      'SELECT * FROM books WHERE id = ? FOR UPDATE',
      [book_id]
    );

    if (books.length === 0) {
      await connection.rollback();
      transactionStarted = false;

      return res.status(404).json({
        success: false,
        message: 'Book not found'
      });
    }

    if (Number(books[0].available_copies) <= 0) {
      await connection.rollback();
      transactionStarted = false;

      return res.status(400).json({
        success: false,
        message: 'No copies available for this book'
      });
    }

    const [members] = await connection.query(
      'SELECT id, status FROM members WHERE id = ?',
      [member_id]
    );

    if (members.length === 0) {
      await connection.rollback();
      transactionStarted = false;

      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    if (members[0].status !== 'active') {
      await connection.rollback();
      transactionStarted = false;

      return res.status(400).json({
        success: false,
        message: 'Member account is inactive'
      });
    }

    const [result] = await connection.query(
      `INSERT INTO transactions
        (book_id, member_id, issue_date, due_date, status)
       VALUES (?, ?, ?, ?, 'issued')`,
      [book_id, member_id, issueDate, dueDate]
    );

    await connection.query(
      `UPDATE books
       SET available_copies = available_copies - 1
       WHERE id = ?`,
      [book_id]
    );

    await connection.commit();
    transactionStarted = false;
    transactionCommitted = true;

    const [newTransaction] = await pool.query(
      `SELECT
        t.id, t.book_id, t.member_id,
        t.issue_date, t.due_date, t.return_date,
        t.status, t.fine_amount,
        b.title AS book_title,
        b.author AS book_author,
        b.isbn,
        m.member_id AS member_code,
        m.full_name AS member_name
       FROM transactions t
       JOIN books b ON t.book_id = b.id
       JOIN members m ON t.member_id = m.id
       WHERE t.id = ?`,
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      message: 'Book issued successfully',
      data: newTransaction[0]
    });
  } catch (error) {
    if (connection && transactionStarted && !transactionCommitted) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('Issue-book rollback failed:', rollbackError.message);
      }
    }

    next(error);
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

// Return an issued book and calculate any overdue fine
const returnBook = async (req, res, next) => {
  let connection;
  let transactionStarted = false;
  let transactionCommitted = false;

  try {
    const { id } = req.params;
    const { return_date } = req.body || {};

    const returnDate = return_date ||
      new Date().toISOString().slice(0, 10);

    if (!Number.isFinite(Date.parse(returnDate))) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid return date.'
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;

    const [transactions] = await connection.query(
      'SELECT * FROM transactions WHERE id = ? FOR UPDATE',
      [id]
    );

    if (transactions.length === 0) {
      await connection.rollback();
      transactionStarted = false;

      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    const transaction = transactions[0];

    if (transaction.status !== 'issued') {
      await connection.rollback();
      transactionStarted = false;

      return res.status(400).json({
        success: false,
        message: 'This transaction is not currently issued.'
      });
    }

    if (returnDate < String(transaction.issue_date).slice(0, 10)) {
      await connection.rollback();
      transactionStarted = false;

      return res.status(400).json({
        success: false,
        message: 'Return date cannot be before the issue date.'
      });
    }

    const fineRate = getFineRate();
    const fineAmount = calculateFine(
      transaction.due_date,
      returnDate,
      fineRate
    );

    await connection.query(
      `UPDATE transactions
       SET return_date = ?, status = 'returned', fine_amount = ?
       WHERE id = ?`,
      [returnDate, fineAmount, id]
    );

    await connection.query(
      `UPDATE books
       SET available_copies = available_copies + 1
       WHERE id = ?`,
      [transaction.book_id]
    );

    await connection.commit();
    transactionStarted = false;
    transactionCommitted = true;

    const [updatedTransaction] = await pool.query(
      `SELECT
        t.id, t.book_id, t.member_id,
        t.issue_date, t.due_date, t.return_date,
        t.status, t.fine_amount,
        b.title AS book_title,
        b.author AS book_author,
        b.isbn,
        m.member_id AS member_code,
        m.full_name AS member_name
       FROM transactions t
       JOIN books b ON t.book_id = b.id
       JOIN members m ON t.member_id = m.id
       WHERE t.id = ?`,
      [id]
    );

    res.json({
      success: true,
      message: 'Book returned successfully',
      data: updatedTransaction[0]
    });
  } catch (error) {
    if (connection && transactionStarted && !transactionCommitted) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('Return-book rollback failed:', rollbackError.message);
      }
    }

    next(error);
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

module.exports = {
  getTransactions,
  issueBook,
  returnBook
};
