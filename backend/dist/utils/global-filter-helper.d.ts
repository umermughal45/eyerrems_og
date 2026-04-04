/**
 * Global Filter Helper
 * Utility to integrate global filter engine into list endpoints
 */
import { Request } from 'express';
import { AuthenticatedRequest } from '../middleware/rbac';
import { PermissionContext, ModuleFilterConfig, SystemConstraints } from '../services/global-filter-engine';
import { GlobalFilterPayload } from '../schemas/global-filter-schema';
/**
 * Parse global filter from request (query params or body)
 */
export declare function parseGlobalFilter(req: Request): GlobalFilterPayload;
/**
 * Build permission context from authenticated request
 */
export declare function buildPermissionContext(req: AuthenticatedRequest): PermissionContext;
/**
 * Apply global filters to a list endpoint
 * Returns where clause, orderBy, and pagination details
 */
export declare function applyListFilters(req: AuthenticatedRequest, config: ModuleFilterConfig, systemConstraints?: SystemConstraints): Promise<{
    where: any;
    orderBy: any;
    pagination: {
        skip: number;
        limit: number;
        page: number;
    };
}>;
/**
 * Calculate pagination metadata
 */
export declare function calculatePagination(page: number, limit: number, total: number): {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
};
//# sourceMappingURL=global-filter-helper.d.ts.map