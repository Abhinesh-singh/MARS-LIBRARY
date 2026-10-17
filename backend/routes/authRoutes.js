const express = require('express');
const router = express.Router();
const { login, register, getProfile } = require('../controllers/authController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { body } = require('express-validator');

router.post('/login', [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required')
], login);

router.post('/register', [
  body('username').isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], register);

router.get('/profile', authenticateToken, getProfile);

module.exports = router;