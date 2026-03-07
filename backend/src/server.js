// backend/src/server.js
const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const SocketManager = require('./services/socketManager');

const PORT = process.env.PORT || 5000;

// Create HTTP server and Socket.IO instance
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// Initialize Socket Manager
const socketManager = new SocketManager(io);

// Expose socket manager for diagnostic endpoint
io.socketManager = socketManager;
// Function to find an available port
const findAvailablePort = (startPort) => {
  return new Promise((resolve, reject) => {
    const testServer = require('http').createServer();
    
    testServer.listen(startPort, () => {
      const { port } = testServer.address();
      testServer.close(() => resolve(port));
    });
    
    testServer.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        // Try the next port
        findAvailablePort(startPort + 1).then(resolve).catch(reject);
      } else {
        reject(err);
      }
    });
  });
};

// Start server with automatic port detection
const startServer = async () => {
  try {
    const availablePort = await findAvailablePort(PORT);
    
    server.listen(availablePort, () => {
      console.log(`🚀 Serveur démarré sur le port ${availablePort}`);
      console.log(`📡 API disponible sur: http://localhost:${availablePort}`);
      console.log(`🧪 Test endpoint: http://localhost:${availablePort}/api/test`);
      console.log(`👤 Users CRUD: http://localhost:${availablePort}/api/users`);
      console.log(`💬 Chat WebSocket: ws://localhost:${availablePort}`);
    });
  } catch (error) {
    console.error('❌ Erreur lors du démarrage du serveur:', error);
    process.exit(1);
  }
};

startServer();
