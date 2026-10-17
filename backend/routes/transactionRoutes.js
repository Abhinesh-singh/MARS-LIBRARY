const express = require('express');
const router = express.Router();
const { getTransactions, issueBook, returnBook } = require('../controllers/transactionController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { body, param, query } = require('express-validator');

router.get('/', authenticateToken, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(['issued', 'returned', 'overdue'])
], getTransactions);

router.post('/issue', authenticateToken, [
  body('book_id').isInt({ min: 1 }).withMessage('Valid book ID required'),
  body('member_id').isInt({ min: 1 }).withMessage('Valid member ID required'),
  body('issue_date').optional().isISO8601().withMessage('Invalid issue date'),
  body('due_date').optional().isISO8601().withMessage('Invalid due date')
], issueBook);

router.put('/:id/return', authenticateToken, [
  param('id').isInt({ min: 1 }).withMessage('Valid transaction ID required'),
  body('return_date').optional().isISO8601().withMessage('Invalid return date')
], returnBook);

module.exports = router;