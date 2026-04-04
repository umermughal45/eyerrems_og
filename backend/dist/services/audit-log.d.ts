/**
 * Audit Log Service
 * Tracks all system changes for compliance and debugging
 */
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
export declare function createAuditLog(data: AuditLogData): Promise<{
    id: string;
    createdAt: Date;
    userId: string | null;
    description: string | null;
    action: string;
    entityType: string;
    entityId: string;
    metadata: import("@prisma/client/runtime/library").JsonValue | null;
    userName: string | null;
    userRole: string | null;
    oldValues: import("@prisma/client/runtime/library").JsonValue | null;
    newValues: import("@prisma/client/runtime/library").JsonValue | null;
    changes: import("@prisma/client/runtime/library").JsonValue | null;
    ipAddress: string | null;
    userAgent: string | null;
} | null>;
/**
 * Get audit logs for an entity
 */
export declare function getAuditLogs(entityType: string, entityId: string, limit?: number): Promise<{
    id: string;
    createdAt: Date;
    userId: string | null;
    description: string | null;
    action: string;
    entityType: string;
    entityId: string;
    metadata: import("@prisma/client/runtime/library").JsonValue | null;
    userName: string | null;
    userRole: string | null;
    oldValues: import("@prisma/client/runtime/library").JsonValue | null;
    newValues: import("@prisma/client/runtime/library").JsonValue | null;
    changes: import("@prisma/client/runtime/library").JsonValue | null;
    ipAddress: string | null;
    userAgent: string | null;
}[]>;
/**
 * Get audit logs by user
 */
export declare function getAuditLogsByUser(userId: string, limit?: number): Promise<{
    id: string;
    createdAt: Date;
    userId: string | null;
    description: string | null;
    action: string;
    entityType: string;
    entityId: string;
    metadata: import("@prisma/client/runtime/library").JsonValue | null;
    userName: string | null;
    userRole: string | null;
    oldValues: import("@prisma/client/runtime/library").JsonValue | null;
    newValues: import("@prisma/client/runtime/library").JsonValue | null;
    changes: import("@prisma/client/runtime/library").JsonValue | null;
    ipAddress: string | null;
    userAgent: string | null;
}[]>;
/**
 * Get audit logs by action
 */
export declare function getAuditLogsByAction(action: string, limit?: number): Promise<{
    id: string;
    createdAt: Date;
    userId: string | null;
    description: string | null;
    action: string;
    entityType: string;
    entityId: string;
    metadata: import("@prisma/client/runtime/library").JsonValue | null;
    userName: string | null;
    userRole: string | null;
    oldValues: import("@prisma/client/runtime/library").JsonValue | null;
    newValues: import("@prisma/client/runtime/library").JsonValue | null;
    changes: import("@prisma/client/runtime/library").JsonValue | null;
    ipAddress: string | null;
    userAgent: string | null;
}[]>;
//# sourceMappingURL=audit-log.d.ts.map