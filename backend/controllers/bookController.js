const pool = require('../config/database');
const { validationResult } = require('express-validator');

const getBooks = async (req, res, next) => {
  try {
    const { search, category, availability, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (search) {
      whereClause += ' AND (b.title LIKE ? OR b.author LIKE ? OR b.isbn LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
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

    const [books] = await pool.execute(`
      SELECT 
        b.id, b.title, b.author, b.isbn, b.category_id, 
        b.total_copies, b.available_copies, b.published_year, b.publisher,
        c.name as category_name
      FROM books b
      LEFT JOIN categories c ON b.category_id = c.id
      ${whereClause}
      ORDER BY b.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), parseInt(offset)]);

    const [total] = await pool.execute(`
      SELECT COUNT(*) as count FROM books b ${whereClause}
    `, params);

    res.json({
      success: true,
      data: books,
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

const getBookById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [books] = await pool.execute(`
      SELECT 
        b.id, b.title, b.author, b.isbn, b.category_id, 
        b.total_copies, b.available_copies, b.published_year, b.publisher,
        c.name as category_name
      FROM books b
      LEFT JOIN categories c ON b.category_id = c.id
      WHERE b.id = ?
    `, [id]);

    if (books.length === 0) {
      return res.status(404).json({ success: false, message: 'Book not found' });
    }

    res.json({ success: true, data: books[0] });
  } catch (error) {
    next(error);
  }
};

const createBook = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { title, author, isbn, category_id, total_copies, published_year, publisher } = req.body;

    const [existing] = await pool.execute('SELECT id FROM books WHERE isbn = ?', [isbn]);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'ISBN already exists' });
    }

    const copies = parseInt(total_copies) || 1;

    const [result] = await pool.execute(`
      INSERT INTO books (title, author, isbn, category_id, total_copies, available_copies, published_year, publisher)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [title, author, isbn, category_id, copies, copies, published_year || null, publisher || null]);

    const [newBook] = await pool.execute(`
      SELECT 
        b.id, b.title, b.author, b.isbn, b.category_id, 
        b.total_copies, b.available_copies, b.published_year, b.publisher,
        c.name as category_name
      FROM books b
      LEFT JOIN categories c ON b.category_id = c.id
      WHERE b.id = ?
    `, [result.insertId]);

    res.status(201).json({ success: true, message: 'Book added successfully', data: newBook[0] });
  } catch (error) {
    next(error);
  }
};

const updateBook = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { id } = req.params;
    const { title, author, isbn, category_id, total_copies, published_year, publisher } = req.body;

    const [existing] = await pool.execute('SELECT * FROM books WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Book not found' });
    }

    const currentBook = existing[0];
    const newTotalCopies = parseInt(total_copies) || currentBook.total_copies;
    const diff = newTotalCopies - currentBook.total_copies;
    const newAvailableCopies = Math.max(0, currentBook.available_copies + diff);

    if (isbn !== currentBook.isbn) {
      const [isbnCheck] = await pool.execute('SELECT id FROM books WHERE isbn = ? AND id != ?', [isbn, id]);
      if (isbnCheck.length > 0) {
        return res.status(409).json({ success: false, message: 'ISBN already exists' });
      }
    }

    await pool.execute(`
      UPDATE books 
      SET title = ?, author = ?, isbn = ?, category_id = ?, total_copies = ?, available_copies = ?, published_year = ?, publisher = ?
      WHERE id = ?
    `, [title, author, isbn, category_id, newTotalCopies, newAvailableCopies, published_year || null, publisher || null, id]);

    const [updatedBook] = await pool.execute(`
      SELECT 
        b.id, b.title, b.author, b.isbn, b.category_id, 
        b.total_copies, b.available_copies, b.published_year, b.publisher,
        c.name as category_name
      FROM books b
      LEFT JOIN categories c ON b.category_id = c.id
      WHERE b.id = ?
    `, [id]);

    res.json({ success: true, message: 'Book updated successfully', data: updatedBook[0] });
  } catch (error) {
    next(error);
  }
};

const deleteBook = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [existing] = await pool.execute('SELECT id FROM books WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Book not found' });
    }

    const [transactions] = await pool.execute('SELECT id FROM transactions WHERE book_id = ? AND status = "issued"', [id]);
    if (transactions.length > 0) {
      return res.status(400).json({ success: false, message: 'Cannot delete book. It has active transactions.' });
    }

    await pool.execute('DELETE FROM books WHERE id = ?', [id]);

    res.json({ success: true, message: 'Book deleted successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = { getBooks, getBookById, createBook, updateBook, deleteBook };