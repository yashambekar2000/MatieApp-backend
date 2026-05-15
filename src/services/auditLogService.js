const database = require('../configs/database');
const logger = require('../configs/logger');

class AuditLogService {
  static async log(data) {
    try {
      const prisma = database.getPrisma();
      
      const log = await prisma.auditLog.create({
        data: {
          userId: data.userId,
          action: data.action,
          entity: data.entity,
          entityId: data.entityId,
          oldValue: data.oldValue,
          newValue: data.newValue,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
        },
      });
      
      logger.debug(`Audit log created: ${data.action} by ${data.userId || 'anonymous'}`);
      return log;
    } catch (error) {
      logger.error(`Failed to create audit log: ${error.message}`);
      // Don't throw - audit logging should not break the main flow
    }
  }

  static async getUserActivity(userId, limit = 50, offset = 0) {
    const prisma = database.getPrisma();
    
    return await prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  static async getEntityHistory(entity, entityId, limit = 50) {
    const prisma = database.getPrisma();
    
    return await prisma.auditLog.findMany({
      where: { 
        entity,
        entityId,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}

module.exports = AuditLogService;