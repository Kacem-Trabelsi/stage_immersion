const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const ChatMessage = require('../models/ChatMessage');
const Conversation = require('../models/Conversation');
const { User } = require('../models/User');
const { authenticateToken } = require('../middleware/auth');

// ✅ Get all conversations for authenticated user
router.get('/conversations', authenticateToken, async (req, res) => {
  try {
    const conversations = await Conversation.getUserConversations(req.user.userId);
    
    res.json({
      success: true,
      data: conversations
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ✅ Create or get direct conversation
router.post('/conversations/direct', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    // Check if the other user exists
    const otherUser = await User.findById(userId);
    if (!otherUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const conversation = await Conversation.createDirectConversation(req.user.userId, userId);
    
    // Populate the conversation
    await conversation.populate('participants.userId', 'firstName lastName avatar email role isActive');
    
    res.json({
      success: true,
      data: conversation
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ✅ Get messages for a conversation
router.get('/conversations/:conversationId/messages', authenticateToken, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    
    // Check if user is participant in conversation
    const conversation = await Conversation.findOne({
      _id: conversationId,
      'participants.userId': req.user.userId,
      'participants.isActive': true
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found or access denied'
      });
    }

    const skip = (page - 1) * limit;
    
    const messages = await ChatMessage.find({
      conversationId,
      isDeleted: false
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .populate('reactions.userId', 'firstName lastName avatar');

    // Mark conversation as read for this user
    await conversation.markAsRead(req.user.userId);

    res.json({
      success: true,
      data: {
        messages: messages.reverse(), // Return in chronological order
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          hasMore: messages.length === parseInt(limit)
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ✅ Send a message
router.post('/conversations/:conversationId/messages', authenticateToken, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { messageType = 'text', replyTo } = req.body;
    let { content } = req.body;
    
    // Parse content if it's a JSON string
    if (typeof content === 'string') {
      try {
        content = JSON.parse(content);
      } catch (e) {
        // If parsing fails, treat as text content
        content = { text: content };
      }
    }
    
    // Check if user is participant in conversation
    const conversation = await Conversation.findOne({
      _id: conversationId,
      'participants.userId': req.user.userId,
      'participants.isActive': true
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found or access denied'
      });
    }

    // Create message data
    const messageData = {
      conversationId,
      senderId: req.user.userId,
      messageType,
      content: {},
      attachments: []
    };

    // Handle different message types
    if (messageType === 'text' && content.text) {
      messageData.content.text = content.text;
    } else if (messageType === 'emoji' && content.emoji) {
      messageData.content.emoji = content.emoji;
    } else if (messageType === 'system' && content.systemMessage) {
      messageData.content.systemMessage = content.systemMessage;
    } else if (messageType === 'file' && content.text) {
      // For file messages, store the descriptive text
      messageData.content.text = content.text;
    }

    // Handle reply
    if (replyTo) {
      messageData.replyTo = replyTo;
    }

    // Handle file uploads
    if (req.files) {
      const uploadDir = path.join(__dirname, '../../uploads/chat');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      for (const [key, file] of Object.entries(req.files)) {
        const fileName = `${Date.now()}-${file.name}`;
        const filePath = path.join(uploadDir, fileName);
        
        await file.mv(filePath);
        
        messageData.attachments.push({
          type: file.mimetype.startsWith('audio/') ? 'voice' : 
                file.mimetype.startsWith('image/') ? 'image' : 'file',
          fileName: file.name,
          filePath: `/uploads/chat/${fileName}`,
          fileSize: file.size,
          mimeType: file.mimetype,
          duration: req.body.duration || null // For voice messages
        });
        
        messageData.messageType = 'file';
      }
    }

    // Create and save message
    const message = new ChatMessage(messageData);
    await message.save();

    // Update conversation's last message
    await conversation.updateLastMessage(message);

    // Populate message for response
    await message.populate('senderId', 'firstName lastName avatar email role');
    if (message.replyTo) {
      await message.populate('replyTo', 'content senderId createdAt');
    }

    res.status(201).json({
      success: true,
      data: message
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ✅ Add reaction to message
router.post('/messages/:messageId/reactions', authenticateToken, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;
    
    if (!emoji) {
      return res.status(400).json({
        success: false,
        message: 'Emoji is required'
      });
    }

    const message = await ChatMessage.findById(messageId);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Check if user already reacted with this emoji
    const existingReaction = message.reactions.find(
      r => r.userId.toString() === req.user.userId && r.emoji === emoji
    );

    if (existingReaction) {
      // Remove reaction if already exists
      message.reactions = message.reactions.filter(
        r => !(r.userId.toString() === req.user.userId && r.emoji === emoji)
      );
    } else {
      // Add new reaction
      message.reactions.push({
        emoji,
        userId: req.user.userId
      });
    }

    await message.save();
    await message.populate('reactions.userId', 'firstName lastName avatar');

    res.json({
      success: true,
      data: message.reactions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ✅ Edit message
router.put('/messages/:messageId', authenticateToken, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { content } = req.body;
    
    const message = await ChatMessage.findOne({
      _id: messageId,
      senderId: req.user.userId,
      isDeleted: false
    });

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found or unauthorized'
      });
    }

    // Only allow editing text messages
    if (message.messageType !== 'text') {
      return res.status(400).json({
        success: false,
        message: 'Only text messages can be edited'
      });
    }

    message.content.text = content.text;
    message.isEdited = true;
    message.editedAt = new Date();
    
    await message.save();

    res.json({
      success: true,
      data: message
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ✅ Delete message
router.delete('/messages/:messageId', authenticateToken, async (req, res) => {
  try {
    const { messageId } = req.params;
    
    const message = await ChatMessage.findOne({
      _id: messageId,
      senderId: req.user.userId
    });

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found or unauthorized'
      });
    }

    message.isDeleted = true;
    message.deletedAt = new Date();
    message.content = { text: 'This message was deleted' };
    
    await message.save();

    res.json({
      success: true,
      message: 'Message deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ✅ Mark conversation as read
router.post('/conversations/:conversationId/read', authenticateToken, async (req, res) => {
  try {
    const { conversationId } = req.params;
    
    const conversation = await Conversation.findOne({
      _id: conversationId,
      'participants.userId': req.user.userId
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    await conversation.markAsRead(req.user.userId);

    res.json({
      success: true,
      message: 'Conversation marked as read'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ✅ Get all users for chat (search/select users)
router.get('/users', authenticateToken, async (req, res) => {
  try {
    const { search = '', role } = req.query;
    
    const query = {
      _id: { $ne: req.user.userId }, // Exclude current user
      isActive: true
    };

    // Add search filter
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } }
      ];
    }

    // Add role filter
    if (role) {
      query.role = role;
    }

    const users = await User.find(query)
      .select('firstName lastName email role avatar isActive')
      .sort({ firstName: 1, lastName: 1 })
      .limit(50);

    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ✅ Get conversation typing status
router.get('/conversations/:conversationId/typing', authenticateToken, async (req, res) => {
  try {
    // This would typically be handled via Socket.IO
    // For now, return empty array
    res.json({
      success: true,
      data: []
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
