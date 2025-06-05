const express = require('express');
const router = express.Router();
const mfaController = require('../controllers/mfa.controller');
const { protect } = require('../middleware/auth.middleware');

// MFA routes
router.post('/setup', protect, mfaController.setupMFA);
router.post('/verify', protect, mfaController.verifyAndEnableMFA);
router.post('/verify-token', mfaController.verifyMFAToken);
router.post('/disable', protect, mfaController.disableMFA);

module.exports = router; 