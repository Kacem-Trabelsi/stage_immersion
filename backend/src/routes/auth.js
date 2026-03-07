// backend/src/routes/auth.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const svgCaptcha = require('svg-captcha');
const { User, UserRole } = require('../models/User');
const { sendResetEmail } = require('../services/emailService');
const userController = require('../controllers/userController');
const config = require('../config');

// JWT Secret - Use centralized config
const JWT_SECRET = config.security.jwtSecret;

// Store for reset tokens (in production, use Redis or database)
const resetTokens = new Map();

// ✅ SIGNUP Route
router.post('/signup', async (req, res) => {
  try {
    const { username, email, password, firstName, lastName, role } = req.body;
    
    // Validation des champs requis
    if (!username || !email || !password || !firstName) {
      return res.status(400).json({
        message: 'Les champs username, email, password et firstName sont requis'
      });
    }

    // Validation du mot de passe
    if (password.length < 6) {
      return res.status(400).json({
        message: 'Le mot de passe doit contenir au moins 6 caractères'
      });
    }

    // Validation de l'email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        message: 'Format d\'email invalide'
      });
    }

    // Validation du rôle
    if (role && !Object.values(UserRole).includes(role)) {
      return res.status(400).json({
        message: `Le rôle doit être l'un des suivants: ${Object.values(UserRole).join(', ')}`
      });
    }

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await User.findOne({ 
      $or: [{ email }, { username }] 
    });
    
    if (existingUser) {
      return res.status(409).json({
        message: 'Un utilisateur avec cet email ou nom d\'utilisateur existe déjà'
      });
    }

    // Créer le nouvel utilisateur
    const newUser = new User({
      username,
      email,
      password, // sera hashé automatiquement par le middleware pre('save')
      firstName,
      lastName,
      role: role || UserRole.STARTUP
    });

    await newUser.save();

    // Générer le token JWT
    const token = jwt.sign(
      { 
        userId: newUser._id, 
        username: newUser.username,
        role: newUser.role 
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      success: true,
      message: 'Utilisateur créé avec succès',
      data: {
        token,
        user: {
          id: newUser._id,
          username: newUser.username,
          email: newUser.email,
          firstName: newUser.firstName,
          lastName: newUser.lastName,
          role: newUser.role,
          isActive: newUser.isActive,
          createdAt: newUser.createdAt
        }
      }
    });

  } catch (err) {
    console.error('❌ Erreur lors de l\'inscription:', err);
    
    if (err.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Erreur de validation',
        errors: Object.keys(err.errors).map(key => ({
          field: key,
          message: err.errors[key].message
        }))
      });
    }
    
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern)[0];
      return res.status(409).json({
        success: false,
        message: `Ce ${field} est déjà utilisé`
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'inscription',
      error: err.message
    });
  }
});

// ✅ SIGNIN Route
router.post('/signin', async (req, res) => {
  try {
    const { login, password, captcha, captchaId } = req.body; // login peut être email ou username
    
    if (!login || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email/nom d\'utilisateur et mot de passe sont requis'
      });
    }

    // CAPTCHA validation (if enabled)
    if (captcha && captchaId) {
      const storedCaptcha = captchaStore.get(captchaId);
      if (!storedCaptcha || storedCaptcha.text.toLowerCase() !== captcha.toLowerCase()) {
        return res.status(400).json({
          success: false,
          message: 'CAPTCHA invalide'
        });
      }
      // Remove used CAPTCHA
      captchaStore.delete(captchaId);
    }

    // Chercher l'utilisateur par email ou username
    const user = await User.findOne({
      $or: [{ email: login }, { username: login }]
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Identifiants invalides'
      });
    }

    // Vérifier si l'utilisateur est actif
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Compte désactivé'
      });
    }

    // Vérifier le mot de passe
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Identifiants invalides'
      });
    }

    // Mettre à jour la dernière connexion
    await User.findByIdAndUpdate(user._id, { lastLogin: new Date() });

    // Générer le token JWT
    const token = jwt.sign(
      { 
        userId: user._id, 
        username: user.username,
        role: user.role 
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      message: 'Connexion réussie',
      data: {
        token,
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          isActive: user.isActive,
          profilePhoto: user.profilePhoto,
          lastLogin: new Date()
        }
      }
    });

  } catch (err) {
    console.error('❌ Erreur lors de la connexion:', err);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la connexion',
      error: err.message
    });
  }
});

// ✅ SIGNOUT Route (optionnel - pour le côté client)
router.post('/signout', (req, res) => {
  // Avec JWT, la déconnexion se fait côté client en supprimant le token
  res.json({
    success: true,
    message: 'Déconnexion réussie'
  });
});

// ✅ Verify Token Route
router.get('/verify', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1]; // Bearer TOKEN
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token manquant'
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    res.json({
      success: true,
      message: 'Token valide',
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          isActive: user.isActive,
          profilePhoto: user.profilePhoto
        }
      }
    });

  } catch (err) {
    res.status(401).json({
      success: false,
      message: 'Token invalide',
      error: err.message
    });
  }
});

// ✅ CAPTCHA Generation Route
const captchaStore = new Map();

router.get('/captcha', (req, res) => {
  try {
    const captcha = svgCaptcha.create({
      size: 4,
      noise: 2,
      color: true,
      background: '#f0f0f0'
    });
    
    const captchaId = crypto.randomBytes(16).toString('hex');
    captchaStore.set(captchaId, {
      text: captcha.text,
      timestamp: Date.now()
    });

    // Clean up old CAPTCHAs (older than 10 minutes)
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    for (const [id, data] of captchaStore.entries()) {
      if (data.timestamp < tenMinutesAgo) {
        captchaStore.delete(id);
      }
    }

    res.json({
      success: true,
      captchaId,
      captchaImage: `data:image/svg+xml;base64,${Buffer.from(captcha.data).toString('base64')}`
    });
  } catch (err) {
    console.error('CAPTCHA generation error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to generate CAPTCHA'
    });
  }
});

// ✅ Forgot Password Route (replace with controller)
router.post('/forgot-password', userController.forgotPassword);

// ✅ Reset Password Route (replace with controller)
router.post('/reset-password', userController.resetPassword);

// ✅ Verify Reset Token Route
router.get('/verify-reset-token', async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Reset token is required'
      });
    }

    // Look for a user with this reset token
    const crypto = require('crypto');
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
    }

    res.json({
      success: true,
      message: 'Reset token is valid',
      data: {
        email: user.email // Return email for verification
      }
    });

  } catch (err) {
    console.error('Verify reset token error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to verify reset token'
    });
  }
});

// ✅ Development: Get reset token for testing (remove in production)
router.post('/dev-get-reset-token', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ message: 'Not found' });
  }
  
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    const resetToken = user.generateResetToken();
    await user.save();
    
    res.json({
      success: true,
      message: 'Development reset token generated',
      resetToken,
      resetLink: `http://localhost:3000/reset-password?token=${resetToken}`,
      expiresAt: new Date(user.resetPasswordExpires)
    });
    
  } catch (err) {
    console.error('Dev reset token error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ✅ OAuth Routes (GitHub)
router.get('/github', (req, res) => {
  // In production, implement GitHub OAuth
  // For now, redirect to GitHub OAuth
  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&redirect_uri=${process.env.GITHUB_REDIRECT_URI}`;
  res.redirect(githubAuthUrl);
});

router.get('/github/callback', async (req, res) => {
  // Handle GitHub OAuth callback
  // This is a placeholder - implement full OAuth flow in production
  res.json({
    success: false,
    message: 'GitHub OAuth not implemented yet'
  });
});

// ✅ OAuth Routes (Google)
router.get('/google', (req, res) => {
  // In production, implement Google OAuth
  // For now, redirect to Google OAuth
  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.GOOGLE_CLIENT_ID}&redirect_uri=${process.env.GOOGLE_REDIRECT_URI}&response_type=code&scope=email profile`;
  res.redirect(googleAuthUrl);
});

router.get('/google/callback', async (req, res) => {
  // Handle Google OAuth callback
  // This is a placeholder - implement full OAuth flow in production
  res.json({
    success: false,
    message: 'Google OAuth not implemented yet'
  });
});

module.exports = router;
