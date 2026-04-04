/**
 * Permissions API Routes
 * 
 * Read-only permission inspection endpoints
 */

import express, { Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/rbac';
import { requirePermission } from '../middleware/rbac';
import {
  inspectRolePermissions,
  inspectUserPermissions,
  logInspectionEvent,
} from '../services/permissions/permission-inspector';
import logger from '../utils/logger';

const router = (express as any).Router();

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
router.get(
  '/inspect',
  requireAuth,
  requirePermission('permissions.inspect'),
  async (req: AuthenticatedRequest, res: Response) => {
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
      let inspectedName: string;
      let inspectedId: string;

      if (type === 'role') {
        inspectionResult = await inspectRolePermissions(id, inspectorId, inspectorUsername);
        inspectedName = inspectionResult.inspectedEntity.name;
        inspectedId = inspectionResult.inspectedEntity.id;
      } else {
        inspectionResult = await inspectUserPermissions(id, inspectorId, inspectorUsername);
        inspectedName = inspectionResult.inspectedEntity.name;
        inspectedId = inspectionResult.inspectedEntity.id;
      }

      // Log inspection event for audit
      if (inspectorId) {
        try {
          await logInspectionEvent(
            inspectorId,
            inspectorUsername,
            type,
            inspectedId,
            inspectedName,
            reason as string | undefined
          );
        } catch (logError: any) {
          logger.warn(`Failed to log inspection event: ${logError.message}`);
          // Continue even if logging fails
        }
      }

      res.json(inspectionResult);
    } catch (error: any) {
      // Enhanced error logging for debugging
      // Extract query params for error reporting
      const { type: errorType, id: errorId } = req.query;
      logger.error(`Permission inspection error:`, {
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
      const errorResponse: any = {
        error: 'Permission inspection failed',
        inspectionType: errorType as string,
        inspectionId: errorId as string,
      };
      
      if (isDev) {
        errorResponse.details = error?.message;
        errorResponse.errorType = error?.name;
        errorResponse.stack = error?.stack;
      } else {
        errorResponse.message = 'An error occurred during permission inspection. Please check server logs.';
      }
      
      res.status(500).json(errorResponse);
    }
  }
);

export default router;
