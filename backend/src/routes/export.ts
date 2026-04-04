/**
 * Unified Export Routes
 * Handles exports for all modules with consistent scoping and RBAC
 */

import express, { Response } from 'express';
import { z } from 'zod';
import { requireAuth, AuthenticatedRequest, requirePermission } from '../middleware/rbac';
import { exportData, getExportCount, MODULE_CONFIGS, ExportRequest } from '../services/unified-export-service';
import { PermissionContext } from '../services/unified-filter-engine';
import { createAuditLog } from '../services/audit-log';
import logger from '../utils/logger';

const router = (express as any).Router();

// Map entity name to module name (backward compatibility)
const ENTITY_TO_MODULE: Record<string, string> = {
  lead: 'leads',
  client: 'clients',
  dealer: 'dealers',
  deal: 'deals',
  employee: 'employees',
  voucher: 'vouchers',
  property: 'properties',
};

// Export request schema (supports both entity and module for backward compatibility)
const exportRequestSchema = z.object({
  entity: z.string().optional(), // New: entity name from registry
  module: z.string().optional(), // Legacy: module name
  format: z.enum(['pdf', 'excel', 'csv', 'word']),
  scope: z.enum(['VIEW', 'FILTERED', 'ALL']),
  dataShape: z.enum(['raw', 'structured']).optional(), // New: data shape
  columns: z.array(z.string()).optional(), // New: selected column keys
  filters: z.record(z.any()).optional(),
  search: z.string().optional(),
  sort: z.object({
    field: z.string(),
    direction: z.enum(['asc', 'desc']),
  }).optional(),
  pagination: z.object({
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
  }).optional(),
}).refine((data) => data.entity || data.module, {
  message: "Either 'entity' or 'module' must be provided",
});

// Map module to required permission
const MODULE_PERMISSIONS: Record<string, string> = {
  leads: 'crm.leads.view',
  clients: 'crm.clients.view',
  dealers: 'crm.dealers.view',
  deals: 'crm.deals.view',
  employees: 'hr.employees.view',
  vouchers: 'finance.vouchers.view',
  properties: 'properties.view',
};

// Check if user has admin permission for FULL_DATASET scope
async function hasAdminPermission(req: AuthenticatedRequest): Promise<boolean> {
  if (!req.user?.role?.permissions) return false;
  return req.user.role.permissions.includes('admin.*') || 
         req.user.role.permissions.includes('*') ||
         req.user.role.name?.toLowerCase() === 'admin';
}

/**
 * POST /export
 * Export data for any module
 */
router.post('/export', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = exportRequestSchema.parse(req.body);
    
    // Resolve module name (entity → module mapping for backward compatibility)
    const moduleName = parsed.entity
      ? (ENTITY_TO_MODULE[parsed.entity] || parsed.entity)
      : (parsed.module || '');
    
    if (!moduleName) {
      return res.status(400).json({ error: 'Module or entity name required' });
    }

    // Build request with resolved module
    const request: ExportRequest = {
      ...parsed,
      module: moduleName,
      columns: parsed.columns, // Pass selected columns
      dataShape: parsed.dataShape || 'raw',
    };

    // Validate module exists
    const config = MODULE_CONFIGS[request.module];
    if (!config) {
      return res.status(400).json({ error: `Module ${request.module} not supported` });
    }

    // Check module-specific permission
    const requiredPermission = MODULE_PERMISSIONS[request.module];
    if (requiredPermission) {
      // Check permission using RBAC middleware logic
      const hasPermission = req.user?.role?.permissions?.includes(requiredPermission) ||
                           req.user?.role?.permissions?.includes('*') ||
                           req.user?.role?.permissions?.includes('admin.*');
      
      if (!hasPermission) {
        return res.status(403).json({ error: `Permission denied: ${requiredPermission} required` });
      }
    }

    // Check admin permission for ALL scope
    if (request.scope === 'ALL') {
      const isAdmin = await hasAdminPermission(req);
      if (!isAdmin) {
        return res.status(403).json({ error: 'Admin permission required for full dataset export' });
      }
    }

    // Build permission context for filter engine
    const permissionContext: PermissionContext = {
      userId: req.user?.id || 'unknown',
      roleId: req.user?.roleId || '',
      roleName: req.user?.role?.name,
      permissions: req.user?.role?.permissions || [],
    };

    // Get export count for validation
    const count = await getExportCount(config, request, permissionContext);
    
    // Warn if FILTERED returns > 10000 rows
    if (request.scope === 'FILTERED' && count > 10000) {
      logger.warn(`Large export requested: ${count} rows for module ${request.module}`);
    }

    // Generate export
    const userId = req.user?.id || 'unknown';
    const result = await exportData(request, userId, permissionContext);

    // Audit log
    await createAuditLog({
      entityType: request.module,
      entityId: 'export',
      action: 'export',
      userId: userId,
      userName: req.user?.username,
      userRole: req.user?.role?.name,
      description: `Exported ${count} records from ${request.module} module`,
      metadata: {
        format: request.format,
        scope: request.scope,
        columns: request.columns,
        columnCount: request.columns?.length || config.columns.length,
        filters: request.filters,
        search: request.search,
        recordCount: count,
      },
      req: req as any,
    });

    // Set headers and send file
    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.setHeader('Content-Length', result.buffer.length.toString());
    
    return res.send(result.buffer);
  } catch (error: any) {
    logger.error('Export error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid export request', details: error.errors });
    }
    if (error.message === 'No data to export') {
      return res.status(404).json({ error: 'No data matches the specified filters' });
    }
    return res.status(500).json({ error: error.message || 'Export failed' });
  }
});

/**
 * GET /export/:module/count
 * Get count of records that would be exported (for validation)
 */
router.get('/export/:module/count', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { module } = req.params;
    const { scope, filters, search } = req.query;

    const config = MODULE_CONFIGS[module];
    if (!config) {
      return res.status(400).json({ error: `Module ${module} not supported` });
    }

    const request: ExportRequest = {
      module,
      format: 'csv', // Format doesn't matter for count
      scope: (scope as any) || 'FILTERED',
      filters: filters ? JSON.parse(filters as string) : undefined,
      search: search as string | undefined,
    };

    const permissionContext: PermissionContext = {
      userId: req.user?.id || 'unknown',
      roleId: req.user?.roleId || '',
      roleName: req.user?.role?.name,
      permissions: req.user?.role?.permissions || [],
    };

    const count = await getExportCount(config, request, permissionContext);

    return res.json({ count });
  } catch (error: any) {
    logger.error('Export count error:', error);
    return res.status(500).json({ error: error.message || 'Failed to get count' });
  }
});

export default router;
