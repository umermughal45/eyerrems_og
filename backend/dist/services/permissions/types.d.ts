/**
 * Permission System Type Definitions
 *
 * Centralized type definitions for the permission system.
 * Following TypeScript best practices and enterprise standards.
 */
/**
 * Permission hierarchy path structure
 */
export interface PermissionPath {
    /** Module name (e.g., 'finance', 'hr', 'properties') */
    module: string;
    /** Optional submodule name (e.g., 'transactions', 'employees') */
    submodule?: string;
    /** Action name (e.g., 'view', 'create', 'edit', 'delete') */
    action: string;
}
/**
 * Result of a permission check operation
 */
export interface PermissionCheckResult {
    /** Whether the permission is allowed */
    allowed: boolean;
    /** Reason for allow/deny (optional) */
    reason?: string;
    /** Full permission path string (e.g., 'finance.transactions.view') */
    permissionPath?: string;
}
/**
 * Source of permission resolution
 */
export type PermissionSource = 'explicit_grant' | 'explicit_deny' | 'inherited_role' | 'system_restriction' | 'deny_by_default' | 'legacy_migration' | 'system_grant';
/**
 * Resolution reason for permission allow/deny
 * Used for clear, auditable explanations in UI
 */
export type ResolutionReason = 'EXPLICITLY_GRANTED' | 'NOT_GRANTED_TO_ROLE' | 'MODULE_ACCESS_DISABLED' | 'SYSTEM_RESTRICTED' | 'REQUIRES_HIGHER_ROLE' | 'INHERITED_DENY';
/**
 * Effective access level
 */
export type EffectiveAccessLevel = 'full' | 'partial' | 'restricted';
/**
 * Effective access summary
 */
export interface EffectiveAccessSummary {
    /** Overall access level */
    level: EffectiveAccessLevel;
    /** Human-readable description */
    description: string;
    /** Methods by which permissions are granted */
    grantedVia: ('explicit' | 'legacy' | 'system')[];
    /** Current enforcement status */
    enforcementStatus: 'active' | 'compatibility_mode';
}
/**
 * Detailed permission inspection result
 */
export interface PermissionInspectionDetail {
    /** Full permission path (e.g., 'finance.transactions.view') */
    permission: string;
    /** Module name */
    module: string;
    /** Submodule name (null for module-level permissions) */
    submodule: string | null;
    /** Action name */
    action: string;
    /** Current status */
    status: 'allowed' | 'denied' | 'cannot_determine';
    /** Source of permission resolution */
    source: PermissionSource;
    /** Primary reason for allow/deny */
    resolutionReason: ResolutionReason;
    /** Human-readable explanation */
    reason: string;
    /** Whether this is a sensitive permission */
    isSensitive: boolean;
    /** Whether audit logging is required for this permission */
    auditRequired?: boolean;
    /** Last time this permission was used (optional) */
    lastUsed?: Date | null;
    /** When this permission was granted (optional) */
    grantedAt?: Date | null;
    /** Who granted this permission (optional) */
    grantedBy?: string | null;
}
/**
 * Module-level inspection result
 */
export interface ModuleInspection {
    /** Module name */
    module: string;
    /** Submodules within this module */
    submodules: Record<string, SubmoduleInspection>;
    /** Module-level permissions (without submodule) */
    moduleLevelPermissions: PermissionInspectionDetail[];
}
/**
 * Submodule-level inspection result
 */
export interface SubmoduleInspection {
    /** Submodule name */
    submodule: string;
    /** Permissions within this submodule */
    permissions: PermissionInspectionDetail[];
}
/**
 * Complete permission inspection result
 */
export interface PermissionInspectionResult {
    /** Entity being inspected */
    inspectedEntity: {
        /** Type of entity */
        type: 'role' | 'user';
        /** Entity ID */
        id: string;
        /** Entity name */
        name: string;
        /** Role status (for roles) */
        status?: 'ACTIVE' | 'DEACTIVATED' | 'SYSTEM_LOCKED';
        /** Assigned roles (for users) */
        roles?: string[];
    };
    /** Inspection metadata */
    inspectionMetadata: {
        /** When inspection was performed */
        timestamp: Date;
        /** Resolver version */
        resolverVersion: string;
        /** Inspector user ID (optional) */
        inspectorId?: string;
        /** Inspector username (optional) */
        inspectorUsername?: string;
    };
    /** Effective access summary */
    effectiveAccess: EffectiveAccessSummary;
    /** Permission details */
    permissions: {
        /** Permissions organized by module */
        modules: Record<string, ModuleInspection>;
        /** Summary statistics */
        summary: {
            /** Total permissions checked */
            totalPermissions: number;
            /** Effective allowed permissions */
            effectiveAllowed: number;
            /** Explicitly defined permissions */
            explicitlyDefined: number;
            /** System-restricted permissions */
            systemRestricted: number;
            /** Sensitive permissions */
            sensitive: number;
            /** Cannot determine status */
            cannotDetermine: number;
        };
    };
    /** Warnings or inconsistencies */
    warnings: string[];
}
/**
 * Permission change audit log entry
 */
export interface PermissionChangeLog {
    /** Actor user ID */
    actorId: string;
    /** Actor username */
    actorUsername: string;
    /** Target role ID */
    roleId: string;
    /** Target role name */
    roleName: string;
    /** Permission path */
    permissionPath: string;
    /** Old value */
    oldValue: any;
    /** New value */
    newValue: any;
    /** Type of change */
    changeType: 'grant' | 'revoke' | 'update' | 'bulk_update';
    /** Additional context */
    context?: Record<string, any>;
}
/**
 * Action execution audit log entry
 */
export interface ActionExecutionLog {
    /** User ID */
    userId: string;
    /** Username */
    username: string;
    /** Role ID */
    roleId: string;
    /** Role name */
    roleName: string;
    /** Permission used */
    permissionUsed: string;
    /** Action performed */
    action: string;
    /** Entity type */
    entityType: string;
    /** Entity ID (optional) */
    entityId?: string;
    /** Request path */
    requestPath: string;
    /** HTTP method */
    requestMethod: string;
    /** Request context (optional) */
    requestContext?: Record<string, any>;
    /** Result of action */
    result: 'allowed' | 'denied' | 'refused';
}
/**
 * Role status types
 */
export type RoleStatus = 'ACTIVE' | 'DEACTIVATED' | 'SYSTEM_LOCKED';
/**
 * Role with permissions
 */
export interface RoleWithPermissions {
    id: string;
    name: string;
    status?: RoleStatus;
    permissions: string[];
    rolePermissions?: RolePermission[];
    createdAt: Date;
    updatedAt: Date;
}
/**
 * Explicit role permission record
 */
export interface RolePermission {
    id: string;
    roleId: string;
    module: string;
    submodule: string | null;
    action: string;
    granted: boolean;
    createdAt: Date;
    createdBy: string | null;
}
/**
 * Bulk permission update request
 */
export interface BulkPermissionUpdate {
    roleId: string;
    permissions: Array<{
        module: string;
        submodule?: string;
        action: string;
        granted: boolean;
    }>;
    actorId: string;
}
/**
 * Standard permission actions
 */
export declare const STANDARD_ACTIONS: readonly ["view", "create", "edit", "delete", "approve", "export"];
/**
 * Restricted permission actions (require explicit grant)
 */
export declare const RESTRICTED_ACTIONS: readonly ["override"];
/**
 * Sensitive permissions requiring special handling
 */
export declare const SENSITIVE_PERMISSIONS: readonly ["ai.override_decision", "ai.view_explanations", "finance.modify_posted_entries", "finance.delete_transactions", "audit.view_logs"];
//# sourceMappingURL=types.d.ts.map