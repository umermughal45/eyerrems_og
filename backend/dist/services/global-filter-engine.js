"use strict";
/**
 * Global Filter Engine
 * Single unified filter parser for ALL modules
 * Applies filters in order: Permissions → System Constraints → User Filters → Search
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyGlobalFilters = applyGlobalFilters;
exports.validateFilter = validateFilter;
const zod_1 = require("zod");
const client_1 = __importDefault(require("../prisma/client"));
const logger_1 = __importDefault(require("../utils/logger"));
const global_filter_schema_1 = require("../schemas/global-filter-schema");
// Whitelist of models that have isArchived field (for fallback)
const MODELS_WITH_ARCHIVED = new Set([
// Add model names here if they have isArchived field
// Example: 'Voucher', 'Journal', etc.
]);
function modelHasField(modelName, fieldName) {
    // Special case for isArchived - use whitelist
    if (fieldName === 'isArchived') {
        return MODELS_WITH_ARCHIVED.has(modelName);
    }
    try {
        // Access Prisma DMMF (Data Model Meta Format)
        const dmmf = client_1.default?._dmmf;
        if (!dmmf) {
            // Fallback: assume common fields exist for common models
            if (fieldName === 'isDeleted') {
                // Most models have isDeleted
                return true;
            }
            return false;
        }
        const models = dmmf.datamodel?.models;
        if (!models || !Array.isArray(models)) {
            // Fallback for isDeleted
            if (fieldName === 'isDeleted')
                return true;
            return false;
        }
        const model = models.find((m) => String(m.name).toLowerCase() === String(modelName).toLowerCase());
        if (!model || !model.fields || !Array.isArray(model.fields)) {
            // Fallback for isDeleted
            if (fieldName === 'isDeleted')
                return true;
            return false;
        }
        return model.fields.some((f) => f.name === fieldName);
    }
    catch (error) {
        // If we can't check, use safe defaults
        logger_1.default.warn(`Could not check if model ${modelName} has field ${fieldName}:`, error);
        // Fallback: assume isDeleted exists (most models have it)
        if (fieldName === 'isDeleted')
            return true;
        return false;
    }
}
/**
 * Apply Permission Scope (Layer 1)
 */
async function applyPermissionScope(config, context) {
    const where = {};
    if (config.permissionScope) {
        return await config.permissionScope(context);
    }
    // Default: no additional restrictions (module-specific routes handle RBAC)
    return where;
}
/**
 * Apply System Constraints (Layer 2)
 */
function applySystemConstraints(config, constraints) {
    const where = {};
    if (constraints.excludeSoftDeleted !== false && modelHasField(config.model, 'isDeleted')) {
        where.isDeleted = false;
    }
    if (constraints.excludeArchived !== false && modelHasField(config.model, 'isArchived')) {
        where.isArchived = false;
    }
    if (config.systemConstraints) {
        const customConstraints = config.systemConstraints(constraints);
        return { ...where, ...customConstraints };
    }
    return where;
}
/**
 * Apply User Filters (Layer 3)
 */
function applyUserFilters(config, filters) {
    const where = {};
    // Identity Filters
    if (filters.identity.system_ids.length > 0 ||
        filters.identity.reference_codes.length > 0 ||
        filters.identity.tids.length > 0) {
        const identityConditions = [];
        filters.identity.system_ids.forEach(id => {
            config.identityFields.forEach(field => {
                identityConditions.push({
                    [field]: { contains: id, mode: 'insensitive' }
                });
            });
        });
        filters.identity.reference_codes.forEach(code => {
            config.identityFields.forEach(field => {
                identityConditions.push({
                    [field]: { contains: code, mode: 'insensitive' }
                });
            });
        });
        filters.identity.tids.forEach(tid => {
            identityConditions.push({ tid: { contains: tid, mode: 'insensitive' } });
        });
        if (identityConditions.length > 0) {
            where.OR = identityConditions;
        }
    }
    // Status Filters
    if (filters.status.length > 0 && config.statusField) {
        where[config.statusField] = { in: filters.status };
    }
    if (filters.lifecycle.length > 0 && config.lifecycleField) {
        where[config.lifecycleField] = { in: filters.lifecycle };
    }
    if (filters.priority.length > 0 && config.priorityField) {
        where[config.priorityField] = { in: filters.priority };
    }
    if (filters.stage.length > 0 && config.stageField) {
        where[config.stageField] = { in: filters.stage };
    }
    // Date Filters (CRITICAL - explicit field selection)
    if (filters.date?.field) {
        const dateMapping = config.dateFields.find(df => df.global === filters.date.field);
        if (dateMapping) {
            let dateFrom;
            let dateTo;
            if (filters.date.preset) {
                const now = new Date();
                switch (filters.date.preset) {
                    case 'today':
                        dateFrom = new Date(now.setHours(0, 0, 0, 0));
                        dateTo = new Date(now.setHours(23, 59, 59, 999));
                        break;
                    case 'last_7_days':
                        dateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                        dateTo = new Date();
                        break;
                    case 'month_to_date':
                        dateFrom = new Date(now.getFullYear(), now.getMonth(), 1);
                        dateTo = new Date();
                        break;
                    case 'quarter':
                        const quarter = Math.floor(now.getMonth() / 3);
                        dateFrom = new Date(now.getFullYear(), quarter * 3, 1);
                        dateTo = new Date();
                        break;
                    case 'last_month':
                        dateFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                        dateTo = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
                        break;
                    case 'this_year':
                        dateFrom = new Date(now.getFullYear(), 0, 1);
                        dateTo = new Date();
                        break;
                    case 'custom':
                        // For custom, use the from/to values directly
                        if (filters.date.from)
                            dateFrom = new Date(filters.date.from);
                        if (filters.date.to)
                            dateTo = new Date(filters.date.to);
                        break;
                }
            }
            else {
                if (filters.date.from)
                    dateFrom = new Date(filters.date.from);
                if (filters.date.to)
                    dateTo = new Date(filters.date.to);
            }
            if (dateFrom || dateTo) {
                const dateFilter = {};
                if (dateFrom)
                    dateFilter.gte = dateFrom.toISOString();
                if (dateTo) {
                    const endDate = new Date(dateTo);
                    endDate.setHours(23, 59, 59, 999);
                    dateFilter.lte = endDate.toISOString();
                }
                where[dateMapping.prisma] = dateFilter;
            }
        }
    }
    // Ownership Filters
    if (filters.ownership.assigned_users.length > 0) {
        where.assignedToUserId = { in: filters.ownership.assigned_users };
    }
    if (filters.ownership.departments.length > 0) {
        where.department = { in: filters.ownership.departments };
    }
    if (filters.ownership.dealers.length > 0) {
        where.assignedDealerId = { in: filters.ownership.dealers };
    }
    if (filters.ownership.agents.length > 0) {
        where.assignedAgentId = { in: filters.ownership.agents };
    }
    if (filters.ownership.created_by.length > 0) {
        where.createdBy = { in: filters.ownership.created_by };
    }
    if (filters.ownership.approved_by.length > 0) {
        where.approvedBy = { in: filters.ownership.approved_by };
    }
    // Numeric Range Filters
    if (filters.numeric_ranges) {
        const ranges = filters.numeric_ranges;
        if (ranges.amount_min !== undefined || ranges.amount_max !== undefined) {
            const amountField = config.numericFields.find(nf => nf.global === 'amount_min' || nf.global === 'amount_max');
            if (amountField) {
                const fieldName = amountField.prisma.replace('_min', '').replace('_max', '');
                const rangeFilter = {};
                if (ranges.amount_min !== undefined && ranges.amount_min !== null)
                    rangeFilter.gte = ranges.amount_min;
                if (ranges.amount_max !== undefined && ranges.amount_max !== null)
                    rangeFilter.lte = ranges.amount_max;
                if (Object.keys(rangeFilter).length > 0) {
                    where[fieldName] = rangeFilter;
                }
            }
        }
        // Similar for balance, debit, credit, tax
        ['balance', 'debit', 'credit', 'tax'].forEach(rangeType => {
            const minKey = `${rangeType}_min`;
            const maxKey = `${rangeType}_max`;
            if (ranges[minKey] !== undefined || ranges[maxKey] !== undefined) {
                const rangeField = config.numericFields.find(nf => nf.global.includes(rangeType));
                if (rangeField) {
                    const fieldName = rangeField.prisma.replace('_min', '').replace('_max', '');
                    const rangeFilter = {};
                    if (ranges[minKey] !== undefined && ranges[minKey] !== null)
                        rangeFilter.gte = ranges[minKey];
                    if (ranges[maxKey] !== undefined && ranges[maxKey] !== null)
                        rangeFilter.lte = ranges[maxKey];
                    if (Object.keys(rangeFilter).length > 0) {
                        where[fieldName] = rangeFilter;
                    }
                }
            }
        });
    }
    // Relational Filters
    filters.relationships.has_related.forEach(rel => {
        const prismaField = config.relationalFields[rel.type];
        if (prismaField) {
            where[prismaField] = rel.id;
        }
    });
    return where;
}
/**
 * Apply Search (Layer 4)
 * Search applies only on already-filtered data
 */
function applySearch(config, search, existingWhere) {
    if (!search || !config.identityFields) {
        return existingWhere;
    }
    const searchConditions = config.identityFields.map(field => ({
        [field]: { contains: search, mode: 'insensitive' }
    }));
    if (existingWhere.OR) {
        existingWhere.OR = [...(Array.isArray(existingWhere.OR) ? existingWhere.OR : []), ...searchConditions];
    }
    else {
        existingWhere.OR = searchConditions;
    }
    return existingWhere;
}
/**
 * Main Filter Engine
 * Applies filters in correct order: Permissions → System → User → Search
 */
async function applyGlobalFilters(config, filters, permissionContext, systemConstraints = {}) {
    const appliedFilters = [];
    // Layer 1: Permissions
    const permissionWhere = await applyPermissionScope(config, permissionContext);
    appliedFilters.push('permissions');
    // Layer 2: System Constraints
    const systemWhere = applySystemConstraints(config, systemConstraints);
    appliedFilters.push('system-constraints');
    // Layer 3: User Filters
    const userWhere = applyUserFilters(config, filters);
    if (Object.keys(userWhere).length > 0) {
        appliedFilters.push('user-filters');
    }
    // Combine layers 1-3
    let where = {
        ...permissionWhere,
        ...systemWhere,
        ...userWhere,
    };
    // Layer 4: Search (applied last, never widens scope)
    if (filters.search) {
        where = applySearch(config, filters.search, where);
        appliedFilters.push('search');
    }
    // Build orderBy - map global field names to Prisma field names
    const sortField = (filters.sorting?.field || 'created_at').trim();
    let prismaSortField = sortField;
    // Map common global field names (snake_case) to Prisma field names (camelCase)
    const fieldMapping = {
        'created_at': 'createdAt',
        'updated_at': 'updatedAt',
        'approved_at': 'approvedAt',
        'posted_at': 'postedAt',
        'follow_up_date': 'followUpDate',
        'expected_close_date': 'expectedCloseDate',
        'deal_date': 'dealDate',
        'join_date': 'joinDate',
    };
    // First, check if there's a mapping in the config's dateFields (most accurate)
    if (config.dateFields && config.dateFields.length > 0) {
        const dateFieldMapping = config.dateFields.find(df => df.global === sortField);
        if (dateFieldMapping) {
            prismaSortField = dateFieldMapping.prisma;
        }
        else if (fieldMapping[sortField]) {
            prismaSortField = fieldMapping[sortField];
        }
        else {
            // Unknown field: fall back to createdAt to avoid Prisma "Unknown argument" 500
            prismaSortField = (config.dateFields.find(df => df.global === 'created_at')?.prisma) || 'createdAt';
        }
    }
    else if (fieldMapping[sortField]) {
        prismaSortField = fieldMapping[sortField];
    }
    else {
        prismaSortField = 'createdAt';
    }
    const orderBy = {
        [prismaSortField]: (filters.sorting?.direction || 'desc'),
    };
    // Track applied filters for audit
    if (filters.status.length > 0)
        appliedFilters.push(`status:${filters.status.join(',')}`);
    if (filters.date?.field)
        appliedFilters.push(`date:${filters.date.field}`);
    if (filters.numeric_ranges?.amount_min || filters.numeric_ranges?.amount_max)
        appliedFilters.push('amount-range');
    if (filters.ownership.assigned_users.length > 0)
        appliedFilters.push('assigned-users');
    return {
        where,
        orderBy,
        appliedFilters,
        permissionScope: permissionContext.roleName || 'default',
    };
}
/**
 * Validate filter payload (rejects unknown fields)
 */
function validateFilter(input) {
    try {
        return (0, global_filter_schema_1.validateGlobalFilter)(input);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            logger_1.default.error('Invalid filter payload:', error.errors);
            throw new Error(`Invalid filter payload: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`);
        }
        throw error;
    }
}
//# sourceMappingURL=global-filter-engine.js.map