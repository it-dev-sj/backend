const express = require('express');
const router = express.Router();
const canvasController = require('../controllers/canvas.controller');
const { protect } = require('../middleware/auth.middleware');

// Get Canvas modules
router.get('/modules', protect, canvasController.getModules);

// Add Canvas module
router.post('/modules/add', protect, canvasController.addModule);

router.post('/file/session', protect, canvasController.fileUploadSession);

router.get('/file/:id', protect, canvasController.getFile);

module.exports = router;