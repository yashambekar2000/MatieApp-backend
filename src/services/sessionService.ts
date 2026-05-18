import { Prisma } from '@prisma/client';
import { Session } from '../types/auth';
import database from '../configs/database';
import logger from '../configs/logger';
import { User } from '../types/auth';

class SessionService {
  static async createSession(
    userId: number,
    token: string,
    expiresAt: Date,
    userAgent: string | null,
    ipAddress: string | null,
  ): Promise<Session> {
    const prisma = database.getPrisma();

    try {
      return await prisma.session.create({
        data: {
          user_id: userId,
          token,
          expires_at: expiresAt,
          user_agent: userAgent,
          ip_address: ipAddress,
        },
      });
    } catch (error) {
      if (error instanceof Error) {
        logger.error(`Failed to create session: ${error.message}`);
      }
      throw error;
    }
  }

  static async findSessionByToken(token: string): Promise<(Session & { user: User }) | null> {
    const prisma = database.getPrisma();

    try {
      return await prisma.session.findUnique({
        where: { token },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              first_name: true,
              last_name: true,
              firm_name: true,
              location_latitude: true,
              location_longitude: true,
              address_string: true,
              phone_number: true,
              role_id: true,
              is_active: true,
              email_verified: true,
              last_login: true,
              password_changed_at: true,
              created_at: true,
              updated_at: true,
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

  static async invalidateAllUserSessions(userId: number, excludeToken?: string): Promise<Prisma.BatchPayload> {
    const prisma = database.getPrisma();

    try {
      const where: Prisma.SessionWhereInput = { user_id: userId };
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

  static async getUserSessions(userId: number): Promise<Array<Pick<Session, 'id' | 'token' | 'expires_at' | 'created_at' | 'user_agent' | 'ip_address'>>> {
    const prisma = database.getPrisma();

    try {
      return await prisma.session.findMany({
        where: { user_id: userId },
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          token: true,
          expires_at: true,
          created_at: true,
          user_agent: true,
          ip_address: true,
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
        where: { expires_at: { lt: new Date() } },
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
          expires_at: expiresAt,
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
        where: { expires_at: { lt: new Date() } },
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
