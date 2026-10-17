const pool = require('../config/database');
const { validationResult } = require('express-validator');

const getCategories = async (req, res, next) => {
  try {
    const { search, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (search) {
      whereClause += ' AND (name LIKE ? OR description LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm);
    }

    const [categories] = await pool.execute(`
      SELECT 
        c.id, c.name, c.description, c.created_at,
        COUNT(b.id) as book_count
      FROM categories c
      LEFT JOIN books b ON c.id = b.category_id
      ${whereClause}
      GROUP BY c.id, c.name, c.description, c.created_at
      ORDER BY c.name
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), parseInt(offset)]);

    const [total] = await pool.execute(`
      SELECT COUNT(*) as count FROM categories ${whereClause}
    `, params);

    res.json({
      success: true,
      data: categories,
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

const createCategory = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { name, description } = req.body;

    const [existing] = await pool.execute('SELECT id FROM categories WHERE name = ?', [name]);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'Category name already exists' });
    }

    const [result] = await pool.execute(
      'INSERT INTO categories (name, description) VALUES (?, ?)',
      [name, description || null]
    );

    const [newCategory] = await pool.execute(`
      SELECT 
        c.id, c.name, c.description, c.created_at,
        COUNT(b.id) as book_count
      FROM categories c
      LEFT JOIN books b ON c.id = b.category_id
      WHERE c.id = ?
      GROUP BY c.id
    `, [result.insertId]);

    res.status(201).json({ success: true, message: 'Category added successfully', data: newCategory[0] });
  } catch (error) {
    next(error);
  }
};

const updateCategory = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { id } = req.params;
    const { name, description } = req.body;

    const [existing] = await pool.execute('SELECT * FROM categories WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    if (name !== existing[0].name) {
      const [nameCheck] = await pool.execute('SELECT id FROM categories WHERE name = ? AND id != ?', [name, id]);
      if (nameCheck.length > 0) {
        return res.status(409).json({ success: false, message: 'Category name already exists' });
      }
    }

    await pool.execute(
      'UPDATE categories SET name = ?, description = ? WHERE id = ?',
      [name, description || null, id]
    );

    const [updatedCategory] = await pool.execute(`
      SELECT 
        c.id, c.name, c.description, c.created_at,
        COUNT(b.id) as book_count
      FROM categories c
      LEFT JOIN books b ON c.id = b.category_id
      WHERE c.id = ?
      GROUP BY c.id
    `, [id]);

    res.json({ success: true, message: 'Category updated successfully', data: updatedCategory[0] });
  } catch (error) {
    next(error);
  }
};

const deleteCategory = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [existing] = await pool.execute('SELECT * FROM categories WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    const [books] = await pool.execute('SELECT id FROM books WHERE category_id = ?', [id]);
    if (books.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot delete category. Books are assigned to this category. Please reassign or delete those books first.' 
      });
    }

    await pool.execute('DELETE FROM categories WHERE id = ?', [id]);

    res.json({ success: true, message: 'Category deleted successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = { getCategories, createCategory, updateCategory, deleteCategory };