const express = require('express');
const router = express.Router();
const { getCategories, createCategory, updateCategory, deleteCategory } = require('../controllers/categoryController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { body, param, query } = require('express-validator');

const categoryValidation = [
  body('name').trim().notEmpty().withMessage('Category name is required'),
  body('description').optional().trim()
];

router.get('/', authenticateToken, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('search').optional().trim()
], getCategories);

router.post('/', authenticateToken, categoryValidation, createCategory);

router.put('/:id', authenticateToken, [
  param('id').isInt({ min: 1 }).withMessage('Valid category ID required'),
  ...categoryValidation
], updateCategory);

router.delete('/:id', authenticateToken, [
  param('id').isInt({ min: 1 }).withMessage('Valid category ID required')
], deleteCategory);

module.exports = router;