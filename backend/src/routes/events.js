const express = require('express');
const router = express.Router();
const Event = require('../models/Event');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');

// List events for current user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { all, creatorRole, upcoming } = req.query;
    const query = {};

    if (String(all).toLowerCase() === 'true') {
      // all published calendar events
    } else if (creatorRole) {
      const roleValue = String(creatorRole).toUpperCase();
      const users = await User.find({ role: roleValue }, '_id').lean();
      query.userId = { $in: users.map((u) => u._id) };
    } else {
      query.userId = req.user.userId || req.user._id;
    }

    if (String(upcoming).toLowerCase() === 'true') {
      query.start = { $gte: new Date() };
    }

    const events = await Event.find(query)
      .populate('userId', 'firstName lastName email role')
      .sort({ start: 1 });
    res.json({ success: true, data: events });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Create event for current user
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { title, start, end, location, description, color, isOnline, meetingType, meetingLink, targetRoles } = req.body;
    if (!title || !start) {
      return res.status(400).json({ success: false, message: 'Title and start are required' });
    }
    const normalizedMeetingType =
      String(meetingType || (isOnline ? 'ONLINE' : 'OFFLINE')).toUpperCase() === 'ONLINE'
        ? 'ONLINE'
        : 'OFFLINE';
    const normalizedTargetRoles = Array.isArray(targetRoles)
      ? targetRoles.map((r) => String(r || '').toUpperCase()).filter(Boolean)
      : ['STARTUP', 'EXPERT', 'S2T'];

    const event = await Event.create({
      userId: req.user.userId || req.user._id,
      title,
      start,
      end,
      location,
      description,
      isOnline: normalizedMeetingType === 'ONLINE',
      meetingType: normalizedMeetingType,
      meetingLink: normalizedMeetingType === 'ONLINE' ? String(meetingLink || '').trim() : '',
      targetRoles: normalizedTargetRoles,
      color
    });
    res.status(201).json({ success: true, data: event });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;


