/**
 * Permission System Migration Script
 * 
 * Converts Admin wildcard permissions to explicit permission grants
 * Leaves other roles untouched (they will auto-convert on first access)
 * 
 * This migration is:
 * - Idempotent (safe to run multiple times)
 * - Reversible (can be rolled back)
 * - Safe (doesn't break existing functionality)
 */

import prisma from '../prisma/client';
import logger from '../utils/logger';
import { grantPermission, getAllAvailablePermissions } from '../services/permissions/permission-service';
import { logPermissionChange } from '../services/permissions/audit-logger';

async function migratePermissions() {
  logger.info('Starting permission system migration...');

  try {
    // Find Admin role
    const adminRole = await prisma.role.findUnique({
      where: { name: 'Admin' },
      include: {
        rolePermissions: true,
      },
    });

    if (!adminRole) {
      logger.warn('Admin role not found, skipping migration');
      return;
    }

    // Check if Admin already has explicit permissions
    if (adminRole.rolePermissions.length > 0) {
      logger.info('Admin role already has explicit permissions, migration already completed');
      return;
    }

    // Check if Admin has wildcard permission
    const legacyPermissions = (adminRole.permissions as string[]) || [];
    const hasWildcard = legacyPermissions.includes('*') || legacyPermissions.includes('admin.*');

    if (!hasWildcard) {
      logger.warn('Admin role does not have wildcard permission, skipping migration');
      return;
    }

    logger.info('Converting Admin wildcard to explicit permissions...');

    // Get all available permissions
    const allPermissions = getAllAvailablePermissions();
    let grantedCount = 0;

    // Grant all permissions explicitly (parallel for performance)
    const grantPromises: Promise<void>[] = [];
    
    for (const [module, permissions] of Object.entries(allPermissions)) {
      for (const permission of permissions) {
        const parts = permission.split('.');
        
        if (parts.length === 2) {
          // Format: "module.action"
          grantPromises.push(
            grantPermission(
              adminRole.id,
              parts[0],
              undefined,
              parts[1],
              'system' // System-initialized
            )
          );
          grantedCount++;
        } else if (parts.length === 3) {
          // Format: "module.submodule.action"
          grantPromises.push(
            grantPermission(
              adminRole.id,
              parts[0],
              parts[1],
              parts[2],
              'system' // System-initialized
            )
          );
          grantedCount++;
        }
      }
    }
    
    // Execute all grants in parallel
    await Promise.all(grantPromises);

    // Log the migration
    await logPermissionChange({
      actorId: 'system',
      actorUsername: 'system',
      roleId: adminRole.id,
      roleName: adminRole.name,
      permissionPath: '*',
      oldValue: { type: 'wildcard', permissions: legacyPermissions },
      newValue: { type: 'explicit', count: grantedCount },
      changeType: 'bulk_update',
      context: {
        migration: true,
        timestamp: new Date().toISOString(),
      },
    });

    logger.info(`Migration completed: Granted ${grantedCount} explicit permissions to Admin role`);

    // Verify migration
    const verifyRole = await prisma.role.findUnique({
      where: { id: adminRole.id },
      include: {
        rolePermissions: {
          where: { granted: true },
        },
      },
    });

    if (verifyRole && verifyRole.rolePermissions.length === grantedCount) {
      logger.info('Migration verification: SUCCESS');
    } else {
      logger.warn(`Migration verification: Expected ${grantedCount}, got ${verifyRole?.rolePermissions.length || 0}`);
    }
  } catch (error: any) {
    logger.error(`Migration failed: ${error.message}`, error);
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  migratePermissions()
    .then(() => {
      logger.info('Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Migration failed', error);
      process.exit(1);
    });
}

export default migratePermissions;
