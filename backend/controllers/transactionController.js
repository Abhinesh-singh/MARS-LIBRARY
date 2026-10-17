const pool = require('../config/database');
const { validationResult } = require('express-validator');
const { calculateFine, getFineRate } = require('../utils/calculateFine');

const getTransactions = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (status) {
      whereClause += ' AND t.status = ?';
      params.push(status);
    }

    const [transactions] = await pool.execute(`
      SELECT 
        t.id, t.book_id, t.member_id, t.issue_date, t.due_date, t.return_date, t.status, t.fine_amount,
        b.title as book_title, b.author as book_author, b.isbn,
        m.member_id as member_code, m.full_name as member_name
      FROM transactions t
      JOIN books b ON t.book_id = b.id
      JOIN members m ON t.member_id = m.id
      ${whereClause}
      ORDER BY t.issue_date DESC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), parseInt(offset)]);

    const [total] = await pool.execute(`
      SELECT COUNT(*) as count FROM transactions t ${whereClause}
    `, params);

    res.json({
      success: true,
      data: transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total[0].count,
        totalPages: Math.ceil(total[0].count / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

const issueBook = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      await connection.rollback();
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { book_id, member_id, issue_date, due_date } = req.body;

    const [books] = await connection.execute('SELECT * FROM books WHERE id = ? FOR UPDATE', [book_id]);
    if (books.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Book not found' });
    }

    const book = books[0];
    if (book.available_copies <= 0) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'No copies available for this book' });
    }

    const [members] = await connection.execute('SELECT * FROM members WHERE id = ?', [member_id]);
    if (members.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    const member = members[0];
    if (member.status !== 'active') {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'Member account is inactive' });
    }

    const issueDate = issue_date || new Date().toISOString().split('T')[0];
    const dueDate = due_date || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const [result] = await connection.execute(`
      INSERT INTO transactions (book_id, member_id, issue_date, due_date, status)
      VALUES (?, ?, ?, ?, 'issued')
    `, [book_id, member_id, issueDate, dueDate]);

    await connection.execute(
      'UPDATE books SET available_copies = available_copies - 1 WHERE id = ?',
      [book_id]
    );

    await connection.commit();

    const [newTransaction] = await pool.execute(`
      SELECT 
        t.id, t.book_id, t.member_id, t.issue_date, t.due_date, t.return_date, t.status, t.fine_amount,
        b.title as book_title, b.author as book_author, b.isbn,
        m.member_id as member_code, m.full_name as member_name
      FROM transactions t
      JOIN books b ON t.book_id = b.id
      JOIN members m ON t.member_id = m.id
      WHERE t.id = ?
    `, [result.insertId]);

    res.status(201).json({ success: true, message: 'Book issued successfully', data: newTransaction[0] });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
};

const returnBook = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const { id } = req.params;
    const { return_date } = req.body;

    const [transactions] = await connection.execute('SELECT * FROM transactions WHERE id = ? FOR UPDATE', [id]);
    if (transactions.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    const transaction = transactions[0];
    if (transaction.status === 'returned') {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'Book already returned' });
    }

    const returnDate = return_date || new Date().toISOString().split('T')[0];
    const fineRate = getFineRate();
    const fineAmount = calculateFine(transaction.due_date, returnDate, fineRate);

    await connection.execute(`
      UPDATE transactions 
      SET return_date = ?, status = 'returned', fine_amount = ?
      WHERE id = ?
    `, [returnDate, fineAmount, id]);

    await connection.execute(
      'UPDATE books SET available_copies = available_copies + 1 WHERE id = ?',
      [transaction.book_id]
    );

    await connection.commit();

    const [updatedTransaction] = await pool.execute(`
      SELECT 
        t.id, t.book_id, t.member_id, t.issue_date, t.due_date, t.return_date, t.status, t.fine_amount,
        b.title as book_title, b.author as book_author, b.isbn,
        m.member_id as member_code, m.full_name as member_name
      FROM transactions t
      JOIN books b ON t.book_id = b.id
      JOIN members m ON t.member_id = m.id
      WHERE t.id = ?
    `, [id]);

    res.json({ success: true, message: 'Book returned successfully', data: updatedTransaction[0] });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
};

module.exports = { getTransactions, issueBook, returnBook };