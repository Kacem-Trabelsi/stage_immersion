const mongoose = require('mongoose');

const attachmentSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['file', 'voice', 'image'],
    required: true
  },
  fileName: { type: String, required: true },
  filePath: { type: String, required: true },
  fileSize: { type: Number, required: true },
  mimeType: { type: String, required: true },
  duration: { type: Number }, // For voice messages
  uploadedAt: { type: Date, default: Date.now }
});

const reactionSchema = new mongoose.Schema({
  emoji: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  addedAt: { type: Date, default: Date.now }
});

const chatMessageSchema = new mongoose.Schema({
  conversationId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Conversation', 
    required: true,
    index: true
  },
  senderId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true
  },
  messageType: {
    type: String,
    enum: ['text', 'file', 'voice', 'emoji', 'system'],
    default: 'text'
  },
  content: {
    text: { type: String },
    emoji: { type: String },
    systemMessage: { type: String }
  },
  attachments: [attachmentSchema],
  reactions: [reactionSchema],
  isEdited: { type: Boolean, default: false },
  editedAt: { type: Date },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  readBy: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    readAt: { type: Date, default: Date.now }
  }],
  replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatMessage' },
  deliveryStatus: {
    type: String,
    enum: ['sent', 'delivered', 'read'],
    default: 'sent'
  }
}, {
  timestamps: true
});

// Indexes for performance
chatMessageSchema.index({ conversationId: 1, createdAt: -1 });
chatMessageSchema.index({ senderId: 1 });
chatMessageSchema.index({ 'readBy.userId': 1 });

// Populate sender info by default
chatMessageSchema.pre(['find', 'findOne'], function() {
  this.populate('senderId', 'firstName lastName avatar email role');
  this.populate('replyTo', 'content senderId createdAt');
});

const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);
module.exports = ChatMessage;
