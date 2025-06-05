const Chat = require('../models/chat.model');
const User = require('../models/user.model');

// Get all users except current user
exports.getAllUsers = async (req, res) => {
  const users = await User.find({ _id: { $ne: req.user._id } }).select('_id fullName email avatar');
  res.json(users);
};

// Get all chats for current user
exports.getUserChats = async (req, res) => {
  const chats = await Chat.find({ members: req.user._id })
    .populate('members', '_id fullName email avatar')
    .select('-__v');
  res.json(chats);
};

// Get or create a private chat between two users
exports.getOrCreatePrivateChat = async (req, res) => {
  const { userId } = req.body;
  let chat = await Chat.findOne({
    type: 'private',
    members: { $all: [req.user._id, userId], $size: 2 }
  });
  if (!chat) {
    chat = await Chat.create({ type: 'private', admins: [req.user._id], members: [req.user._id, userId] });
  }
  chat = await chat.populate('members', '_id fullName email avatar');
  res.json(chat);
};

// Create a group chat
exports.createGroupChat = async (req, res) => {
  const { groupName, memberIds } = req.body;

  console.log(memberIds, groupName);
  const chat = await Chat.create({
    type: 'group',
    groupName,
    members: [req.user._id, ...memberIds],
    admins: [req.user._id]
  });
  await chat.populate('members', '_id fullName email avatar');
  res.json(chat);
};

// Invite user to group chat
exports.inviteToGroup = async (req, res) => {
  const { chatId, userId } = req.body;
  const chat = await Chat.findById(chatId);
  if (!chat || chat.type !== 'group') return res.status(404).json({ error: 'Group not found' });
  if (!chat.admins.includes(req.user._id)) return res.status(403).json({ error: 'Not an admin' });
  if (!chat.members.includes(userId)) {
    chat.members.push(userId);
    await chat.save();
  }
  await chat.populate('members', '_id fullName email avatar');
  res.json(chat);
}; 