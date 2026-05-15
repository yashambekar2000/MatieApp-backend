const { PrismaClient } = require('@prisma/client');
const logger = require('./logger');

class Database {
  constructor() {
    this.prisma = null;
    this.isConnected = false;
  }

  async connect() {
    if (this.isConnected) {
      logger.info('Using existing database connection');
      return this.prisma;
    }

    try {
      this.prisma = new PrismaClient({
        log: process.env.NODE_ENV === 'development' 
          ? ['query', 'info', 'warn', 'error']
          : ['error'],
        errorFormat: 'pretty',
      });

      // Test connection
      await this.prisma.$connect();
      this.isConnected = true;
      
      logger.info('PostgreSQL connected successfully');
      
      // Handle connection events using process events instead
      process.on('beforeExit', () => {
        logger.warn('Process beforeExit - database connection will close');
      });

      return this.prisma;
    } catch (error) {
      logger.error(`Database connection failed: ${error.message}`);
      throw error;
    }
  }

  async disconnect() {
    if (!this.isConnected || !this.prisma) {
      return;
    }

    try {
      await this.prisma.$disconnect();
      this.isConnected = false;
      logger.info('Database disconnected successfully');
    } catch (error) {
      logger.error(`Error disconnecting database: ${error.message}`);
      throw error;
    }
  }

  getPrisma() {
    if (!this.prisma) {
      throw new Error('Database not connected. Call connect() first.');
    }
    return this.prisma;
  }

  // Transaction helper
  async transaction(callback) {
    const prisma = this.getPrisma();
    return await prisma.$transaction(callback);
  }

  // Health check
  async healthCheck() {
    try {
      const prisma = this.getPrisma();
      await prisma.$queryRaw`SELECT 1`;
      return { status: 'healthy', timestamp: new Date().toISOString() };
    } catch (error) {
      logger.error(`Health check failed: ${error.message}`);
      return { status: 'unhealthy', error: error.message, timestamp: new Date().toISOString() };
    }
  }
}

module.exports = new Database();