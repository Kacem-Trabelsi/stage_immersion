// backend/src/config.js
module.exports = {
  database: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/synergypark',
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    }
  },
  security: {
    corsOptions: {
      origin: process.env.FRONTEND_URL || 'http://localhost:4200',
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization']
    },
    jwtSecret: process.env.JWT_SECRET || 'your-secret-key-here-change-in-production',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h'
  },
  server: {
    port: process.env.PORT || 5000,
    environment: process.env.NODE_ENV || 'development'
  },
  email: {
    from: process.env.EMAIL_FROM || 'noreply@synergypark.com',
    username: process.env.EMAIL_USERNAME,
    password: process.env.EMAIL_PASSWORD
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    enableRequestLogging: process.env.ENABLE_REQUEST_LOGGING !== 'false'
  }
};
