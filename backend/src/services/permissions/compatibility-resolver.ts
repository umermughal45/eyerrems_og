/**
 * Backward Compatibility Resolver
 * 
 * Converts legacy permission format to explicit permissions
 * Auto-generates explicit permissions from legacy access on first load
 */

import prisma from '../../prisma/client';
import logger from '../../utils/logger';
import { grantPermission, generateModulePermissions, getAllAvailablePermissions } from './permission-service';

/**
 * Check if role has explicit permissions (new system)
 */
export async function hasExplicitPermissions(roleId: string): Promise<boolean> {
  const count = await prisma.rolePermission.count({
    where: { roleId },
  });
  return count > 0;
}

/**
 * Convert legacy permissions to explicit permissions
 */
export async function convertLegacyPermissions(
  roleId: string,
  legacyPermissions: string[],
  actorId: string = 'system'
): Promise<void> {
  // Use explicit select to avoid querying category column if it doesn't exist
  const role = await prisma.role.findUnique({
    where: { id: roleId },
    select: {
      id: true,
      name: true,
      status: true,
      // Don't select category - may not exist yet
    },
  });

  if (!role) {
    throw new Error(`Role ${roleId} not found`);
  }

  // Check if already converted
  const hasExplicit = await hasExplicitPermissions(roleId);
  if (hasExplicit) {
    logger.info(`Role ${role.name} already has explicit permissions, skipping conversion`);
    return;
  }

  logger.info(`Converting legacy permissions for role: ${role.name}`);

  // Handle Admin role with wildcard
  if (legacyPermissions.includes('*') || legacyPermissions.includes('admin.*')) {
    // Grant ALL permissions to Admin
    const allPermissions = getAllAvailablePermissions();
    
    for (const [module, permissions] of Object.entries(allPermissions)) {
      for (const permission of permissions) {
        const parts = permission.split('.');
        if (parts.length === 2) {
          await grantPermission(roleId, parts[0], undefined, parts[1], actorId);
        } else if (parts.length === 3) {
          await grantPermission(roleId, parts[0], parts[1], parts[2], actorId);
        }
      }
    }

    logger.info(`Converted Admin role: granted ${Object.values(allPermissions).flat().length} explicit permissions`);
    return;
  }

  // Convert legacy permission strings to explicit grants
  for (const legacyPerm of legacyPermissions) {
    const parts = legacyPerm.split('.');
    
    if (parts.length === 2) {
      // Format: "module.action"
      const [module, action] = parts;
      
      // Grant at module level
      await grantPermission(roleId, module, undefined, action, actorId);
      
      // Also grant for common submodules if action is "view"
      if (action === 'view') {
        const commonSubmodules = ['transactions', 'reports', 'units', 'employees', 'leads'];
        for (const submodule of commonSubmodules) {
          try {
            await grantPermission(roleId, module, submodule, action, actorId);
          } catch (e) {
            // Ignore if submodule doesn't exist for this module
          }
        }
      }
    } else if (parts.length === 3) {
      // Format: "module.submodule.action"
      const [module, submodule, action] = parts;
      await grantPermission(roleId, module, submodule, action, actorId);
    } else if (parts.length === 1 && parts[0].endsWith('.*')) {
      // Format: "module.*" - grant all standard actions for module
      const module = parts[0].replace('.*', '');
      const standardActions = ['view', 'create', 'edit', 'delete'];
      
      for (const action of standardActions) {
        await grantPermission(roleId, module, undefined, action, actorId);
      }
    }
  }

  logger.info(`Converted legacy permissions for role ${role.name}: ${legacyPermissions.length} → explicit grants`);
}

// Simple in-memory lock to prevent concurrent conversions
const conversionLocks = new Map<string, Promise<void>>();

/**
 * Resolve permissions for a role (with backward compatibility)
 * Returns explicit permissions if available, otherwise converts legacy
 * Uses lock to prevent concurrent conversions
 */
export async function resolveRolePermissions(
  roleId: string,
  legacyPermissions: string[]
): Promise<string[]> {
  // Check if explicit permissions exist
  const hasExplicit = await hasExplicitPermissions(roleId);
  
  if (!hasExplicit) {
    // Check if conversion is already in progress
    const existingLock = conversionLocks.get(roleId);
    if (existingLock) {
      // Wait for existing conversion to complete
      await existingLock;
    } else {
      // Start conversion with lock
      const conversionPromise = (async () => {
        try {
          logger.info(`Auto-converting legacy permissions for role ${roleId}`);
          await convertLegacyPermissions(roleId, legacyPermissions);
        } finally {
          // Remove lock when done
          conversionLocks.delete(roleId);
        }
      })();
      
      conversionLocks.set(roleId, conversionPromise);
      await conversionPromise;
    }
  }

  // Get explicit permissions
  // Use explicit select to avoid querying category column if it doesn't exist
  const role = await prisma.role.findUnique({
    where: { id: roleId },
    select: {
      id: true,
      name: true,
      status: true,
      // Don't select category - may not exist yet
      rolePermissions: {
        where: { granted: true },
      },
    },
  });

  if (!role) {
    return [];
  }

  // PART 4: Permission Resolution After Deactivation
  // Deactivated roles do not grant permissions at runtime
  const roleStatus = (role as any).status || 'ACTIVE';
  if (roleStatus === 'DEACTIVATED') {
    logger.info(`Role ${role.name} (${roleId}) is DEACTIVATED - returning empty permissions`);
    return [];
  }

  // Build permission strings from explicit grants
  return role.rolePermissions.map((rp) => {
    if (rp.submodule) {
      return `${rp.module}.${rp.submodule}.${rp.action}`;
    }
    return `${rp.module}.${rp.action}`;
  });
}
