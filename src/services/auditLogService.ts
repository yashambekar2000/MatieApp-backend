import database from '../configs/database';
import logger from '../configs/logger';

class AuditLogService {
  static async log(data: {
    user_id?: number;
    action: string;
    entity: string;
    entity_id: number;
    old_value?: unknown;
    new_value?: unknown;
    ip_address?: string;
    user_agent?: string | null;
  }) {
    try {
      const prisma = database.getPrisma();

      const log = await prisma.auditLog.create({
        data: {
          user_id: data.user_id,
          action: data.action,
          entity: data.entity,
          entity_id: data.entity_id,
          old_value: data.old_value as any,
          new_value: data.new_value as any,
          ip_address: data.ip_address,
          user_agent: data.user_agent,
        },
      });

      logger.debug(`Audit log created: ${data.action} by ${data.user_id || 'anonymous'}`);
      return log;
    } catch (error) {
      if (error instanceof Error) {
        logger.error(`Failed to create audit log: ${error.message}`);
      }
    }
  }

  static async getUserActivity(user_id: number, limit = 50, offset = 0) {
    const prisma = database.getPrisma();

    return prisma.auditLog.findMany({
      where: { user_id: user_id },
      orderBy: { created_at: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  static async getEntityHistory(entity: string, entity_id: number, limit = 50) {
    const prisma = database.getPrisma();

    return prisma.auditLog.findMany({
      where: {
        entity,
        entity_id,
      },
      orderBy: { created_at: 'desc' },
      take: limit,
    });
  }
}

export default AuditLogService;
