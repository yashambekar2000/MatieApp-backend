// server.js
const dotenv = require('dotenv');
dotenv.config();

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  console.error(err.name, err.message, err.stack);
  process.exit(1);
});

const app = require('./src/app');
const database = require('./src/configs/database');
const logger = require('./src/configs/logger');
const SessionService = require('./src/services/sessionService');

const PORT = process.env.PORT || 3000;

let server;

const startServer = async () => {
  try {
    // Connect to database
    await database.connect();
    
    // Run session cleanup every hour
    setInterval(async () => {
      await SessionService.cleanupExpiredSessions();
    }, 60 * 60 * 1000);
    
    server = app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV}`);
      logger.info(`Database: PostgreSQL with Prisma`);
    });
  } catch (error) {
    logger.error(`Failed to start server: ${error.message}`);
    process.exit(1);
  }
};

startServer();

// Graceful shutdown
const gracefulShutdown = async () => {
  logger.info('Received shutdown signal, closing server...');
  
  if (server) {
    server.close(async () => {
      logger.info('HTTP server closed');
      
      try {
        await database.disconnect();
        logger.info('Database connection closed');
        process.exit(0);
      } catch (error) {
        logger.error(`Error during shutdown: ${error.message}`);
        process.exit(1);
      }
    });
  } else {
    process.exit(0);
  }
  
  // Force shutdown after timeout
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

// Handle process events
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);