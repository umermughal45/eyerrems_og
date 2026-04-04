/**
 * Global Filter Engine
 * Single unified filter parser for ALL modules
 * Applies filters in order: Permissions → System Constraints → User Filters → Search
 */
import { Prisma } from '../prisma/client';
import { GlobalFilterPayload } from '../schemas/global-filter-schema';
/**
 * Permission Context
 */
export interface PermissionContext {
    userId: string;
    roleId: string;
    roleName?: string;
    permissions: string[];
    companyId?: string;
    departmentId?: string;
    propertyAccess?: string[];
}
/**
 * System Constraints
 */
export interface SystemConstraints {
    excludeSoftDeleted?: boolean;
    excludeArchived?: boolean;
    includeLockedPeriods?: boolean;
    allowPostedModification?: boolean;
}
/**
 * Module Filter Configuration
 * Maps global filter fields to Prisma model fields
 */
export interface ModuleFilterConfig {
    model: string;
    identityFields: string[];
    statusField?: string;
    lifecycleField?: string;
    priorityField?: string;
    stageField?: string;
    dateFields: Array<{
        global: string;
        prisma: string;
    }>;
    numericFields: Array<{
        global: string;
        prisma: string;
    }>;
    relationalFields: Record<string, string>;
    permissionScope?: (context: PermissionContext) => Promise<Prisma.JsonObject>;
    systemConstraints?: (constraints: SystemConstraints) => Prisma.JsonObject;
}
/**
 * Filter Result
 */
export interface FilterResult {
    where: Prisma.JsonObject;
    orderBy: Prisma.JsonObject;
    appliedFilters: string[];
    permissionScope: string;
}
/**
 * Main Filter Engine
 * Applies filters in correct order: Permissions → System → User → Search
 */
export declare function applyGlobalFilters(config: ModuleFilterConfig, filters: GlobalFilterPayload, permissionContext: PermissionContext, systemConstraints?: SystemConstraints): Promise<FilterResult>;
/**
 * Validate filter payload (rejects unknown fields)
 */
export declare function validateFilter(input: unknown): GlobalFilterPayload;
//# sourceMappingURL=global-filter-engine.d.ts.map