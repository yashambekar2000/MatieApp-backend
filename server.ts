import dotenv from 'dotenv';
import http from 'http';
import app from './src/app';
import database from './src/configs/database';
import logger from './src/configs/logger';
import SessionService from './src/services/sessionService';

dotenv.config();

process.on('uncaughtException', (err: Error) => {
  console.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  console.error(err.name, err.message, err.stack);
  process.exit(1);
});

const PORT = Number(process.env.PORT) || 3000;
let server: http.Server | undefined;

const startServer = async (): Promise<void> => {
  try {
    await database.connect();

    setInterval(async () => {
      await SessionService.cleanupExpiredSessions();
    }, 60 * 60 * 1000);

    server = app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV}`);
      logger.info(`Database: PostgreSQL with Prisma`);
    });
  } catch (error) {
    if (error instanceof Error) {
      logger.error(`Failed to start server: ${error.message}`);
    }
    process.exit(1);
  }
};

startServer();

const gracefulShutdown = async (): Promise<void> => {
  logger.info('Received shutdown signal, closing server...');

  if (server) {
    server.close(async () => {
      logger.info('HTTP server closed');
      try {
        await database.disconnect();
        logger.info('Database connection closed');
        process.exit(0);
      } catch (error) {
        if (error instanceof Error) {
          logger.error(`Error during shutdown: ${error.message}`);
        }
        process.exit(1);
      }
    });
  } else {
    process.exit(0);
  }

  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
