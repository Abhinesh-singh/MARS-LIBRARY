
const pool = require('../config/database');
const { validationResult } = require('express-validator');
const {
  calculateFine,
  getFineRate
} = require('../utils/calculateFine');

// Convert database date to YYYY-MM-DD safely.
function normalizeDate(value) {
  if (value instanceof Date) {
    // Use UTC date components for MySQL DATE values returned as Date.
    const year = value.getUTCFullYear();
    const month = String(value.getUTCMonth() + 1).padStart(2, '0');
    const day = String(value.getUTCDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  if (typeof value === 'string') {
    // Handles YYYY-MM-DD and datetime strings beginning with that date.
    const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
  }

  return null;
}

// Strictly validate a calendar date in YYYY-MM-DD format.
function isValidDate(value) {
  if (typeof value !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
}

function todayDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function validPositiveInteger(value, fallback, maximum) {
  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.min(parsed, maximum);
}

// GET all transactions
const getTransactions = async (req, res, next) => {
  try {
    const page = validPositiveInteger(req.query.page, 1, 1000000);
    const limit = validPositiveInteger(req.query.limit, 10, 100);
    const offset = (page - 1) * limit;
    const status = req.query.status;

    let whereClause = 'WHERE 1 = 1';
    const params = [];

    if (status) {
      whereClause += ' AND t.status = ?';
      params.push(status);
    }

    const [transactions] = await pool.query(
      `SELECT
          t.id,
          t.book_id,
          t.member_id,
          DATE_FORMAT(t.issue_date, '%Y-%m-%d') AS issue_date,
          DATE_FORMAT(t.due_date, '%Y-%m-%d') AS due_date,
          DATE_FORMAT(t.return_date, '%Y-%m-%d') AS return_date,
          t.status,
          t.fine_amount,
          b.title AS book_title,
          b.author AS book_author,
          b.isbn,
          m.member_id AS member_code,
          m.full_name AS member_name
       FROM transactions t
       JOIN books b ON t.book_id = b.id
       JOIN members m ON t.member_id = m.id
       ${whereClause}
       ORDER BY t.issue_date DESC, t.id DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    const [totalRows] = await pool.query(
      `SELECT COUNT(*) AS count
       FROM transactions t
       ${whereClause}`,
      params
    );

    const total = Number(totalRows[0].count);

    res.json({
      success: true,
      data: transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

// Issue a book
const issueBook = async (req, res, next) => {
  let connection;
  let transactionStarted = false;

  try {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { book_id, member_id, issue_date, due_date } = req.body;

    if (!Number.isSafeInteger(Number(book_id)) ||
        Number(book_id) < 1 ||
        !Number.isSafeInteger(Number(member_id)) ||
        Number(member_id) < 1) {
      return res.status(400).json({
        success: false,
        message: 'Valid book and member IDs are required.'
      });
    }

    const issueDate = issue_date || todayDate();

    if (!isValidDate(issueDate)) {
      return res.status(400).json({
        success: false,
        message: 'Issue date must be a valid YYYY-MM-DD date.'
      });
    }

    let dueDate = due_date;

    if (!dueDate) {
      const [year, month, day] = issueDate.split('-').map(Number);
      const date = new Date(Date.UTC(year, month - 1, day + 14));
      dueDate = date.toISOString().slice(0, 10);
    }

    if (!isValidDate(dueDate) || dueDate < issueDate) {
      return res.status(400).json({
        success: false,
        message: 'Due date must be valid and cannot be before the issue date.'
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;

    const [books] = await connection.query(
      'SELECT * FROM books WHERE id = ? FOR UPDATE',
      [Number(book_id)]
    );

    if (books.length === 0) {
      await connection.rollback();
      transactionStarted = false;

      return res.status(404).json({
        success: false,
        message: 'Book not found.'
      });
    }

    if (Number(books[0].available_copies) <= 0) {
      await connection.rollback();
      transactionStarted = false;

      return res.status(400).json({
        success: false,
        message: 'No copies available for this book.'
      });
    }

    const [members] = await connection.query(
      'SELECT * FROM members WHERE id = ?',
      [Number(member_id)]
    );

    if (members.length === 0) {
      await connection.rollback();
      transactionStarted = false;

      return res.status(404).json({
        success: false,
        message: 'Member not found.'
      });
    }

    if (String(members[0].status).trim().toLowerCase() !== 'active') {
      await connection.rollback();
      transactionStarted = false;

      return res.status(400).json({
        success: false,
        message: 'Member account is inactive.'
      });
    }

    const [result] = await connection.query(
      `INSERT INTO transactions
         (book_id, member_id, issue_date, due_date, status)
       VALUES (?, ?, ?, ?, 'issued')`,
      [Number(book_id), Number(member_id), issueDate, dueDate]
    );

    await connection.query(
      'UPDATE books SET available_copies = available_copies - 1 WHERE id = ?',
      [Number(book_id)]
    );

    await connection.commit();
    transactionStarted = false;

    const [newTransactions] = await pool.query(
      `SELECT
          t.id, t.book_id, t.member_id,
          DATE_FORMAT(t.issue_date, '%Y-%m-%d') AS issue_date,
          DATE_FORMAT(t.due_date, '%Y-%m-%d') AS due_date,
          DATE_FORMAT(t.return_date, '%Y-%m-%d') AS return_date,
          t.status, t.fine_amount,
          b.title AS book_title, b.author AS book_author, b.isbn,
          m.member_id AS member_code, m.full_name AS member_name
       FROM transactions t
       JOIN books b ON t.book_id = b.id
       JOIN members m ON t.member_id = m.id
       WHERE t.id = ?`,
      [result.insertId]
    );

    return res.status(201).json({
      success: true,
      message: 'Book issued successfully.',
      data: newTransactions[0]
    });
  } catch (error) {
    if (connection && transactionStarted) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('Issue rollback error:', rollbackError.message);
      }
    }

    return next(error);
  } finally {
    if (connection) connection.release();
  }
};

// Return a book
const returnBook = async (req, res, next) => {
  let connection;
  let transactionStarted = false;

  try {
    const id = Number(req.params.id);
    const suppliedReturnDate = req.body.return_date;
    const returnDate = suppliedReturnDate || todayDate();

    if (!Number.isSafeInteger(id) || id < 1) {
      return res.status(400).json({
        success: false,
        message: 'Invalid transaction ID.'
      });
    }

    if (!isValidDate(returnDate)) {
      return res.status(400).json({
        success: false,
        message: 'Return date must be a valid YYYY-MM-DD date.'
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;

    const [transactions] = await connection.query(
      `SELECT *,
              DATE_FORMAT(issue_date, '%Y-%m-%d') AS issue_date_text
       FROM transactions
       WHERE id = ?
       FOR UPDATE`,
      [id]
    );

    if (transactions.length === 0) {
      await connection.rollback();
      transactionStarted = false;

      return res.status(404).json({
        success: false,
        message: 'Transaction not found.'
      });
    }

    const transaction = transactions[0];
    const currentStatus = String(transaction.status || '')
      .trim()
      .toLowerCase();

    console.log('Return-book debug:', {
      transactionId: id,
      issueDate: transaction.issue_date_text,
      returnDate,
      status: transaction.status
    });

    if (currentStatus !== 'issued') {
      await connection.rollback();
      transactionStarted = false;

      return res.status(400).json({
        success: false,
        message: 'This transaction is not currently issued.',
        data: {
          transactionId: id,
          status: transaction.status
        }
      });
    }

    const issueDate = normalizeDate(transaction.issue_date_text);

    if (!issueDate || !isValidDate(issueDate)) {
      await connection.rollback();
      transactionStarted = false;

      return res.status(500).json({
        success: false,
        message: 'Invalid issue date stored for this transaction.'
      });
    }

    if (returnDate < issueDate) {
      await connection.rollback();
      transactionStarted = false;

      return res.status(400).json({
        success: false,
        message: 'Return date cannot be before the issue date.',
        data: {
          transactionId: id,
          issueDate,
          returnDate
        }
      });
    }

    const dueDate = normalizeDate(transaction.due_date);

    if (!dueDate || !isValidDate(dueDate)) {
      await connection.rollback();
      transactionStarted = false;

      return res.status(500).json({
        success: false,
        message: 'Invalid due date stored for this transaction.'
      });
    }

    const fineRate = getFineRate();
    const fineAmount = calculateFine(dueDate, returnDate, fineRate);

    await connection.query(
      `UPDATE transactions
       SET return_date = ?, status = 'returned', fine_amount = ?
       WHERE id = ? AND status = 'issued'`,
      [returnDate, fineAmount, id]
    );

    // Increase stock only if this transaction was still issued.
    // The transaction row is locked above to prevent double returns.
    await connection.query(
      'UPDATE books SET available_copies = available_copies + 1 WHERE id = ?',
      [transaction.book_id]
    );

    await connection.commit();
    transactionStarted = false;

    const [updatedTransactions] = await pool.query(
      `SELECT
          t.id, t.book_id, t.member_id,
          DATE_FORMAT(t.issue_date, '%Y-%m-%d') AS issue_date,
          DATE_FORMAT(t.due_date, '%Y-%m-%d') AS due_date,
          DATE_FORMAT(t.return_date, '%Y-%m-%d') AS return_date,
          t.status, t.fine_amount,
          b.title AS book_title, b.author AS book_author, b.isbn,
          m.member_id AS member_code, m.full_name AS member_name
       FROM transactions t
       JOIN books b ON t.book_id = b.id
       JOIN members m ON t.member_id = m.id
       WHERE t.id = ?`,
      [id]
    );

    return res.json({
      success: true,
      message: 'Book returned successfully.',
      data: updatedTransactions[0]
    });
  } catch (error) {
    if (connection && transactionStarted) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('Return rollback error:', rollbackError.message);
      }
    }

    return next(error);
  } finally {
    if (connection) connection.release();
  }
};

module.exports = {
  getTransactions,
  issueBook,
  returnBook
};
