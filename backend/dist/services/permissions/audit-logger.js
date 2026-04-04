"use strict";
/**
 * Permission Audit Logger
 *
 * Logs all permission changes and sensitive action executions
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logPermissionChange = logPermissionChange;
exports.logActionExecution = logActionExecution;
exports.getPermissionAuditLogs = getPermissionAuditLogs;
exports.getActionAuditLogs = getActionAuditLogs;
const client_1 = __importDefault(require("../../prisma/client"));
const logger_1 = __importDefault(require("../../utils/logger"));
/**
 * Log permission change
 */
async function logPermissionChange(log) {
    try {
        await client_1.default.permissionAuditLog.create({
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
        logger_1.default.info(`Permission change logged: ${log.changeType}`, {
            actor: log.actorUsername,
            role: log.roleName,
            permission: log.permissionPath,
        });
    }
    catch (error) {
        logger_1.default.error(`Failed to log permission change: ${error.message}`, error);
        // Don't throw - audit logging failure shouldn't break the operation
    }
}
/**
 * Log action execution
 */
async function logActionExecution(log) {
    try {
        await client_1.default.actionAuditLog.create({
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
            logger_1.default.warn(`Action execution logged: ${log.result}`, {
                user: log.username,
                permission: log.permissionUsed,
                action: log.action,
                entity: `${log.entityType}${log.entityId ? `:${log.entityId}` : ''}`,
            });
        }
        else {
            logger_1.default.info(`Action execution logged: ${log.result}`, {
                user: log.username,
                permission: log.permissionUsed,
                action: log.action,
            });
        }
    }
    catch (error) {
        logger_1.default.error(`Failed to log action execution: ${error.message}`, error);
        // Don't throw - audit logging failure shouldn't break the operation
    }
}
/**
 * Get permission audit logs for a role
 */
async function getPermissionAuditLogs(roleId, limit = 100) {
    const where = roleId ? { roleId } : {};
    return client_1.default.permissionAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
    });
}
/**
 * Get action audit logs
 */
async function getActionAuditLogs(filters, limit = 100) {
    return client_1.default.actionAuditLog.findMany({
        where: filters || {},
        orderBy: { createdAt: 'desc' },
        take: limit,
    });
}
//# sourceMappingURL=audit-logger.js.map