/**
 * Role Category Service
 *
 * Determines and manages role categories for enforcement.
 * Categories are immutable after creation and used for reassignment validation.
 */
export type RoleCategory = 'ADMIN' | 'DEALER' | 'STAFF' | 'TENANT' | 'SYSTEM';
/**
 * Determine role category from role name
 * This is the single source of truth for category assignment
 */
export declare function determineRoleCategory(roleName: string, roleStatus?: string): RoleCategory;
/**
 * Get role category (from database or determine from name)
 * Handles cases where category column doesn't exist yet (backward compatibility)
 */
export declare function getRoleCategory(role: {
    name: string;
    category?: string | null;
    status?: string;
}): RoleCategory;
//# sourceMappingURL=role-category.d.ts.map