// backend/src/app.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const fileUpload = require('express-fileupload');
// ✅ Import du modèle User
const { User, UserRole } = require('./models/User');
// ✅ Import de la configuration centralisée
const config = require('./config');

const app = express();

// JWT Secret from centralized config
const JWT_SECRET = config.security.jwtSecret;

// 📊 Logging Helper Functions
const logInfo = (message, data = null) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ℹ️  INFO: ${message}`, data ? JSON.stringify(data, null, 2) : '');
};

const logError = (message, error = null, req = null) => {
  const timestamp = new Date().toISOString();
  const errorDetails = {
    message,
    error: error?.message || error,
    stack: error?.stack,
    url: req?.originalUrl,
    method: req?.method,
    ip: req?.ip || req?.connection?.remoteAddress,
    userAgent: req?.get('User-Agent'),
    timestamp
  };
  console.error(`[${timestamp}] ❌ ERROR: ${message}`, JSON.stringify(errorDetails, null, 2));
};

const logWarning = (message, data = null) => {
  const timestamp = new Date().toISOString();
  console.warn(`[${timestamp}] ⚠️  WARNING: ${message}`, data ? JSON.stringify(data, null, 2) : '');
};

const logSuccess = (message, data = null) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ✅ SUCCESS: ${message}`, data ? JSON.stringify(data, null, 2) : '');
};

// 🌐 Middleware avec logging
// 🌐 Middleware avec logging
app.use(cors({
  origin: 'http://localhost:3000', // ✅ Change from 4200 to 3000
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));


app.use(express.json({ limit: '10mb' }));

// Upload routes use multer internally; mount before express-fileupload to avoid multipart conflicts
app.use('/api/uploads', require('./routes/uploadRoutes'));

// Configure file upload middleware
app.use(fileUpload({
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max file size
  abortOnLimit: true,
  useTempFiles: true,
  tempFileDir: '/tmp/'
}));

// Set up static file serving for uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/user', require('./routes/userRoutes'));
app.use('/api/company-profile', require('./routes/companyProfile'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/posts', require('./routes/postRoutes'));
app.use('/api/user-management', require('./routes/userManagement'));

app.use('/api/voice-calls', require('./routes/voiceCalls'));
app.use('/api/events', require('./routes/events'));
app.use('/api/meetings', require('./routes/meetingRoutes'));
app.use('/api/notes', require('./routes/notes'));
app.use('/api/obstacles', require('./routes/obstacles'));
app.use('/api/tickets', require('./routes/tickets'));
app.use('/api/emails', require('./routes/emails'));


// 📝 Request Logging Middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const logData = {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
    contentType: req.get('Content-Type'),
    contentLength: req.get('Content-Length'),
    timestamp
  };
  
  logInfo(`Incoming ${req.method} request to ${req.originalUrl}`, logData);
  
  // Log response
  const originalSend = res.send;
  res.send = function(data) {
    logInfo(`Response ${res.statusCode} for ${req.method} ${req.originalUrl}`, {
      statusCode: res.statusCode,
      responseSize: data ? data.length : 0,
      duration: Date.now() - new Date(timestamp).getTime() + 'ms'
    });
    originalSend.call(this, data);
  };
  
  next();
});

// 🌐 Connexion MongoDB avec logging amélioré
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/synergypark';

mongoose.connect(mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  logSuccess('Connexion à MongoDB réussie', { uri: mongoUri.replace(/\/\/.*@/, '//***:***@') });
})
.catch(err => {
  logError('Erreur de connexion MongoDB', err);
  process.exit(1);
});

// MongoDB Event Listeners
mongoose.connection.on('error', (err) => {
  logError('Erreur MongoDB', err);
});

mongoose.connection.on('disconnected', () => {
  logWarning('MongoDB déconnecté');
});

mongoose.connection.on('reconnected', () => {
  logInfo('MongoDB reconnecté');
});

// 🔐 Authentication Middleware avec logging
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      logWarning('Tentative d\'accès sans token', {
        url: req.originalUrl,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      return res.status(401).json({
        message: 'Token d\'accès manquant',
        code: 'MISSING_TOKEN'
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      logWarning('Token valide mais utilisateur non trouvé', {
        userId: decoded.userId,
        url: req.originalUrl
      });
      return res.status(401).json({
        message: 'Utilisateur non trouvé',
        code: 'USER_NOT_FOUND'
      });
    }

    if (!user.isActive) {
      logWarning('Tentative d\'accès avec compte désactivé', {
        userId: user._id,
        username: user.username
      });
      return res.status(401).json({
        message: 'Compte désactivé',
        code: 'ACCOUNT_DISABLED'
      });
    }

    req.user = user;
    logInfo(`Utilisateur authentifié: ${user.username}`, {
      userId: user._id,
      role: user.role,
      url: req.originalUrl
    });
    next();
  } catch (err) {
    logError('Erreur d\'authentification', err, req);
    return res.status(403).json({
      message: 'Token invalide',
      code: 'INVALID_TOKEN',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// 🔒 Error Response Helper
const sendErrorResponse = (res, statusCode, message, code = null, details = null) => {
  const response = {
    success: false,
    message,
    code,
    timestamp: new Date().toISOString()
  };
  
  if (details && process.env.NODE_ENV === 'development') {
    response.details = details;
  }
  
  return res.status(statusCode).json(response);
};

// ✅ Success Response Helper
const sendSuccessResponse = (res, statusCode, message, data = null) => {
  const response = {
    success: true,
    message,
    timestamp: new Date().toISOString()
  };
  
  if (data) {
    response.data = data;
  }
  
  return res.status(statusCode).json(response);
};

// ✅ Route de test simple
app.get('/api/test', (req, res) => {
  logInfo('Test endpoint accessed');
  sendSuccessResponse(res, 200, 'API fonctionne correctement !', {
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

// ✅ Health Check Route
app.get('/api/health', async (req, res) => {
  try {
    const dbState = mongoose.connection.readyState;
    const dbStatus = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting'
    };

    const healthData = {
      status: dbState === 1 ? 'healthy' : 'unhealthy',
      database: {
        status: dbStatus[dbState],
        state: dbState
      },
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString()
    };

    if (dbState === 1) {
      await User.countDocuments();
      logInfo('Health check passed');
      sendSuccessResponse(res, 200, 'Service healthy', healthData);
    } else {
      logError('Health check failed - Database not connected');
      sendErrorResponse(res, 503, 'Service unhealthy', 'DATABASE_DISCONNECTED', healthData);
    }
  } catch (err) {
    logError('Health check error', err);
    sendErrorResponse(res, 503, 'Service unhealthy', 'HEALTH_CHECK_ERROR', {
      error: err.message
    });
  }
});

// ✅ AUTHENTICATION ROUTES

// SIGNUP Route
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { username, email, password, firstName, lastName, role } = req.body;
    
    logInfo('Tentative d\'inscription', { username, email, role });
    
    if (!username || !email || !password || !firstName) {
      logWarning('Inscription échouée - champs manquants', { 
        received: { username: !!username, email: !!email, password: !!password, firstName: !!firstName }
      });
      return sendErrorResponse(res, 400, 'Les champs username, email, password et firstName sont requis', 'MISSING_FIELDS');
    }

    if (password.length < 6) {
      logWarning('Inscription échouée - mot de passe trop court', { username, email });
      return sendErrorResponse(res, 400, 'Le mot de passe doit contenir au moins 6 caractères', 'WEAK_PASSWORD');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      logWarning('Inscription échouée - email invalide', { username, email });
      return sendErrorResponse(res, 400, 'Format d\'email invalide', 'INVALID_EMAIL');
    }

    if (role && !Object.values(UserRole).includes(role)) {
      logWarning('Inscription échouée - rôle invalide', { username, email, role });
      return sendErrorResponse(res, 400, `Le rôle doit être l'un des suivants: ${Object.values(UserRole).join(', ')}`, 'INVALID_ROLE');
    }

    const existingUser = await User.findOne({ 
      $or: [{ email }, { username }] 
    });
    
    if (existingUser) {
      logWarning('Inscription échouée - utilisateur existant', { 
        username, 
        email, 
        existingField: existingUser.email === email ? 'email' : 'username' 
      });
      return sendErrorResponse(res, 409, 'Un utilisateur avec cet email ou nom d\'utilisateur existe déjà', 'USER_EXISTS');
    }

    const newUser = new User({
      username,
      email,
      password,
      firstName,
      lastName,
      role: role || UserRole.STARTUP
    });

    await newUser.save();
    logSuccess('Nouvel utilisateur créé', { userId: newUser._id, username, email, role: newUser.role });

    const token = jwt.sign(
      { 
        userId: newUser._id, 
        username: newUser.username,
        role: newUser.role 
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    const userData = {
      id: newUser._id,
      username: newUser.username,
      email: newUser.email,
      firstName: newUser.firstName,
      lastName: newUser.lastName,
      role: newUser.role,
      isActive: newUser.isActive,
      createdAt: newUser.createdAt
    };

    sendSuccessResponse(res, 201, 'Utilisateur créé avec succès', {
      token,
      user: userData
    });

  } catch (err) {
    logError('Erreur lors de l\'inscription', err, req);
    
    if (err.name === 'ValidationError') {
      const errors = Object.keys(err.errors).map(key => ({
        field: key,
        message: err.errors[key].message
      }));
      return sendErrorResponse(res, 400, 'Erreur de validation', 'VALIDATION_ERROR', { errors });
    }
    
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern)[0];
      return sendErrorResponse(res, 409, `Ce ${field} est déjà utilisé`, 'DUPLICATE_FIELD');
    }
    
    sendErrorResponse(res, 500, 'Erreur lors de l\'inscription', 'SIGNUP_ERROR', { error: err.message });
  }
});

// SIGNIN Route
app.post('/api/auth/signin', async (req, res) => {
  try {
    const { login, password } = req.body;
    
    logInfo('Tentative de connexion', { login });
    
    if (!login || !password) {
      logWarning('Connexion échouée - champs manquants', { login: !!login, password: !!password });
      return sendErrorResponse(res, 400, 'Email/nom d\'utilisateur et mot de passe sont requis', 'MISSING_CREDENTIALS');
    }

    const user = await User.findOne({
      $or: [{ email: login }, { username: login }]
    });

    if (!user) {
      logWarning('Connexion échouée - utilisateur non trouvé', { login });
      return sendErrorResponse(res, 401, 'Identifiants invalides', 'INVALID_CREDENTIALS');
    }

    if (!user.isActive) {
      logWarning('Connexion échouée - compte désactivé', { userId: user._id, username: user.username });
      return sendErrorResponse(res, 401, 'Compte désactivé', 'ACCOUNT_DISABLED');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      logWarning('Connexion échouée - mot de passe incorrect', { userId: user._id, username: user.username });
      return sendErrorResponse(res, 401, 'Identifiants invalides', 'INVALID_CREDENTIALS');
    }

    await User.findByIdAndUpdate(user._id, { lastLogin: new Date() });
    logSuccess('Connexion réussie', { userId: user._id, username: user.username, role: user.role });

    const token = jwt.sign(
      { 
        userId: user._id, 
        username: user.username,
        role: user.role 
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    const userData = {
      id: user._id,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isActive: user.isActive,
      profilePhoto: user.profilePhoto,
      avatar: user.avatar,
      lastLogin: new Date()
    };

    sendSuccessResponse(res, 200, 'Connexion réussie', {
      token,
      user: userData
    });

  } catch (err) {
    logError('Erreur lors de la connexion', err, req);
    sendErrorResponse(res, 500, 'Erreur lors de la connexion', 'SIGNIN_ERROR', { error: err.message });
  }
});

// SIGNOUT Route
app.post('/api/auth/signout', (req, res) => {
  logInfo('Déconnexion utilisateur');
  sendSuccessResponse(res, 200, 'Déconnexion réussie');
});

// Verify Token Route
app.get('/api/auth/verify', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      logWarning('Vérification token - token manquant');
      return sendErrorResponse(res, 401, 'Token manquant', 'MISSING_TOKEN');
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      logWarning('Vérification token - utilisateur non trouvé', { userId: decoded.userId });
      return sendErrorResponse(res, 401, 'Utilisateur non trouvé', 'USER_NOT_FOUND');
    }

    logInfo('Token vérifié avec succès', { userId: user._id, username: user.username });

    const userData = {
      id: user._id,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isActive: user.isActive,
      avatar: user.avatar,
      profilePhoto: user.profilePhoto
    };

    sendSuccessResponse(res, 200, 'Token valide', { user: userData });

  } catch (err) {
    logError('Erreur lors de la vérification du token', err, req);
    sendErrorResponse(res, 401, 'Token invalide', 'INVALID_TOKEN', { error: err.message });
  }
});

// ✅ PASSWORD RESET ROUTES (MOVED HERE - BEFORE 404 HANDLER)

// Password Reset Request
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    
    logInfo('Demande de réinitialisation de mot de passe', { email });
    
    if (!email) {
      logWarning('Demande de reset échouée - email manquant');
      return sendErrorResponse(res, 400, 'Email requis', 'MISSING_EMAIL');
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      logWarning('Demande de reset échouée - email invalide', { email });
      return sendErrorResponse(res, 400, 'Format d\'email invalide', 'INVALID_EMAIL');
    }
    
    const user = await User.findOne({ email });
    
    if (!user) {
      logWarning('Demande de reset échouée - utilisateur non trouvé', { email });
      return sendSuccessResponse(res, 200, 'Si cet email existe, un lien de réinitialisation a été envoyé');
    }
    
    if (!user.isActive) {
      logWarning('Demande de reset échouée - compte désactivé', { email });
      return sendErrorResponse(res, 401, 'Compte désactivé', 'ACCOUNT_DISABLED');
    }
    
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    if (user.lastPasswordResetRequest > oneHourAgo && user.passwordResetAttempts >= 5) {
      logWarning('Demande de reset échouée - trop de tentatives', { email });
      return sendErrorResponse(res, 429, 'Trop de tentatives. Réessayez dans une heure.', 'TOO_MANY_ATTEMPTS');
    }
    
    const crypto = require('crypto');
    const resetToken = crypto.randomBytes(32).toString('hex');
    
    user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.resetPasswordExpires = Date.now() + 15 * 60 * 1000;
    user.passwordResetAttempts = (user.passwordResetAttempts || 0) + 1;
    user.lastPasswordResetRequest = new Date();
    
    await user.save();
    
    if (process.env.NODE_ENV === 'development') {
      logInfo('Reset token généré (DEV ONLY)', { 
        email, 
        resetToken,
        resetUrl: `${process.env.FRONTEND_URL || 'http://localhost:4200'}/reset-password?token=${resetToken}`
      });
      
      return sendSuccessResponse(res, 200, 'Token de réinitialisation généré', {
        message: 'Un lien de réinitialisation a été envoyé à votre email',
        resetToken: resetToken,
        resetUrl: `${process.env.FRONTEND_URL || 'http://localhost:4200'}/reset-password?token=${resetToken}`
      });
    }
    
    logSuccess('Email de réinitialisation envoyé', { email, userId: user._id });
    sendSuccessResponse(res, 200, 'Si cet email existe, un lien de réinitialisation a été envoyé');
    
  } catch (err) {
    logError('Erreur lors de la demande de réinitialisation', err, req);
    sendErrorResponse(res, 500, 'Erreur serveur', 'SERVER_ERROR');
  }
});

// Password Reset Verification
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    
    logInfo('Tentative de réinitialisation de mot de passe');
    
    if (!token || !newPassword) {
      logWarning('Réinitialisation échouée - champs manquants');
      return sendErrorResponse(res, 400, 'Token et nouveau mot de passe requis', 'MISSING_FIELDS');
    }
    
    if (newPassword.length < 6) {
      logWarning('Réinitialisation échouée - mot de passe trop faible');
      return sendErrorResponse(res, 400, 'Le mot de passe doit contenir au moins 6 caractères', 'WEAK_PASSWORD');
    }
    
    const crypto = require('crypto');
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() }
    });
    
    if (!user) {
      logWarning('Réinitialisation échouée - token invalide ou expiré');
      return sendErrorResponse(res, 400, 'Token invalide ou expiré', 'INVALID_TOKEN');
    }
    
    if (!user.isActive) {
      logWarning('Réinitialisation échouée - compte désactivé', { userId: user._id });
      return sendErrorResponse(res, 401, 'Compte désactivé', 'ACCOUNT_DISABLED');
    }
    
    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    user.passwordResetAttempts = 0;
    user.lastPasswordResetRequest = undefined;
    
    await user.save();
    
    logSuccess('Mot de passe réinitialisé avec succès', { 
      userId: user._id, 
      username: user.username 
    });
    
    sendSuccessResponse(res, 200, 'Mot de passe réinitialisé avec succès');
    
  } catch (err) {
    logError('Erreur lors de la réinitialisation du mot de passe', err, req);
    sendErrorResponse(res, 500, 'Erreur serveur', 'SERVER_ERROR');
  }
});

// Verify Reset Token
app.get('/api/auth/verify-reset-token/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    logInfo('Vérification du token de réinitialisation');
    
    const crypto = require('crypto');
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() }
    });
    
    if (!user) {
      logWarning('Token de réinitialisation invalide ou expiré');
      return sendErrorResponse(res, 400, 'Token invalide ou expiré', 'INVALID_TOKEN');
    }
    
    logInfo('Token de réinitialisation valide', { userId: user._id });
    
    sendSuccessResponse(res, 200, 'Token valide', {
      email: user.email,
      firstName: user.firstName
    });
    
  } catch (err) {
    logError('Erreur lors de la vérification du token', err, req);
    sendErrorResponse(res, 500, 'Erreur serveur', 'SERVER_ERROR');
  }
});

// ✅ Protected Profile Route
app.get('/api/profile', authenticateToken, (req, res) => {
  logInfo('Accès au profil utilisateur', { userId: req.user._id, username: req.user.username });
  sendSuccessResponse(res, 200, 'Profil utilisateur récupéré', { user: req.user });
});

// ✅ CRUD ROUTES (Protected)

// READ ALL Users - Protected
app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    logInfo('Récupération de tous les utilisateurs', { requestedBy: req.user.username });
    
    const users = await User.find().select('-password');
    
    logSuccess('Utilisateurs récupérés', { count: users.length, requestedBy: req.user.username });
    
    sendSuccessResponse(res, 200, 'Utilisateurs récupérés avec succès', {
      count: users.length,
      users
    });
  } catch (err) {
    logError('Erreur lors de la récupération des utilisateurs', err, req);
    sendErrorResponse(res, 500, 'Erreur lors de la récupération des utilisateurs', 'FETCH_USERS_ERROR', { error: err.message });
  }
});

// READ ONE User - Protected
app.get('/api/user/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    logInfo('Récupération d\'un utilisateur', { userId: id, requestedBy: req.user.username });
    const user = await User.findById(id).select('-password');
    if (!user) {
      logWarning('Utilisateur non trouvé', { userId: id, requestedBy: req.user.username });
      return sendErrorResponse(res, 404, 'Utilisateur non trouvé', 'USER_NOT_FOUND');
    }
    logSuccess('Utilisateur trouvé', { userId: id, username: user.username });
    sendSuccessResponse(res, 200, 'Utilisateur trouvé', { user });
  } catch (err) {
    logError('Erreur lors de la récupération de l\'utilisateur', err, req);
    if (err.name === 'CastError') {
      return sendErrorResponse(res, 400, 'ID utilisateur invalide', 'INVALID_USER_ID');
    }
    sendErrorResponse(res, 500, 'Erreur lors de la récupération de l\'utilisateur', 'FETCH_USER_ERROR', { error: err.message });
  }
});

// UPDATE User - Protected
app.put('/api/users/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { username, email, firstName, lastName, role, isActive, profilePhoto } = req.body;
    
    logInfo('Mise à jour d\'un utilisateur', { 
      userId: id, 
      updatedBy: req.user.username,
      updates: { username: !!username, email: !!email, firstName: !!firstName, role: !!role }
    });
    
    if (role && !Object.values(UserRole).includes(role)) {
      logWarning('Mise à jour utilisateur échouée - rôle invalide', { 
        userId: id, 
        role, 
        updatedBy: req.user.username 
      });
      return sendErrorResponse(res, 400, `Le rôle doit être l'un des suivants: ${Object.values(UserRole).join(', ')}`, 'INVALID_ROLE');
    }

    const updateData = {};
    if (username) updateData.username = username;
    if (email) updateData.email = email;
    if (firstName) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (role) updateData.role = role;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (profilePhoto !== undefined) updateData.profilePhoto = profilePhoto;

    const updatedUser = await User.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    if (!updatedUser) {
      logWarning('Mise à jour échouée - utilisateur non trouvé', { 
        userId: id, 
        updatedBy: req.user.username 
      });
      return sendErrorResponse(res, 404, 'Utilisateur non trouvé', 'USER_NOT_FOUND');
    }

    logSuccess('Utilisateur mis à jour avec succès', { 
      userId: id, 
      username: updatedUser.username,
      updatedBy: req.user.username 
    });

    sendSuccessResponse(res, 200, 'Utilisateur mis à jour avec succès', { user: updatedUser });
    
  } catch (err) {
    logError('Erreur lors de la mise à jour de l\'utilisateur', err, req);
    
    if (err.name === 'ValidationError') {
      const errors = Object.keys(err.errors).map(key => ({
        field: key,
        message: err.errors[key].message
      }));
      return sendErrorResponse(res, 400, 'Erreur de validation', 'VALIDATION_ERROR', { errors });
    }
    
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern)[0];
      return sendErrorResponse(res, 409, `Ce ${field} est déjà utilisé`, 'DUPLICATE_FIELD');
    }
    
    if (err.name === 'CastError') {
      return sendErrorResponse(res, 400, 'ID utilisateur invalide', 'INVALID_USER_ID');
    }

    sendErrorResponse(res, 500, 'Erreur lors de la mise à jour de l\'utilisateur', 'UPDATE_USER_ERROR', { error: err.message });
  }
});

// DELETE User - Protected
app.delete('/api/users/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    logInfo('Suppression d\'un utilisateur', { userId: id, deletedBy: req.user.username });
    
    const deletedUser = await User.findByIdAndDelete(id);
    
    if (!deletedUser) {
      logWarning('Suppression échouée - utilisateur non trouvé', { 
        userId: id, 
        deletedBy: req.user.username 
      });
      return sendErrorResponse(res, 404, 'Utilisateur non trouvé', 'USER_NOT_FOUND');
    }
    
    logSuccess('Utilisateur supprimé avec succès', { 
      userId: id, 
      username: deletedUser.username,
      deletedBy: req.user.username 
    });
    
    sendSuccessResponse(res, 200, 'Utilisateur supprimé avec succès', {
      deletedUser: {
        id: deletedUser._id,
        username: deletedUser.username,
        email: deletedUser.email
      }
    });
    
  } catch (err) {
    logError('Erreur lors de la suppression de l\'utilisateur', err, req);
    
    if (err.name === 'CastError') {
      return sendErrorResponse(res, 400, 'ID utilisateur invalide', 'INVALID_USER_ID');
    }
    
    sendErrorResponse(res, 500, 'Erreur lors de la suppression de l\'utilisateur', 'DELETE_USER_ERROR', { error: err.message });
  }
});

// ✅ Test route (unprotected)
app.post('/api/test-create-user', async (req, res) => {
  try {
    const { username, email, password, firstName, lastName, role } = req.body;
    
    logInfo('Test - Création d\'utilisateur', { username, email, role });
    
    if (!username || !email || !password || !firstName) {
      logWarning('Test création échouée - champs manquants', { 
        received: { username: !!username, email: !!email, password: !!password, firstName: !!firstName }
      });
      return sendErrorResponse(res, 400, 'Les champs username, email, password et firstName sont requis', 'MISSING_FIELDS', { received: req.body });
    }

    if (role && !Object.values(UserRole).includes(role)) {
      logWarning('Test création échouée - rôle invalide', { role });
      return sendErrorResponse(res, 400, `Le rôle doit être l'un des suivants: ${Object.values(UserRole).join(', ')}`, 'INVALID_ROLE', { received: role });
    }

    const newUser = new User({
      username,
      email,
      password,
      firstName,
      lastName,
      role: role || UserRole.STARTUP,
      lastLogin: new Date(),
      isActive: true,
      profilePhoto: req.body.profilePhoto || ''
    });

    await newUser.save();
    
    logSuccess('Test - Utilisateur créé avec succès', { 
      userId: newUser._id, 
      username, 
      email 
    });
    
    const userData = {
      id: newUser._id,
      username: newUser.username,
      email: newUser.email,
      firstName: newUser.firstName,
      lastName: newUser.lastName,
      role: newUser.role,
      isActive: newUser.isActive,
      profilePhoto: newUser.profilePhoto,
      createdAt: newUser.createdAt,
      lastLogin: newUser.lastLogin
    };

    sendSuccessResponse(res, 201, 'Utilisateur créé avec succès', { user: userData });
    
  } catch (err) {
    logError('Erreur lors du test de création d\'utilisateur', err, req);
    
    if (err.name === 'ValidationError') {
      const errors = Object.keys(err.errors).map(key => ({
        field: key,
        message: err.errors[key].message
      }));
      return sendErrorResponse(res, 400, 'Erreur de validation', 'VALIDATION_ERROR', { errors });
    }
    
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern)[0];
      return sendErrorResponse(res, 409, `Ce ${field} est déjà utilisé`, 'DUPLICATE_FIELD', { error: `Duplicate ${field}` });
    }
    
    sendErrorResponse(res, 500, 'Erreur lors de la création de l\'utilisateur', 'TEST_CREATE_ERROR', { 
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

// ✅ 404 Handler - Route non trouvée (MUST BE LAST!)
app.use((req, res) => {
  logWarning('Route non trouvée', { 
    url: req.originalUrl, 
    method: req.method,
    ip: req.ip 
  });
  sendErrorResponse(res, 404, 'Route non trouvée', 'ROUTE_NOT_FOUND', {
    requestedUrl: req.originalUrl,
    method: req.method
  });
});

// ✅ Gestionnaire d'erreurs global
app.use((err, req, res, next) => {
  logError('Erreur globale non gérée', err, req);
  
  if (res.headersSent) {
    return next(err);
  }
  
  sendErrorResponse(res, 500, 'Erreur interne du serveur', 'INTERNAL_SERVER_ERROR', {
    error: process.env.NODE_ENV === 'development' ? err.message : 'Une erreur interne s\'est produite'
  });
});

// ✅ Graceful shutdown
process.on('SIGTERM', () => {
  logInfo('SIGTERM reçu, arrêt du serveur...');
  mongoose.connection.close(() => {
    logInfo('Connexion MongoDB fermée');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logInfo('SIGINT reçu, arrêt du serveur...');
  mongoose.connection.close(() => {
    logInfo('Connexion MongoDB fermée');
    process.exit(0);
  });
});

// 🔍 Diagnostic endpoint for checking connections
app.get('/api/diagnostic/connections', (req, res) => {
  try {
    // Get socket manager instance from global
    const io = require('./server').io;
    const socketManager = io.socketManager;
    
    if (socketManager) {
      res.json({
        success: true,
        data: {
          message: 'Backend is running',
          timestamp: new Date().toISOString(),
          port: process.env.PORT || 5000,
          totalConnectedUsers: socketManager.connectedUsers.size,
          connectedUsers: Array.from(socketManager.connectedUsers.keys()),
          socketConnections: socketManager.userSockets.size
        }
      });
    } else {
      res.json({
        success: true,
        data: {
          message: 'Backend is running (Socket manager not available)',
          timestamp: new Date().toISOString(),
          port: process.env.PORT || 5000
        }
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error getting connection info',
      error: error.message
    });
  }
});

// ✅ Export de l'app
module.exports = app;
