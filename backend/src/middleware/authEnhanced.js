/**
 * Middleware d'authentification et d'autorisation pour le système de gestion des utilisateurs
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const config = require('../config');

/**
 * Middleware d'authentification JWT
 */
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ 
        success: false,
        message: 'Token d\'accès requis' 
      });
    }

    const decoded = jwt.verify(token, config.security.jwtSecret);
    
    // Récupérer les informations utilisateur actuelles depuis la base de données
    const user = await User.findById(decoded.userId || decoded.id)
      .select('-password');
    
    if (!user) {
      return res.status(401).json({ 
        success: false,
        message: 'Utilisateur non trouvé' 
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Erreur authentification:', error);
    return res.status(403).json({ 
      success: false,
      message: 'Token invalide ou expiré' 
    });
  }
};

/**
 * Middleware de vérification du rôle
 */
const requireRole = (requiredRole) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentification requise'
      });
    }

    if (req.user.role !== requiredRole) {
      return res.status(403).json({ 
        success: false,
        message: `Accès interdit - Rôle ${requiredRole} requis` 
      });
    }
    
    next();
  };
};

/**
 * Middleware de vérification du statut approuvé - DESACTIVE
 * Tous les utilisateurs authentifiés ont maintenant accès
 */
const requireApprovedStatus = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentification requise'
    });
  }

  // Plus de vérification de statut - tous les utilisateurs authentifiés ont accès
  next();
};

/**
 * Middleware de vérification du blocage utilisateur
 */
const requireNotBlocked = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentification requise'
    });
  }

  if (req.user.blocked) {
    return res.status(403).json({ 
      success: false,
      message: 'Compte bloqué - Contactez un administrateur',
      code: 'ACCOUNT_BLOCKED'
    });
  }
  
  next();
};

/**
 * Middleware combiné pour les utilisateurs standards
 * Vérifie l'authentification, le statut approuvé et le non-blocage
 */
const requireActiveUser = [
  authenticateToken,
  requireApprovedStatus,
  requireNotBlocked
];

/**
 * Middleware pour les administrateurs S2T
 * Vérifie l'authentification et le rôle S2T
 */
const requireS2TAdmin = [
  authenticateToken,
  requireRole('S2T')
];

/**
 * Middleware de vérification de propriété
 * Vérifie que l'utilisateur peut modifier ses propres données ou est S2T
 */
const requireOwnershipOrS2T = (req, res, next) => {
  const { userId } = req.params;
  
  if (req.user.role === 'S2T' || req.user._id.toString() === userId) {
    return next();
  }
  
  return res.status(403).json({
    success: false,
    message: 'Accès interdit - Vous ne pouvez modifier que vos propres données'
  });
};

/**
 * Middleware de logging des actions sensibles
 */
const logSensitiveActions = (action) => {
  return (req, res, next) => {
    const originalSend = res.send;
    
    res.send = function(data) {
      // Log seulement si l'action a réussi
      if (res.statusCode >= 200 && res.statusCode < 300) {
        console.log(`[AUDIT] ${action} - Utilisateur: ${req.user.email} (${req.user.role}), IP: ${req.ip}, Date: ${new Date().toISOString()}, Params: ${JSON.stringify(req.params)}`);
      }
      
      originalSend.call(this, data);
    };
    
    next();
  };
};

/**
 * Middleware de limitation de taux pour les actions sensibles
 */
const rateLimitSensitiveActions = () => {
  const attempts = new Map();
  
  return (req, res, next) => {
    const key = `${req.user._id}_${req.ip}`;
    const now = Date.now();
    const windowMs = 15 * 60 * 1000; // 15 minutes
    const maxAttempts = 10; // Maximum 10 actions sensibles par fenêtre
    
    if (!attempts.has(key)) {
      attempts.set(key, []);
    }
    
    const userAttempts = attempts.get(key);
    
    // Nettoyer les anciennes tentatives
    const recentAttempts = userAttempts.filter(time => now - time < windowMs);
    
    if (recentAttempts.length >= maxAttempts) {
      return res.status(429).json({
        success: false,
        message: 'Trop d\'actions sensibles - Veuillez patienter avant de réessayer',
        retryAfter: Math.ceil((recentAttempts[0] + windowMs - now) / 1000)
      });
    }
    
    recentAttempts.push(now);
    attempts.set(key, recentAttempts);
    
    next();
  };
};

module.exports = {
  authenticateToken,
  requireRole,
  requireApprovedStatus,
  requireNotBlocked,
  requireActiveUser,
  requireS2TAdmin,
  requireOwnershipOrS2T,
  logSensitiveActions,
  rateLimitSensitiveActions
};