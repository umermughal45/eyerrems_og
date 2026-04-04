"use strict";
/**
 * Audit Log Service
 * Tracks all system changes for compliance and debugging
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAuditLog = createAuditLog;
exports.getAuditLogs = getAuditLogs;
exports.getAuditLogsByUser = getAuditLogsByUser;
exports.getAuditLogsByAction = getAuditLogsByAction;
const client_1 = __importDefault(require("../prisma/client"));
/**
 * Create audit log entry
 */
async function createAuditLog(data) {
    try {
        // Extract IP and user agent from request if provided
        const ipAddress = data.req?.ip || data.req?.socket.remoteAddress;
        const userAgent = data.req?.headers['user-agent'];
        // Calculate changes if old and new values provided
        let changes = data.changes;
        if (!changes && data.oldValues && data.newValues) {
            changes = calculateChanges(data.oldValues, data.newValues);
        }
        const auditLog = await client_1.default.auditLog.create({
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
                ipAddress: ipAddress,
                userAgent,
            },
        });
        return auditLog;
    }
    catch (error) {
        console.error('Error creating audit log:', error);
        // Don't throw - audit logging should not break the main flow
        return null;
    }
}
/**
 * Calculate changes between old and new values
 */
function calculateChanges(oldValues, newValues) {
    const changes = {};
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
async function getAuditLogs(entityType, entityId, limit = 50) {
    return await client_1.default.auditLog.findMany({
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
async function getAuditLogsByUser(userId, limit = 50) {
    return await client_1.default.auditLog.findMany({
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
async function getAuditLogsByAction(action, limit = 50) {
    return await client_1.default.auditLog.findMany({
        where: {
            action,
        },
        orderBy: {
            createdAt: 'desc',
        },
        take: limit,
    });
}
//# sourceMappingURL=audit-log.js.map