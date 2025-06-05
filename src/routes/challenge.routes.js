const express = require('express');
const router = express.Router();
const challengeController = require('../controllers/challenge.controller');
const { protect } = require('../middleware/auth.middleware');
const { challengeValidation } = require('../middleware/validation.middleware');

// Get all challenges
router.get('/', protect, challengeController.getAll);

// Get challenge by ID
router.get('/:id', protect, challengeController.getById);

// Create new challenge
router.post('/', protect, challengeValidation.create, challengeController.create);

module.exports = router; 