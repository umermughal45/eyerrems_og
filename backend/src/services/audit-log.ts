/**
 * Audit Log Service
 * Tracks all system changes for compliance and debugging
 */

import prisma from '../prisma/client';
import { Request } from 'express';

export interface AuditLogData {
  entityType: string;
  entityId: string;
  action: 'create' | 'update' | 'delete' | 'view' | 'approve' | 'reject' | 'import' | 'export';
  userId?: string;
  userName?: string;
  userRole?: string;
  oldValues?: any;
  newValues?: any;
  changes?: any;
  description?: string;
  metadata?: any;
  req?: Request;
}

/**
 * Create audit log entry
 */
export async function createAuditLog(data: AuditLogData) {
  try {
    // Extract IP and user agent from request if provided
    const ipAddress = data.req?.ip || data.req?.socket.remoteAddress;
    const userAgent = data.req?.headers['user-agent'];

    // Calculate changes if old and new values provided
    let changes = data.changes;
    if (!changes && data.oldValues && data.newValues) {
      changes = calculateChanges(data.oldValues, data.newValues);
    }

    const auditLog = await prisma.auditLog.create({
      data: {
        entityType: data.entityType,
        entityId: data.entityId,
        action: data.action,
        userId: data.userId,
        userName: data.userName,
        userRole: data.userRole,
        oldValues: data.oldValues ? JSON.parse(JSON.stringify(data.oldValues)) : null,
        newValues: data.newValues ? JSON.parse(JSON.stringify(data.newValues)) : null,
        changes: changes ? JSON.parse(JSON.stringify(changes)) : null,
        description: data.description,
        metadata: data.metadata ? JSON.parse(JSON.stringify(data.metadata)) : null,
        ipAddress: ipAddress as string,
        userAgent,
      },
    });

    return auditLog;
  } catch (error) {
    console.error('Error creating audit log:', error);
    // Don't throw - audit logging should not break the main flow
    return null;
  }
}

/**
 * Calculate changes between old and new values
 */
function calculateChanges(oldValues: any, newValues: any): any {
  const changes: any = {};

  for (const key in newValues) {
    if (oldValues[key] !== newValues[key]) {
      changes[key] = {
        old: oldValues[key],
        new: newValues[key],
      };
    }
  }

  // Check for deleted fields
  for (const key in oldValues) {
    if (!(key in newValues)) {
      changes[key] = {
        old: oldValues[key],
        new: null,
      };
    }
  }

  return changes;
}

/**
 * Get audit logs for an entity
 */
export async function getAuditLogs(
  entityType: string,
  entityId: string,
  limit: number = 50
) {
  return await prisma.auditLog.findMany({
    where: {
      entityType,
      entityId,
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: limit,
  });
}

/**
 * Get audit logs by user
 */
export async function getAuditLogsByUser(userId: string, limit: number = 50) {
  return await prisma.auditLog.findMany({
    where: {
      userId,
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: limit,
  });
}

/**
 * Get audit logs by action
 */
export async function getAuditLogsByAction(
  action: string,
  limit: number = 50
) {
  return await prisma.auditLog.findMany({
    where: {
      action,
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: limit,
  });
}

