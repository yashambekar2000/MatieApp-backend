// src/services/sessionService.js
const database = require('../configs/database');
const logger = require('../configs/logger');

class SessionService {
  static async createSession(userId, token, expiresAt, userAgent, ipAddress) {
    const prisma = database.getPrisma();
    
    try {
      return await prisma.session.create({
        data: {
          userId,
          token,
          expiresAt,
          userAgent: userAgent || null,
          ipAddress: ipAddress || null,
        },
      });
    } catch (error) {
      logger.error(`Failed to create session: ${error.message}`);
      throw error;
    }
  }

  static async findSessionByToken(token) {
    const prisma = database.getPrisma();
    
    try {
      return await prisma.session.findUnique({
        where: { token },
        include: { 
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
              isActive: true,
              emailVerified: true,
              lastLogin: true,
              passwordChangedAt: true,
              createdAt: true,
            }
          }
        },
      });
    } catch (error) {
      logger.error(`Failed to find session: ${error.message}`);
      return null;
    }
  }

  static async invalidateSession(token) {
    const prisma = database.getPrisma();
    
    try {
      return await prisma.session.delete({ where: { token } });
    } catch (error) {
      // If session doesn't exist, that's fine
      if (error.code !== 'P2025') {
        logger.error(`Failed to invalidate session: ${error.message}`);
      }
      return null;
    }
  }

  static async invalidateAllUserSessions(userId, excludeToken = null) {
    const prisma = database.getPrisma();
    
    try {
      const where = { userId };
      if (excludeToken) {
        where.token = { not: excludeToken };
      }
      
      return await prisma.session.deleteMany({ where });
    } catch (error) {
      logger.error(`Failed to invalidate user sessions: ${error.message}`);
      return { count: 0 };
    }
  }

  static async getUserSessions(userId) {
    const prisma = database.getPrisma();
    
    try {
      return await prisma.session.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          token: true,
          expiresAt: true,
          createdAt: true,
          userAgent: true,
          ipAddress: true,
        },
      });
    } catch (error) {
      logger.error(`Failed to get user sessions: ${error.message}`);
      return [];
    }
  }

  static async cleanupExpiredSessions() {
    const prisma = database.getPrisma();
    
    try {
      const result = await prisma.session.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });
      
      if (result.count > 0) {
        logger.info(`Cleaned up ${result.count} expired sessions`);
      }
      
      return result.count;
    } catch (error) {
      logger.error(`Failed to cleanup expired sessions: ${error.message}`);
      return 0;
    }
  }

  static async blacklistToken(token, userId, expiresAt) {
    const prisma = database.getPrisma();
    
    try {
      return await prisma.blacklistedToken.create({
        data: {
          token,
          userId,
          expiresAt,
        },
      });
    } catch (error) {
      logger.error(`Failed to blacklist token: ${error.message}`);
      return null;
    }
  }

  static async isTokenBlacklisted(token) {
    const prisma = database.getPrisma();
    
    try {
      const blacklisted = await prisma.blacklistedToken.findUnique({
        where: { token },
      });
      
      return !!blacklisted;
    } catch (error) {
      logger.error(`Failed to check blacklisted token: ${error.message}`);
      return false;
    }
  }

  static async cleanupExpiredBlacklistedTokens() {
    const prisma = database.getPrisma();
    
    try {
      const result = await prisma.blacklistedToken.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });
      
      if (result.count > 0) {
        logger.info(`Cleaned up ${result.count} expired blacklisted tokens`);
      }
      
      return result.count;
    } catch (error) {
      logger.error(`Failed to cleanup expired blacklisted tokens: ${error.message}`);
      return 0;
    }
  }
}

module.exports = SessionService;