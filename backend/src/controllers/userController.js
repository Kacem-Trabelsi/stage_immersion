const { User, UserRole } = require('../models/User');
const { sendResetEmail } = require('../services/emailService');
const crypto = require('crypto');

exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-mot_de_passe');
    res.status(200).json({
      status: 'success',
      results: users.length,
      data: { users }
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: err.message
    });
  }
};

exports.createUser = async (req, res) => {
  try {
    const newUser = await User.create({
      nom_utilisateur: req.body.nom_utilisateur,
      email: req.body.email,
      mot_de_passe: req.body.mot_de_passe,
      prénom: req.body.prénom,
      nom: req.body.nom,
      role: req.body.role || UserRole.USER,
      photo_de_profil: req.body.photo_de_profil
    });

    // Ne pas retourner le mot de passe
    newUser.mot_de_passe = undefined;

    res.status(201).json({
      status: 'success',
      data: { user: newUser }
    });
  } catch (err) {
    res.status(400).json({
      status: 'fail',
      message: err.message
    });
  }
};

// Forgot Password Controller
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, message: 'Email is required.' });
  }
  try {
    const user = await User.findOne({ email });
    if (!user) {
      // For security, do not reveal if user exists
      return res.status(200).json({ success: true, message: 'If that email is registered, a reset link has been sent.' });
    }
    
    const resetToken = user.generateResetToken();
    await user.save();
    
    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
    
    try {
      await sendResetEmail(user.email, resetLink);
      console.log('✅ Reset email sent successfully');
    } catch (emailError) {
      console.error('❌ Email service failed, but reset token created:', emailError.message);
      // In development, log the reset link
      if (process.env.NODE_ENV !== 'production') {
        console.log(`🔗 Development Reset Link: ${resetLink}`);
      }
    }
    
    return res.status(200).json({ 
      success: true, 
      message: 'If that email is registered, a reset link has been sent.',
      ...(process.env.NODE_ENV !== 'production' && { resetLink }) // Include link in development
    });
  } catch (err) {
    console.error('Forgot password error:', err);
    return res.status(500).json({ success: false, message: 'Server error. Please try again later.' });
  }
};

// Reset Password Controller
exports.resetPassword = async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) {
    return res.status(400).json({ success: false, message: 'Token and new password are required.' });
  }
  
  try {
    const crypto = require('crypto');
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    
    // Find user with valid reset token
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() }
    });
    
    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired reset token.' });
    }
    
    // Update password and clear reset token fields
    user.password = password;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();
    
    return res.status(200).json({ success: true, message: 'Password reset successful.' });
  } catch (err) {
    console.error('Reset password error:', err);
    return res.status(500).json({ success: false, message: 'Server error. Please try again later.' });
  }
};

// Ajoutez d'autres méthodes (getUser, updateUser, deleteUser, login, etc.)