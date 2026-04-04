/**
 * Permission Audit Logger
 *
 * Logs all permission changes and sensitive action executions
 */
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
export declare function logPermissionChange(log: PermissionChangeLog): Promise<void>;
/**
 * Log action execution
 */
export declare function logActionExecution(log: ActionExecutionLog): Promise<void>;
/**
 * Get permission audit logs for a role
 */
export declare function getPermissionAuditLogs(roleId?: string, limit?: number): Promise<any[]>;
/**
 * Get action audit logs
 */
export declare function getActionAuditLogs(filters?: {
    userId?: string;
    roleId?: string;
    permissionUsed?: string;
    entityType?: string;
    result?: 'allowed' | 'denied' | 'refused';
}, limit?: number): Promise<any[]>;
//# sourceMappingURL=audit-logger.d.ts.map