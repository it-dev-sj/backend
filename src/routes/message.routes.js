const express = require('express');
const router = express.Router();
const messageController = require('../controllers/message.controller');
const { protect } = require('../middleware/auth.middleware');
const multer = require('multer');
const path = require('path');
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// 🔐 Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// 📦 Multer storage for Cloudinary
const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const ext = path.extname(file.originalname); // e.g., '.xlsx'
    const baseName = path.basename(file.originalname, ext); // e.g., 'report'
    const safeName = baseName.replace(/\s+/g, '_'); // replace spaces with underscores

    return {
      folder: 'uploads',
      resource_type: 'auto',
      public_id: `${safeName}${ext}`, // keep full filename with extension
    };
  },
});

const upload = multer({ storage });

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
