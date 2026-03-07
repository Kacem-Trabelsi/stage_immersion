const mongoose = require('mongoose');

// Énumérations pour les tickets de problèmes de startup
const TicketCategory = Object.freeze({
  TECHNICAL: 'TECHNICAL',           // Problème technique
  BUSINESS: 'BUSINESS',             // Problème business
  LEGAL: 'LEGAL',                   // Problème légal
  FINANCIAL: 'FINANCIAL',           // Problème financier
  MARKETING: 'MARKETING',           // Problème marketing
  OPERATIONAL: 'OPERATIONAL',       // Problème opérationnel
  HUMAN_RESOURCES: 'HUMAN_RESOURCES', // Problème RH
  OTHER: 'OTHER'                    // Autre
});

const TicketPriority = Object.freeze({
  LOW: 'LOW',                       // Faible
  MEDIUM: 'MEDIUM',                 // Moyen
  HIGH: 'HIGH',                     // Élevé
  URGENT: 'URGENT'                  // Urgent
});

const TicketStatus = Object.freeze({
  OPEN: 'OPEN',                     // Ouvert
  IN_PROGRESS: 'IN_PROGRESS',       // En cours
  PENDING: 'PENDING',               // En attente
  RESOLVED: 'RESOLVED',             // Résolu
  CLOSED: 'CLOSED'                  // Fermé
});

const TicketImpact = Object.freeze({
  LOW: 'LOW',                       // Impact faible
  MEDIUM: 'MEDIUM',                 // Impact moyen
  HIGH: 'HIGH',                     // Impact élevé
  CRITICAL: 'CRITICAL'              // Impact critique
});

const ticketSchema = new mongoose.Schema({
  // Informations de base
  title: {
    type: String,
    required: [true, 'Le titre est requis'],
    trim: true,
    maxlength: [200, 'Le titre ne peut pas dépasser 200 caractères']
  },
  
  description: {
    type: String,
    required: [true, 'La description est requise'],
    trim: true,
    maxlength: [2000, 'La description ne peut pas dépasser 2000 caractères']
  },
  
  category: {
    type: String,
    enum: Object.values(TicketCategory),
    required: [true, 'La catégorie est requise'],
    default: TicketCategory.OTHER
  },
  
  priority: {
    type: String,
    enum: Object.values(TicketPriority),
    required: [true, 'La priorité est requise'],
    default: TicketPriority.MEDIUM
  },
  
  status: {
    type: String,
    enum: Object.values(TicketStatus),
    default: TicketStatus.OPEN
  },
  
  impact: {
    type: String,
    enum: Object.values(TicketImpact),
    required: [true, 'L\'impact est requis'],
    default: TicketImpact.MEDIUM
  },
  
  // Informations de contact
  contactEmail: {
    type: String,
    required: [true, 'L\'email de contact est requis'],
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Format d\'email invalide']
  },
  
  contactPhone: {
    type: String,
    trim: true,
    default: ''
  },
  
  // Informations sur la startup
  companyName: {
    type: String,
    required: [true, 'Le nom de l\'entreprise est requis'],
    trim: true,
    maxlength: [100, 'Le nom de l\'entreprise ne peut pas dépasser 100 caractères']
  },
  
  // Solution proposée (optionnelle)
  proposedSolution: {
    type: String,
    trim: true,
    maxlength: [1000, 'La solution proposée ne peut pas dépasser 1000 caractères'],
    default: ''
  },
  
  // Référence à l'utilisateur qui a créé le ticket
  reportedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false // Peut être null si signalé anonymement
  },
  
  // Référence à l'utilisateur assigné pour résoudre le ticket
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  
  // Commentaires et suivi
  comments: [{
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: [500, 'Le commentaire ne peut pas dépasser 500 caractères']
    },
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    isInternal: {
      type: Boolean,
      default: false // true pour les commentaires internes (non visibles par le startup)
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    reactions: {
      LIKE: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      LOVE: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
    }
  }],
  reactions: {
    LIKE: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    LOVE: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
  },
  
  // Fichiers joints
  attachments: [{
    fileName: { type: String, required: true },
    filePath: { type: String, required: true },
    fileSize: { type: Number, required: true },
    mimeType: { type: String, required: true },
    uploadedAt: { type: Date, default: Date.now }
  }],
  
  // Dates importantes
  dueDate: {
    type: Date,
    default: null
  },
  
  resolvedAt: {
    type: Date,
    default: null
  },
  
  closedAt: {
    type: Date,
    default: null
  },
  
  // Métadonnées
  tags: [{ type: String }],
  
  isUrgent: {
    type: Boolean,
    default: false
  },
  
  isPublic: {
    type: Boolean,
    default: false // true si le ticket peut être visible par d'autres startups
  }
}, {
  timestamps: true
});

// Indexes pour les performances
ticketSchema.index({ reportedBy: 1, createdAt: -1 });
ticketSchema.index({ assignedTo: 1, status: 1 });
ticketSchema.index({ category: 1, priority: 1 });
ticketSchema.index({ status: 1, createdAt: -1 });
ticketSchema.index({ companyName: 1 });

// Méthodes virtuelles
ticketSchema.virtual('isOverdue').get(function() {
  if (this.dueDate && this.status !== TicketStatus.CLOSED && this.status !== TicketStatus.RESOLVED) {
    return new Date() > this.dueDate;
  }
  return false;
});

// Méthodes d'instance
ticketSchema.methods.addComment = function(content, authorId, isInternal = false) {
  this.comments.push({
    content,
    authorId,
    isInternal,
    createdAt: new Date()
  });
  return this.save();
};

ticketSchema.methods.toggleReaction = function(type, userId) {
  if (!this.reactions) this.reactions = { LIKE: [], LOVE: [] };
  const list = this.reactions[type] || [];
  const idx = list.findIndex((u) => u.toString() === userId.toString());
  if (idx >= 0) {
    list.splice(idx, 1);
  } else {
    list.push(userId);
  }
  this.reactions[type] = list;
  return this.save();
};

ticketSchema.methods.toggleCommentReaction = function(commentId, type, userId) {
  const comment = this.comments.id(commentId);
  if (!comment) return Promise.reject(new Error('Commentaire non trouvé'));
  if (!comment.reactions) comment.reactions = { LIKE: [], LOVE: [] };
  const list = comment.reactions[type] || [];
  const idx = list.findIndex((u) => u.toString() === userId.toString());
  if (idx >= 0) {
    list.splice(idx, 1);
  } else {
    list.push(userId);
  }
  comment.reactions[type] = list;
  return this.save();
};

ticketSchema.methods.updateStatus = function(newStatus) {
  this.status = newStatus;
  
  if (newStatus === TicketStatus.RESOLVED) {
    this.resolvedAt = new Date();
  } else if (newStatus === TicketStatus.CLOSED) {
    this.closedAt = new Date();
  }
  
  return this.save();
};

// Méthodes statiques
ticketSchema.statics.getTicketsByStatus = function(status) {
  return this.find({ status }).sort({ createdAt: -1 });
};

ticketSchema.statics.getTicketsByCategory = function(category) {
  return this.find({ category }).sort({ createdAt: -1 });
};

ticketSchema.statics.getOverdueTickets = function() {
  return this.find({
    dueDate: { $lt: new Date() },
    status: { $nin: [TicketStatus.CLOSED, TicketStatus.RESOLVED] }
  }).sort({ dueDate: 1 });
};

// Export des énumérations
ticketSchema.statics.Category = TicketCategory;
ticketSchema.statics.Priority = TicketPriority;
ticketSchema.statics.Status = TicketStatus;
ticketSchema.statics.Impact = TicketImpact;

module.exports = mongoose.model('Ticket', ticketSchema);
