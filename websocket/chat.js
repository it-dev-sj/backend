const { Server } = require('socket.io');
const Message = require('../src/models/message.model');
const jwt = require('jsonwebtoken');
const User = require('../src/models/user.model');
const Chat = require('../src/models/chat.model');
// Track online users with timestamps
const onlineUsers = new Map();

function setupChat(server) {
  const io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || '*',
      methods: ['GET', 'POST']
    },
    pingTimeout: 60000,
    pingInterval: 25000
  });

  // Middleware to authenticate socket connections
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      // Handle both token structures
      socket.userId = decoded.id || (decoded.data && decoded.data.user && decoded.data.user.id);
      if (!socket.userId) {
        return next(new Error('Invalid token structure'));
      }
      next();
    } catch (error) {
      return next(new Error('Authentication error'));
    }
  });

  // Helper function to broadcast online users
  const broadcastOnlineUsers = () => {
    io.emit('user_online', Array.from(onlineUsers.keys()));
  };

  // Helper function to handle errors
  const handleError = (socket, error, event) => {
    console.log(`Socket error in ${event}:`, error);
    socket.emit('error', { message: 'An error occurred', event });
  };

  const getUnreadCountsForUser = async (userId) => {
    const counts = {};
    
    // Get all chats where user is a member
    const chats = await Chat.find({ members: userId });
    
    for (const chat of chats) {
      if (chat.type === 'group') {
        // For group chats, count unread messages from other members
        const count = await Message.countDocuments({
          roomId: chat._id,
          senderId: { $ne: userId },
          status: { $ne: 'read' }
        });
        counts[chat._id] = count;
      } else {
        // For private chats, count unread messages from the other user
        const otherId = chat.members.find(id => id.toString() !== userId.toString());
        const count = await Message.countDocuments({
          $or: [
            { senderId: otherId, recipientId: userId, status: { $ne: 'read' } }
          ]
        });
        counts[chat._id] = count;
      }
    }
    
    return counts;
  };

  const emitUnreadCounts = async (userId, io) => {
    const counts = await getUnreadCountsForUser(userId);
    if(userId){
      io.to(userId.toString()).emit('unread_counts', { counts });
    }    
  };

  io.on('connection', (socket) => {
    console.log(`New socket connection: ${socket.id} for user ${socket.userId}`);
    
    socket.on('get_online_users', () => {
      broadcastOnlineUsers()
    });

    // User presence
    socket.on('user_online', (userId) => {
      try {
        if (userId !== socket.userId) {
          throw new Error('Unauthorized user ID');
        }
        onlineUsers.set(userId, Date.now());
        broadcastOnlineUsers();
        console.log(`User ${userId} is now online`);
      } catch (error) {
        handleError(socket, error, 'user_online');
      }
    });

    socket.on('disconnect', async () => {
      try {
        if (socket.userId) {
          onlineUsers.delete(socket.userId);
          socket.leave(socket.userId);
          const chats = await Chat.find({ members: socket.userId, type: 'group' })
            .populate('members', '_id fullName email avatar')
            .select('-__v');
          chats.forEach(chat => {
            console.log(`User ${socket.userId} left room ${chat._id.toString()}`);
            socket.leave(chat._id.toString());
          });
          broadcastOnlineUsers();
          console.log(`User ${socket.userId} disconnected`);
        }
      } catch (error) {
        handleError(socket, error, 'disconnect');
      }
    });

    socket.on('register_user', async (userId) => {
      try {
        if (userId !== socket.userId) {
          throw new Error('Unauthorized user ID');
        }
        socket.join(userId);
        await User.findById(userId).then(async (user) => {
          if (user) {
            const chats = await Chat.find({ members: user._id, type: 'group' })
              .populate('members', '_id fullName email avatar')
              .select('-__v');
            chats.forEach(chat => {
              console.log(`User ${socket.userId} joined room ${chat._id.toString()}`);
              socket.join(chat._id.toString());
            });
          }
        });
        onlineUsers.set(userId, Date.now());
        broadcastOnlineUsers();
        console.log(`User ${userId} registered`);
      } catch (error) {
        handleError(socket, error, 'register_user');
      }
    });

    // Send current online users on connect
    socket.emit('user_online', Array.from(onlineUsers.keys()));

    socket.on('create_group', async ({ roomId, groupName, memberIds }) => {
      socket.join(roomId);

      const chat = await Chat.findById(roomId);
      if(chat) {
        memberIds.forEach(memberId => {
          if(Array.from(onlineUsers.keys()).includes(memberId)) {
              console.log(memberId, "user online");
              socket.to(memberId).emit('new_group_created', chat);
            }
          });
        }
      });

    // Join a group chat room
    socket.on('join_room', (roomId) => {
      try {
        socket.join(roomId);
        console.log(`User ${socket.userId} joined room ${roomId}`);
      } catch (error) {
        handleError(socket, error, 'join_room');
      }
    });

    // Leave a group chat room
    socket.on('leave_room', (roomId) => {
      try {
        socket.leave(roomId);
        console.log(`User ${socket.userId} left room ${roomId}`);
      } catch (error) {
        handleError(socket, error, 'leave_room');
      }
    });

    // Send a group message
    socket.on('send_group_message', async ({ roomId, senderId, content, fileUrl, fileType, originalname }) => {
      try {
        const message = await Message.create({ 
          senderId, 
          roomId, 
          content,
          fileUrl,
          fileType,
          status: 'sent',
          originalname
        });
        io.to(roomId).emit('new_group_message', message);
        // Emit unread counts to all members except sender
        const chat = await Chat.findById(roomId);
        if (chat) {
          for (const memberId of chat.members) {
            if (memberId.toString() !== senderId.toString()) {
              console.log(memberId, "emit unread counts");
              await emitUnreadCounts(memberId, io);
            }
          }
        }
        console.log(`New group message in room ${roomId} from user ${senderId}`);
      } catch (error) {
        handleError(socket, error, 'send_group_message');
      }
    });

    // Send a private message
    socket.on('send_private_message', async ({ senderId, content, recipientId, fileUrl, fileType, originalname }) => {
      console.log('send_private_message', senderId, content, recipientId, fileUrl, fileType, originalname);
      try {
        const message = await Message.create({ 
          senderId, 
          recipientId, 
          content,
          fileUrl,
          fileType,
          status: 'sent',
          originalname
        });
        socket.to(recipientId).emit('new_private_message', message);
        socket.emit('new_private_message', message);
        // Emit unread counts to recipient
        await emitUnreadCounts(recipientId, io);
        console.log(`New private message from ${senderId} to ${recipientId}`);
      } catch (error) {
        handleError(socket, error, 'send_private_message');
      }
    });

    socket.on('create_private', async ({ roomId, userId }) => {
      console.log('create_private', roomId, userId);
      const chat = await Chat.findById(roomId).populate('members', '_id fullName email avatar');
      if(chat) {
        if(onlineUsers.has(userId)) {
          socket.to(userId).emit('new_private_created', chat);
        }
      }
    });

    // For private messaging, join a room named after the user ID
    // socket.on('join_private', (userId) => {
    //   try {
    //     socket.join(userId);
    //     console.log(`User ${socket.userId} joined private room ${userId}`);
    //   } catch (error) {
    //     handleError(socket, error, 'join_private');
    //   }
    // });

    // Typing indicator
    socket.on('typing', ({ roomId, userId }) => {
      try {
        if (roomId) {
          socket.to(roomId).emit('typing', { userId });
        }
      } catch (error) {
        handleError(socket, error, 'typing');
      }
    });

    socket.on('stop_typing', ({ roomId, userId }) => {
      try {
        if (roomId) {
          socket.to(roomId).emit('stop_typing', { userId });
        }
      } catch (error) {
        handleError(socket, error, 'stop_typing');
      }
    });

    // Message delivered/read status
    socket.on('message_delivered', async ({ messageId, userId, roomId }) => {
      try {
        const msg = await Message.findById(messageId);
        if (msg && msg.status !== 'delivered') {
          msg.status = 'delivered';
          await msg.save();
          if(roomId) {
            io.to(roomId).emit('message_status', { messageId, status: 'delivered' });
          } else {
            socket.to(msg.senderId.toString()).emit('message_status', { messageId, status: 'delivered' });
          }
          console.log(`Message ${messageId} marked as delivered`);
        }
      } catch (error) {
        handleError(socket, error, 'message_delivered');
      }
    });

    emitUnreadCounts(socket.userId, io);

    // After message events, emit unread counts
    socket.on('message_read', async ({ messageId, userId, roomId }) => {
      console.log(messageId, "ids")
      try {
        const msg = await Message.findById(messageId);
        if (msg && msg.status !== 'read') {
          console.log("read by someone")
          msg.status = 'read';
          await msg.save();
          if(roomId) {
            io.to(roomId).emit('message_status', { messageId, status: 'read' });
          } else {
            socket.emit('message_status', { messageId, status: 'read' });
            socket.to(msg.senderId.toString()).emit('message_status', { messageId, status: 'read' });
          }
          // Emit unread counts to both sender and recipient
          if(roomId){
            const chat = await Chat.findById(roomId);
            chat.members.forEach(async (memberId) => {
              if(memberId.toString() !== msg.senderId.toString() && onlineUsers.has(memberId.toString())) {
                await emitUnreadCounts(memberId, io);
              }
            })
          } else {
            await emitUnreadCounts(msg.recipientId, io);
          }
          console.log(`Message ${messageId} marked as read`);
        }
      } catch (error) {
        handleError(socket, error, 'message_read');
      }
    });

    // Reactions
    socket.on('add_reaction', async ({ messageId, userId, emoji }) => {
      try {
        const msg = await Message.findById(messageId);
        if (msg) {
          msg.reactions = msg.reactions.filter(r => String(r.userId) !== String(userId));
          msg.reactions.push({ userId, emoji });
          await msg.save();
          io.to(msg.roomId || userId).emit('reactions_update', { messageId, reactions: msg.reactions });
          console.log(`Reaction added to message ${messageId} by user ${userId}`);
        }
      } catch (error) {
        handleError(socket, error, 'add_reaction');
      }
    });

    socket.on('remove_reaction', async ({ messageId, userId }) => {
      try {
        const msg = await Message.findById(messageId);
        if (msg) {
          msg.reactions = msg.reactions.filter(r => String(r.userId) !== String(userId));
          await msg.save();
          io.to(msg.roomId || userId).emit('reactions_update', { messageId, reactions: msg.reactions });
          console.log(`Reaction removed from message ${messageId} by user ${userId}`);
        }
      } catch (error) {
        handleError(socket, error, 'remove_reaction');
      }
    });

    // Edit a message
    socket.on('edit_message', async ({ messageId, content, roomId, fileUrl, fileType, originalname }) => {
      try {
        const message = await Message.findById(messageId);
        if (!message) {
          throw new Error('Message not found');
        }
        
        message.content = content;
        if (fileUrl) message.fileUrl = fileUrl;
        if (fileType) message.fileType = fileType;
        if (originalname) message.originalname = originalname;
        await message.save();
        
        if (roomId) {
          io.to(roomId).emit('message_edited', message);
        } else if (message.recipientId) {
          socket.to(message.recipientId.toString()).emit('message_edited', message);
          socket.emit('message_edited', message);
        }
        console.log(`Message ${messageId} edited by user ${socket.userId}`);
      } catch (error) {
        handleError(socket, error, 'edit_message');
      }
    });

    // Reply to a message
    socket.on('reply_to_message', async ({ currentUserId, messageId, content, recipientId, roomId, fileUrl, fileType, originalname }) => {
      try {
        const originalMessage = await Message.findById(messageId);
        if (!originalMessage) {
          throw new Error('Original message not found');
        }

        const replyMessage = await Message.create({
          senderId: currentUserId,
          recipientId: recipientId || null,
          roomId: roomId || null,
          content,
          replyTo: messageId,
          fileUrl,
          fileType,
          originalname,
          status: 'sent'
        });

        if (roomId) {
          io.to(roomId).emit('message_replied', replyMessage);
        } else if (recipientId) {
          socket.to(recipientId).emit('message_replied', replyMessage);
          socket.emit('message_replied', replyMessage);
        }
        console.log(`Reply sent to message ${messageId} by user ${currentUserId}`);
      } catch (error) {
        handleError(socket, error, 'reply_to_message');
      }
    });

    // Delete a message
    socket.on('delete_message', async ({ messageId, roomId }) => {
      try {
        const message = await Message.findById(messageId);
        if (!message) {
          throw new Error('Message not found');
        }

        await message.deleteOne();

        if (roomId) {
          io.to(roomId).emit('message_deleted', { messageId });
        } else if (message.recipientId) {
          socket.to(message.recipientId.toString()).emit('message_deleted', { messageId });
          socket.emit('message_deleted', { messageId });
        }
        console.log(`Message ${messageId} deleted by user ${socket.userId}`);
      } catch (error) {
        handleError(socket, error, 'delete_message');
      }
    });
  });

  return io;
}

module.exports = setupChat; 