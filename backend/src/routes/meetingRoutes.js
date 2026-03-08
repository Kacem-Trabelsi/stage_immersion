const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const Meeting = require('../models/Meeting');

const ALLOWED_ROLES = new Set(['STARTUP', 'EXPERT', 'S2T']);

const getUserId = (req) => String(req?.user?.userId || req?.user?._id || req?.user?.id || '');
const getRole = (req) => String(req?.user?.role || '').toUpperCase();

const canUseMeetings = (req) => ALLOWED_ROLES.has(getRole(req));

const periodRange = (period) => {
  const now = new Date();
  if (period === 'today') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return { start, end };
  }
  if (period === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return { start, end };
  }
  if (period === 'year') {
    const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
    return { start, end };
  }
  return null;
};

router.get('/', authenticateToken, async (req, res) => {
  try {
    if (!canUseMeetings(req)) {
      return res.status(403).json({ success: false, message: 'Only STARTUP, EXPERT and S2T can access meetings' });
    }

    const role = getRole(req);
    const userId = getUserId(req);
    const query = {
      $or: [{ creatorId: userId }, { targetRoles: role }, { targetRoles: 'ALL' }],
    };

    const { upcoming, period } = req.query;
    if (String(upcoming).toLowerCase() === 'true') {
      query.start = { $gte: new Date() };
    }

    const range = periodRange(String(period || '').toLowerCase());
    if (range) {
      query.start = { ...(query.start || {}), $gte: range.start, $lte: range.end };
    }

    const meetings = await Meeting.find(query)
      .populate('creatorId', 'firstName lastName email role')
      .sort({ start: 1 });

    return res.json({ success: true, data: meetings });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/', authenticateToken, async (req, res) => {
  try {
    if (!canUseMeetings(req)) {
      return res.status(403).json({ success: false, message: 'Only STARTUP, EXPERT and S2T can create meetings' });
    }

    const {
      title,
      start,
      end,
      description,
      location,
      isOnline,
      meetingType,
      meetingLink,
      targetRoles,
    } = req.body;

    if (!String(title || '').trim() || !start) {
      return res.status(400).json({ success: false, message: 'Title and start are required' });
    }

    const normalizedMeetingType =
      String(meetingType || (isOnline ? 'ONLINE' : 'OFFLINE')).toUpperCase() === 'ONLINE' ? 'ONLINE' : 'OFFLINE';

    const normalizedRoles = Array.isArray(targetRoles)
      ? targetRoles.map((r) => String(r || '').toUpperCase()).filter((r) => ['STARTUP', 'EXPERT', 'S2T', 'ALL'].includes(r))
      : ['STARTUP', 'EXPERT', 'S2T'];

    const meeting = await Meeting.create({
      creatorId: getUserId(req),
      title: String(title).trim(),
      start,
      end,
      description: String(description || '').trim(),
      location: String(location || '').trim(),
      isOnline: normalizedMeetingType === 'ONLINE',
      meetingType: normalizedMeetingType,
      meetingLink: normalizedMeetingType === 'ONLINE' ? String(meetingLink || '').trim() : '',
      targetRoles: normalizedRoles.length > 0 ? normalizedRoles : ['STARTUP', 'EXPERT', 'S2T'],
    });

    const populated = await Meeting.findById(meeting._id).populate('creatorId', 'firstName lastName email role');
    return res.status(201).json({ success: true, data: populated });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
