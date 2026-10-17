const pool = require('../config/database');
const { validationResult } = require('express-validator');

const generateMemberId = async () => {
  const [result] = await pool.execute('SELECT MAX(CAST(SUBSTRING(member_id, 4) AS UNSIGNED)) as max_id FROM members WHERE member_id LIKE "LIB%"');
  const nextId = (result[0].max_id || 0) + 1;
  return `LIB${String(nextId).padStart(3, '0')}`;
};

const getMembers = async (req, res, next) => {
  try {
    const { search, status, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (search) {
      whereClause += ' AND (full_name LIKE ? OR member_id LIKE ? OR email LIKE ? OR phone LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (status) {
      whereClause += ' AND status = ?';
      params.push(status);
    }

    const [members] = await pool.execute(`
      SELECT id, member_id, full_name, email, phone, address, status, created_at
      FROM members
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), parseInt(offset)]);

    const [total] = await pool.execute(`
      SELECT COUNT(*) as count FROM members ${whereClause}
    `, params);

    res.json({
      success: true,
      data: members,
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

const getMemberById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [members] = await pool.execute(`
      SELECT id, member_id, full_name, email, phone, address, status, created_at
      FROM members
      WHERE id = ?
    `, [id]);

    if (members.length === 0) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    const [transactions] = await pool.execute(`
      SELECT 
        t.id, t.issue_date, t.due_date, t.return_date, t.status, t.fine_amount,
        b.title as book_title, b.author as book_author
      FROM transactions t
      JOIN books b ON t.book_id = b.id
      WHERE t.member_id = ?
      ORDER BY t.issue_date DESC
    `, [id]);

    res.json({ success: true, data: { ...members[0], transactions } });
  } catch (error) {
    next(error);
  }
};

const createMember = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { full_name, email, phone, address } = req.body;

    const [existing] = await pool.execute('SELECT id FROM members WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }

    const memberId = await generateMemberId();

    const [result] = await pool.execute(`
      INSERT INTO members (member_id, full_name, email, phone, address, status)
      VALUES (?, ?, ?, ?, ?, 'active')
    `, [memberId, full_name, email, phone || null, address || null]);

    const [newMember] = await pool.execute(`
      SELECT id, member_id, full_name, email, phone, address, status, created_at
      FROM members
      WHERE id = ?
    `, [result.insertId]);

    res.status(201).json({ success: true, message: 'Member registered successfully', data: newMember[0] });
  } catch (error) {
    next(error);
  }
};

const updateMember = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { id } = req.params;
    const { full_name, email, phone, address, status } = req.body;

    const [existing] = await pool.execute('SELECT * FROM members WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    if (email !== existing[0].email) {
      const [emailCheck] = await pool.execute('SELECT id FROM members WHERE email = ? AND id != ?', [email, id]);
      if (emailCheck.length > 0) {
        return res.status(409).json({ success: false, message: 'Email already registered' });
      }
    }

    await pool.execute(`
      UPDATE members 
      SET full_name = ?, email = ?, phone = ?, address = ?, status = ?
      WHERE id = ?
    `, [full_name, email, phone || null, address || null, status || 'active', id]);

    const [updatedMember] = await pool.execute(`
      SELECT id, member_id, full_name, email, phone, address, status, created_at
      FROM members
      WHERE id = ?
    `, [id]);

    res.json({ success: true, message: 'Member updated successfully', data: updatedMember[0] });
  } catch (error) {
    next(error);
  }
};

const deleteMember = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [existing] = await pool.execute('SELECT id FROM members WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    const [transactions] = await pool.execute('SELECT id FROM transactions WHERE member_id = ? AND status = "issued"', [id]);
    if (transactions.length > 0) {
      return res.status(400).json({ success: false, message: 'Cannot delete member. They have active borrowed books.' });
    }

    await pool.execute('DELETE FROM members WHERE id = ?', [id]);

    res.json({ success: true, message: 'Member deleted successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = { getMembers, getMemberById, createMember, updateMember, deleteMember };