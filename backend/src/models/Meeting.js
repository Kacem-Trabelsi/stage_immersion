const mongoose = require('mongoose');

const meetingSchema = new mongoose.Schema({
  creatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true, trim: true },
  start: { type: Date, required: true },
  end: { type: Date },
  description: { type: String, default: '' },
  location: { type: String, default: '' },
  isOnline: { type: Boolean, default: true },
  meetingType: { type: String, enum: ['ONLINE', 'OFFLINE'], default: 'ONLINE' },
  meetingLink: { type: String, default: '' },
  targetRoles: [{ type: String, enum: ['STARTUP', 'EXPERT', 'S2T', 'ALL'] }],
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Meeting', meetingSchema);
