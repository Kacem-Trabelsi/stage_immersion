const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  author: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  }, // lien avec ton User model
  type: { 
    type: String, 
    enum: ['OPPORTUNITY', 'SUCCESS', 'EVENT', 'DISCUSSION'], 
    default: 'DISCUSSION' 
  }, // catégoriser les posts
  category: {
    type: String,
    enum: [
      'FUNDING', 'PARTNERSHIP', 'COMMERCIAL', 'MENTORSHIP', // For OPPORTUNITY type
      'STARTUP_SUCCESS', 'INCUBATOR_NEWS', 'RECOGNITION', 'METRICS', // For SUCCESS type
      'WORKSHOP', 'CONFERENCE', 'TRAINING', 'NETWORKING', // For EVENT type
      'GENERAL', 'QUESTION', 'TECHNICAL', 'ECOSYSTEM' // For DISCUSSION type
    ],
    default: 'GENERAL'
  },
  title: { type: String, required: true },
  content: { type: String, required: true },
  media: [{ type: String }], // images, docs, etc.
  attachments: [{ 
    name: String,
    fileUrl: String,
    fileType: String 
  }],
  eventDetails: {
    startDate: Date,
    endDate: Date,
    location: String,
    virtualMeetingUrl: String,
    maxParticipants: Number,
    registeredParticipants: [{ 
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      registrationDate: { type: Date, default: Date.now }
    }]
  },
  tags: [{ type: String }], // For better searchability
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  views: { type: Number, default: 0 },
  comments: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    text: String,
    createdAt: { type: Date, default: Date.now },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
  }],
  isPinned: { type: Boolean, default: false },
  isPrivate: { type: Boolean, default: false },
  targetAudience: [{
    type: String,
    enum: ['STARTUPS', 'MENTORS', 'INVESTORS', 'PARTNERS', 'STAFF', 'ALL'],
    default: 'ALL'
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Add text index for search functionality
postSchema.index({ 
  title: 'text', 
  content: 'text', 
  tags: 'text',
  'eventDetails.location': 'text'
});

// Update the updatedAt field on save
postSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

const Post = mongoose.model('Post', postSchema);
module.exports = Post;
