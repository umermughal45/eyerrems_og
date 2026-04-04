/**
 * Filter Helper for List Endpoints
 * Provides reusable function to apply unified filters to list queries
 */

import { Request } from 'express';
import { AuthenticatedRequest } from '../middleware/rbac';
import { applyFilters, validateFilterPayload, ModuleFilterConfig, FilterPayload, PermissionContext, SystemConstraints } from '../services/unified-filter-engine';
import { parsePaginationQuery, calculatePagination } from './pagination';
import { createAuditLog } from '../services/audit-log';
import logger from './logger';

/**
 * Apply filters to a list query
 * Returns where clause, pagination info, and applied filter metadata
 */
export async function applyListFilters(
  req: AuthenticatedRequest,
  config: ModuleFilterConfig,
  defaultOrderBy: any = { createdAt: 'desc' }
): Promise<{
  where: any;
  orderBy: any;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    skip: number;
  };
  appliedFilters: string[];
}> {
  // Parse pagination
  const { page, limit } = parsePaginationQuery(req.query);
  const skip = (page - 1) * limit;

  // Parse filter payload from query params or body
  let filterPayload: FilterPayload = {};
  
  // Try to get filters from body (POST) or query (GET)
  if (req.method === 'POST' && req.body?.filters) {
    filterPayload = req.body.filters;
  } else if (req.query.filters) {
    try {
      filterPayload = typeof req.query.filters === 'string' 
        ? JSON.parse(req.query.filters) 
        : req.query.filters;
    } catch {
      logger.warn('Failed to parse filters from query', { filters: req.query.filters });
    }
  } else {
    // Legacy: parse individual query params (coerce to strings safely)
    const rawStatus = req.query.status;
    const rawPriority = req.query.priority;

    const status =
      Array.isArray(rawStatus)
        ? rawStatus.map((s) => String(s))
        : rawStatus
        ? [String(rawStatus)]
        : undefined;

    const priority =
      Array.isArray(rawPriority)
        ? rawPriority.map((p) => String(p))
        : rawPriority
        ? [String(rawPriority)]
        : undefined;

    const amountMin = req.query.amountMin as string | undefined;
    const amountMax = req.query.amountMax as string | undefined;

    filterPayload = {
      status,
      priority,
      assignedTo: req.query.assignedTo as string | undefined,
      department: req.query.department as string | undefined,
      search: req.query.search as string | undefined,
      dateField: req.query.dateField as string | undefined,
      datePreset: req.query.datePreset as any,
      dateFrom: req.query.dateFrom as string | undefined,
      dateTo: req.query.dateTo as string | undefined,
      amount:
        amountMin || amountMax
          ? {
              min: amountMin ? parseFloat(amountMin) : undefined,
              max: amountMax ? parseFloat(amountMax) : undefined,
            }
          : undefined,
    };

    // Remove undefined values
    Object.keys(filterPayload).forEach((key) => {
      if (filterPayload[key] === undefined) {
        delete filterPayload[key];
      }
    });
  }

  // Build permission context
  const permissionContext: PermissionContext = {
    userId: req.user?.id || 'unknown',
    roleId: req.user?.roleId || '',
    roleName: req.user?.role?.name,
    permissions: req.user?.role?.permissions || [],
  };

  // System constraints
  const systemConstraints: SystemConstraints = {
    excludeSoftDeleted: true,
    excludeArchived: true,
  };

  // Validate filter payload
  const validation = validateFilterPayload(config, filterPayload);
  if (!validation.valid) {
    throw new Error(`Invalid filter payload: ${validation.errors.join(', ')}`);
  }

  // Apply filters using unified engine
  const filterResult = await applyFilters(config, filterPayload, permissionContext, systemConstraints);

  // Audit log filter usage
  if (Object.keys(filterPayload).length > 0) {
    await createAuditLog({
      entityType: config.model,
      entityId: 'filter',
      action: 'view',
      userId: permissionContext.userId,
      userName: req.user?.username,
      userRole: permissionContext.roleName,
      description: `Applied filters to ${config.model} list`,
      metadata: {
        filters: filterPayload,
        appliedFilters: filterResult.appliedFilters,
        permissionScope: filterResult.permissionScope,
      },
      req: req as any,
    });
  }

  // Parse sort
  const sortField = (req.query.sortField || req.body?.sort?.field) as string | undefined;
  const sortDirection = (req.query.sortDirection || req.body?.sort?.direction || 'desc') as 'asc' | 'desc';
  const orderBy = sortField ? { [sortField]: sortDirection } : defaultOrderBy;

  return {
    where: filterResult.where,
    orderBy,
    pagination: {
      page,
      limit,
      total: 0, // Will be set by caller after count
      totalPages: 0,
      skip,
    },
    appliedFilters: filterResult.appliedFilters,
  };
}
