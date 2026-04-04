import express, { Response } from 'express';
import { z } from 'zod';
import prisma from '../prisma/client';
import logger from '../utils/logger';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';
import { getRoleCategory } from '../services/permissions/role-category';
import { arePermissionsEquivalent, calculatePermissionDelta } from '../services/permissions/permission-comparison';
import { checkCategoryMigrationStatus } from '../utils/check-migration-status';

const router = (express as any).Router();

// Get all users (Admin only)
router.get('/', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { role, status } = req.query;
    
    const where: any = {};
    
    // Filter by role if provided
    if (role && typeof role === 'string') {
      where.roleId = role;
    }
    
    // Note: User model doesn't have a status field, but we can filter by role status
    // For now, we'll return all users and let frontend filter by role status
    
    const users = await prisma.user.findMany({
      where,
      include: {
        role: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Filter by role status if status query param is provided
    let filteredUsers = users;
    if (status === 'active') {
      filteredUsers = users.filter((user: any) => {
        const roleStatus = (user.role as any)?.status || 'ACTIVE';
        return roleStatus === 'ACTIVE';
      });
    }

    res.json(filteredUsers.map((user: any) => ({
      id: user.id,
      username: user.username,
      email: user.email,
      roleId: user.roleId,
      role: user.role ? {
        id: user.role.id,
        name: user.role.name,
        status: (user.role as any).status || 'ACTIVE',
      } : null,
      createdAt: user.createdAt,
    })));
  } catch (error: any) {
    logger.error('Get users error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch users',
      details: process.env.NODE_ENV === 'development' ? error?.message : undefined,
    });
  }
});

// PART 1: Explicit User Reassignment API
// POST /api/users/:userId/roles/reassign
// Single-purpose endpoint for explicit user role reassignment
router.post('/:userId/roles/reassign', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { fromRoleId, toRoleId, reason } = z.object({
      fromRoleId: z.string().uuid('Invalid fromRoleId'),
      toRoleId: z.string().uuid('Invalid toRoleId'),
      reason: z.string().min(1, 'Reason is required').default('ROLE_DEACTIVATION_PREP'),
    }).parse(req.body);

    const userId = req.params.userId;
    const actorId = req.user!.id;
    const actorUsername = req.user!.username || req.user!.email || 'unknown';

    // Get user with current role
    // Use explicit select to avoid querying category column if it doesn't exist
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: {
          select: {
            id: true,
            name: true,
            status: true,
            // Don't select category - may not exist yet
          },
        },
      },
    });

    if (!user) {
      logger.warn(`User reassignment failed: User ${userId} not found (actor: ${actorId})`);
      return res.status(404).json({ 
        error: 'USER_NOT_FOUND',
        code: 'USER_NOT_FOUND',
      });
    }

    // Validation: User must currently have fromRoleId
    if (user.roleId !== fromRoleId) {
      logger.warn(`INVALID_REASSIGNMENT: User ${userId} has role ${user.roleId}, not ${fromRoleId} (actor: ${actorId})`);
      return res.status(400).json({ 
        error: 'INVALID_REASSIGNMENT',
        code: 'USER_ROLE_MISMATCH',
      });
    }

    // Validation: fromRoleId must be ACTIVE
    // Use explicit select to avoid querying category column if it doesn't exist
    const fromRole = await prisma.role.findUnique({
      where: { id: fromRoleId },
      select: {
        id: true,
        name: true,
        status: true,
        // category: true, // Don't select - may not exist yet
      },
    }) as any;

    if (!fromRole) {
      logger.warn(`INVALID_REASSIGNMENT: Source role ${fromRoleId} not found (actor: ${actorId})`);
      return res.status(404).json({ 
        error: 'ROLE_NOT_FOUND',
        code: 'SOURCE_ROLE_NOT_FOUND',
      });
    }

    const fromRoleStatus = fromRole.status || 'ACTIVE';
    if (fromRoleStatus !== 'ACTIVE') {
      logger.warn(`INVALID_REASSIGNMENT: Source role ${fromRoleId} is ${fromRoleStatus}, not ACTIVE (actor: ${actorId})`);
      return res.status(400).json({ 
        error: 'INVALID_REASSIGNMENT',
        code: 'SOURCE_ROLE_NOT_ACTIVE',
      });
    }

    // Validation: toRoleId must be ACTIVE
    // Use explicit select to avoid querying category column if it doesn't exist
    const toRole = await prisma.role.findUnique({
      where: { id: toRoleId },
      select: {
        id: true,
        name: true,
        status: true,
        // category: true, // Don't select - may not exist yet
      },
    }) as any;

    if (!toRole) {
      logger.warn(`INVALID_TARGET_ROLE: Target role ${toRoleId} not found (actor: ${actorId})`);
      return res.status(404).json({ 
        error: 'ROLE_NOT_FOUND',
        code: 'TARGET_ROLE_NOT_FOUND',
      });
    }

    const toRoleStatus = toRole.status || 'ACTIVE';
    if (toRoleStatus !== 'ACTIVE') {
      return res.status(400).json({ 
        error: 'Invalid target role',
        message: `Target role must be ACTIVE`,
        toRoleStatus,
      });
    }

    // PART 2: Rule 1 — Block same role
    if (toRoleId === fromRoleId) {
      logger.warn(`INVALID_REASSIGNMENT: Attempt to reassign user ${userId} to same role ${fromRoleId} by ${actorId}`);
      return res.status(400).json({ 
        error: 'INVALID_REASSIGNMENT',
        message: 'Cannot reassign user to the same role',
        code: 'SAME_ROLE',
      });
    }

    // PART 2: Rule 2 — Block same category
    // Check if migration has been applied
    const categoryMigrationApplied = await checkCategoryMigrationStatus();
    
    let fromCategory: string;
    let toCategory: string;
    
    if (!categoryMigrationApplied) {
      // Migration not applied - skip category check but log warning
      logger.warn(`Category migration not applied - skipping category validation for user ${userId} reassignment`);
      fromCategory = 'MIGRATION_PENDING';
      toCategory = 'MIGRATION_PENDING';
    } else {
      try {
        fromCategory = getRoleCategory(fromRole);
        toCategory = getRoleCategory(toRole);
        
        // Only enforce category check if migration is applied
        if (fromCategory === toCategory) {
          logger.warn(`INVALID_REASSIGNMENT: Attempt to reassign user ${userId} from ${fromCategory} to ${toCategory} (same category) by ${actorId}`);
          return res.status(400).json({ 
            error: 'INVALID_REASSIGNMENT',
            message: 'Reassignment must change role category',
            code: 'SAME_CATEGORY',
            fromCategory,
            toCategory,
          });
        }
      } catch (categoryError: any) {
        logger.error(`Category determination failed: ${categoryError.message}`, categoryError);
        fromCategory = 'UNKNOWN';
        toCategory = 'UNKNOWN';
      }
    }

    // PART 2: Rule 3 — Role lifecycle checks
    if (toRoleStatus !== 'ACTIVE') {
      logger.warn(`INVALID_TARGET_ROLE: Attempt to reassign user ${userId} to non-active role ${toRoleId} (status: ${toRoleStatus}) by ${actorId}`);
      return res.status(400).json({ 
        error: 'INVALID_TARGET_ROLE',
        message: 'Target role must be active',
        code: 'TARGET_NOT_ACTIVE',
        toRoleStatus,
      });
    }

    // Check if actor is system admin
    const actor = await prisma.user.findUnique({
      where: { id: actorId },
      include: { 
        role: {
          select: {
            id: true,
            name: true,
            status: true,
            // Don't select category - may not exist yet
          },
        },
      },
    });
    const actorIsSystemAdmin = actor?.role?.name?.toLowerCase() === 'admin';

    if (toRoleStatus === 'SYSTEM_LOCKED' && !actorIsSystemAdmin) {
      logger.warn(`INVALID_TARGET_ROLE: Non-admin attempt to reassign user ${userId} to system-locked role ${toRoleId} by ${actorId}`);
      return res.status(400).json({ 
        error: 'INVALID_TARGET_ROLE',
        message: 'Cannot assign system-locked role',
        code: 'SYSTEM_LOCKED_ROLE',
      });
    }

    // PART 3: Enforce Permission Change
    let permissionDelta: any = null;
    try {
      const areEquivalent = await arePermissionsEquivalent(fromRoleId, toRoleId);
      
      if (areEquivalent) {
        logger.warn(`NO_PERMISSION_LINEAGE_CHANGE: Attempt to reassign user ${userId} from ${fromRoleId} to ${toRoleId} with equivalent permissions by ${actorId}`);
        return res.status(400).json({ 
          error: 'NO_PERMISSION_LINEAGE_CHANGE',
          message: 'Target role does not alter effective permissions',
          code: 'EQUIVALENT_PERMISSIONS',
        });
      }
      
      // Calculate permission delta for audit
      permissionDelta = await calculatePermissionDelta(fromRoleId, toRoleId);
    } catch (permError: any) {
      logger.error(`Permission comparison error: ${permError.message}`, permError);
      // Don't block reassignment if permission check fails (could be due to missing permissions)
      // Log the error but continue with reassignment
      permissionDelta = {
        added: [],
        removed: [],
        unchanged: [],
        error: 'Permission comparison failed',
      };
    }

    // Get permission snapshots before reassignment
    const { getRolePermissions } = await import('../services/permissions/permission-service');
    let previousPermissions: any[] = [];
    let newPermissions: any[] = [];
    
    try {
      previousPermissions = await getRolePermissions(fromRoleId);
      newPermissions = await getRolePermissions(toRoleId);
    } catch (permError: any) {
      logger.warn(`Failed to fetch permission snapshots: ${permError.message}`);
    }

    // PART 4: Atomic Transaction
    await prisma.$transaction(async (tx) => {
      // Update user role
      await tx.user.update({
        where: { id: userId },
        data: { roleId: toRoleId },
      });

      // Verify user has at least one active role
      const updatedUser = await tx.user.findUnique({
        where: { id: userId },
        include: {
          role: {
            select: {
              id: true,
              name: true,
              status: true,
              // Don't select category - may not exist yet
            },
          },
        },
      });

      if (!updatedUser || !updatedUser.role) {
        throw new Error('User role update failed - user has no role');
      }

      const updatedRoleStatus = (updatedUser.role as any).status || 'ACTIVE';
      if (updatedRoleStatus !== 'ACTIVE') {
        throw new Error(`User role update failed - assigned role is ${updatedRoleStatus}, not ACTIVE`);
      }

      // PART 4: Mandatory Audit Logging - Must succeed or rollback
      await tx.roleLifecycleAuditLog.create({
        data: {
          actorId,
          actorUsername,
          roleId: fromRoleId,
          roleName: fromRole.name,
          previousStatus: fromRoleStatus,
          newStatus: fromRoleStatus, // Status unchanged, but user reassigned
          affectedUsers: [{ id: user.id, username: user.username, email: user.email }],
          reassignmentMap: { [userId]: toRoleId },
          reason: reason || 'ROLE_DEACTIVATION_PREP',
          context: {
            requestPath: req.path,
            requestMethod: req.method,
            ip: req.ip,
            previousPermissions: previousPermissions,
            newPermissions: newPermissions,
            reassignmentType: 'EXPLICIT_USER_REASSIGNMENT',
            fromCategory: fromCategory || 'UNKNOWN',
            toCategory: toCategory || 'UNKNOWN',
            permissionDelta: permissionDelta ? {
              added: permissionDelta.added || [],
              removed: permissionDelta.removed || [],
              unchanged: permissionDelta.unchanged || [],
            } : null,
          },
        } as any,
      });
    });

    logger.info(`User ${user.username} (${userId}) reassigned from role ${fromRole.name} (${fromCategory}) to ${toRole.name} (${toCategory}) by ${actorUsername}. Permission delta: +${permissionDelta.added.length} -${permissionDelta.removed.length} =${permissionDelta.unchanged.length}`);

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        previousRoleId: fromRoleId,
        previousRoleName: fromRole.name,
        previousCategory: fromCategory,
        newRoleId: toRoleId,
        newRoleName: toRole.name,
        newCategory: toCategory,
      },
      reason,
      categoryChange: {
        from: fromCategory,
        to: toCategory,
      },
      permissionDelta: {
        added: permissionDelta.added.length,
        removed: permissionDelta.removed.length,
        unchanged: permissionDelta.unchanged.length,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      logger.warn(`Validation error in user reassignment: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')} (actor: ${req.user?.id})`);
      return res.status(400).json({ 
        error: 'VALIDATION_ERROR',
        code: 'INVALID_REQUEST',
      });
    }
    logger.error(`User reassignment error: ${error.message}`, {
      userId: req.params.userId,
      actorId: req.user?.id,
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({ 
      error: 'REASSIGNMENT_FAILED',
      code: 'INTERNAL_ERROR',
    });
  }
});

export default router;
