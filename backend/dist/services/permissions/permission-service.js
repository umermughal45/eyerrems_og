"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RESTRICTED_ACTIONS = exports.STANDARD_ACTIONS = void 0;
exports.parsePermission = parsePermission;
exports.buildPermissionPath = buildPermissionPath;
exports.checkPermission = checkPermission;
exports.checkAnyPermission = checkAnyPermission;
exports.getRolePermissions = getRolePermissions;
exports.grantPermission = grantPermission;
exports.revokePermission = revokePermission;
exports.bulkUpdatePermissions = bulkUpdatePermissions;
exports.generateModulePermissions = generateModulePermissions;
exports.getAllAvailablePermissions = getAllAvailablePermissions;
const client_1 = __importDefault(require("../../prisma/client"));
const logger_1 = __importDefault(require("../../utils/logger"));
const permission_cache_1 = require("./permission-cache");
/**
 * Parse permission string into structured path
 * Format: "module.submodule.action" or "module.action"
 */
function parsePermission(permission) {
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
function buildPermissionPath(module, submodule, action) {
    if (submodule) {
        return `${module}.${submodule}.${action}`;
    }
    return `${module}.${action}`;
}
/**
 * Standard actions available across all modules
 */
exports.STANDARD_ACTIONS = [
    'view',
    'create',
    'edit',
    'delete',
    'approve',
    'export',
];
/**
 * Restricted actions (require explicit grant, OFF by default)
 */
exports.RESTRICTED_ACTIONS = [
    'override', // For AI, Finance, Audit modules
];
/**
 * Check if user has explicit permission
 * NO WILDCARDS - Explicit grants only
 */
async function checkPermission(roleId, permission) {
    try {
        // Check cache first
        const cached = permission_cache_1.permissionCache.get(roleId, permission);
        if (cached) {
            return {
                allowed: cached.allowed,
                reason: cached.reason,
                permissionPath: permission,
            };
        }
        const parsed = parsePermission(permission);
        if (!parsed) {
            logger_1.default.warn(`Invalid permission format: ${permission}`);
            const result = {
                allowed: false,
                reason: 'Invalid permission format',
                permissionPath: permission,
            };
            permission_cache_1.permissionCache.set(roleId, permission, false, result.reason);
            return result;
        }
        // Get role with permissions
        // Use explicit select to avoid querying category column if it doesn't exist
        const role = await client_1.default.role.findUnique({
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
            permission_cache_1.permissionCache.set(roleId, permission, false, result.reason);
            return result;
        }
        // PART 1: Check role status - deactivated roles don't grant permissions
        const roleStatus = role.status || 'ACTIVE';
        if (roleStatus === 'DEACTIVATED') {
            const result = {
                allowed: false,
                reason: 'Role is deactivated',
                permissionPath: permission,
            };
            permission_cache_1.permissionCache.set(roleId, permission, false, result.reason);
            return result;
        }
        // Check explicit permission
        const hasExplicitPermission = role.rolePermissions.length > 0;
        if (hasExplicitPermission) {
            const result = {
                allowed: true,
                permissionPath: permission,
            };
            permission_cache_1.permissionCache.set(roleId, permission, true);
            return result;
        }
        // Deny by default - no explicit grant found
        const result = {
            allowed: false,
            reason: 'No explicit permission granted',
            permissionPath: permission,
        };
        permission_cache_1.permissionCache.set(roleId, permission, false, result.reason);
        return result;
    }
    catch (error) {
        logger_1.default.error(`Permission check error: ${error.message}`, error);
        // Fail closed - deny on error
        const result = {
            allowed: false,
            reason: 'Permission check failed',
            permissionPath: permission,
        };
        permission_cache_1.permissionCache.set(roleId, permission, false, result.reason);
        return result;
    }
}
/**
 * Check if user has any of the required permissions
 */
async function checkAnyPermission(roleId, permissions) {
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
async function getRolePermissions(roleId) {
    try {
        // Use explicit select to avoid querying category column if it doesn't exist
        const role = await client_1.default.role.findUnique({
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
            logger_1.default.warn(`Role ${roleId} not found when fetching permissions`);
            return [];
        }
        return role.rolePermissions || [];
    }
    catch (error) {
        logger_1.default.error(`Failed to get role permissions for ${roleId}:`, {
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
async function grantPermission(roleId, module, submodule, action, actorId) {
    // Normalize submodule: convert empty string or undefined to null
    const submoduleValue = submodule && submodule.trim() !== ''
        ? submodule.trim()
        : null;
    // Use findFirst + create/update pattern instead of upsert to handle nullable submodule
    // Prisma's upsert doesn't work well with nullable fields in compound unique constraints
    const existing = await client_1.default.rolePermission.findFirst({
        where: {
            roleId,
            module,
            submodule: submoduleValue,
            action,
        },
    });
    if (existing) {
        // Update existing permission
        await client_1.default.rolePermission.update({
            where: { id: existing.id },
            data: {
                granted: true,
                createdBy: actorId,
            },
        });
    }
    else {
        // Create new permission
        await client_1.default.rolePermission.create({
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
    permission_cache_1.permissionCache.invalidateRole(roleId);
}
/**
 * Revoke permission from role
 */
async function revokePermission(roleId, module, submodule, action, actorId) {
    await client_1.default.rolePermission.updateMany({
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
    permission_cache_1.permissionCache.invalidateRole(roleId);
}
/**
 * Bulk grant/revoke permissions
 */
async function bulkUpdatePermissions(roleId, permissions, actorId) {
    try {
        // Use a transaction to ensure atomicity and avoid issues with nullable fields in compound unique constraints
        await client_1.default.$transaction(async (tx) => {
            // Batch process permissions to avoid timeout issues with large sets
            const batchSize = 50;
            for (let i = 0; i < permissions.length; i += batchSize) {
                const batch = permissions.slice(i, i + batchSize);
                // Process batch sequentially to avoid database contention
                // (Parallel processing within transaction can cause deadlocks)
                for (const perm of batch) {
                    try {
                        // Normalize submodule: convert empty string or undefined to null
                        const submoduleValue = perm.submodule && perm.submodule.trim() !== ''
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
                        }
                        else {
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
                            }
                            catch (createError) {
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
                                    }
                                    else {
                                        // Record doesn't exist, rethrow original error
                                        throw createError;
                                    }
                                }
                                else {
                                    // Different error, rethrow
                                    throw createError;
                                }
                            }
                        }
                    }
                    catch (permError) {
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
                        logger_1.default.error(`Failed to update permission ${permPath} for role ${roleId}:`, errorDetails);
                        throw new Error(`Failed to update permission ${permPath}: ${permError?.message || 'Database error'} (Code: ${permError?.code || 'UNKNOWN'})`);
                    }
                }
            }
        }, {
            maxWait: 10000, // Maximum time to wait for a transaction slot (increased from 5s)
            timeout: 30000, // Maximum time the transaction can run (increased from 10s to 30s for large permission sets)
        });
        // Invalidate cache for this role after bulk update
        permission_cache_1.permissionCache.invalidateRole(roleId);
    }
    catch (error) {
        const errorDetails = {
            message: error?.message,
            code: error?.code,
            meta: error?.meta,
            stack: error?.stack,
            permissionsCount: permissions.length,
            roleId,
            actorId,
        };
        logger_1.default.error(`Bulk update permissions failed for role ${roleId}:`, errorDetails);
        throw error;
    }
}
/**
 * Generate all possible permissions for a module
 */
function generateModulePermissions(module, submodules) {
    const permissions = [];
    // Standard actions at module level
    exports.STANDARD_ACTIONS.forEach((action) => {
        permissions.push(buildPermissionPath(module, undefined, action));
    });
    // Submodule permissions
    if (submodules) {
        submodules.forEach((submodule) => {
            exports.STANDARD_ACTIONS.forEach((action) => {
                permissions.push(buildPermissionPath(module, submodule, action));
            });
        });
    }
    return permissions;
}
/**
 * Get all available modules and their permissions
 */
function getAllAvailablePermissions() {
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
//# sourceMappingURL=permission-service.js.map