// backend/src/middleware/auth.js
const jwt = require('jsonwebtoken');
const { User } = require('../models/User');
const config = require('../config');

console.log('AUTH MIDDLEWARE LOADED');

// Middleware pour vérifier le token JWT
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    console.log('AUTH DEBUG: Authorization header:', authHeader);

    if (!token) {
      console.log('AUTH DEBUG: No token found');
      return res.status(401).json({
        message: 'Token d\'accès manquant'
      });
    }

    const decoded = jwt.verify(token, config.security.jwtSecret);
    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      console.log('AUTH DEBUG: User not found for token:', decoded.userId);
      return res.status(401).json({
        message: 'Utilisateur non trouvé'
      });
    }

    if (!user.isActive) {
      console.log('AUTH DEBUG: User is not active:', user.username);
      return res.status(401).json({
        message: 'Compte désactivé'
      });
    }

    req.user = {
      userId: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      isActive: user.isActive
    };
    console.log('AUTH DEBUG: Authenticated user:', req.user);
    next();
  } catch (err) {
    console.log('AUTH DEBUG: Token invalid or error:', err.message);
    return res.status(403).json({
      message: 'Token invalide',
      error: err.message
    });
  }
};

// Middleware pour vérifier les rôles
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        message: 'Utilisateur non authentifié'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: 'Accès non autorisé pour ce rôle'
      });
    }

    next();
  };
};

module.exports = {
  authenticateToken,
  authorizeRoles
};
