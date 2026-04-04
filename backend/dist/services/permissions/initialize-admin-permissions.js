"use strict";
/**
 * Initialize Admin Role Permissions
 *
 * This script grants ALL available permissions to the Admin role explicitly.
 * Run this after creating the Admin role or when new permissions are added.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeAdminPermissions = initializeAdminPermissions;
exports.ensureAdminHasAllPermissions = ensureAdminHasAllPermissions;
const client_1 = __importDefault(require("../../prisma/client"));
const logger_1 = __importDefault(require("../../utils/logger"));
const permission_service_1 = require("./permission-service");
/**
 * Grant all available permissions to Admin role
 */
async function initializeAdminPermissions(adminRoleId) {
    try {
        logger_1.default.info(`Initializing Admin role permissions for role ${adminRoleId}`);
        const allPermissions = (0, permission_service_1.getAllAvailablePermissions)();
        let grantedCount = 0;
        let skippedCount = 0;
        for (const [module, permissions] of Object.entries(allPermissions)) {
            for (const permissionString of permissions) {
                const parts = permissionString.split('.');
                if (parts.length === 2) {
                    // Module-level permission: module.action
                    const [moduleName, action] = parts;
                    try {
                        await (0, permission_service_1.grantPermission)(adminRoleId, moduleName, undefined, action, 'system');
                        grantedCount++;
                    }
                    catch (error) {
                        logger_1.default.warn(`Failed to grant ${permissionString}: ${error.message}`);
                        skippedCount++;
                    }
                }
                else if (parts.length === 3) {
                    // Submodule-level permission: module.submodule.action
                    const [moduleName, submodule, action] = parts;
                    try {
                        await (0, permission_service_1.grantPermission)(adminRoleId, moduleName, submodule, action, 'system');
                        grantedCount++;
                    }
                    catch (error) {
                        logger_1.default.warn(`Failed to grant ${permissionString}: ${error.message}`);
                        skippedCount++;
                    }
                }
            }
        }
        logger_1.default.info(`Admin permissions initialized: ${grantedCount} granted, ${skippedCount} skipped`);
    }
    catch (error) {
        logger_1.default.error(`Failed to initialize Admin permissions: ${error.message}`, error);
        throw error;
    }
}
/**
 * Ensure Admin role has all permissions (idempotent)
 */
async function ensureAdminHasAllPermissions() {
    try {
        const adminRole = await client_1.default.role.findUnique({
            where: { name: 'Admin' },
            select: {
                id: true,
                name: true,
                status: true,
                // Don't select category - may not exist yet
            },
        });
        if (!adminRole) {
            logger_1.default.warn('Admin role not found, skipping permission initialization');
            return;
        }
        // Check if Admin already has explicit permissions
        const permissionCount = await client_1.default.rolePermission.count({
            where: { roleId: adminRole.id, granted: true },
        });
        if (permissionCount === 0) {
            logger_1.default.info('Admin role has no explicit permissions, initializing...');
            await initializeAdminPermissions(adminRole.id);
        }
        else {
            logger_1.default.info(`Admin role already has ${permissionCount} explicit permissions`);
        }
    }
    catch (error) {
        logger_1.default.error(`Failed to ensure Admin permissions: ${error.message}`, error);
    }
}
//# sourceMappingURL=initialize-admin-permissions.js.map