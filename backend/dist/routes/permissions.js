"use strict";
/**
 * Permissions API Routes
 *
 * Read-only permission inspection endpoints
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const rbac_1 = require("../middleware/rbac");
const rbac_2 = require("../middleware/rbac");
const permission_inspector_1 = require("../services/permissions/permission-inspector");
const logger_1 = __importDefault(require("../utils/logger"));
const router = express_1.default.Router();
/**
 * GET /permissions/inspect
 *
 * Inspect effective permissions for a role or user
 *
 * Query params:
 * - type: 'role' | 'user' (required)
 * - id: role ID or user ID (required)
 * - reason: Optional reason for inspection (for audit)
 *
 * Requires: permissions.inspect
 */
router.get('/inspect', rbac_1.requireAuth, (0, rbac_2.requirePermission)('permissions.inspect'), async (req, res) => {
    try {
        const { type, id, reason } = req.query;
        // Validate query parameters
        if (!type || (type !== 'role' && type !== 'user')) {
            return res.status(400).json({
                error: 'Invalid type parameter. Must be "role" or "user"',
            });
        }
        if (!id || typeof id !== 'string') {
            return res.status(400).json({
                error: 'Invalid id parameter. Must be a valid UUID',
            });
        }
        const inspectorId = req.user?.id;
        const inspectorUsername = req.user?.username || req.user?.email || 'unknown';
        // Perform inspection based on type
        let inspectionResult;
        let inspectedName;
        let inspectedId;
        if (type === 'role') {
            inspectionResult = await (0, permission_inspector_1.inspectRolePermissions)(id, inspectorId, inspectorUsername);
            inspectedName = inspectionResult.inspectedEntity.name;
            inspectedId = inspectionResult.inspectedEntity.id;
        }
        else {
            inspectionResult = await (0, permission_inspector_1.inspectUserPermissions)(id, inspectorId, inspectorUsername);
            inspectedName = inspectionResult.inspectedEntity.name;
            inspectedId = inspectionResult.inspectedEntity.id;
        }
        // Log inspection event for audit
        if (inspectorId) {
            try {
                await (0, permission_inspector_1.logInspectionEvent)(inspectorId, inspectorUsername, type, inspectedId, inspectedName, reason);
            }
            catch (logError) {
                logger_1.default.warn(`Failed to log inspection event: ${logError.message}`);
                // Continue even if logging fails
            }
        }
        res.json(inspectionResult);
    }
    catch (error) {
        // Enhanced error logging for debugging
        // Extract query params for error reporting
        const { type: errorType, id: errorId } = req.query;
        logger_1.default.error(`Permission inspection error:`, {
            message: error?.message,
            stack: error?.stack,
            name: error?.name,
            type: errorType,
            id: errorId,
            inspectorId: req.user?.id,
        });
        // Handle specific errors
        if (error?.message?.includes('not found')) {
            return res.status(404).json({
                error: error.message,
            });
        }
        if (error?.message?.includes('no role assigned')) {
            return res.status(400).json({
                error: error.message,
            });
        }
        // Always return error details for debugging (sanitized in production)
        const isDev = process.env.NODE_ENV === 'development';
        const errorResponse = {
            error: 'Permission inspection failed',
            inspectionType: errorType,
            inspectionId: errorId,
        };
        if (isDev) {
            errorResponse.details = error?.message;
            errorResponse.errorType = error?.name;
            errorResponse.stack = error?.stack;
        }
        else {
            errorResponse.message = 'An error occurred during permission inspection. Please check server logs.';
        }
        res.status(500).json(errorResponse);
    }
});
exports.default = router;
//# sourceMappingURL=permissions.js.map