/**
 * Unified Filter Engine
 * ERP-grade filtering with permission enforcement and audit safety
 *
 * Filter Layers (executed in order):
 * 1. Permissions (backend only - company scope, property access, department, role)
 * 2. System Constraints (soft-deleted, archived, locked periods, posted records)
 * 3. User Advanced Filters (identity, status, date, ownership, numeric, relational)
 * 4. Search (applied last, never widens scope)
 */
import { Prisma } from '../prisma/client';
/**
 * Filter Payload Structure
 * Serializable, auditable, reusable for UI + export
 */
export interface FilterPayload {
    systemId?: string;
    tid?: string;
    codes?: string[];
    referenceNumbers?: string[];
    status?: string[];
    priority?: string[];
    stage?: string[];
    lifecycle?: string[];
    dateField?: string;
    datePreset?: 'today' | 'thisWeek' | 'thisMonth' | 'lastMonth' | 'custom';
    dateFrom?: string;
    dateTo?: string;
    createdBy?: string;
    assignedTo?: string;
    assignedDealerId?: string;
    assignedAgentId?: string;
    department?: string;
    approvedBy?: string;
    amount?: {
        min?: number;
        max?: number;
    };
    balance?: {
        min?: number;
        max?: number;
    };
    tax?: {
        min?: number;
        max?: number;
    };
    debit?: {
        min?: number;
        max?: number;
    };
    credit?: {
        min?: number;
        max?: number;
    };
    propertyId?: string;
    unitId?: string;
    tenantId?: string;
    dealId?: string;
    clientId?: string;
    employeeId?: string;
    accountId?: string;
    voucherId?: string;
    search?: string;
    [key: string]: any;
}
/**
 * Permission Context
 * Used for Layer 1 filtering
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
 * System Constraints Context
 * Used for Layer 2 filtering
 */
export interface SystemConstraints {
    excludeSoftDeleted?: boolean;
    excludeArchived?: boolean;
    includeLockedPeriods?: boolean;
    allowPostedModification?: boolean;
}
/**
 * Filter Result
 * Contains the Prisma where clause and metadata
 */
export interface FilterResult {
    where: Prisma.JsonObject;
    appliedFilters: string[];
    permissionScope: string;
    recordCount?: number;
}
/**
 * Module-specific filter configuration
 */
export interface ModuleFilterConfig {
    model: string;
    permissionScope?: (context: PermissionContext) => Promise<Prisma.JsonObject>;
    systemConstraints?: (constraints: SystemConstraints) => Prisma.JsonObject;
    identityFields?: string[];
    statusField?: string;
    dateFields?: string[];
    numericFields?: string[];
    relationalFields?: Record<string, string>;
}
/**
 * Main filter engine
 * Applies filters in correct order: Permissions → System → User → Search
 */
export declare function applyFilters(config: ModuleFilterConfig, filters: FilterPayload, permissionContext: PermissionContext, systemConstraints?: SystemConstraints): Promise<FilterResult>;
/**
 * Validate filter payload
 * Ensures date fields are valid, numeric ranges are correct, etc.
 */
export declare function validateFilterPayload(config: ModuleFilterConfig, filters: FilterPayload): {
    valid: boolean;
    errors: string[];
};
//# sourceMappingURL=unified-filter-engine.d.ts.map