const mongoose = require('mongoose');

const participantSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  role: {
    type: String,
    enum: ['admin', 'member'],
    default: 'member'
  },
  joinedAt: { type: Date, default: Date.now },
  lastSeenAt: { type: Date, default: Date.now },
  notifications: { type: Boolean, default: true },
  isActive: { type: Boolean, default: true }
});

const conversationSchema = new mongoose.Schema({
  title: { type: String },
  type: {
    type: String,
    enum: ['direct', 'group'],
    default: 'direct'
  },
  participants: [participantSchema],
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  lastMessage: {
    messageId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatMessage' },
    content: { type: String },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    timestamp: { type: Date }
  },
  unreadCount: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    count: { type: Number, default: 0 }
  }],
  isActive: { type: Boolean, default: true },
  settings: {
    allowFileSharing: { type: Boolean, default: true },
    allowVoiceMessages: { type: Boolean, default: true },
    autoDeleteMessages: { type: Boolean, default: false },
    autoDeleteDays: { type: Number, default: 30 }
  }
}, {
  timestamps: true
});

// Indexes for performance
conversationSchema.index({ 'participants.userId': 1 });
conversationSchema.index({ 'lastMessage.timestamp': -1 });
conversationSchema.index({ createdBy: 1 });

// Create a direct conversation between two users
conversationSchema.statics.createDirectConversation = async function(user1Id, user2Id) {
  // Check if direct conversation already exists
  const existingConversation = await this.findOne({
    type: 'direct',
    'participants.userId': { $all: [user1Id, user2Id] },
    'participants': { $size: 2 }
  });

  if (existingConversation) {
    return existingConversation;
  }

  // Create new direct conversation
  const conversation = new this({
    type: 'direct',
    participants: [
      { userId: user1Id },
      { userId: user2Id }
    ],
    createdBy: user1Id
  });

  return await conversation.save();
};

// Get conversations for a user
conversationSchema.statics.getUserConversations = async function(userId) {
  return await this.find({
    'participants.userId': userId,
    'participants.isActive': true,
    isActive: true
  })
  .populate('participants.userId', 'firstName lastName avatar email role isActive')
  .populate('lastMessage.senderId', 'firstName lastName avatar')
  .sort({ 'lastMessage.timestamp': -1, updatedAt: -1 });
};

// Update last message and unread counts
conversationSchema.methods.updateLastMessage = async function(message) {
  this.lastMessage = {
    messageId: message._id,
    content: message.content.text || message.content.emoji || 'File',
    senderId: message.senderId,
    timestamp: message.createdAt
  };

  // Update unread counts for all participants except sender
  this.participants.forEach(participant => {
    if (participant.userId.toString() !== message.senderId.toString()) {
      const unreadEntry = this.unreadCount.find(
        entry => entry.userId.toString() === participant.userId.toString()
      );
      
      if (unreadEntry) {
        unreadEntry.count += 1;
      } else {
        this.unreadCount.push({
          userId: participant.userId,
          count: 1
        });
      }
    }
  });

  return await this.save();
};

// Mark messages as read for a user
conversationSchema.methods.markAsRead = async function(userId) {
  const unreadEntry = this.unreadCount.find(
    entry => entry.userId.toString() === userId.toString()
  );
  
  if (unreadEntry) {
    unreadEntry.count = 0;
  }

  // Update participant's lastSeenAt
  const participant = this.participants.find(
    p => p.userId.toString() === userId.toString()
  );
  
  if (participant) {
    participant.lastSeenAt = new Date();
  }

  return await this.save();
};

const Conversation = mongoose.model('Conversation', conversationSchema);
module.exports = Conversation;
