const pool = require('../config/database');
const { validationResult } = require('express-validator');

// 1. Get all books with pagination
const getBooks = async (req, res, next) => {
  try {
    const { search, category, availability } = req.query;

    // Validate pagination values before using them in SQL
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(req.query.limit, 10) || 10)
    );
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (search) {
      whereClause +=
        ' AND (b.title LIKE ? OR b.author LIKE ? OR b.isbn LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    if (category) {
      whereClause += ' AND b.category_id = ?';
      params.push(category);
    }

    if (availability === 'available') {
      whereClause += ' AND b.available_copies > 0';
    } else if (availability === 'unavailable') {
      whereClause += ' AND b.available_copies = 0';
    }

    const [books] = await pool.query(
      `SELECT b.id, b.title, b.author, b.isbn, b.category_id,
              b.total_copies, b.available_copies, b.published_year,
              b.publisher, c.name AS category_name
       FROM books b
       LEFT JOIN categories c ON b.category_id = c.id
       ${whereClause}
       ORDER BY b.created_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    const [total] = await pool.query(
      `SELECT COUNT(*) AS count
       FROM books b
       ${whereClause}`,
      params
    );

    const totalCount = Number(total[0].count);

    res.json({
      success: true,
      data: books,
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

// 2. Get one book by ID
const getBookById = async (req, res, next) => {
  try {
    const [books] = await pool.query(
      `SELECT b.*, c.name AS category_name
       FROM books b
       LEFT JOIN categories c ON b.category_id = c.id
       WHERE b.id = ?`,
      [req.params.id]
    );

    if (books.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Book not found'
      });
    }

    res.json({ success: true, data: books[0] });
  } catch (error) {
    next(error);
  }
};

// 3. Add a new book
const createBook = async (req, res, next) => {
  try {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const {
      title,
      author,
      isbn,
      category_id,
      total_copies = 1,
      published_year = null,
      publisher = null
    } = req.body;

    const [existing] = await pool.query(
      'SELECT id FROM books WHERE isbn = ?',
      [isbn]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'A book with this ISBN already exists'
      });
    }

    await pool.query(
      `INSERT INTO books
       (title, author, isbn, category_id, total_copies,
        available_copies, published_year, publisher)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title,
        author,
        isbn,
        category_id,
        total_copies,
        total_copies,
        published_year,
        publisher
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Book added successfully'
    });
  } catch (error) {
    next(error);
  }
};

// 4. Update an existing book
const updateBook = async (req, res, next) => {
  try {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const {
      title,
      author,
      isbn,
      category_id,
      total_copies,
      published_year,
      publisher
    } = req.body;

    const [books] = await pool.query(
      'SELECT id, total_copies, available_copies FROM books WHERE id = ?',
      [id]
    );

    if (books.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Book not found'
      });
    }

    const [duplicate] = await pool.query(
      'SELECT id FROM books WHERE isbn = ? AND id <> ?',
      [isbn, id]
    );

    if (duplicate.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Another book already uses this ISBN'
      });
    }

    const oldBook = books[0];
    const newTotal =
      total_copies === undefined
        ? oldBook.total_copies
        : Number(total_copies);

    const issuedCopies =
      Number(oldBook.total_copies) - Number(oldBook.available_copies);

    if (newTotal < issuedCopies) {
      return res.status(400).json({
        success: false,
        message: 'Total copies cannot be less than currently issued copies'
      });
    }

    const newAvailable = newTotal - issuedCopies;

    await pool.query(
      `UPDATE books
       SET title = ?, author = ?, isbn = ?, category_id = ?,
           total_copies = ?, available_copies = ?,
           published_year = ?, publisher = ?
       WHERE id = ?`,
      [
        title,
        author,
        isbn,
        category_id,
        newTotal,
        newAvailable,
        published_year || null,
        publisher || null,
        id
      ]
    );

    res.json({
      success: true,
      message: 'Book updated successfully'
    });
  } catch (error) {
    next(error);
  }
};

// 5. Delete a book
const deleteBook = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [books] = await pool.query(
      'SELECT id FROM books WHERE id = ?',
      [id]
    );

    if (books.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Book not found'
      });
    }

    const [transactions] = await pool.query(
      "SELECT id FROM transactions WHERE book_id = ? AND status = 'issued'",
      [id]
    );

    if (transactions.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete a book that is currently issued'
      });
    }

    await pool.query('DELETE FROM books WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Book deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Export all controller functions
module.exports = {
  getBooks,
  getBookById,
  createBook,
  updateBook,
  deleteBook
};