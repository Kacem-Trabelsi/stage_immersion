const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Note = require('../models/Note');
const { CompanyProfile } = require('../models/CompanyProfile');
const { User } = require('../models/User');
const config = require('../config');

// JWT Secret - Use centralized config
const JWT_SECRET = config.security.jwtSecret;

// Simple auth middleware (reuse pattern from app.js)
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'Missing token' });
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    if (!user) return res.status(401).json({ success: false, message: 'User not found' });
    if (!user.isActive) return res.status(401).json({ success: false, message: 'Account disabled' });
    req.user = user;
    next();
  } catch (err) {
    return res.status(403).json({ success: false, message: 'Invalid token' });
  }
};

// List notes for a company
router.get('/company/:companyId', authenticateToken, async (req, res) => {
  try {
    const { companyId } = req.params;
    const companyExists = await CompanyProfile.findById(companyId).select('_id');
    if (!companyExists) return res.status(404).json({ success: false, message: 'Company not found' });
    const notes = await Note.find({ companyId }).sort({ createdAt: -1 }).populate('authorId', 'firstName lastName username role');
    res.json({ success: true, data: notes });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to list notes', error: err.message });
  }
});

// List notes authored by current user
router.get('/mine', authenticateToken, async (req, res) => {
  try {
    const notes = await Note.find({ authorId: req.user._id })
      .sort({ createdAt: -1 })
      .populate('authorId', 'firstName lastName username role')
      .populate('companyId', 'companyName');
    res.json({ success: true, data: notes });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to list my notes', error: err.message });
  }
});

// Create a note
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { title, content, priority, tags, companyId, startupUserId, isPinned } = req.body;
    if (!title || !content) {
      return res.status(400).json({ success: false, message: 'title and content are required' });
    }
    if (companyId) {
      const companyExists = await CompanyProfile.findById(companyId).select('_id');
      if (!companyExists) return res.status(404).json({ success: false, message: 'Company not found' });
    }

    const note = await Note.create({
      title,
      content,
      priority: priority || 'Medium',
      tags: Array.isArray(tags) ? tags : [],
      companyId: companyId || undefined,
      startupUserId: startupUserId || undefined,
      authorId: req.user._id,
      isPinned: !!isPinned
    });

    const populated = await note.populate('authorId', 'firstName lastName username role');
    res.status(201).json({ success: true, data: populated });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to create note', error: err.message });
  }
});

// Update a note (author only)
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const note = await Note.findById(id);
    if (!note) return res.status(404).json({ success: false, message: 'Note not found' });
    if (String(note.authorId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Not allowed' });
    }
    const allowed = ['title', 'content', 'priority', 'tags', 'isPinned', 'isArchived'];
    for (const key of allowed) {
      if (key in req.body) note[key] = req.body[key];
    }
    await note.save();
    const populated = await note.populate('authorId', 'firstName lastName username role');
    res.json({ success: true, data: populated });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update note', error: err.message });
  }
});

// Delete a note (author only)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const note = await Note.findById(id);
    if (!note) return res.status(404).json({ success: false, message: 'Note not found' });
    if (String(note.authorId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Not allowed' });
    }
    await Note.findByIdAndDelete(id);
    res.json({ success: true, message: 'Note deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete note', error: err.message });
  }
});

module.exports = router;


