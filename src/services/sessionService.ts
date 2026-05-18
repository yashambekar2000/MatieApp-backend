import { Prisma, Session } from '@prisma/client';
import database from '../configs/database';
import logger from '../configs/logger';

class SessionService {
  static async createSession(
    userId: string,
    token: string,
    expiresAt: Date,
    userAgent: string | null,
    ipAddress: string | null,
  ): Promise<Session> {
    const prisma = database.getPrisma();

    try {
      return await prisma.session.create({
        data: {
          userId,
          token,
          expiresAt,
          userAgent,
          ipAddress,
        },
      });
    } catch (error) {
      if (error instanceof Error) {
        logger.error(`Failed to create session: ${error.message}`);
      }
      throw error;
    }
  }

  static async findSessionByToken(token: string): Promise<(Session & { user: { id: string; email: string; name: string; role: string; isActive: boolean; emailVerified: boolean; lastLogin: Date | null; passwordChangedAt: Date | null; createdAt: Date } }) | null> {
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
            },
          },
        },
      });
    } catch (error) {
      if (error instanceof Error) {
        logger.error(`Failed to find session: ${error.message}`);
      }
      return null;
    }
  }

  static async invalidateSession(token: string): Promise<Session | null> {
    const prisma = database.getPrisma();

    try {
      return await prisma.session.delete({ where: { token } });
    } catch (error) {
      if (error instanceof Error && (error as any).code !== 'P2025') {
        logger.error(`Failed to invalidate session: ${error.message}`);
      }
      return null;
    }
  }

  static async invalidateAllUserSessions(userId: string, excludeToken?: string): Promise<Prisma.BatchPayload> {
    const prisma = database.getPrisma();

    try {
      const where: Prisma.SessionWhereInput = { userId };
      if (excludeToken) {
        where.token = { not: excludeToken };
      }

      return await prisma.session.deleteMany({ where });
    } catch (error) {
      if (error instanceof Error) {
        logger.error(`Failed to invalidate user sessions: ${error.message}`);
      }
      return { count: 0 };
    }
  }

  static async getUserSessions(userId: string): Promise<Array<Pick<Session, 'id' | 'token' | 'expiresAt' | 'createdAt' | 'userAgent' | 'ipAddress'>>> {
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
      if (error instanceof Error) {
        logger.error(`Failed to get user sessions: ${error.message}`);
      }
      return [];
    }
  }

  static async cleanupExpiredSessions(): Promise<number> {
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
      if (error instanceof Error) {
        logger.error(`Failed to cleanup expired sessions: ${error.message}`);
      }
      return 0;
    }
  }

  static async blacklistToken(token: string, _userId: string, expiresAt: Date) {
    const prisma = database.getPrisma();

    try {
      return await prisma.blacklistedToken.create({
        data: {
          token,
          expiresAt,
        },
      });
    } catch (error) {
      if (error instanceof Error) {
        logger.error(`Failed to blacklist token: ${error.message}`);
      }
      return null;
    }
  }

  static async isTokenBlacklisted(token: string): Promise<boolean> {
    const prisma = database.getPrisma();

    try {
      const blacklisted = await prisma.blacklistedToken.findUnique({
        where: { token },
      });
      return !!blacklisted;
    } catch (error) {
      if (error instanceof Error) {
        logger.error(`Failed to check blacklisted token: ${error.message}`);
      }
      return false;
    }
  }

  static async cleanupExpiredBlacklistedTokens(): Promise<number> {
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
      if (error instanceof Error) {
        logger.error(`Failed to cleanup expired blacklisted tokens: ${error.message}`);
      }
      return 0;
    }
  }
}

export default SessionService;
