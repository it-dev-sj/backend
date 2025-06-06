const express = require('express');
const router = express.Router();
const canvasController = require('../controllers/canvas.controller');
const { protect } = require('../middleware/auth.middleware');

router.get('/modules', protect, canvasController.getModules);

router.post('/modules/add', protect, canvasController.addModule);

router.post('/modules/item/add', protect, canvasController.addModuleItem);

router.post('/file/session', protect, canvasController.fileUploadSession);

router.get('/file/:id', protect, canvasController.getFile);

router.delete('/file/:id', protect, canvasController.getFile);

module.exports = router;