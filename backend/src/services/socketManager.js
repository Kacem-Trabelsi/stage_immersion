const socketAuth = require('../middleware/socketAuth');
const ChatMessage = require('../models/ChatMessage');
const Conversation = require('../models/Conversation');
const VoiceCall = require('../models/VoiceCall');

class SocketManager {
  constructor(io) {
    this.io = io;
    this.connectedUsers = new Map(); // userId -> socketId
    this.userSockets = new Map();    // socketId -> userId
    this.typingUsers = new Map();    // conversationId -> Set of userIds
    this.activeCalls = new Map();    // callId -> call data
    this.userCalls = new Map();      // userId -> callId
    
    this.setupSocketHandlers();
    
    // Clean up stale calls every 2 minutes
    setInterval(() => {
      this.cleanupStaleCalls();
    }, 2 * 60 * 1000);
  }

  setupSocketHandlers() {
    this.io.use(socketAuth);
    
    this.io.on('connection', (socket) => {
      console.log(`👤 User ${socket.user.userId} connected (socket: ${socket.id})`);
      console.log(`📧 User email: ${socket.user.email}`);
      
      // Store user connection
      this.connectedUsers.set(socket.user.userId, socket.id);
      this.userSockets.set(socket.id, socket.user.userId);
      
      // Log current connected users with detailed info
      console.log(`📊 Total connected users: ${this.connectedUsers.size}`);
      console.log(`👥 Connected users list:`);
      this.connectedUsers.forEach((socketId, userId) => {
        console.log(`   - User ID: ${userId} (Socket: ${socketId})`);
      });
      console.log(`🔗 Socket connections: ${this.userSockets.size}`);
      
      // Join user to their conversations
      this.joinUserConversations(socket);
      
      // Handle socket events
      this.handleSocketEvents(socket);
      
      // Handle disconnect
      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });
    });
  }

  async joinUserConversations(socket) {
    try {
      const conversations = await Conversation.find({
        'participants.userId': socket.user.userId,
        'participants.isActive': true
      });
      
      conversations.forEach(conversation => {
        socket.join(`conversation_${conversation._id}`);
      });
    } catch (error) {
      console.error('Error joining user conversations:', error);
    }
  }

  handleSocketEvents(socket) {
    // Join conversation
    socket.on('join_conversation', (conversationId) => {
      socket.join(`conversation_${conversationId}`);
      console.log(`User ${socket.user.userId} joined conversation ${conversationId}`);
    });

    // Leave conversation
    socket.on('leave_conversation', (conversationId) => {
      socket.leave(`conversation_${conversationId}`);
      console.log(`User ${socket.user.userId} left conversation ${conversationId}`);
    });

    // Handle new message
    socket.on('send_message', async (data) => {
      try {
        await this.handleNewMessage(socket, data);
      } catch (error) {
        socket.emit('message_error', { error: error.message });
      }
    });

    // Handle typing indicators
    socket.on('typing_start', (data) => {
      this.handleTypingStart(socket, data);
    });

    socket.on('typing_stop', (data) => {
      this.handleTypingStop(socket, data);
    });

    // Handle message reactions
    socket.on('add_reaction', async (data) => {
      try {
        await this.handleAddReaction(socket, data);
      } catch (error) {
        socket.emit('reaction_error', { error: error.message });
      }
    });

    // Handle message read status
    socket.on('mark_as_read', async (data) => {
      try {
        await this.handleMarkAsRead(socket, data);
      } catch (error) {
        socket.emit('read_error', { error: error.message });
      }
    });

    // Handle online status
    socket.on('update_status', (status) => {
      socket.broadcast.emit('user_status_update', {
        userId: socket.user.userId,
        status: status,
        timestamp: new Date()
      });
    });

    // Voice call events
    socket.on('initiate_call', async (data) => {
      try {
        await this.handleInitiateCall(socket, data);
      } catch (error) {
        socket.emit('call_error', { error: error.message });
      }
    });

    socket.on('accept_call', async (data) => {
      try {
        await this.handleAcceptCall(socket, data);
      } catch (error) {
        socket.emit('call_error', { error: error.message });
      }
    });

    socket.on('reject_call', async (data) => {
      try {
        await this.handleRejectCall(socket, data);
      } catch (error) {
        socket.emit('call_error', { error: error.message });
      }
    });

    socket.on('end_call', async (data) => {
      try {
        await this.handleEndCall(socket, data);
      } catch (error) {
        socket.emit('call_error', { error: error.message });
      }
    });

    // WebRTC signaling events
    socket.on('call_offer', (data) => {
      this.handleCallOffer(socket, data);
    });

    socket.on('call_answer', (data) => {
      this.handleCallAnswer(socket, data);
    });

    socket.on('ice_candidate', (data) => {
      this.handleIceCandidate(socket, data);
    });

  }

  async handleNewMessage(socket, data) {
    const { conversationId, messageType, content, replyTo, attachments } = data;
    
    // Verify user is participant in conversation
    const conversation = await Conversation.findOne({
      _id: conversationId,
      'participants.userId': socket.user.userId,
      'participants.isActive': true
    });

    if (!conversation) {
      throw new Error('Conversation not found or access denied');
    }

    // Create message
    const messageData = {
      conversationId,
      senderId: socket.user.userId,
      messageType: messageType || 'text',
      content: content || {},
      attachments: attachments || []
    };

    if (replyTo) {
      messageData.replyTo = replyTo;
    }

    const message = new ChatMessage(messageData);
    await message.save();

    // Update conversation
    await conversation.updateLastMessage(message);

    // Populate message for broadcasting
    await message.populate('senderId', 'firstName lastName avatar email role');
    if (message.replyTo) {
      await message.populate('replyTo', 'content senderId createdAt');
    }

    // Broadcast to conversation participants
    this.io.to(`conversation_${conversationId}`).emit('new_message', {
      message,
      conversationId
    });

    // Send delivery confirmations to online users
    const onlineParticipants = conversation.participants.filter(p => 
      p.userId.toString() !== socket.user.userId && 
      this.connectedUsers.has(p.userId.toString())
    );

    onlineParticipants.forEach(participant => {
      const participantSocketId = this.connectedUsers.get(participant.userId.toString());
      if (participantSocketId) {
        this.io.to(participantSocketId).emit('message_delivered', {
          messageId: message._id,
          conversationId,
          deliveredAt: new Date()
        });
      }
    });

    // Clear typing indicators for sender
    this.handleTypingStop(socket, { conversationId });
  }

  handleTypingStart(socket, { conversationId }) {
    if (!this.typingUsers.has(conversationId)) {
      this.typingUsers.set(conversationId, new Set());
    }
    
    this.typingUsers.get(conversationId).add(socket.user.userId);
    
    // Broadcast typing status to other participants
    socket.to(`conversation_${conversationId}`).emit('user_typing', {
      userId: socket.user.userId,
      conversationId,
      isTyping: true
    });

    // Auto-stop typing after 3 seconds
    setTimeout(() => {
      this.handleTypingStop(socket, { conversationId });
    }, 3000);
  }

  handleTypingStop(socket, { conversationId }) {
    if (this.typingUsers.has(conversationId)) {
      this.typingUsers.get(conversationId).delete(socket.user.userId);
      
      if (this.typingUsers.get(conversationId).size === 0) {
        this.typingUsers.delete(conversationId);
      }
    }
    
    socket.to(`conversation_${conversationId}`).emit('user_typing', {
      userId: socket.user.userId,
      conversationId,
      isTyping: false
    });
  }

  async handleAddReaction(socket, { messageId, emoji }) {
    const message = await ChatMessage.findById(messageId);
    if (!message) {
      throw new Error('Message not found');
    }

    // Check if user already reacted with this emoji
    const existingReaction = message.reactions.find(
      r => r.userId.toString() === socket.user.userId && r.emoji === emoji
    );

    if (existingReaction) {
      // Remove reaction
      message.reactions = message.reactions.filter(
        r => !(r.userId.toString() === socket.user.userId && r.emoji === emoji)
      );
    } else {
      // Add reaction
      message.reactions.push({
        emoji,
        userId: socket.user.userId
      });
    }

    await message.save();
    await message.populate('reactions.userId', 'firstName lastName avatar');

    // Broadcast reaction update
    this.io.to(`conversation_${message.conversationId}`).emit('reaction_updated', {
      messageId,
      reactions: message.reactions
    });
  }

  async handleMarkAsRead(socket, { conversationId, messageIds }) {
    const conversation = await Conversation.findOne({
      _id: conversationId,
      'participants.userId': socket.user.userId
    });

    if (!conversation) {
      throw new Error('Conversation not found');
    }

    // Mark conversation as read
    await conversation.markAsRead(socket.user.userId);

    // Mark specific messages as read if provided
    if (messageIds && messageIds.length > 0) {
      await ChatMessage.updateMany(
        { 
          _id: { $in: messageIds },
          conversationId,
          'readBy.userId': { $ne: socket.user.userId }
        },
        {
          $push: {
            readBy: {
              userId: socket.user.userId,
              readAt: new Date()
            }
          },
          deliveryStatus: 'read'
        }
      );
    }

    // Broadcast read status to conversation participants
    socket.to(`conversation_${conversationId}`).emit('messages_read', {
      userId: socket.user.userId,
      conversationId,
      messageIds: messageIds || [],
      readAt: new Date()
    });
  }

  handleDisconnect(socket) {
    const userId = this.userSockets.get(socket.id);
    
    if (userId) {
      console.log(`👤 User ${userId} disconnected (socket: ${socket.id})`);
      
      // Remove from connected users
      this.connectedUsers.delete(userId);
      this.userSockets.delete(socket.id);
      
      // Log remaining connected users
      console.log(`📊 Remaining connected users: ${this.connectedUsers.size}`);
      console.log(`👥 Remaining users list:`);
      this.connectedUsers.forEach((socketId, userId) => {
        console.log(`   - User ID: ${userId} (Socket: ${socketId})`);
      });
      console.log(`🔗 Remaining socket connections: ${this.userSockets.size}`);
      
      // Clear typing indicators
      this.typingUsers.forEach((typingSet, conversationId) => {
        if (typingSet.has(userId)) {
          typingSet.delete(userId);
          this.io.to(`conversation_${conversationId}`).emit('user_typing', {
            userId,
            conversationId,
            isTyping: false
          });
        }
      });
      
      // Broadcast offline status
      socket.broadcast.emit('user_status_update', {
        userId,
        status: 'offline',
        timestamp: new Date()
      });
    }
  }

  // Utility method to send message to specific user
  sendToUser(userId, event, data) {
    const socketId = this.connectedUsers.get(userId);
    if (socketId) {
      this.io.to(socketId).emit(event, data);
      return true;
    }
    return false;
  }

  // Get online users for a conversation
  getOnlineUsers(conversationId, participants) {
    return participants.filter(participant => 
      this.connectedUsers.has(participant.userId.toString())
    ).map(participant => participant.userId);
  }

  // Get typing users for a conversation
  getTypingUsers(conversationId) {
    return Array.from(this.typingUsers.get(conversationId) || []);
  }

  // Voice call handlers
  async handleInitiateCall(socket, data) {
    const { conversationId, receiverId, callType = 'voice' } = data;
    const callerId = socket.user.userId;

    // First, clean up any stale calls (older than 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    await VoiceCall.updateMany(
      {
        $or: [
          { callerId, receiverId },
          { callerId: receiverId, receiverId: callerId }
        ],
        status: { $in: ['initiated', 'ringing'] },
        createdAt: { $lt: fiveMinutesAgo }
      },
      {
        $set: {
          status: 'ended',
          endedAt: new Date(),
          endReason: 'timeout'
        }
      }
    );

    // Check if there's still an active call
    const existingCall = await VoiceCall.findOne({
      $or: [
        { callerId, receiverId, status: { $in: ['initiated', 'ringing', 'accepted'] } },
        { callerId: receiverId, receiverId: callerId, status: { $in: ['initiated', 'ringing', 'accepted'] } }
      ]
    });

    if (existingCall) {
      // If the existing call is very recent (less than 30 seconds), reject the new call
      const callAge = Date.now() - new Date(existingCall.createdAt).getTime();
      if (callAge < 30000) { // 30 seconds
        throw new Error('There is already an active call with this user');
      } else {
        // If the call is older than 30 seconds, end it and allow new call
        await existingCall.endCall('timeout');
      }
    }

    // Create new voice call
    const voiceCall = new VoiceCall({
      conversationId,
      callerId,
      receiverId,
      callType,
      status: 'initiated'
    });

    await voiceCall.save();
    await voiceCall.populate([
      { path: 'callerId', select: 'firstName lastName avatar email' },
      { path: 'receiverId', select: 'firstName lastName avatar email' }
    ]);

    // Clean up any existing calls in memory for these users
    this.cleanupUserCalls(callerId);
    this.cleanupUserCalls(receiverId);

    // Store call in memory
    this.activeCalls.set(voiceCall._id.toString(), voiceCall);
    this.userCalls.set(callerId, voiceCall._id.toString());
    this.userCalls.set(receiverId, voiceCall._id.toString());

    // Notify caller
    socket.emit('call_initiated', { call: voiceCall });

    // Notify receiver
    const receiverSocketId = this.connectedUsers.get(receiverId);
    if (receiverSocketId) {
      this.io.to(receiverSocketId).emit('incoming_call', { call: voiceCall });
    } else {
      // Receiver is offline, mark call as missed
      voiceCall.status = 'missed';
      voiceCall.endedAt = new Date();
      voiceCall.endReason = 'missed';
      await voiceCall.save();
    }
  }

  async handleAcceptCall(socket, data) {
    const { callId } = data;
    const userId = socket.user.userId;

    const voiceCall = await VoiceCall.findOne({
      _id: callId,
      receiverId: userId,
      status: { $in: ['initiated', 'ringing'] }
    });

    if (!voiceCall) {
      throw new Error('Call not found or already processed');
    }

    await voiceCall.acceptCall();
    await voiceCall.populate([
      { path: 'callerId', select: 'firstName lastName avatar email' },
      { path: 'receiverId', select: 'firstName lastName avatar email' }
    ]);

    // Update call in memory
    this.activeCalls.set(voiceCall._id.toString(), voiceCall);

    // Notify both parties
    const callerIdStr = voiceCall.callerId && voiceCall.callerId._id
      ? voiceCall.callerId._id.toString()
      : voiceCall.callerId.toString();
    const callerSocketId = this.connectedUsers.get(callerIdStr);
    if (callerSocketId) {
      this.io.to(callerSocketId).emit('call_accepted', { call: voiceCall });
    }

    socket.emit('call_accepted', { call: voiceCall });
  }

  async handleRejectCall(socket, data) {
    const { callId } = data;
    const userId = socket.user.userId;

    const voiceCall = await VoiceCall.findOne({
      _id: callId,
      receiverId: userId,
      status: { $in: ['initiated', 'ringing'] }
    });

    if (!voiceCall) {
      throw new Error('Call not found or already processed');
    }

    await voiceCall.rejectCall();

    // Remove from memory
    this.activeCalls.delete(voiceCall._id.toString());
    this.userCalls.delete(voiceCall.callerId);
    this.userCalls.delete(voiceCall.receiverId);

    // Notify caller - ensure ID is string
    const callerIdStr = voiceCall.callerId.toString();
    const callerSocketId = this.connectedUsers.get(callerIdStr);
    if (callerSocketId) {
      this.io.to(callerSocketId).emit('call_rejected', { call: voiceCall });
    }

    socket.emit('call_rejected', { call: voiceCall });
  }

  async handleEndCall(socket, data) {
    const { callId, reason = 'normal' } = data;
    const userId = socket.user.userId;

    const voiceCall = await VoiceCall.findOne({
      _id: callId,
      $or: [
        { callerId: userId },
        { receiverId: userId }
      ],
      status: { $in: ['initiated', 'ringing', 'accepted'] }
    });

    if (!voiceCall) {
      // Call not found or already ended - this is not necessarily an error
      // Just return without throwing an error
      return;
    }

    await voiceCall.endCall(reason);

    // Remove from memory
    this.activeCalls.delete(voiceCall._id.toString());
    this.userCalls.delete(voiceCall.callerId);
    this.userCalls.delete(voiceCall.receiverId);

    // Notify both parties - ensure IDs are strings
    const callerIdStr = voiceCall.callerId.toString();
    const receiverIdStr = voiceCall.receiverId.toString();
    const callerSocketId = this.connectedUsers.get(callerIdStr);
    const receiverSocketId = this.connectedUsers.get(receiverIdStr);


    // Notify caller
    if (callerSocketId) {
      this.io.to(callerSocketId).emit('call_ended', { call: voiceCall });
    }
    
    // Notify receiver
    if (receiverSocketId) {
      this.io.to(receiverSocketId).emit('call_ended', { call: voiceCall });
    }
  }

  // WebRTC signaling handlers
  handleCallOffer(socket, data) {
    const { callId, offer, receiverId } = data;
    
    const receiverSocketId = this.connectedUsers.get(receiverId);
    if (receiverSocketId) {
      this.io.to(receiverSocketId).emit('call_offer', {
        callId,
        offer,
        callerId: socket.user.userId
      });
    }
  }

  handleCallAnswer(socket, data) {
    const { callId, answer, callerId } = data;
    
    const callerSocketId = this.connectedUsers.get(callerId);
    if (callerSocketId) {
      this.io.to(callerSocketId).emit('call_answer', {
        callId,
        answer,
        receiverId: socket.user.userId
      });
    }
  }

  handleIceCandidate(socket, data) {
    const { callId, candidate, targetUserId } = data;
    
    const targetSocketId = this.connectedUsers.get(targetUserId);
    if (targetSocketId) {
      this.io.to(targetSocketId).emit('ice_candidate', {
        callId,
        candidate,
        fromUserId: socket.user.userId
      });
    }
  }

  // Get active call for user
  getActiveCall(userId) {
    const callId = this.userCalls.get(userId);
    return callId ? this.activeCalls.get(callId) : null;
  }

  // Check if user is in a call
  isUserInCall(userId) {
    return this.userCalls.has(userId);
  }

  // Clean up calls for a specific user
  cleanupUserCalls(userId) {
    const callId = this.userCalls.get(userId);
    if (callId) {
      this.activeCalls.delete(callId);
      this.userCalls.delete(userId);
    }
  }

  // Clean up all stale calls in memory
  cleanupStaleCalls() {
    const now = Date.now();
    const staleThreshold = 5 * 60 * 1000; // 5 minutes

    for (const [callId, call] of this.activeCalls.entries()) {
      const callAge = now - new Date(call.createdAt).getTime();
      if (callAge > staleThreshold) {
        this.activeCalls.delete(callId);
        this.userCalls.delete(call.callerId);
        this.userCalls.delete(call.receiverId);
      }
    }
  }

}

module.exports = SocketManager;
