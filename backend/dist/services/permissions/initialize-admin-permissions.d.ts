/**
 * Initialize Admin Role Permissions
 *
 * This script grants ALL available permissions to the Admin role explicitly.
 * Run this after creating the Admin role or when new permissions are added.
 */
/**
 * Grant all available permissions to Admin role
 */
export declare function initializeAdminPermissions(adminRoleId: string): Promise<void>;
/**
 * Ensure Admin role has all permissions (idempotent)
 */
export declare function ensureAdminHasAllPermissions(): Promise<void>;
//# sourceMappingURL=initialize-admin-permissions.d.ts.map