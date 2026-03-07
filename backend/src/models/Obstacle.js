// backend/src/models/Obstacle.js
const mongoose = require('mongoose');

// Énumérations pour les statuts et priorités
const ObstacleStatus = Object.freeze({
  PENDING: 'PENDING',           // En attente
  IN_PROGRESS: 'IN_PROGRESS',   // En cours de traitement
  RESOLVED: 'RESOLVED',         // Résolu
  CLOSED: 'CLOSED',             // Fermé
  CANCELLED: 'CANCELLED'        // Annulé
});

const ObstaclePriority = Object.freeze({
  LOW: 'LOW',                   // Faible
  MEDIUM: 'MEDIUM',             // Moyenne
  HIGH: 'HIGH',                 // Élevée
  CRITICAL: 'CRITICAL'          // Critique
});

const ObstacleCategory = Object.freeze({
  TECHNICAL: 'TECHNICAL',       // Problème Technique
  ADMINISTRATIVE: 'ADMINISTRATIVE', // Problème Administratif
  RESOURCES: 'RESOURCES',       // Manque de Ressources
  TRAINING: 'TRAINING',         // Besoin de Formation
  COMMUNICATION: 'COMMUNICATION', // Problème de Communication
  PROCESS: 'PROCESS',           // Amélioration de Processus
  OTHER: 'OTHER'                // Autre
});

const ObstacleImpact = Object.freeze({
  MINIMAL: 'MINIMAL',           // Impact Minimal
  MODERATE: 'MODERATE',         // Impact Modéré
  IMPORTANT: 'IMPORTANT',       // Impact Important
  CRITICAL: 'CRITICAL'          // Impact Critique
});

const obstacleSchema = new mongoose.Schema({
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
    enum: Object.values(ObstacleCategory),
    required: [true, 'La catégorie est requise'],
    default: ObstacleCategory.OTHER
  },
  
  priority: {
    type: String,
    enum: Object.values(ObstaclePriority),
    required: [true, 'La priorité est requise'],
    default: ObstaclePriority.MEDIUM
  },
  
  impact: {
    type: String,
    enum: Object.values(ObstacleImpact),
    required: [true, 'L\'impact est requis'],
    default: ObstacleImpact.MODERATE
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
  
  // Solution proposée (optionnelle)
  proposedSolution: {
    type: String,
    trim: true,
    maxlength: [1000, 'La solution proposée ne peut pas dépasser 1000 caractères'],
    default: ''
  },
  
  // Statut et suivi
  status: {
    type: String,
    enum: Object.values(ObstacleStatus),
    default: ObstacleStatus.PENDING
  },
  
  // Référence à l'utilisateur qui a créé l'obstacle
  reportedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false // Peut être null si signalé anonymement
  },
  
  // Référence à l'utilisateur assigné pour résoudre l'obstacle
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  
  // Commentaires et suivi
  comments: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    comment: {
      type: String,
      required: true,
      trim: true,
      maxlength: [500, 'Le commentaire ne peut pas dépasser 500 caractères']
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Dates importantes
  createdAt: {
    type: Date,
    default: Date.now
  },
  
  updatedAt: {
    type: Date,
    default: Date.now
  },
  
  resolvedAt: {
    type: Date,
    default: null
  },
  
  // Métadonnées
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  
  // Fichiers joints (optionnel)
  attachments: [{
    filename: String,
    originalName: String,
    path: String,
    size: Number,
    mimeType: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Statistiques
  viewCount: {
    type: Number,
    default: 0
  },
  
  // Indicateur de confidentialité
  isPrivate: {
    type: Boolean,
    default: false
  }
});

// Index pour améliorer les performances de recherche
obstacleSchema.index({ status: 1, priority: 1 });
obstacleSchema.index({ category: 1, createdAt: -1 });
obstacleSchema.index({ reportedBy: 1, createdAt: -1 });
obstacleSchema.index({ assignedTo: 1, status: 1 });
obstacleSchema.index({ createdAt: -1 });

// Middleware pour mettre à jour updatedAt
obstacleSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Middleware pour mettre à jour resolvedAt quand le statut change
obstacleSchema.pre('save', function(next) {
  if (this.isModified('status') && this.status === ObstacleStatus.RESOLVED && !this.resolvedAt) {
    this.resolvedAt = new Date();
  }
  next();
});

// Méthodes d'instance
obstacleSchema.methods.addComment = function(userId, comment) {
  this.comments.push({
    user: userId,
    comment: comment,
    createdAt: new Date()
  });
  return this.save();
};

obstacleSchema.methods.assignTo = function(userId) {
  this.assignedTo = userId;
  this.status = ObstacleStatus.IN_PROGRESS;
  return this.save();
};

obstacleSchema.methods.resolve = function() {
  this.status = ObstacleStatus.RESOLVED;
  this.resolvedAt = new Date();
  return this.save();
};

obstacleSchema.methods.close = function() {
  this.status = ObstacleStatus.CLOSED;
  return this.save();
};

// Méthodes statiques
obstacleSchema.statics.findByStatus = function(status) {
  return this.find({ status: status }).populate('reportedBy assignedTo', 'username email firstName lastName');
};

obstacleSchema.statics.findByCategory = function(category) {
  return this.find({ category: category }).populate('reportedBy assignedTo', 'username email firstName lastName');
};

obstacleSchema.statics.findByPriority = function(priority) {
  return this.find({ priority: priority }).populate('reportedBy assignedTo', 'username email firstName lastName');
};

obstacleSchema.statics.getStatistics = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        pending: { $sum: { $cond: [{ $eq: ['$status', ObstacleStatus.PENDING] }, 1, 0] } },
        inProgress: { $sum: { $cond: [{ $eq: ['$status', ObstacleStatus.IN_PROGRESS] }, 1, 0] } },
        resolved: { $sum: { $cond: [{ $eq: ['$status', ObstacleStatus.RESOLVED] }, 1, 0] } },
        closed: { $sum: { $cond: [{ $eq: ['$status', ObstacleStatus.CLOSED] }, 1, 0] } },
        critical: { $sum: { $cond: [{ $eq: ['$priority', ObstaclePriority.CRITICAL] }, 1, 0] } },
        high: { $sum: { $cond: [{ $eq: ['$priority', ObstaclePriority.HIGH] }, 1, 0] } }
      }
    }
  ]);
  
  return stats[0] || {
    total: 0,
    pending: 0,
    inProgress: 0,
    resolved: 0,
    closed: 0,
    critical: 0,
    high: 0
  };
};

// Virtual pour calculer la durée de résolution
obstacleSchema.virtual('resolutionTime').get(function() {
  if (this.resolvedAt && this.createdAt) {
    return this.resolvedAt - this.createdAt;
  }
  return null;
});

// Configuration pour inclure les virtuals dans JSON
obstacleSchema.set('toJSON', { virtuals: true });
obstacleSchema.set('toObject', { virtuals: true });

const Obstacle = mongoose.model('Obstacle', obstacleSchema);

module.exports = {
  Obstacle,
  ObstacleStatus,
  ObstaclePriority,
  ObstacleCategory,
  ObstacleImpact
};
