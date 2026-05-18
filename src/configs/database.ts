import { PrismaClient } from '@prisma/client';
import logger from './logger';

class Database {
  private prisma: PrismaClient | null;
  private isConnected: boolean;

  constructor() {
    this.prisma = null;
    this.isConnected = false;
  }

  async connect(): Promise<PrismaClient> {
    if (this.isConnected && this.prisma) {
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

      await this.prisma.$connect();
      this.isConnected = true;

      logger.info('PostgreSQL connected successfully');

      process.on('beforeExit', () => {
        logger.warn('Process beforeExit - database connection will close');
      });

      return this.prisma;
    } catch (error) {
      if (error instanceof Error) {
        logger.error(`Database connection failed: ${error.message}`);
      }
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.isConnected || !this.prisma) {
      return;
    }

    try {
      await this.prisma.$disconnect();
      this.isConnected = false;
      logger.info('Database disconnected successfully');
    } catch (error) {
      if (error instanceof Error) {
        logger.error(`Error disconnecting database: ${error.message}`);
      }
      throw error;
    }
  }

  getPrisma(): PrismaClient {
    if (!this.prisma) {
      throw new Error('Database not connected. Call connect() first.');
    }
    return this.prisma;
  }

  async transaction<T>(callback: (prisma: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>) => Promise<T>): Promise<T> {
    const prisma = this.getPrisma();
    return prisma.$transaction(callback as any) as Promise<T>;
  }

  async healthCheck() {
    try {
      const prisma = this.getPrisma();
      await prisma.$queryRaw`SELECT 1`;
      return { status: 'healthy', timestamp: new Date().toISOString() };
    } catch (error) {
      if (error instanceof Error) {
        logger.error(`Health check failed: ${error.message}`);
      }
      return { status: 'unhealthy', error: (error instanceof Error ? error.message : 'Unknown error'), timestamp: new Date().toISOString() };
    }
  }
}

export default new Database();
