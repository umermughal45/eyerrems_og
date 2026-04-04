"use strict";
/**
 * Filter Helper for List Endpoints
 * Provides reusable function to apply unified filters to list queries
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyListFilters = applyListFilters;
const unified_filter_engine_1 = require("../services/unified-filter-engine");
const pagination_1 = require("./pagination");
const audit_log_1 = require("../services/audit-log");
const logger_1 = __importDefault(require("./logger"));
/**
 * Apply filters to a list query
 * Returns where clause, pagination info, and applied filter metadata
 */
async function applyListFilters(req, config, defaultOrderBy = { createdAt: 'desc' }) {
    // Parse pagination
    const { page, limit } = (0, pagination_1.parsePaginationQuery)(req.query);
    const skip = (page - 1) * limit;
    // Parse filter payload from query params or body
    let filterPayload = {};
    // Try to get filters from body (POST) or query (GET)
    if (req.method === 'POST' && req.body?.filters) {
        filterPayload = req.body.filters;
    }
    else if (req.query.filters) {
        try {
            filterPayload = typeof req.query.filters === 'string'
                ? JSON.parse(req.query.filters)
                : req.query.filters;
        }
        catch {
            logger_1.default.warn('Failed to parse filters from query', { filters: req.query.filters });
        }
    }
    else {
        // Legacy: parse individual query params (coerce to strings safely)
        const rawStatus = req.query.status;
        const rawPriority = req.query.priority;
        const status = Array.isArray(rawStatus)
            ? rawStatus.map((s) => String(s))
            : rawStatus
                ? [String(rawStatus)]
                : undefined;
        const priority = Array.isArray(rawPriority)
            ? rawPriority.map((p) => String(p))
            : rawPriority
                ? [String(rawPriority)]
                : undefined;
        const amountMin = req.query.amountMin;
        const amountMax = req.query.amountMax;
        filterPayload = {
            status,
            priority,
            assignedTo: req.query.assignedTo,
            department: req.query.department,
            search: req.query.search,
            dateField: req.query.dateField,
            datePreset: req.query.datePreset,
            dateFrom: req.query.dateFrom,
            dateTo: req.query.dateTo,
            amount: amountMin || amountMax
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
    const permissionContext = {
        userId: req.user?.id || 'unknown',
        roleId: req.user?.roleId || '',
        roleName: req.user?.role?.name,
        permissions: req.user?.role?.permissions || [],
    };
    // System constraints
    const systemConstraints = {
        excludeSoftDeleted: true,
        excludeArchived: true,
    };
    // Validate filter payload
    const validation = (0, unified_filter_engine_1.validateFilterPayload)(config, filterPayload);
    if (!validation.valid) {
        throw new Error(`Invalid filter payload: ${validation.errors.join(', ')}`);
    }
    // Apply filters using unified engine
    const filterResult = await (0, unified_filter_engine_1.applyFilters)(config, filterPayload, permissionContext, systemConstraints);
    // Audit log filter usage
    if (Object.keys(filterPayload).length > 0) {
        await (0, audit_log_1.createAuditLog)({
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
            req: req,
        });
    }
    // Parse sort
    const sortField = (req.query.sortField || req.body?.sort?.field);
    const sortDirection = (req.query.sortDirection || req.body?.sort?.direction || 'desc');
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
//# sourceMappingURL=filter-helper.js.map