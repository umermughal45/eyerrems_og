"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const zod_1 = require("zod");
const client_1 = __importDefault(require("../prisma/client"));
const logger_1 = __importDefault(require("../utils/logger"));
const auth_1 = require("../middleware/auth");
const role_category_1 = require("../services/permissions/role-category");
const permission_comparison_1 = require("../services/permissions/permission-comparison");
const check_migration_status_1 = require("../utils/check-migration-status");
const router = express_1.default.Router();
// Get all users (Admin only)
router.get('/', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const { role, status } = req.query;
        const where = {};
        // Filter by role if provided
        if (role && typeof role === 'string') {
            where.roleId = role;
        }
        // Note: User model doesn't have a status field, but we can filter by role status
        // For now, we'll return all users and let frontend filter by role status
        const users = await client_1.default.user.findMany({
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
            filteredUsers = users.filter((user) => {
                const roleStatus = user.role?.status || 'ACTIVE';
                return roleStatus === 'ACTIVE';
            });
        }
        res.json(filteredUsers.map((user) => ({
            id: user.id,
            username: user.username,
            email: user.email,
            roleId: user.roleId,
            role: user.role ? {
                id: user.role.id,
                name: user.role.name,
                status: user.role.status || 'ACTIVE',
            } : null,
            createdAt: user.createdAt,
        })));
    }
    catch (error) {
        logger_1.default.error('Get users error:', error);
        res.status(500).json({
            error: 'Failed to fetch users',
            details: process.env.NODE_ENV === 'development' ? error?.message : undefined,
        });
    }
});
// PART 1: Explicit User Reassignment API
// POST /api/users/:userId/roles/reassign
// Single-purpose endpoint for explicit user role reassignment
router.post('/:userId/roles/reassign', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const { fromRoleId, toRoleId, reason } = zod_1.z.object({
            fromRoleId: zod_1.z.string().uuid('Invalid fromRoleId'),
            toRoleId: zod_1.z.string().uuid('Invalid toRoleId'),
            reason: zod_1.z.string().min(1, 'Reason is required').default('ROLE_DEACTIVATION_PREP'),
        }).parse(req.body);
        const userId = req.params.userId;
        const actorId = req.user.id;
        const actorUsername = req.user.username || req.user.email || 'unknown';
        // Get user with current role
        // Use explicit select to avoid querying category column if it doesn't exist
        const user = await client_1.default.user.findUnique({
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
            logger_1.default.warn(`User reassignment failed: User ${userId} not found (actor: ${actorId})`);
            return res.status(404).json({
                error: 'USER_NOT_FOUND',
                code: 'USER_NOT_FOUND',
            });
        }
        // Validation: User must currently have fromRoleId
        if (user.roleId !== fromRoleId) {
            logger_1.default.warn(`INVALID_REASSIGNMENT: User ${userId} has role ${user.roleId}, not ${fromRoleId} (actor: ${actorId})`);
            return res.status(400).json({
                error: 'INVALID_REASSIGNMENT',
                code: 'USER_ROLE_MISMATCH',
            });
        }
        // Validation: fromRoleId must be ACTIVE
        // Use explicit select to avoid querying category column if it doesn't exist
        const fromRole = await client_1.default.role.findUnique({
            where: { id: fromRoleId },
            select: {
                id: true,
                name: true,
                status: true,
                // category: true, // Don't select - may not exist yet
            },
        });
        if (!fromRole) {
            logger_1.default.warn(`INVALID_REASSIGNMENT: Source role ${fromRoleId} not found (actor: ${actorId})`);
            return res.status(404).json({
                error: 'ROLE_NOT_FOUND',
                code: 'SOURCE_ROLE_NOT_FOUND',
            });
        }
        const fromRoleStatus = fromRole.status || 'ACTIVE';
        if (fromRoleStatus !== 'ACTIVE') {
            logger_1.default.warn(`INVALID_REASSIGNMENT: Source role ${fromRoleId} is ${fromRoleStatus}, not ACTIVE (actor: ${actorId})`);
            return res.status(400).json({
                error: 'INVALID_REASSIGNMENT',
                code: 'SOURCE_ROLE_NOT_ACTIVE',
            });
        }
        // Validation: toRoleId must be ACTIVE
        // Use explicit select to avoid querying category column if it doesn't exist
        const toRole = await client_1.default.role.findUnique({
            where: { id: toRoleId },
            select: {
                id: true,
                name: true,
                status: true,
                // category: true, // Don't select - may not exist yet
            },
        });
        if (!toRole) {
            logger_1.default.warn(`INVALID_TARGET_ROLE: Target role ${toRoleId} not found (actor: ${actorId})`);
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
            logger_1.default.warn(`INVALID_REASSIGNMENT: Attempt to reassign user ${userId} to same role ${fromRoleId} by ${actorId}`);
            return res.status(400).json({
                error: 'INVALID_REASSIGNMENT',
                message: 'Cannot reassign user to the same role',
                code: 'SAME_ROLE',
            });
        }
        // PART 2: Rule 2 — Block same category
        // Check if migration has been applied
        const categoryMigrationApplied = await (0, check_migration_status_1.checkCategoryMigrationStatus)();
        let fromCategory;
        let toCategory;
        if (!categoryMigrationApplied) {
            // Migration not applied - skip category check but log warning
            logger_1.default.warn(`Category migration not applied - skipping category validation for user ${userId} reassignment`);
            fromCategory = 'MIGRATION_PENDING';
            toCategory = 'MIGRATION_PENDING';
        }
        else {
            try {
                fromCategory = (0, role_category_1.getRoleCategory)(fromRole);
                toCategory = (0, role_category_1.getRoleCategory)(toRole);
                // Only enforce category check if migration is applied
                if (fromCategory === toCategory) {
                    logger_1.default.warn(`INVALID_REASSIGNMENT: Attempt to reassign user ${userId} from ${fromCategory} to ${toCategory} (same category) by ${actorId}`);
                    return res.status(400).json({
                        error: 'INVALID_REASSIGNMENT',
                        message: 'Reassignment must change role category',
                        code: 'SAME_CATEGORY',
                        fromCategory,
                        toCategory,
                    });
                }
            }
            catch (categoryError) {
                logger_1.default.error(`Category determination failed: ${categoryError.message}`, categoryError);
                fromCategory = 'UNKNOWN';
                toCategory = 'UNKNOWN';
            }
        }
        // PART 2: Rule 3 — Role lifecycle checks
        if (toRoleStatus !== 'ACTIVE') {
            logger_1.default.warn(`INVALID_TARGET_ROLE: Attempt to reassign user ${userId} to non-active role ${toRoleId} (status: ${toRoleStatus}) by ${actorId}`);
            return res.status(400).json({
                error: 'INVALID_TARGET_ROLE',
                message: 'Target role must be active',
                code: 'TARGET_NOT_ACTIVE',
                toRoleStatus,
            });
        }
        // Check if actor is system admin
        const actor = await client_1.default.user.findUnique({
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
            logger_1.default.warn(`INVALID_TARGET_ROLE: Non-admin attempt to reassign user ${userId} to system-locked role ${toRoleId} by ${actorId}`);
            return res.status(400).json({
                error: 'INVALID_TARGET_ROLE',
                message: 'Cannot assign system-locked role',
                code: 'SYSTEM_LOCKED_ROLE',
            });
        }
        // PART 3: Enforce Permission Change
        let permissionDelta = null;
        try {
            const areEquivalent = await (0, permission_comparison_1.arePermissionsEquivalent)(fromRoleId, toRoleId);
            if (areEquivalent) {
                logger_1.default.warn(`NO_PERMISSION_LINEAGE_CHANGE: Attempt to reassign user ${userId} from ${fromRoleId} to ${toRoleId} with equivalent permissions by ${actorId}`);
                return res.status(400).json({
                    error: 'NO_PERMISSION_LINEAGE_CHANGE',
                    message: 'Target role does not alter effective permissions',
                    code: 'EQUIVALENT_PERMISSIONS',
                });
            }
            // Calculate permission delta for audit
            permissionDelta = await (0, permission_comparison_1.calculatePermissionDelta)(fromRoleId, toRoleId);
        }
        catch (permError) {
            logger_1.default.error(`Permission comparison error: ${permError.message}`, permError);
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
        const { getRolePermissions } = await Promise.resolve().then(() => __importStar(require('../services/permissions/permission-service')));
        let previousPermissions = [];
        let newPermissions = [];
        try {
            previousPermissions = await getRolePermissions(fromRoleId);
            newPermissions = await getRolePermissions(toRoleId);
        }
        catch (permError) {
            logger_1.default.warn(`Failed to fetch permission snapshots: ${permError.message}`);
        }
        // PART 4: Atomic Transaction
        await client_1.default.$transaction(async (tx) => {
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
            const updatedRoleStatus = updatedUser.role.status || 'ACTIVE';
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
                },
            });
        });
        logger_1.default.info(`User ${user.username} (${userId}) reassigned from role ${fromRole.name} (${fromCategory}) to ${toRole.name} (${toCategory}) by ${actorUsername}. Permission delta: +${permissionDelta.added.length} -${permissionDelta.removed.length} =${permissionDelta.unchanged.length}`);
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
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            logger_1.default.warn(`Validation error in user reassignment: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')} (actor: ${req.user?.id})`);
            return res.status(400).json({
                error: 'VALIDATION_ERROR',
                code: 'INVALID_REQUEST',
            });
        }
        logger_1.default.error(`User reassignment error: ${error.message}`, {
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
exports.default = router;
//# sourceMappingURL=users.js.map