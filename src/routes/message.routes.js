const express = require('express');
const router = express.Router();
const messageController = require('../controllers/message.controller');
const { protect } = require('../middleware/auth.middleware');
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../../uploads/messages'));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // ✅ Set to 2MB
});

// Edit a message
router.patch('/:id', protect, messageController.editMessage);

// Delete a message
router.delete('/:id', protect, messageController.deleteMessage);

// Forward a message
router.post('/:id/forward', protect, messageController.forwardMessage);

// Upload file
router.post('/upload', protect, upload.single('file'), messageController.uploadFile);

// Get file
router.get('/getFile/:filename', messageController.getFile);

// Pin/unpin message
router.post('/:id/pin', protect, messageController.pinMessage);

// Star/unstar message
router.post('/:id/star', protect, messageController.starMessage);

// Get messages
router.get('/:chatId', protect, messageController.getMessages);

module.exports = router; 
