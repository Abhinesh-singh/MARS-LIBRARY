const express = require('express');
const router = express.Router();
const { 
  getOverdueReport, 
  getMostBorrowedReport, 
  getTransactionReport, 
  getMemberStatistics,
  getAvailableBooksReport
} = require('../controllers/reportController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { query } = require('express-validator');

router.get('/overdue', authenticateToken, getOverdueReport);

router.get('/most-borrowed', authenticateToken, [
  query('limit').optional().isInt({ min: 1, max: 100 })
], getMostBorrowedReport);

router.get('/transactions', authenticateToken, [
  query('start_date').optional().isISO8601().withMessage('Invalid start date'),
  query('end_date').optional().isISO8601().withMessage('Invalid end date'),
  query('category').optional().isInt({ min: 1 }),
  query('status').optional().isIn(['issued', 'returned', 'overdue'])
], getTransactionReport);

router.get('/member-statistics', authenticateToken, getMemberStatistics);

router.get('/available-books', authenticateToken, [
  query('category').optional().isInt({ min: 1 })
], getAvailableBooksReport);

module.exports = router;