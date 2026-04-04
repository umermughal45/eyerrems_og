/**
 * Permission Audit Logger
 * 
 * Logs all permission changes and sensitive action executions
 */

import prisma from '../../prisma/client';
import logger from '../../utils/logger';

export interface PermissionChangeLog {
  actorId: string;
  actorUsername: string;
  roleId: string;
  roleName: string;
  permissionPath: string;
  oldValue: any;
  newValue: any;
  changeType: 'grant' | 'revoke' | 'update' | 'bulk_update';
  context?: Record<string, any>;
}

export interface ActionExecutionLog {
  userId: string;
  username: string;
  roleId: string;
  roleName: string;
  permissionUsed: string;
  action: string;
  entityType: string;
  entityId?: string;
  requestPath: string;
  requestMethod: string;
  requestContext?: Record<string, any>;
  result: 'allowed' | 'denied' | 'refused';
}

/**
 * Log permission change
 */
export async function logPermissionChange(log: PermissionChangeLog): Promise<void> {
  try {
    await prisma.permissionAuditLog.create({
      data: {
        actorId: log.actorId,
        actorUsername: log.actorUsername,
        roleId: log.roleId,
        roleName: log.roleName,
        permissionPath: log.permissionPath,
        oldValue: log.oldValue,
        newValue: log.newValue,
        changeType: log.changeType,
        context: log.context || {},
      },
    });

    logger.info(`Permission change logged: ${log.changeType}`, {
      actor: log.actorUsername,
      role: log.roleName,
      permission: log.permissionPath,
    });
  } catch (error: any) {
    logger.error(`Failed to log permission change: ${error.message}`, error);
    // Don't throw - audit logging failure shouldn't break the operation
  }
}

/**
 * Log action execution
 */
export async function logActionExecution(log: ActionExecutionLog): Promise<void> {
  try {
    await prisma.actionAuditLog.create({
      data: {
        userId: log.userId,
        username: log.username,
        roleId: log.roleId,
        roleName: log.roleName,
        permissionUsed: log.permissionUsed,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        requestPath: log.requestPath,
        requestMethod: log.requestMethod,
        requestContext: log.requestContext || {},
        result: log.result,
      },
    });

    if (log.result === 'denied' || log.result === 'refused') {
      logger.warn(`Action execution logged: ${log.result}`, {
        user: log.username,
        permission: log.permissionUsed,
        action: log.action,
        entity: `${log.entityType}${log.entityId ? `:${log.entityId}` : ''}`,
      });
    } else {
      logger.info(`Action execution logged: ${log.result}`, {
        user: log.username,
        permission: log.permissionUsed,
        action: log.action,
      });
    }
  } catch (error: any) {
    logger.error(`Failed to log action execution: ${error.message}`, error);
    // Don't throw - audit logging failure shouldn't break the operation
  }
}

/**
 * Get permission audit logs for a role
 */
export async function getPermissionAuditLogs(
  roleId?: string,
  limit: number = 100
): Promise<any[]> {
  const where = roleId ? { roleId } : {};
  
  return prisma.permissionAuditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

/**
 * Get action audit logs
 */
export async function getActionAuditLogs(
  filters?: {
    userId?: string;
    roleId?: string;
    permissionUsed?: string;
    entityType?: string;
    result?: 'allowed' | 'denied' | 'refused';
  },
  limit: number = 100
): Promise<any[]> {
  return prisma.actionAuditLog.findMany({
    where: filters || {},
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}
