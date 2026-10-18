
const pool = require('../config/database');
const { validationResult } = require('express-validator');

// GET all categories with search and pagination
const getCategories = async (req, res, next) => {
  try {
    const search = String(req.query.search || '').trim();

    // Validate pagination values
    const parsedPage = Number(req.query.page);
    const parsedLimit = Number(req.query.limit);

    const page =
      Number.isSafeInteger(parsedPage) && parsedPage > 0
        ? parsedPage
        : 1;

    const limit =
      Number.isSafeInteger(parsedLimit) && parsedLimit > 0
        ? Math.min(parsedLimit, 100)
        : 10;

    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1 = 1';
    const params = [];

    if (search) {
      whereClause += ' AND (c.name LIKE ? OR c.description LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm);
    }

    // Use validated integer LIMIT/OFFSET values in the query.
    const [categories] = await pool.query(
      `SELECT
          c.id,
          c.name,
          c.description,
          c.created_at,
          COUNT(b.id) AS book_count
       FROM categories c
       LEFT JOIN books b ON c.id = b.category_id
       ${whereClause}
       GROUP BY c.id, c.name, c.description, c.created_at
       ORDER BY c.name ASC
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    const [totalRows] = await pool.query(
      `SELECT COUNT(*) AS count
       FROM categories c
       ${whereClause}`,
      params
    );

    const total = Number(totalRows[0].count);

    res.json({
      success: true,
      data: categories,
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

// CREATE category
const createCategory = async (req, res, next) => {
  try {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const name =
      typeof req.body.name === 'string'
        ? req.body.name.trim()
        : '';

    const description =
      typeof req.body.description === 'string'
        ? req.body.description.trim()
        : '';

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Category name is required.'
      });
    }

    const [existing] = await pool.query(
      'SELECT id FROM categories WHERE name = ?',
      [name]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Category name already exists.'
      });
    }

    const [result] = await pool.query(
      'INSERT INTO categories (name, description) VALUES (?, ?)',
      [name, description || null]
    );

    const [newCategory] = await pool.query(
      `SELECT
          c.id,
          c.name,
          c.description,
          c.created_at,
          COUNT(b.id) AS book_count
       FROM categories c
       LEFT JOIN books b ON c.id = b.category_id
       WHERE c.id = ?
       GROUP BY c.id, c.name, c.description, c.created_at`,
      [result.insertId]
    );

    return res.status(201).json({
      success: true,
      message: 'Category added successfully.',
      data: newCategory[0]
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message: 'Category name already exists.'
      });
    }

    return next(error);
  }
};

// UPDATE category
const updateCategory = async (req, res, next) => {
  try {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id < 1) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category ID.'
      });
    }

    const name =
      typeof req.body.name === 'string'
        ? req.body.name.trim()
        : '';

    const description =
      typeof req.body.description === 'string'
        ? req.body.description.trim()
        : '';

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Category name is required.'
      });
    }

    const [existing] = await pool.query(
      'SELECT id FROM categories WHERE id = ?',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Category not found.'
      });
    }

    const [nameCheck] = await pool.query(
      'SELECT id FROM categories WHERE name = ? AND id != ?',
      [name, id]
    );

    if (nameCheck.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Category name already exists.'
      });
    }

    await pool.query(
      'UPDATE categories SET name = ?, description = ? WHERE id = ?',
      [name, description || null, id]
    );

    const [updatedCategory] = await pool.query(
      `SELECT
          c.id,
          c.name,
          c.description,
          c.created_at,
          COUNT(b.id) AS book_count
       FROM categories c
       LEFT JOIN books b ON c.id = b.category_id
       WHERE c.id = ?
       GROUP BY c.id, c.name, c.description, c.created_at`,
      [id]
    );

    return res.json({
      success: true,
      message: 'Category updated successfully.',
      data: updatedCategory[0]
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message: 'Category name already exists.'
      });
    }

    return next(error);
  }
};

// DELETE category
const deleteCategory = async (req, res, next) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id < 1) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category ID.'
      });
    }

    const [existing] = await pool.query(
      'SELECT id FROM categories WHERE id = ?',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Category not found.'
      });
    }

    const [books] = await pool.query(
      'SELECT id FROM books WHERE category_id = ? LIMIT 1',
      [id]
    );

    if (books.length > 0) {
      return res.status(400).json({
        success: false,
        message:
          'Cannot delete category because books are assigned to it. Reassign or remove those books first.'
      });
    }

    await pool.query(
      'DELETE FROM categories WHERE id = ?',
      [id]
    );

    return res.json({
      success: true,
      message: 'Category deleted successfully.'
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory
};
