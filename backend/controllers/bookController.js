const pool = require('../config/database');
const { validationResult } = require('express-validator');


const getBooks = async (req, res, next) => {
  try {
    const { search, category, availability } = req.query;

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

    const [books] = await pool.query(
      `
      SELECT
        b.id, b.title, b.author, b.isbn, b.category_id,
        b.total_copies, b.available_copies, b.published_year, b.publisher,
        c.name AS category_name
      FROM books b
      LEFT JOIN categories c ON b.category_id = c.id
      ${whereClause}
      ORDER BY b.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
      `,
      params
    );

    const [total] = await pool.execute(
      `SELECT COUNT(*) AS count FROM books b ${whereClause}`,
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
