/**
 * Global Filter Helper
 * Utility to integrate global filter engine into list endpoints
 */

import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/rbac';
import { applyGlobalFilters, PermissionContext, ModuleFilterConfig, SystemConstraints } from '../services/global-filter-engine';
import { validateGlobalFilter, GlobalFilterPayload } from '../schemas/global-filter-schema';
import { createAuditLog } from '../services/audit-log';
import logger from '../utils/logger';

/**
 * Parse global filter from request (query params or body)
 */
export function parseGlobalFilter(req: Request): GlobalFilterPayload {
  // Try body first (for POST requests)
  if (req.body && req.body.filter) {
    return validateGlobalFilter(req.body.filter);
  }
  
  // Fallback to query params (for GET requests)
  const filter: Partial<GlobalFilterPayload> = {};
  
  // Parse pagination
  const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 25;
  filter.pagination = { page, limit };
  
  // Parse sorting (default to created_at which will be mapped to createdAt)
  const sortField = (req.query.sort || req.query.sortBy || 'created_at') as string;
  const sortDir = (req.query.direction || req.query.order || 'desc') as 'asc' | 'desc';
  filter.sorting = { field: sortField, direction: sortDir };
  
  // Parse search
  if (req.query.search) {
    filter.search = req.query.search as string;
  }
  
  // Parse status
  if (req.query.status) {
    filter.status = Array.isArray(req.query.status) 
      ? req.query.status.map(s => String(s))
      : [String(req.query.status)];
  }
  
  // Parse priority
  if (req.query.priority) {
    filter.priority = Array.isArray(req.query.priority)
      ? req.query.priority.map(p => String(p))
      : [String(req.query.priority)];
  }
  
  // Parse date filters
  if (req.query.dateField || req.query.dateFrom || req.query.dateTo || req.query.datePreset) {
    filter.date = {
      field: req.query.dateField as any,
      from: req.query.dateFrom as string | null,
      to: req.query.dateTo as string | null,
      preset: req.query.datePreset as any,
    };
  }
  
  // Parse ownership
  if (req.query.assignedTo) {
    const existing = filter.ownership || {
      assigned_users: [],
      teams: [],
      departments: [],
      dealers: [],
      agents: [],
      created_by: [],
      approved_by: [],
    };
    filter.ownership = {
      ...existing,
      assigned_users: Array.isArray(req.query.assignedTo)
        ? req.query.assignedTo.map(u => String(u))
        : [String(req.query.assignedTo)],
    };
  }
  
  // Parse numeric ranges
  if (req.query.amountMin || req.query.amountMax) {
    filter.numeric_ranges = {
      amount_min: req.query.amountMin ? parseFloat(req.query.amountMin as string) : null,
      amount_max: req.query.amountMax ? parseFloat(req.query.amountMax as string) : null,
    };
  }
  
  // Apply defaults
  return validateGlobalFilter(filter);
}

/**
 * Build permission context from authenticated request
 */
export function buildPermissionContext(req: AuthenticatedRequest): PermissionContext {
  return {
    userId: req.user?.id || 'unknown',
    roleId: req.user?.roleId || '',
    roleName: req.user?.role?.name,
    permissions: req.user?.role?.permissions || [],
  };
}

/**
 * Apply global filters to a list endpoint
 * Returns where clause, orderBy, and pagination details
 */
export async function applyListFilters(
  req: AuthenticatedRequest,
  config: ModuleFilterConfig,
  systemConstraints: SystemConstraints = {}
): Promise<{
  where: any;
  orderBy: any;
  pagination: { skip: number; limit: number; page: number };
}> {
  const filterPayload = parseGlobalFilter(req);
  const permissionContext = buildPermissionContext(req);
  
  // Apply filters
  const result = await applyGlobalFilters(
    config,
    filterPayload,
    permissionContext,
    systemConstraints
  );
  
  // Build pagination
  const page = filterPayload.pagination.page;
  const limit = filterPayload.pagination.limit;
  const skip = (page - 1) * limit;
  
  // Audit log filter application
  try {
    await createAuditLog({
      entityType: config.model.toLowerCase(),
      entityId: 'list-query',
      action: 'view',
      userId: permissionContext.userId,
      userName: permissionContext.roleName,
      userRole: permissionContext.roleName,
      description: `Applied filters: ${result.appliedFilters.join(', ')}`,
      metadata: {
        filters: filterPayload,
        appliedFilters: result.appliedFilters,
        permissionScope: result.permissionScope,
      },
      req: req as any,
    });
  } catch (error) {
    logger.error('Failed to create filter audit log:', error);
  }
  
  return {
    where: result.where,
    orderBy: result.orderBy,
    pagination: { skip, limit, page },
  };
}

/**
 * Calculate pagination metadata
 */
export function calculatePagination(page: number, limit: number, total: number) {
  const totalPages = Math.ceil(total / limit);
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}
