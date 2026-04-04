/**
 * Initialize Admin Role Permissions
 * 
 * This script grants ALL available permissions to the Admin role explicitly.
 * Run this after creating the Admin role or when new permissions are added.
 */

import prisma from '../../prisma/client';
import logger from '../../utils/logger';
import { getAllAvailablePermissions, grantPermission } from './permission-service';

/**
 * Grant all available permissions to Admin role
 */
export async function initializeAdminPermissions(adminRoleId: string): Promise<void> {
  try {
    logger.info(`Initializing Admin role permissions for role ${adminRoleId}`);

    const allPermissions = getAllAvailablePermissions();
    let grantedCount = 0;
    let skippedCount = 0;

    for (const [module, permissions] of Object.entries(allPermissions)) {
      for (const permissionString of permissions) {
        const parts = permissionString.split('.');
        
        if (parts.length === 2) {
          // Module-level permission: module.action
          const [moduleName, action] = parts;
          try {
            await grantPermission(adminRoleId, moduleName, undefined, action, 'system');
            grantedCount++;
          } catch (error: any) {
            logger.warn(`Failed to grant ${permissionString}: ${error.message}`);
            skippedCount++;
          }
        } else if (parts.length === 3) {
          // Submodule-level permission: module.submodule.action
          const [moduleName, submodule, action] = parts;
          try {
            await grantPermission(adminRoleId, moduleName, submodule, action, 'system');
            grantedCount++;
          } catch (error: any) {
            logger.warn(`Failed to grant ${permissionString}: ${error.message}`);
            skippedCount++;
          }
        }
      }
    }

    logger.info(`Admin permissions initialized: ${grantedCount} granted, ${skippedCount} skipped`);
  } catch (error: any) {
    logger.error(`Failed to initialize Admin permissions: ${error.message}`, error);
    throw error;
  }
}

/**
 * Ensure Admin role has all permissions (idempotent)
 */
export async function ensureAdminHasAllPermissions(): Promise<void> {
  try {
    const adminRole = await prisma.role.findUnique({
      where: { name: 'Admin' },
      select: {
        id: true,
        name: true,
        status: true,
        // Don't select category - may not exist yet
      },
    }) as any;

    if (!adminRole) {
      logger.warn('Admin role not found, skipping permission initialization');
      return;
    }

    // Check if Admin already has explicit permissions
    const permissionCount = await prisma.rolePermission.count({
      where: { roleId: adminRole.id, granted: true },
    });

    if (permissionCount === 0) {
      logger.info('Admin role has no explicit permissions, initializing...');
      await initializeAdminPermissions(adminRole.id);
    } else {
      logger.info(`Admin role already has ${permissionCount} explicit permissions`);
    }
  } catch (error: any) {
    logger.error(`Failed to ensure Admin permissions: ${error.message}`, error);
  }
}
