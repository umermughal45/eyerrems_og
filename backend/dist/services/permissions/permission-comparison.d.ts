/**
 * Permission Comparison Service
 *
 * Compares permission sets to ensure reassignment changes permission lineage.
 * Used to prevent semantic bypasses where roles have equivalent permissions.
 */
export interface PermissionFingerprint {
    granted: Set<string>;
    denied: Set<string>;
    total: number;
}
/**
 * Create permission fingerprint from role permissions
 */
export declare function createPermissionFingerprint(roleId: string): Promise<PermissionFingerprint>;
/**
 * Calculate similarity between two permission fingerprints
 * Returns a value between 0 (completely different) and 1 (identical)
 */
export declare function calculatePermissionSimilarity(from: PermissionFingerprint, to: PermissionFingerprint): number;
/**
 * Check if two permission sets are equivalent
 * Returns true if similarity >= 95% (considered equivalent)
 */
export declare function arePermissionsEquivalent(fromRoleId: string, toRoleId: string): Promise<boolean>;
/**
 * Calculate permission delta between two roles
 */
export declare function calculatePermissionDelta(fromRoleId: string, toRoleId: string): Promise<{
    added: string[];
    removed: string[];
    unchanged: string[];
}>;
//# sourceMappingURL=permission-comparison.d.ts.map