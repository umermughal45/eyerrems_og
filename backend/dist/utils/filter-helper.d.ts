/**
 * Filter Helper for List Endpoints
 * Provides reusable function to apply unified filters to list queries
 */
import { AuthenticatedRequest } from '../middleware/rbac';
import { ModuleFilterConfig } from '../services/unified-filter-engine';
/**
 * Apply filters to a list query
 * Returns where clause, pagination info, and applied filter metadata
 */
export declare function applyListFilters(req: AuthenticatedRequest, config: ModuleFilterConfig, defaultOrderBy?: any): Promise<{
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
}>;
//# sourceMappingURL=filter-helper.d.ts.map