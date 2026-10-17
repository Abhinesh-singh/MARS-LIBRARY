const express = require('express');
const router = express.Router();
const { getMembers, getMemberById, createMember, updateMember, deleteMember } = require('../controllers/memberController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { body, param, query } = require('express-validator');

const memberValidation = [
  body('full_name').trim().notEmpty().withMessage('Full name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('phone').optional().trim(),
  body('address').optional().trim(),
  body('status').optional().isIn(['active', 'inactive']).withMessage('Invalid status')
];

router.get('/', authenticateToken, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('search').optional().trim(),
  query('status').optional().isIn(['active', 'inactive'])
], getMembers);

router.get('/:id', authenticateToken, [
  param('id').isInt({ min: 1 }).withMessage('Valid member ID required')
], getMemberById);

router.post('/', authenticateToken, memberValidation, createMember);

router.put('/:id', authenticateToken, [
  param('id').isInt({ min: 1 }).withMessage('Valid member ID required'),
  ...memberValidation
], updateMember);

router.delete('/:id', authenticateToken, [
  param('id').isInt({ min: 1 }).withMessage('Valid member ID required')
], deleteMember);

module.exports = router;