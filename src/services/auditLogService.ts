import database from '../configs/database';
import logger from '../configs/logger';

class AuditLogService {
  static async log(data: {
    userId?: string;
    action: string;
    entity: string;
    entityId: string;
    oldValue?: unknown;
    newValue?: unknown;
    ipAddress?: string;
    userAgent?: string | null;
  }) {
    try {
      const prisma = database.getPrisma();

      const log = await prisma.auditLog.create({
        data: {
          userId: data.userId,
          action: data.action,
          entity: data.entity,
          entityId: data.entityId,
          oldValue: data.oldValue as any,
          newValue: data.newValue as any,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
        },
      });

      logger.debug(`Audit log created: ${data.action} by ${data.userId || 'anonymous'}`);
      return log;
    } catch (error) {
      if (error instanceof Error) {
        logger.error(`Failed to create audit log: ${error.message}`);
      }
    }
  }

  static async getUserActivity(userId: string, limit = 50, offset = 0) {
    const prisma = database.getPrisma();

    return prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  static async getEntityHistory(entity: string, entityId: string, limit = 50) {
    const prisma = database.getPrisma();

    return prisma.auditLog.findMany({
      where: {
        entity,
        entityId,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}

export default AuditLogService;
