import { prisma } from "../config/prisma.js";
import { logger } from "../config/logger.js";

interface AuditLogParams {
  adminId: number | null;
  action: string;
  entityType: string;
  entityId: number;
  metadata?: any;
}

/**
 * Centrally log audit events to the database and write to Winston logs.
 */
export const logAuditEvent = async (params: AuditLogParams): Promise<void> => {
  try {
    await prisma.auditLog.create({
      data: {
        adminId: params.adminId,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        metadata: params.metadata ? JSON.parse(JSON.stringify(params.metadata)) : null,
      },
    });
    
    logger.info(`Audit Log [${params.action}] on ${params.entityType} ID: ${params.entityId}`, {
      adminId: params.adminId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
    });
  } catch (error) {
    logger.error("Failed to write database audit log", { error, params });
  }
};
