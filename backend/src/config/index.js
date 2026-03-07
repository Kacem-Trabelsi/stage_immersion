// backend/src/config/index.js
require('dotenv').config();

const config = {
  // Configuration de l'application
  app: {
    name: process.env.APP_NAME || 'SynergyPark API',
    port: process.env.PORT || 5000,
    env: process.env.NODE_ENV || 'development',
    baseUrl: process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`
  },

  // Base de données MongoDB
  database: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/synergypark',
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      autoIndex: true,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000
    },
    testUri: process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/synergypark_test'
  },

  // ✅ FIXED: Security with proper CORS origins
  security: {
    jwtSecret: process.env.JWT_SECRET || 'votre_super_secret_jwt',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '90d',
    passwordResetExpires: process.env.PASSWORD_RESET_EXPIRES || 3600000,
    corsOptions: {
      origin: [
        'http://localhost:3000',  // React default
        'http://localhost:4200',  // Angular default
        'http://127.0.0.1:3000',
        'http://127.0.0.1:4200',
        // Add production URL when deploying
        ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : [])
      ],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type', 
        'Authorization', 
        'X-Requested-With',
        'Accept',
        'Origin'
      ],
      credentials: true,
      optionsSuccessStatus: 200
    }
  },

  // Email configuration
  email: {
    service: process.env.EMAIL_SERVICE || 'SendGrid',
    host: process.env.EMAIL_HOST || 'smtp.sendgrid.net',
    port: process.env.EMAIL_PORT || 587,
    username: process.env.EMAIL_USERNAME || 'apikey',
    password: process.env.EMAIL_PASSWORD || 'votre_api_key_sendgrid',
    from: process.env.EMAIL_FROM || 'no-reply@synergypark.com'
  },

  // Frontend URLs
  frontend: {
    url: process.env.FRONTEND_URL || 'http://localhost:3000',
    loginUrl: process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL}/login` : 'http://localhost:3000/login',
    dashboardUrl: process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL}/dashboard` : 'http://localhost:3000/dashboard'
  },

  // Uploads
  uploads: {
    profilePictures: {
      directory: process.env.PROFILE_UPLOAD_DIR || 'uploads/profile_pictures',
      maxSize: process.env.PROFILE_MAX_UPLOAD || 5 * 1024 * 1024,
      allowedTypes: ['image/jpeg', 'image/png']
    }
  },

  // User defaults
  userDefaults: {
    role: 'user',
    isActive: true,
    profilePicture: 'default.jpg'
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'debug',
    file: process.env.LOG_FILE || 'app.log',
    directory: process.env.LOG_DIR || 'logs',
    enableRequestLogging: process.env.ENABLE_REQUEST_LOGGING === 'true'
  }
};

// ✅ Enhanced validation
const validateConfig = () => {
  const errors = [];

  if (!config.database.uri) {
    errors.push('MONGODB_URI is required in .env file');
  }
  
  if (process.env.NODE_ENV === 'production') {
    if (!config.security.jwtSecret || config.security.jwtSecret === 'votre_super_secret_jwt') {
      errors.push('JWT_SECRET must be set to a secure value in production');
    }
    
    if (config.security.jwtSecret.length < 32) {
      errors.push('JWT_SECRET should be at least 32 characters long');
    }
  }

  if (errors.length > 0) {
    console.error('Configuration validation errors:');
    errors.forEach(error => console.error(`- ${error}`));
    throw new Error('Invalid configuration. Please check your .env file.');
  }
};

// ✅ Log configuration (non-sensitive parts)
const logConfig = () => {
  console.log('🚀 Application Configuration:');
  console.log(`   Environment: ${config.app.env}`);
  console.log(`   Port: ${config.app.port}`);
  console.log(`   Database: ${config.database.uri.replace(/\/\/.*@/, '//***:***@')}`);
  console.log(`   CORS Origins: ${JSON.stringify(config.security.corsOptions.origin)}`);
  console.log(`   Frontend URL: ${config.frontend.url}`);
  console.log('---');
};

validateConfig();

if (config.app.env !== 'test') {
  logConfig();
}

module.exports = config;