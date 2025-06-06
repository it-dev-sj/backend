const Message = require('../models/message.model');
const path = require('path');
const Chat = require('../models/chat.model');

// Edit a message
exports.editMessage = async (req, res) => {
  const { id } = req.params;
  const { content } = req.body;
  const message = await Message.findById(id);
  if (!message) return res.status(404).json({ error: 'Message not found' });
  if (String(message.senderId) !== String(req.user._id)) return res.status(403).json({ error: 'Not allowed' });
  message.content = content;
  await message.save();
  res.json(message);
};

// Delete a message
exports.deleteMessage = async (req, res) => {
  const { id } = req.params;
  const message = await Message.findById(id);
  if (!message) return res.status(404).json({ error: 'Message not found' });
  if (String(message.senderId) !== String(req.user._id)) return res.status(403).json({ error: 'Not allowed' });
  await message.deleteOne();
  res.json({ success: true });
};

// Forward a message
exports.forwardMessage = async (req, res) => {
  const { id } = req.params;
  const { recipientId, roomId } = req.body;
  const original = await Message.findById(id);
  if (!original) return res.status(404).json({ error: 'Original message not found' });
  const newMsg = await Message.create({
    senderId: req.user._id,
    recipientId: recipientId || null,
    roomId: roomId || null,
    content: original.content,
    forwardedFrom: { message: original._id, user: original.senderId }
  });
  res.json(newMsg);
};

// Upload a file (image, audio, etc.)
exports.uploadFile = async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  console.log(req.file);
  const fileUrl = req.file.path;
  res.json({ url: fileUrl, originalname: req.file.originalname });
};

// Get a file
exports.getFile = async (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(__dirname, '../../uploads/messages', filename);
  res.sendFile(filePath);
};

// Pin or unpin a message
exports.pinMessage = async (req, res) => {
  const { id } = req.params;
  const { pin } = req.body;
  const msg = await Message.findById(id);
  if (!msg) return res.status(404).json({ error: 'Message not found' });
  msg.pinned = !!pin;
  await msg.save();
  res.json(msg);
};

// Star or unstar a message
exports.starMessage = async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;
  const { star } = req.body;
  const msg = await Message.findById(id);
  if (!msg) return res.status(404).json({ error: 'Message not found' });
  if (star) {
    if (!msg.starredBy.includes(userId)) msg.starredBy.push(userId);
  } else {
    msg.starredBy = msg.starredBy.filter(u => String(u) !== String(userId));
  }
  await msg.save();
  res.json(msg);
};

exports.getMessages = async (req, res) => {
  try {
    const { chatId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    // First check if this is a group chat
    const isGroupChat = await Chat.findOne({ _id: chatId, type: 'group' });
    
    let query;
    if (isGroupChat) {
      // For group chats, just get messages by roomId
      query = { roomId: chatId };
    } else {
      // For private chats, get messages between the two users
      query = {
        $or: [
          { 
            $and: [
              { senderId: req.user._id },
              { recipientId: chatId }
            ]
          },
          {
            $and: [
              { senderId: chatId },
              { recipientId: req.user._id }
            ]
          }
        ]
      };
    }

    const messages = await Message.find(query)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)

    const total = await Message.countDocuments(query);

    res.json({
      messages: messages.reverse(),
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error in getMessages:', error);
    res.status(500).json({ message: error.message });
  }
}; 