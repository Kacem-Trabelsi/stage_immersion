const jwt = require('jsonwebtoken');
const { User } = require('../models/User');
const config = require('../config');

console.log('🔐 SocketAuth JWT_SECRET configured:', config.security.jwtSecret ? 'Present' : 'Missing');

const socketAuth = async (socket, next) => {
  try {
    console.log('🔐 Socket authentication attempt');
    console.log('📋 Handshake auth:', socket.handshake.auth);
    console.log('📋 Handshake query:', socket.handshake.query);
    console.log('📋 Headers:', socket.handshake.headers);
    
    // Get token from handshake auth, query, or headers
    let token = socket.handshake.auth?.token || 
                socket.handshake.query?.token || 
                socket.handshake.headers?.authorization?.replace('Bearer ', '');
    
    if (!token) {
      console.error('❌ No authentication token provided');
      console.error('🔍 Available data:', {
        auth: socket.handshake.auth,
        query: socket.handshake.query,
        headers: socket.handshake.headers
      });
      return next(new Error('Authentication token required'));
    }

    console.log('🔑 Token found, verifying...');
    console.log('🔑 Token preview:', token.substring(0, 20) + '...');
    
    // Verify token
    const decoded = jwt.verify(token, config.security.jwtSecret);
    console.log('✅ Token verified for user:', decoded.userId);
    
    // Get user from database
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user || !user.isActive) {
      console.error('❌ User not found or inactive:', decoded.userId);
      return next(new Error('User not found or inactive'));
    }

    console.log('✅ User authenticated:', user.email);
    console.log('✅ User ID:', user._id);
    
    // Attach user to socket with proper structure
    socket.user = {
      userId: user._id.toString(),
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role
    };
    
    console.log('✅ Socket user attached:', socket.user);
    
    next();
  } catch (error) {
    console.error('❌ Socket authentication error:', error);
    console.error('❌ Error details:', {
      message: error.message,
      name: error.name,
      stack: error.stack
    });
    next(new Error('Authentication failed: ' + error.message));
  }
};

module.exports = socketAuth;
