/**
 * Permission Service - Production-Grade Action-Based Permission System
 *
 * CRITICAL RULES:
 * - No wildcards at runtime
 * - Deny by default
 * - Explicit allow required
 * - Admin must pass explicit checks (no bypass)
 * - Silent refusal preferred over errors
 */
export interface PermissionPath {
    module: string;
    submodule?: string;
    action: string;
}
export interface PermissionCheckResult {
    allowed: boolean;
    reason?: string;
    permissionPath?: string;
}
/**
 * Parse permission string into structured path
 * Format: "module.submodule.action" or "module.action"
 */
export declare function parsePermission(permission: string): PermissionPath | null;
/**
 * Build permission path string from components
 */
export declare function buildPermissionPath(module: string, submodule: string | undefined, action: string): string;
/**
 * Standard actions available across all modules
 */
export declare const STANDARD_ACTIONS: readonly ["view", "create", "edit", "delete", "approve", "export"];
/**
 * Restricted actions (require explicit grant, OFF by default)
 */
export declare const RESTRICTED_ACTIONS: readonly ["override"];
/**
 * Check if user has explicit permission
 * NO WILDCARDS - Explicit grants only
 */
export declare function checkPermission(roleId: string, permission: string): Promise<PermissionCheckResult>;
/**
 * Check if user has any of the required permissions
 */
export declare function checkAnyPermission(roleId: string, permissions: string[]): Promise<PermissionCheckResult>;
/**
 * Get all permissions for a role
 */
export declare function getRolePermissions(roleId: string): Promise<RolePermission[]>;
/**
 * Grant permission to role
 */
export declare function grantPermission(roleId: string, module: string, submodule: string | undefined, action: string, actorId: string): Promise<void>;
/**
 * Revoke permission from role
 */
export declare function revokePermission(roleId: string, module: string, submodule: string | undefined, action: string, actorId: string): Promise<void>;
/**
 * Bulk grant/revoke permissions
 */
export declare function bulkUpdatePermissions(roleId: string, permissions: Array<{
    module: string;
    submodule?: string;
    action: string;
    granted: boolean;
}>, actorId: string): Promise<void>;
/**
 * Generate all possible permissions for a module
 */
export declare function generateModulePermissions(module: string, submodules?: string[]): string[];
/**
 * Get all available modules and their permissions
 */
export declare function getAllAvailablePermissions(): Record<string, string[]>;
type RolePermission = {
    id: string;
    roleId: string;
    module: string;
    submodule: string | null;
    action: string;
    granted: boolean;
    createdAt: Date;
    createdBy: string | null;
};
export {};
//# sourceMappingURL=permission-service.d.ts.map