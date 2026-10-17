const pool = require('../config/database');

const getOverdueReport = async (req, res, next) => {
  try {
    const [overdueBooks] = await pool.execute(`
      SELECT 
        t.id, t.issue_date, t.due_date, t.fine_amount,
        b.title as book_title, b.author as book_author, b.isbn,
        m.member_id as member_code, m.full_name as member_name, m.email as member_email,
        DATEDIFF(CURDATE(), t.due_date) as days_overdue
      FROM transactions t
      JOIN books b ON t.book_id = b.id
      JOIN members m ON t.member_id = m.id
      WHERE t.status IN ('issued', 'overdue') AND t.due_date < CURDATE()
      ORDER BY t.due_date
    `);

    res.json({ success: true, data: overdueBooks });
  } catch (error) {
    next(error);
  }
};

const getMostBorrowedReport = async (req, res, next) => {
  try {
    const { limit = 10 } = req.query;

    const [mostBorrowed] = await pool.execute(`
      SELECT 
        b.id, b.title, b.author, b.isbn, c.name as category,
        COUNT(t.id) as borrow_count
      FROM books b
      LEFT JOIN categories c ON b.category_id = c.id
      LEFT JOIN transactions t ON b.id = t.book_id
      GROUP BY b.id, b.title, b.author, b.isbn, c.name
      ORDER BY borrow_count DESC, b.title
      LIMIT ?
    `, [parseInt(limit)]);

    res.json({ success: true, data: mostBorrowed });
  } catch (error) {
    next(error);
  }
};

const getTransactionReport = async (req, res, next) => {
  try {
    const { start_date, end_date, category, status } = req.query;

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (start_date) {
      whereClause += ' AND t.issue_date >= ?';
      params.push(start_date);
    }

    if (end_date) {
      whereClause += ' AND t.issue_date <= ?';
      params.push(end_date);
    }

    if (category) {
      whereClause += ' AND b.category_id = ?';
      params.push(category);
    }

    if (status) {
      whereClause += ' AND t.status = ?';
      params.push(status);
    }

    const [transactions] = await pool.execute(`
      SELECT 
        t.id, t.issue_date, t.due_date, t.return_date, t.status, t.fine_amount,
        b.title as book_title, b.author as book_author, b.isbn, c.name as category,
        m.member_id as member_code, m.full_name as member_name
      FROM transactions t
      JOIN books b ON t.book_id = b.id
      JOIN categories c ON b.category_id = c.id
      JOIN members m ON t.member_id = m.id
      ${whereClause}
      ORDER BY t.issue_date DESC
    `, params);

    res.json({ success: true, data: transactions });
  } catch (error) {
    next(error);
  }
};

const getMemberStatistics = async (req, res, next) => {
  try {
    const [memberStats] = await pool.execute(`
      SELECT 
        m.id, m.member_id, m.full_name, m.email,
        COUNT(t.id) as total_borrowed,
        SUM(CASE WHEN t.status = 'issued' THEN 1 ELSE 0 END) as currently_borrowed,
        SUM(CASE WHEN t.status = 'overdue' THEN 1 ELSE 0 END) as overdue_count,
        SUM(t.fine_amount) as total_fines
      FROM members m
      LEFT JOIN transactions t ON m.id = t.member_id
      WHERE m.status = 'active'
      GROUP BY m.id, m.member_id, m.full_name, m.email
      ORDER BY total_borrowed DESC
    `);

    res.json({ success: true, data: memberStats });
  } catch (error) {
    next(error);
  }
};

const getAvailableBooksReport = async (req, res, next) => {
  try {
    const { category } = req.query;

    let whereClause = 'WHERE b.available_copies > 0';
    const params = [];

    if (category) {
      whereClause += ' AND b.category_id = ?';
      params.push(category);
    }

    const [availableBooks] = await pool.execute(`
      SELECT 
        b.id, b.title, b.author, b.isbn, c.name as category,
        b.total_copies, b.available_copies
      FROM books b
      LEFT JOIN categories c ON b.category_id = c.id
      ${whereClause}
      ORDER BY b.title
    `, params);

    res.json({ success: true, data: availableBooks });
  } catch (error) {
    next(error);
  }
};

module.exports = { 
  getOverdueReport, 
  getMostBorrowedReport, 
  getTransactionReport, 
  getMemberStatistics,
  getAvailableBooksReport
};