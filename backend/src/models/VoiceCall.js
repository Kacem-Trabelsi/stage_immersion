const mongoose = require('mongoose');

const voiceCallSchema = new mongoose.Schema({
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true,
    index: true
  },
  callerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  receiverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['initiated', 'ringing', 'accepted', 'rejected', 'ended', 'missed'],
    default: 'initiated',
    index: true
  },
  callType: {
    type: String,
    enum: ['voice', 'video'],
    default: 'voice'
  },
  startedAt: {
    type: Date,
    default: Date.now
  },
  endedAt: {
    type: Date
  },
  duration: {
    type: Number, // Duration in seconds
    default: 0
  },
  callQuality: {
    type: String,
    enum: ['excellent', 'good', 'fair', 'poor'],
    default: 'good'
  },
  // WebRTC specific data
  callerOffer: {
    type: String // SDP offer from caller
  },
  receiverAnswer: {
    type: String // SDP answer from receiver
  },
  iceCandidates: [{
    candidate: String,
    sdpMLineIndex: Number,
    sdpMid: String,
    from: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Call metadata
  endReason: {
    type: String,
    enum: ['normal', 'timeout', 'rejected', 'busy', 'error', 'cancelled', 'missed']
  },
  isRecorded: {
    type: Boolean,
    default: false
  },
  recordingPath: {
    type: String
  }
}, {
  timestamps: true
});

// Indexes for performance
voiceCallSchema.index({ conversationId: 1, createdAt: -1 });
voiceCallSchema.index({ callerId: 1, status: 1 });
voiceCallSchema.index({ receiverId: 1, status: 1 });
voiceCallSchema.index({ status: 1, createdAt: -1 });

// Virtual for call duration calculation
voiceCallSchema.virtual('calculatedDuration').get(function() {
  if (this.endedAt && this.startedAt) {
    return Math.floor((this.endedAt - this.startedAt) / 1000);
  }
  return 0;
});

// Method to end call
voiceCallSchema.methods.endCall = function(reason = 'normal') {
  this.status = 'ended';
  this.endedAt = new Date();
  this.duration = this.calculatedDuration;
  this.endReason = reason;
  return this.save();
};

// Method to accept call
voiceCallSchema.methods.acceptCall = function() {
  this.status = 'accepted';
  return this.save();
};

// Method to reject call
voiceCallSchema.methods.rejectCall = function() {
  this.status = 'rejected';
  this.endedAt = new Date();
  this.endReason = 'rejected';
  return this.save();
};

// Static method to find active calls
voiceCallSchema.statics.findActiveCalls = function(userId) {
  return this.find({
    $or: [
      { callerId: userId },
      { receiverId: userId }
    ],
    status: { $in: ['initiated', 'ringing', 'accepted'] }
  });
};

module.exports = mongoose.model('VoiceCall', voiceCallSchema);
