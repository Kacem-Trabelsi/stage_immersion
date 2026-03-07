const mongoose = require('mongoose');

// Notes left by experts on startups/companies
const noteSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  content: { type: String, required: true },
  priority: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Medium' },
  tags: [{ type: String }],
  // author of the note (expert)
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  // target startup/company (optional)
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'CompanyProfile', index: true },
  // optional link to a specific user/startup account
  startupUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isPinned: { type: Boolean, default: false },
  isArchived: { type: Boolean, default: false }
}, {
  timestamps: true
});

noteSchema.index({ companyId: 1, createdAt: -1 });
noteSchema.index({ authorId: 1, createdAt: -1 });

module.exports = mongoose.model('Note', noteSchema);


