const mongoose = require('mongoose');

const emailMessageSchema = new mongoose.Schema(
  {
    threadId: { type: String, index: true, default: '' },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    to: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
    cc: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    bcc: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    subject: { type: String, default: '(No Subject)', trim: true },
    body: { type: String, default: '', trim: true },
    replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'EmailMessage', default: null },
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    deletedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
  },
  { timestamps: true }
);

emailMessageSchema.pre('save', function setThreadId(next) {
  if (!this.threadId) {
    this.threadId = this._id.toString();
  }
  next();
});

module.exports = mongoose.model('EmailMessage', emailMessageSchema);

