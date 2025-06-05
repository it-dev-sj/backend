const express = require('express');
const router = express.Router();
const passport = require('passport');
const authController = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth.middleware');
const { authValidation } = require('../middleware/validation.middleware');

// Public routes
router.post('/register', authValidation.register, authController.register);
router.post('/login', authValidation.login, authController.login);
router.post('/login/token', authController.loginWithToken);
router.get('/verify-email', authController.verifyEmail);
router.post('/resend-verification', authController.resendVerificationEmail);
router.get('/google', authController.googleAuth);
router.get('/google/callback', authController.googleAuthCallback);
// Forgot Password routes
router.post('/forgot-password', authValidation.forgotPassword, authController.forgotPassword);
router.post('/reset-password', authValidation.resetPassword, authController.resetPassword);

// Protected routes
router.get('/me', protect, authController.getMe);

module.exports = router; 