
const pool = require('../config/database');
const { validationResult } = require('express-validator');

// Generate a unique library member ID
const generateMemberId = async () => {
  const [result] = await pool.query(`
    SELECT MAX(CAST(SUBSTRING(member_id, 4) AS UNSIGNED)) AS max_id
    FROM members
    WHERE member_id LIKE 'LIB%'
  `);

  const nextId = Number(result[0].max_id || 0) + 1;
  return `LIB${String(nextId).padStart(3, '0')}`;
};

// Get all members with search, status filter and pagination
const getMembers = async (req, res, next) => {
  try {
    const { search, status } = req.query;

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(req.query.limit, 10) || 10)
    );
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (search) {
      whereClause += ` AND (
        full_name LIKE ?
        OR member_id LIKE ?
        OR email LIKE ?
        OR phone LIKE ?
      )`;

      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    if (status) {
      whereClause += ' AND status = ?';
      params.push(status);
    }

    // LIMIT and OFFSET use validated integers
    const [members] = await pool.query(
      `SELECT
        id, member_id, full_name, email, phone,
        address, status, created_at
       FROM members
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    const [total] = await pool.query(
      `SELECT COUNT(*) AS count
       FROM members
       ${whereClause}`,
      params
    );

    const totalCount = Number(total[0].count);

    res.json({
      success: true,
      data: members,
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

// Get one member and their transaction history
const getMemberById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [members] = await pool.query(
      `SELECT
        id, member_id, full_name, email, phone,
        address, status, created_at
       FROM members
       WHERE id = ?`,
      [id]
    );

    if (members.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    const [transactions] = await pool.query(
      `SELECT
        t.id, t.issue_date, t.due_date, t.return_date,
        t.status, t.fine_amount,
        b.title AS book_title,
        b.author AS book_author
       FROM transactions t
       JOIN books b ON t.book_id = b.id
       WHERE t.member_id = ?
       ORDER BY t.issue_date DESC`,
      [id]
    );

    res.json({
      success: true,
      data: { ...members[0], transactions }
    });
  } catch (error) {
    next(error);
  }
};

// Create a member
const createMember = async (req, res, next) => {
  try {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { full_name, email, phone, address } = req.body;

    const [existing] = await pool.query(
      'SELECT id FROM members WHERE email = ?',
      [email]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Email already registered'
      });
    }

    const memberId = await generateMemberId();

    const [result] = await pool.query(
      `INSERT INTO members
        (member_id, full_name, email, phone, address, status)
       VALUES (?, ?, ?, ?, ?, 'active')`,
      [
        memberId,
        full_name,
        email,
        phone || null,
        address || null
      ]
    );

    const [newMember] = await pool.query(
      `SELECT
        id, member_id, full_name, email, phone,
        address, status, created_at
       FROM members
       WHERE id = ?`,
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      message: 'Member registered successfully',
      data: newMember[0]
    });
  } catch (error) {
    next(error);
  }
};

// Update a member
const updateMember = async (req, res, next) => {
  try {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const { full_name, email, phone, address, status } = req.body;

    const [existing] = await pool.query(
      'SELECT * FROM members WHERE id = ?',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    if (email !== existing[0].email) {
      const [emailCheck] = await pool.query(
        'SELECT id FROM members WHERE email = ? AND id <> ?',
        [email, id]
      );

      if (emailCheck.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'Email already registered'
        });
      }
    }

    await pool.query(
      `UPDATE members
       SET full_name = ?, email = ?, phone = ?,
           address = ?, status = ?
       WHERE id = ?`,
      [
        full_name,
        email,
        phone || null,
        address || null,
        status || existing[0].status || 'active',
        id
      ]
    );

    const [updatedMember] = await pool.query(
      `SELECT
        id, member_id, full_name, email, phone,
        address, status, created_at
       FROM members
       WHERE id = ?`,
      [id]
    );

    res.json({
      success: true,
      message: 'Member updated successfully',
      data: updatedMember[0]
    });
  } catch (error) {
    next(error);
  }
};

// Delete a member if they have no currently issued books
const deleteMember = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [existing] = await pool.query(
      'SELECT id FROM members WHERE id = ?',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    const [transactions] = await pool.query(
      `SELECT id
       FROM transactions
       WHERE member_id = ? AND status = 'issued'
       LIMIT 1`,
      [id]
    );

    if (transactions.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete member. They have active borrowed books.'
      });
    }

    await pool.query(
      'DELETE FROM members WHERE id = ?',
      [id]
    );

    res.json({
      success: true,
      message: 'Member deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Export controller functions
module.exports = {
  getMembers,
  getMemberById,
  createMember,
  updateMember,
  deleteMember
};
