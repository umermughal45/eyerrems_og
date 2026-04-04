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
export function determineRoleCategory(roleName: string, roleStatus?: string): RoleCategory {
  const normalizedName = roleName.trim().toLowerCase();
  
  // Admin role is always ADMIN + SYSTEM_LOCKED
  if (normalizedName === 'admin') {
    return 'ADMIN';
  }
  
  // Dealer variants
  if (normalizedName.includes('dealer')) {
    return 'DEALER';
  }
  
  // Tenant variants
  if (normalizedName.includes('tenant')) {
    return 'TENANT';
  }
  
  // System roles (SYSTEM_LOCKED)
  if (roleStatus === 'SYSTEM_LOCKED') {
    return 'SYSTEM';
  }
  
  // Default to STAFF for all other roles
  return 'STAFF';
}

/**
 * Get role category (from database or determine from name)
 * Handles cases where category column doesn't exist yet (backward compatibility)
 */
export function getRoleCategory(role: { name: string; category?: string | null; status?: string }): RoleCategory {
  // If category exists in DB and is valid, use it (immutable after creation)
  if (role.category && typeof role.category === 'string' && ['ADMIN', 'DEALER', 'STAFF', 'TENANT', 'SYSTEM'].includes(role.category)) {
    return role.category as RoleCategory;
  }
  
  // Otherwise determine from name and status (handles missing category column)
  return determineRoleCategory(role.name, role.status);
}
