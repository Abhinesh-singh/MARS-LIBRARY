const express = require('express');
const router = express.Router();
const { getBooks, getBookById, createBook, updateBook, deleteBook } = require('../controllers/bookController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { body, param, query } = require('express-validator');

const bookValidation = [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('author').trim().notEmpty().withMessage('Author is required'),
  body('isbn').trim().notEmpty().withMessage('ISBN is required'),
  body('category_id').isInt({ min: 1 }).withMessage('Valid category is required'),
  body('total_copies').optional().isInt({ min: 1 }).withMessage('Total copies must be at least 1'),
  body('published_year').optional().isInt({ min: 1000, max: new Date().getFullYear() }).withMessage('Invalid year'),
  body('publisher').optional().trim()
];

router.get('/', authenticateToken, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('search').optional().trim(),
  query('category').optional().isInt({ min: 1 }),
  query('availability').optional().isIn(['available', 'unavailable'])
], getBooks);

router.get('/:id', authenticateToken, [
  param('id').isInt({ min: 1 }).withMessage('Valid book ID required')
], getBookById);

router.post('/', authenticateToken, bookValidation, createBook);

router.put('/:id', authenticateToken, [
  param('id').isInt({ min: 1 }).withMessage('Valid book ID required'),
  ...bookValidation
], updateBook);

router.delete('/:id', authenticateToken, [
  param('id').isInt({ min: 1 }).withMessage('Valid book ID required')
], deleteBook);

module.exports = router;