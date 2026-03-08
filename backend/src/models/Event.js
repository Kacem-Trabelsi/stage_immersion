const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  start: { type: Date, required: true },
  end: { type: Date },
  location: { type: String, default: '' },
  description: { type: String, default: '' },
  isOnline: { type: Boolean, default: false },
  meetingType: { type: String, enum: ['ONLINE', 'OFFLINE'], default: 'OFFLINE' },
  meetingLink: { type: String, default: '' },
  targetRoles: [{ type: String, enum: ['STARTUP', 'EXPERT', 'S2T', 'ADMIN'] }],
  color: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Event', eventSchema);


