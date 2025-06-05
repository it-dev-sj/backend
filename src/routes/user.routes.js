const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { protect } = require('../middleware/auth.middleware');
const { userValidation } = require('../middleware/validation.middleware');

// Get avatar
router.get('/avatar/:filename', userController.getAvatar);

// Get user profile
router.get('/profile', protect, userController.getProfile);

// Update user profile
router.put('/profile', userValidation.updateProfile, userController.updateProfile);

// Upload avatar
router.post('/avatar', userController.uploadAvatar);

// Delete user profile
router.delete('/profile', protect, userController.deleteProfile);

module.exports = router; 