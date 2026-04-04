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

import prisma from '../../prisma/client';
import logger from '../../utils/logger';
import { permissionCache } from './permission-cache';

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
export function parsePermission(permission: string): PermissionPath | null {
  const parts = permission.split('.');
  
  if (parts.length < 2 || parts.length > 3) {
    return null;
  }

  if (parts.length === 2) {
    return {
      module: parts[0],
      action: parts[1],
    };
  }

  return {
    module: parts[0],
    submodule: parts[1],
    action: parts[2],
  };
}

/**
 * Build permission path string from components
 */
export function buildPermissionPath(module: string, submodule: string | undefined, action: string): string {
  if (submodule) {
    return `${module}.${submodule}.${action}`;
  }
  return `${module}.${action}`;
}

/**
 * Standard actions available across all modules
 */
export const STANDARD_ACTIONS = [
  'view',
  'create',
  'edit',
  'delete',
  'approve',
  'export',
] as const;

/**
 * Restricted actions (require explicit grant, OFF by default)
 */
export const RESTRICTED_ACTIONS = [
  'override', // For AI, Finance, Audit modules
] as const;

/**
 * Check if user has explicit permission
 * NO WILDCARDS - Explicit grants only
 */
export async function checkPermission(
  roleId: string,
  permission: string
): Promise<PermissionCheckResult> {
  try {
    // Check cache first
    const cached = permissionCache.get(roleId, permission);
    if (cached) {
      return {
        allowed: cached.allowed,
        reason: cached.reason,
        permissionPath: permission,
      };
    }

    const parsed = parsePermission(permission);
    if (!parsed) {
      logger.warn(`Invalid permission format: ${permission}`);
      const result = {
        allowed: false,
        reason: 'Invalid permission format',
        permissionPath: permission,
      };
      permissionCache.set(roleId, permission, false, result.reason);
      return result;
    }

    // Get role with permissions
    // Use explicit select to avoid querying category column if it doesn't exist
    const role = await prisma.role.findUnique({
      where: { id: roleId },
      select: {
        id: true,
        name: true,
        status: true,
        // Don't select category - may not exist yet
        rolePermissions: {
          where: {
            module: parsed.module,
            submodule: parsed.submodule ?? null,
            action: parsed.action,
            granted: true,
          },
        },
      },
    });

    if (!role) {
      const result = {
        allowed: false,
        reason: 'Role not found',
        permissionPath: permission,
      };
      permissionCache.set(roleId, permission, false, result.reason);
      return result;
    }

    // PART 1: Check role status - deactivated roles don't grant permissions
    const roleStatus = (role as any).status || 'ACTIVE';
    if (roleStatus === 'DEACTIVATED') {
      const result = {
        allowed: false,
        reason: 'Role is deactivated',
        permissionPath: permission,
      };
      permissionCache.set(roleId, permission, false, result.reason);
      return result;
    }

    // Check explicit permission
    const hasExplicitPermission = role.rolePermissions.length > 0;

    if (hasExplicitPermission) {
      const result = {
        allowed: true,
        permissionPath: permission,
      };
      permissionCache.set(roleId, permission, true);
      return result;
    }

    // Deny by default - no explicit grant found
    const result = {
      allowed: false,
      reason: 'No explicit permission granted',
      permissionPath: permission,
    };
    permissionCache.set(roleId, permission, false, result.reason);
    return result;
  } catch (error: any) {
    logger.error(`Permission check error: ${error.message}`, error);
    // Fail closed - deny on error
    const result = {
      allowed: false,
      reason: 'Permission check failed',
      permissionPath: permission,
    };
    permissionCache.set(roleId, permission, false, result.reason);
    return result;
  }
}

/**
 * Check if user has any of the required permissions
 */
export async function checkAnyPermission(
  roleId: string,
  permissions: string[]
): Promise<PermissionCheckResult> {
  for (const permission of permissions) {
    const result = await checkPermission(roleId, permission);
    if (result.allowed) {
      return result;
    }
  }

  return {
    allowed: false,
    reason: 'None of the required permissions granted',
  };
}

/**
 * Get all permissions for a role
 */
export async function getRolePermissions(roleId: string): Promise<RolePermission[]> {
  try {
    // Use explicit select to avoid querying category column if it doesn't exist
    const role = await prisma.role.findUnique({
      where: { id: roleId },
      select: {
        id: true,
        // Don't select category - may not exist yet
        rolePermissions: {
          orderBy: [
            { module: 'asc' },
            { submodule: 'asc' },
            { action: 'asc' },
          ],
        },
      },
    });

    if (!role) {
      logger.warn(`Role ${roleId} not found when fetching permissions`);
      return [];
    }

    return role.rolePermissions || [];
  } catch (error: any) {
    logger.error(`Failed to get role permissions for ${roleId}:`, {
      message: error?.message,
      code: error?.code,
      stack: error?.stack,
    });
    throw error;
  }
}

/**
 * Grant permission to role
 */
export async function grantPermission(
  roleId: string,
  module: string,
  submodule: string | undefined,
  action: string,
  actorId: string
): Promise<void> {
  // Normalize submodule: convert empty string or undefined to null
  const submoduleValue: string | null = 
    submodule && submodule.trim() !== '' 
      ? submodule.trim() 
      : null;

  // Use findFirst + create/update pattern instead of upsert to handle nullable submodule
  // Prisma's upsert doesn't work well with nullable fields in compound unique constraints
  const existing = await prisma.rolePermission.findFirst({
    where: {
      roleId,
      module,
      submodule: submoduleValue,
      action,
    },
  });

  if (existing) {
    // Update existing permission
    await prisma.rolePermission.update({
      where: { id: existing.id },
      data: {
        granted: true,
        createdBy: actorId,
      },
    });
  } else {
    // Create new permission
    await prisma.rolePermission.create({
      data: {
        roleId,
        module,
        submodule: submoduleValue,
        action,
        granted: true,
        createdBy: actorId,
      },
    });
  }

  // Invalidate cache for this role
  permissionCache.invalidateRole(roleId);
}

/**
 * Revoke permission from role
 */
export async function revokePermission(
  roleId: string,
  module: string,
  submodule: string | undefined,
  action: string,
  actorId: string
): Promise<void> {
  await prisma.rolePermission.updateMany({
    where: {
      roleId,
      module,
      submodule: submodule ?? null,
      action,
    },
    data: {
      granted: false,
      createdBy: actorId,
    },
  });

  // Invalidate cache for this role
  permissionCache.invalidateRole(roleId);
}

/**
 * Bulk grant/revoke permissions
 */
export async function bulkUpdatePermissions(
  roleId: string,
  permissions: Array<{
    module: string;
    submodule?: string;
    action: string;
    granted: boolean;
  }>,
  actorId: string
): Promise<void> {
  try {
    // Use a transaction to ensure atomicity and avoid issues with nullable fields in compound unique constraints
    await prisma.$transaction(
      async (tx) => {
        // Batch process permissions to avoid timeout issues with large sets
        const batchSize = 50;
        for (let i = 0; i < permissions.length; i += batchSize) {
          const batch = permissions.slice(i, i + batchSize);
          
          // Process batch sequentially to avoid database contention
          // (Parallel processing within transaction can cause deadlocks)
          for (const perm of batch) {
            try {
              // Normalize submodule: convert empty string or undefined to null
            const submoduleValue: string | null = 
              perm.submodule && perm.submodule.trim() !== '' 
                ? perm.submodule.trim() 
                : null;
            
            const permPath = submoduleValue
              ? `${perm.module}.${submoduleValue}.${perm.action}`
              : `${perm.module}.${perm.action}`;
            
            // Find existing permission using the compound unique constraint fields
            // Use findFirst to handle nullable submodule properly
            const existing = await tx.rolePermission.findFirst({
              where: {
                roleId,
                module: perm.module,
                submodule: submoduleValue,
                action: perm.action,
              },
            });
            
            if (existing) {
              // Update existing permission
              await tx.rolePermission.update({
                where: { id: existing.id },
                data: {
                  granted: perm.granted,
                  createdBy: actorId,
                },
              });
            } else {
              // Try to create new permission
              // If it fails due to unique constraint violation (race condition),
              // find and update instead
              try {
                await tx.rolePermission.create({
                  data: {
                    roleId,
                    module: perm.module,
                    submodule: submoduleValue,
                    action: perm.action,
                    granted: perm.granted,
                    createdBy: actorId,
                  },
                });
              } catch (createError: any) {
                // If unique constraint violation, the record was created by another transaction
                // Find it and update instead
                if (createError.code === 'P2002' || createError.code === '23505') {
                  const raceConditionRecord = await tx.rolePermission.findFirst({
                    where: {
                      roleId,
                      module: perm.module,
                      submodule: submoduleValue,
                      action: perm.action,
                    },
                  });
                  
                  if (raceConditionRecord) {
                    await tx.rolePermission.update({
                      where: { id: raceConditionRecord.id },
                      data: {
                        granted: perm.granted,
                        createdBy: actorId,
                      },
                    });
                  } else {
                    // Record doesn't exist, rethrow original error
                    throw createError;
                  }
                } else {
                  // Different error, rethrow
                  throw createError;
                }
              }
            }
          } catch (permError: any) {
            // Log the specific permission that failed with detailed error info
            const permPath = perm.submodule 
              ? `${perm.module}.${perm.submodule}.${perm.action}`
              : `${perm.module}.${perm.action}`;
            const errorDetails = {
              message: permError?.message,
              code: permError?.code,
              meta: permError?.meta,
              stack: permError?.stack,
              permission: perm,
              roleId,
              actorId,
            };
            logger.error(`Failed to update permission ${permPath} for role ${roleId}:`, errorDetails);
            throw new Error(`Failed to update permission ${permPath}: ${permError?.message || 'Database error'} (Code: ${permError?.code || 'UNKNOWN'})`);
            }
          }
        }
      },
      {
        maxWait: 10000, // Maximum time to wait for a transaction slot (increased from 5s)
        timeout: 30000, // Maximum time the transaction can run (increased from 10s to 30s for large permission sets)
      }
    );

    // Invalidate cache for this role after bulk update
    permissionCache.invalidateRole(roleId);
  } catch (error: any) {
    const errorDetails = {
      message: error?.message,
      code: error?.code,
      meta: error?.meta,
      stack: error?.stack,
      permissionsCount: permissions.length,
      roleId,
      actorId,
    };
    logger.error(`Bulk update permissions failed for role ${roleId}:`, errorDetails);
    throw error;
  }
}

/**
 * Generate all possible permissions for a module
 */
export function generateModulePermissions(module: string, submodules?: string[]): string[] {
  const permissions: string[] = [];

  // Standard actions at module level
  STANDARD_ACTIONS.forEach((action) => {
    permissions.push(buildPermissionPath(module, undefined, action));
  });

  // Submodule permissions
  if (submodules) {
    submodules.forEach((submodule) => {
      STANDARD_ACTIONS.forEach((action) => {
        permissions.push(buildPermissionPath(module, submodule, action));
      });
    });
  }

  return permissions;
}

/**
 * Get all available modules and their permissions
 */
export function getAllAvailablePermissions(): Record<string, string[]> {
  return {
    finance: generateModulePermissions('finance', ['transactions', 'reports', 'vouchers', 'journal']),
    properties: generateModulePermissions('properties', ['units', 'leases', 'maintenance']),
    hr: generateModulePermissions('hr', ['employees', 'payroll', 'attendance', 'leave']),
    crm: generateModulePermissions('crm', ['leads', 'clients', 'deals', 'communications']),
    construction: generateModulePermissions('construction', ['projects', 'milestones', 'budgets']),
    tenants: generateModulePermissions('tenants', ['payments', 'leases', 'maintenance']),
    ai: [
      ...generateModulePermissions('ai', ['intelligence', 'assistant']),
      'ai.intelligence.override_decision',
      'ai.intelligence.view_explanations',
    ],
    audit: [
      ...generateModulePermissions('audit', ['logs', 'reports']),
      'audit.logs.view',
    ],
    permissions: [
      'permissions.view',
      'permissions.inspect',
    ],
    reminder: [
      ...generateModulePermissions('reminder'),
      'reminder.update',
      'reminder.delete',
    ],
    notification: [
      'notification.view',
      'notification.manage',
    ],
  };
}

// Type helper for RolePermission
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
