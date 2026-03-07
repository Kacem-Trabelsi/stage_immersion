const express = require('express');
const router = express.Router();
const VoiceCall = require('../models/VoiceCall');
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');

// ✅ Initiate a voice call
router.post('/initiate', authenticateToken, async (req, res) => {
  try {
    const { conversationId, receiverId, callType = 'voice' } = req.body;
    const callerId = req.user.userId;

    // Validate conversation exists and user is participant
    const conversation = await Conversation.findOne({
      _id: conversationId,
      'participants.userId': { $in: [callerId, receiverId] },
      'participants.isActive': true
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found or access denied'
      });
    }

    // Check if receiver exists
    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({
        success: false,
        message: 'Receiver not found'
      });
    }

    // Check if there's already an active call
    const existingCall = await VoiceCall.findOne({
      $or: [
        { callerId, receiverId, status: { $in: ['initiated', 'ringing', 'accepted'] } },
        { callerId: receiverId, receiverId: callerId, status: { $in: ['initiated', 'ringing', 'accepted'] } }
      ]
    });

    if (existingCall) {
      return res.status(400).json({
        success: false,
        message: 'There is already an active call with this user'
      });
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

    // Populate call data
    await voiceCall.populate([
      { path: 'callerId', select: 'firstName lastName avatar email' },
      { path: 'receiverId', select: 'firstName lastName avatar email' }
    ]);

    res.status(201).json({
      success: true,
      data: voiceCall
    });

  } catch (error) {
    console.error('Error initiating voice call:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ✅ Accept a voice call
router.post('/:callId/accept', authenticateToken, async (req, res) => {
  try {
    const { callId } = req.params;
    const userId = req.user.userId;

    const voiceCall = await VoiceCall.findOne({
      _id: callId,
      receiverId: userId,
      status: { $in: ['initiated', 'ringing'] }
    });

    if (!voiceCall) {
      return res.status(404).json({
        success: false,
        message: 'Call not found or already processed'
      });
    }

    await voiceCall.acceptCall();

    // Populate call data
    await voiceCall.populate([
      { path: 'callerId', select: 'firstName lastName avatar email' },
      { path: 'receiverId', select: 'firstName lastName avatar email' }
    ]);

    res.json({
      success: true,
      data: voiceCall
    });

  } catch (error) {
    console.error('Error accepting voice call:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ✅ Reject a voice call
router.post('/:callId/reject', authenticateToken, async (req, res) => {
  try {
    const { callId } = req.params;
    const userId = req.user.userId;

    const voiceCall = await VoiceCall.findOne({
      _id: callId,
      receiverId: userId,
      status: { $in: ['initiated', 'ringing'] }
    });

    if (!voiceCall) {
      return res.status(404).json({
        success: false,
        message: 'Call not found or already processed'
      });
    }

    await voiceCall.rejectCall();

    res.json({
      success: true,
      data: voiceCall
    });

  } catch (error) {
    console.error('Error rejecting voice call:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ✅ End a voice call
router.post('/:callId/end', authenticateToken, async (req, res) => {
  try {
    const { callId } = req.params;
    const { reason = 'normal' } = req.body;
    const userId = req.user.userId;

    const voiceCall = await VoiceCall.findOne({
      _id: callId,
      $or: [
        { callerId: userId },
        { receiverId: userId }
      ],
      status: { $in: ['initiated', 'ringing', 'accepted'] }
    });

    if (!voiceCall) {
      return res.status(404).json({
        success: false,
        message: 'Call not found or already ended'
      });
    }

    await voiceCall.endCall(reason);

    res.json({
      success: true,
      data: voiceCall
    });

  } catch (error) {
    console.error('Error ending voice call:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ✅ Get call history
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { page = 1, limit = 20, conversationId } = req.query;

    const query = {
      $or: [
        { callerId: userId },
        { receiverId: userId }
      ],
      status: { $in: ['ended', 'rejected', 'missed'] }
    };

    if (conversationId) {
      query.conversationId = conversationId;
    }

    const calls = await VoiceCall.find(query)
      .populate('callerId', 'firstName lastName avatar email')
      .populate('receiverId', 'firstName lastName avatar email')
      .populate('conversationId', 'type participants')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await VoiceCall.countDocuments(query);

    res.json({
      success: true,
      data: {
        calls,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total
        }
      }
    });

  } catch (error) {
    console.error('Error fetching call history:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ✅ Get active calls
router.get('/active', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const activeCalls = await VoiceCall.findActiveCalls(userId)
      .populate('callerId', 'firstName lastName avatar email')
      .populate('receiverId', 'firstName lastName avatar email')
      .populate('conversationId', 'type participants');

    res.json({
      success: true,
      data: activeCalls
    });

  } catch (error) {
    console.error('Error fetching active calls:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ✅ Clean up stale calls
router.post('/cleanup', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    // Clean up stale calls for this user
    const result = await VoiceCall.updateMany(
      {
        $or: [
          { callerId: userId },
          { receiverId: userId }
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

    res.json({
      success: true,
      message: `Cleaned up ${result.modifiedCount} stale calls`,
      data: { modifiedCount: result.modifiedCount }
    });

  } catch (error) {
    console.error('Error cleaning up stale calls:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ✅ Add ICE candidate
router.post('/:callId/ice-candidate', authenticateToken, async (req, res) => {
  try {
    const { callId } = req.params;
    const { candidate, sdpMLineIndex, sdpMid } = req.body;
    const userId = req.user.userId;

    const voiceCall = await VoiceCall.findOne({
      _id: callId,
      $or: [
        { callerId: userId },
        { receiverId: userId }
      ],
      status: { $in: ['accepted'] }
    });

    if (!voiceCall) {
      return res.status(404).json({
        success: false,
        message: 'Call not found or not in correct state'
      });
    }

    voiceCall.iceCandidates.push({
      candidate,
      sdpMLineIndex,
      sdpMid,
      from: userId
    });

    await voiceCall.save();

    res.json({
      success: true,
      data: voiceCall
    });

  } catch (error) {
    console.error('Error adding ICE candidate:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ✅ Update call offer/answer
router.put('/:callId/sdp', authenticateToken, async (req, res) => {
  try {
    const { callId } = req.params;
    const { sdp, type } = req.body; // type: 'offer' or 'answer'
    const userId = req.user.userId;

    const voiceCall = await VoiceCall.findOne({
      _id: callId,
      $or: [
        { callerId: userId },
        { receiverId: userId }
      ]
    });

    if (!voiceCall) {
      return res.status(404).json({
        success: false,
        message: 'Call not found'
      });
    }

    if (type === 'offer') {
      voiceCall.callerOffer = sdp;
    } else if (type === 'answer') {
      voiceCall.receiverAnswer = sdp;
    }

    await voiceCall.save();

    res.json({
      success: true,
      data: voiceCall
    });

  } catch (error) {
    console.error('Error updating SDP:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
