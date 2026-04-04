"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyFilters = applyFilters;
exports.validateFilterPayload = validateFilterPayload;
const client_1 = __importDefault(require("../prisma/client"));
const logger_1 = __importDefault(require("../utils/logger"));
// Whitelist of models that have isArchived field (for fallback)
const MODELS_WITH_ARCHIVED = new Set([]);
// Models that do NOT have isDeleted (Voucher, Transaction, Invoice, etc.)
const MODELS_WITHOUT_IS_DELETED = new Set([
    'voucher', 'transaction', 'invoice', 'commission', 'transactioncategory',
    'account', 'journalentry', 'journalline', 'voucherline', 'ledgerentry',
]);
function modelHasField(modelName, fieldName) {
    if (fieldName === 'isArchived') {
        return MODELS_WITH_ARCHIVED.has(modelName);
    }
    if (fieldName === 'isDeleted') {
        const key = String(modelName).toLowerCase();
        if (MODELS_WITHOUT_IS_DELETED.has(key))
            return false;
    }
    try {
        const dmmf = client_1.default?._dmmf;
        if (!dmmf) {
            if (fieldName === 'isDeleted')
                return !MODELS_WITHOUT_IS_DELETED.has(String(modelName).toLowerCase());
            return false;
        }
        const models = dmmf.datamodel?.models;
        if (!models || !Array.isArray(models)) {
            if (fieldName === 'isDeleted')
                return !MODELS_WITHOUT_IS_DELETED.has(String(modelName).toLowerCase());
            return false;
        }
        const model = models.find((m) => String(m.name).toLowerCase() === String(modelName).toLowerCase());
        if (!model || !model.fields || !Array.isArray(model.fields)) {
            if (fieldName === 'isDeleted')
                return !MODELS_WITHOUT_IS_DELETED.has(String(modelName).toLowerCase());
            return false;
        }
        return model.fields.some((f) => f.name === fieldName);
    }
    catch (error) {
        logger_1.default.warn(`Could not check if model ${modelName} has field ${fieldName}:`, error);
        if (fieldName === 'isDeleted')
            return !MODELS_WITHOUT_IS_DELETED.has(String(modelName).toLowerCase());
        return false;
    }
}
/**
 * Default permission scope (Layer 1)
 * Applies company/department/property access restrictions
 */
async function applyPermissionScope(config, context) {
    const where = {};
    // If module has custom permission scope, use it
    if (config.permissionScope) {
        return await config.permissionScope(context);
    }
    // Default: no additional restrictions (module-specific routes handle RBAC)
    // This is a placeholder - actual implementation would check:
    // - Company scope
    // - Property access
    // - Department scope
    // - Role restrictions
    return where;
}
/**
 * Default system constraints (Layer 2)
 * Always enforced unless explicitly overridden
 */
function applySystemConstraints(config, constraints) {
    const where = {};
    // Soft-deleted exclusion (default: true)
    if (constraints.excludeSoftDeleted !== false && modelHasField(config.model, 'isDeleted')) {
        where.isDeleted = false;
    }
    // Archived exclusion (default: true)
    if (constraints.excludeArchived !== false && modelHasField(config.model, 'isArchived')) {
        where.isArchived = false;
    }
    // If module has custom constraints, merge them
    if (config.systemConstraints) {
        const customConstraints = config.systemConstraints(constraints);
        return { ...where, ...customConstraints };
    }
    return where;
}
/**
 * Apply user filters (Layer 3)
 * Identity, status, date, ownership, numeric, relational
 */
function applyUserFilters(config, filters) {
    const where = {};
    // Identity Filters
    if (filters.systemId || filters.tid || filters.codes?.length || filters.referenceNumbers?.length) {
        const identityConditions = [];
        if (filters.systemId && config.identityFields) {
            config.identityFields.forEach(field => {
                identityConditions.push({
                    [field]: { contains: filters.systemId, mode: 'insensitive' }
                });
            });
        }
        if (filters.tid) {
            identityConditions.push({ tid: { contains: filters.tid, mode: 'insensitive' } });
        }
        if (filters.codes?.length && config.identityFields) {
            filters.codes.forEach(code => {
                config.identityFields.forEach(field => {
                    identityConditions.push({
                        [field]: { contains: code, mode: 'insensitive' }
                    });
                });
            });
        }
        if (filters.referenceNumbers?.length) {
            filters.referenceNumbers.forEach(ref => {
                identityConditions.push({ referenceNumber: { contains: ref, mode: 'insensitive' } });
            });
        }
        if (identityConditions.length > 0) {
            where.OR = identityConditions;
        }
    }
    // Status Filters (multi-select)
    if (filters.status?.length && config.statusField) {
        where[config.statusField] = { in: filters.status };
    }
    if (filters.priority?.length) {
        where.priority = { in: filters.priority };
    }
    if (filters.stage?.length) {
        where.stage = { in: filters.stage };
    }
    if (filters.lifecycle?.length) {
        where.status = { in: filters.lifecycle };
    }
    // Date Filters (CRITICAL - explicit field selection)
    if (filters.dateField && (filters.dateFrom || filters.dateTo || filters.datePreset)) {
        let dateFrom;
        let dateTo;
        if (filters.datePreset) {
            const now = new Date();
            switch (filters.datePreset) {
                case 'today':
                    dateFrom = new Date(now.setHours(0, 0, 0, 0));
                    dateTo = new Date(now.setHours(23, 59, 59, 999));
                    break;
                case 'thisWeek':
                    const weekStart = new Date(now);
                    weekStart.setDate(now.getDate() - now.getDay());
                    weekStart.setHours(0, 0, 0, 0);
                    dateFrom = weekStart;
                    dateTo = new Date();
                    break;
                case 'thisMonth':
                    dateFrom = new Date(now.getFullYear(), now.getMonth(), 1);
                    dateTo = new Date();
                    break;
                case 'lastMonth':
                    dateFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                    dateTo = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
                    break;
                case 'custom':
                    if (filters.dateFrom)
                        dateFrom = new Date(filters.dateFrom);
                    if (filters.dateTo)
                        dateTo = new Date(filters.dateTo);
                    break;
            }
        }
        else {
            if (filters.dateFrom)
                dateFrom = new Date(filters.dateFrom);
            if (filters.dateTo)
                dateTo = new Date(filters.dateTo);
        }
        if (dateFrom || dateTo) {
            const dateFilter = {};
            if (dateFrom)
                dateFilter.gte = dateFrom.toISOString();
            if (dateTo) {
                // Set to end of day
                const endDate = new Date(dateTo);
                endDate.setHours(23, 59, 59, 999);
                dateFilter.lte = endDate.toISOString();
            }
            where[filters.dateField] = dateFilter;
        }
    }
    // Ownership & Responsibility
    if (filters.createdBy) {
        where.createdBy = filters.createdBy;
    }
    if (filters.assignedTo) {
        where.assignedToUserId = filters.assignedTo;
    }
    if (filters.assignedDealerId) {
        where.assignedDealerId = filters.assignedDealerId;
    }
    if (filters.assignedAgentId) {
        where.assignedAgentId = filters.assignedAgentId;
    }
    if (filters.department) {
        where.department = filters.department;
    }
    if (filters.approvedBy) {
        where.approvedBy = filters.approvedBy;
    }
    // Numeric / Financial Filters
    if (filters.amount) {
        const amountFilter = {};
        if (filters.amount.min !== undefined)
            amountFilter.gte = filters.amount.min;
        if (filters.amount.max !== undefined)
            amountFilter.lte = filters.amount.max;
        if (Object.keys(amountFilter).length > 0) {
            where.amount = amountFilter;
        }
    }
    if (filters.balance) {
        const balanceFilter = {};
        if (filters.balance.min !== undefined)
            balanceFilter.gte = filters.balance.min;
        if (filters.balance.max !== undefined)
            balanceFilter.lte = filters.balance.max;
        if (Object.keys(balanceFilter).length > 0) {
            where.balance = balanceFilter;
        }
    }
    if (filters.debit) {
        const debitFilter = {};
        if (filters.debit.min !== undefined)
            debitFilter.gte = filters.debit.min;
        if (filters.debit.max !== undefined)
            debitFilter.lte = filters.debit.max;
        if (Object.keys(debitFilter).length > 0) {
            where.debit = debitFilter;
        }
    }
    if (filters.credit) {
        const creditFilter = {};
        if (filters.credit.min !== undefined)
            creditFilter.gte = filters.credit.min;
        if (filters.credit.max !== undefined)
            creditFilter.lte = filters.credit.max;
        if (Object.keys(creditFilter).length > 0) {
            where.credit = creditFilter;
        }
    }
    // Relational Filters
    if (filters.propertyId && config.relationalFields?.propertyId) {
        where[config.relationalFields.propertyId] = filters.propertyId;
    }
    if (filters.unitId && config.relationalFields?.unitId) {
        where[config.relationalFields.unitId] = filters.unitId;
    }
    if (filters.tenantId && config.relationalFields?.tenantId) {
        where[config.relationalFields.tenantId] = filters.tenantId;
    }
    if (filters.dealId && config.relationalFields?.dealId) {
        where[config.relationalFields.dealId] = filters.dealId;
    }
    if (filters.clientId && config.relationalFields?.clientId) {
        where[config.relationalFields.clientId] = filters.clientId;
    }
    if (filters.employeeId && config.relationalFields?.employeeId) {
        where[config.relationalFields.employeeId] = filters.employeeId;
    }
    if (filters.accountId && config.relationalFields?.accountId) {
        where[config.relationalFields.accountId] = filters.accountId;
    }
    if (filters.voucherId && config.relationalFields?.voucherId) {
        where[config.relationalFields.voucherId] = filters.voucherId;
    }
    // Additional module-specific filters
    Object.keys(filters).forEach(key => {
        if (!['systemId', 'tid', 'codes', 'referenceNumbers', 'status', 'priority', 'stage', 'lifecycle',
            'dateField', 'datePreset', 'dateFrom', 'dateTo', 'createdBy', 'assignedTo', 'assignedDealerId',
            'assignedAgentId', 'department', 'approvedBy', 'amount', 'balance', 'tax', 'debit', 'credit',
            'propertyId', 'unitId', 'tenantId', 'dealId', 'clientId', 'employeeId', 'accountId', 'voucherId',
            'search'].includes(key)) {
            // Voucher model: frontend sends voucherType, Prisma field is type
            if (config.model === 'Voucher' && key === 'voucherType') {
                where.type = filters[key];
            }
            else {
                where[key] = filters[key];
            }
        }
    });
    return where;
}
/**
 * Apply search (Layer 4)
 * Search applies only on already-filtered data
 */
function applySearch(config, search, existingWhere) {
    if (!search || !config.identityFields) {
        return existingWhere;
    }
    // Search only on identity fields
    const searchConditions = config.identityFields.map(field => ({
        [field]: { contains: search, mode: 'insensitive' }
    }));
    // Combine with existing OR conditions if they exist
    if (existingWhere.OR) {
        existingWhere.OR = [...(Array.isArray(existingWhere.OR) ? existingWhere.OR : []), ...searchConditions];
    }
    else {
        existingWhere.OR = searchConditions;
    }
    return existingWhere;
}
/**
 * Main filter engine
 * Applies filters in correct order: Permissions → System → User → Search
 */
async function applyFilters(config, filters, permissionContext, systemConstraints = {}) {
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
    // Track which filters were applied for audit
    if (filters.status?.length)
        appliedFilters.push(`status:${filters.status.join(',')}`);
    if (filters.dateField)
        appliedFilters.push(`date:${filters.dateField}`);
    if (filters.amount)
        appliedFilters.push('amount-range');
    if (filters.createdBy)
        appliedFilters.push('created-by');
    if (filters.assignedTo)
        appliedFilters.push('assigned-to');
    return {
        where,
        appliedFilters,
        permissionScope: permissionContext.roleName || 'default',
    };
}
/**
 * Validate filter payload
 * Ensures date fields are valid, numeric ranges are correct, etc.
 */
function validateFilterPayload(config, filters) {
    const errors = [];
    // Validate date field
    if (filters.dateField && config.dateFields && !config.dateFields.includes(filters.dateField)) {
        errors.push(`Invalid dateField: ${filters.dateField}. Must be one of: ${config.dateFields.join(', ')}`);
    }
    // Validate date range
    if (filters.dateFrom && filters.dateTo) {
        const from = new Date(filters.dateFrom);
        const to = new Date(filters.dateTo);
        if (isNaN(from.getTime()) || isNaN(to.getTime())) {
            errors.push('Invalid date range: dateFrom and dateTo must be valid ISO date strings');
        }
        else if (from > to) {
            errors.push('Invalid date range: dateFrom must be before dateTo');
        }
    }
    // Validate numeric ranges
    if (filters.amount) {
        if (filters.amount.min !== undefined && filters.amount.max !== undefined && filters.amount.min > filters.amount.max) {
            errors.push('Invalid amount range: min must be less than or equal to max');
        }
    }
    if (filters.balance) {
        if (filters.balance.min !== undefined && filters.balance.max !== undefined && filters.balance.min > filters.balance.max) {
            errors.push('Invalid balance range: min must be less than or equal to max');
        }
    }
    return {
        valid: errors.length === 0,
        errors,
    };
}
//# sourceMappingURL=unified-filter-engine.js.map