/**
 * Backward Compatibility Resolver
 *
 * Converts legacy permission format to explicit permissions
 * Auto-generates explicit permissions from legacy access on first load
 */
/**
 * Check if role has explicit permissions (new system)
 */
export declare function hasExplicitPermissions(roleId: string): Promise<boolean>;
/**
 * Convert legacy permissions to explicit permissions
 */
export declare function convertLegacyPermissions(roleId: string, legacyPermissions: string[], actorId?: string): Promise<void>;
/**
 * Resolve permissions for a role (with backward compatibility)
 * Returns explicit permissions if available, otherwise converts legacy
 * Uses lock to prevent concurrent conversions
 */
export declare function resolveRolePermissions(roleId: string, legacyPermissions: string[]): Promise<string[]>;
//# sourceMappingURL=compatibility-resolver.d.ts.map