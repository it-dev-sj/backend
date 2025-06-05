const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chat.controller');
const { protect } = require('../middleware/auth.middleware');

// Get all users (contacts)
router.get('/users', protect, chatController.getAllUsers);

// Get all chats for current user
router.get('/', protect, chatController.getUserChats);

// Get or create a private chat
router.post('/private', protect, chatController.getOrCreatePrivateChat);

// Create a group chat
router.post('/group', protect, chatController.createGroupChat);

// Invite user to group chat
router.post('/group/invite', protect, chatController.inviteToGroup);

module.exports = router; 