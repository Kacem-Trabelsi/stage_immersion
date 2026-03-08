const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const EmailMessage = require('../models/EmailMessage');
const { User } = require('../models/User');
const { authenticateToken } = require('../middleware/auth');

const ALLOWED_ROLES = new Set(['STARTUP', 'EXPERT', 'S2T']);

const toObjectIdArray = (values = []) => {
  return (Array.isArray(values) ? values : [])
    .map((id) => String(id || '').trim())
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));
};

const uniqObjectIds = (values = []) => {
  const map = new Map();
  values.forEach((v) => {
    if (!v) return;
    const key = String(v);
    if (!map.has(key)) map.set(key, v);
  });
  return Array.from(map.values());
};

const mapEmail = (emailDoc, currentUserId) => {
  const toObj = typeof emailDoc.toObject === 'function' ? emailDoc.toObject() : emailDoc;
  const current = String(currentUserId);
  const isRead = Array.isArray(toObj.readBy)
    ? toObj.readBy.some((u) => String(u?._id || u) === current)
    : false;
  return { ...toObj, isRead };
};

router.use(authenticateToken);
router.use((req, res, next) => {
  if (!ALLOWED_ROLES.has(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Role not allowed for email messaging'
    });
  }
  return next();
});

router.get('/contacts', async (req, res) => {
  try {
    const users = await User.find({
      _id: { $ne: req.user.userId },
      isActive: true,
      role: { $in: Array.from(ALLOWED_ROLES) }
    })
      .select('firstName lastName email role avatar profilePhoto position country')
      .sort({ firstName: 1, lastName: 1 })
      .lean();

    return res.json({ success: true, data: users });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/inbox', async (req, res) => {
  try {
    const currentUserId = new mongoose.Types.ObjectId(req.user.userId);
    const search = String(req.query.search || '').trim();

    const filter = {
      $or: [{ to: currentUserId }, { cc: currentUserId }, { bcc: currentUserId }],
      deletedBy: { $ne: currentUserId }
    };

    if (search) {
      filter.$or = [
        { ...filter.$or[0], subject: { $regex: search, $options: 'i' } },
        { ...filter.$or[1], subject: { $regex: search, $options: 'i' } },
        { ...filter.$or[2], subject: { $regex: search, $options: 'i' } },
        { ...filter.$or[0], body: { $regex: search, $options: 'i' } },
        { ...filter.$or[1], body: { $regex: search, $options: 'i' } },
        { ...filter.$or[2], body: { $regex: search, $options: 'i' } }
      ];
    }

    const emails = await EmailMessage.find(filter)
      .sort({ createdAt: -1 })
      .populate('senderId', 'firstName lastName email role avatar profilePhoto')
      .populate('to', 'firstName lastName email role avatar profilePhoto')
      .populate('cc', 'firstName lastName email role avatar profilePhoto')
      .populate('bcc', 'firstName lastName email role avatar profilePhoto')
      .lean();

    return res.json({
      success: true,
      data: emails.map((e) => mapEmail(e, req.user.userId))
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/sent', async (req, res) => {
  try {
    const currentUserId = new mongoose.Types.ObjectId(req.user.userId);
    const search = String(req.query.search || '').trim();
    const filter = { senderId: currentUserId, deletedBy: { $ne: currentUserId } };

    if (search) {
      filter.$or = [
        { subject: { $regex: search, $options: 'i' } },
        { body: { $regex: search, $options: 'i' } }
      ];
    }

    const emails = await EmailMessage.find(filter)
      .sort({ createdAt: -1 })
      .populate('senderId', 'firstName lastName email role avatar profilePhoto')
      .populate('to', 'firstName lastName email role avatar profilePhoto')
      .populate('cc', 'firstName lastName email role avatar profilePhoto')
      .populate('bcc', 'firstName lastName email role avatar profilePhoto')
      .lean();

    return res.json({
      success: true,
      data: emails.map((e) => mapEmail(e, req.user.userId))
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:emailId', async (req, res) => {
  try {
    const { emailId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(emailId)) {
      return res.status(400).json({ success: false, message: 'Invalid email ID' });
    }

    const currentUserId = new mongoose.Types.ObjectId(req.user.userId);
    const email = await EmailMessage.findOne({
      _id: emailId,
      $or: [{ senderId: currentUserId }, { to: currentUserId }, { cc: currentUserId }, { bcc: currentUserId }],
      deletedBy: { $ne: currentUserId }
    })
      .populate('senderId', 'firstName lastName email role avatar profilePhoto')
      .populate('to', 'firstName lastName email role avatar profilePhoto')
      .populate('cc', 'firstName lastName email role avatar profilePhoto')
      .populate('bcc', 'firstName lastName email role avatar profilePhoto')
      .populate('replyTo', 'subject body senderId createdAt')
      .lean();

    if (!email) {
      return res.status(404).json({ success: false, message: 'Email not found or access denied' });
    }

    return res.json({ success: true, data: mapEmail(email, req.user.userId) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.patch('/:emailId/read', async (req, res) => {
  try {
    const { emailId } = req.params;
    const currentUserId = new mongoose.Types.ObjectId(req.user.userId);

    const email = await EmailMessage.findOneAndUpdate(
      {
        _id: emailId,
        $or: [{ to: currentUserId }, { cc: currentUserId }, { bcc: currentUserId }]
      },
      { $addToSet: { readBy: currentUserId } },
      { new: true }
    ).lean();

    if (!email) {
      return res.status(404).json({ success: false, message: 'Email not found or access denied' });
    }

    return res.json({ success: true, data: mapEmail(email, req.user.userId) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/send', async (req, res) => {
  try {
    const senderId = new mongoose.Types.ObjectId(req.user.userId);
    const to = toObjectIdArray(req.body.to);
    const cc = toObjectIdArray(req.body.cc);
    const bcc = toObjectIdArray(req.body.bcc);
    const allRecipients = uniqObjectIds([...to, ...cc, ...bcc]).filter((id) => String(id) !== String(senderId));

    if (allRecipients.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one recipient is required' });
    }

    const validUsers = await User.find({
      _id: { $in: allRecipients },
      isActive: true,
      role: { $in: Array.from(ALLOWED_ROLES) }
    }).select('_id');

    const validUserIds = new Set(validUsers.map((u) => String(u._id)));
    const safeTo = to.filter((id) => validUserIds.has(String(id)));
    const safeCc = cc.filter((id) => validUserIds.has(String(id)));
    const safeBcc = bcc.filter((id) => validUserIds.has(String(id)));

    if (safeTo.length + safeCc.length + safeBcc.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid recipients found' });
    }

    const email = await EmailMessage.create({
      senderId,
      to: safeTo,
      cc: safeCc,
      bcc: safeBcc,
      subject: String(req.body.subject || '').trim() || '(No Subject)',
      body: String(req.body.body || '').trim(),
      readBy: [senderId]
    });

    const populated = await EmailMessage.findById(email._id)
      .populate('senderId', 'firstName lastName email role avatar profilePhoto')
      .populate('to', 'firstName lastName email role avatar profilePhoto')
      .populate('cc', 'firstName lastName email role avatar profilePhoto')
      .populate('bcc', 'firstName lastName email role avatar profilePhoto')
      .lean();

    return res.status(201).json({ success: true, data: mapEmail(populated, req.user.userId) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/:emailId/reply', async (req, res) => {
  try {
    const { emailId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(emailId)) {
      return res.status(400).json({ success: false, message: 'Invalid email ID' });
    }

    const currentUserId = new mongoose.Types.ObjectId(req.user.userId);
    const parentEmail = await EmailMessage.findOne({
      _id: emailId,
      $or: [{ senderId: currentUserId }, { to: currentUserId }, { cc: currentUserId }, { bcc: currentUserId }]
    }).lean();

    if (!parentEmail) {
      return res.status(404).json({ success: false, message: 'Original email not found or access denied' });
    }

    const participants = uniqObjectIds([
      parentEmail.senderId,
      ...(parentEmail.to || []),
      ...(parentEmail.cc || []),
      ...(parentEmail.bcc || [])
    ]).filter((id) => String(id) !== String(currentUserId));

    const email = await EmailMessage.create({
      threadId: parentEmail.threadId || parentEmail._id.toString(),
      senderId: currentUserId,
      to: participants,
      subject: String(req.body.subject || '').trim() || `Re: ${parentEmail.subject || '(No Subject)'}`,
      body: String(req.body.body || '').trim(),
      replyTo: parentEmail._id,
      readBy: [currentUserId]
    });

    const populated = await EmailMessage.findById(email._id)
      .populate('senderId', 'firstName lastName email role avatar profilePhoto')
      .populate('to', 'firstName lastName email role avatar profilePhoto')
      .populate('cc', 'firstName lastName email role avatar profilePhoto')
      .populate('bcc', 'firstName lastName email role avatar profilePhoto')
      .populate('replyTo', 'subject body senderId createdAt')
      .lean();

    return res.status(201).json({ success: true, data: mapEmail(populated, req.user.userId) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;

