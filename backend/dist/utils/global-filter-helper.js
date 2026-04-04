"use strict";
/**
 * Global Filter Helper
 * Utility to integrate global filter engine into list endpoints
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseGlobalFilter = parseGlobalFilter;
exports.buildPermissionContext = buildPermissionContext;
exports.applyListFilters = applyListFilters;
exports.calculatePagination = calculatePagination;
const global_filter_engine_1 = require("../services/global-filter-engine");
const global_filter_schema_1 = require("../schemas/global-filter-schema");
const audit_log_1 = require("../services/audit-log");
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * Parse global filter from request (query params or body)
 */
function parseGlobalFilter(req) {
    // Try body first (for POST requests)
    if (req.body && req.body.filter) {
        return (0, global_filter_schema_1.validateGlobalFilter)(req.body.filter);
    }
    // Fallback to query params (for GET requests)
    const filter = {};
    // Parse pagination
    const page = req.query.page ? parseInt(req.query.page, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 25;
    filter.pagination = { page, limit };
    // Parse sorting (default to created_at which will be mapped to createdAt)
    const sortField = (req.query.sort || req.query.sortBy || 'created_at');
    const sortDir = (req.query.direction || req.query.order || 'desc');
    filter.sorting = { field: sortField, direction: sortDir };
    // Parse search
    if (req.query.search) {
        filter.search = req.query.search;
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
            field: req.query.dateField,
            from: req.query.dateFrom,
            to: req.query.dateTo,
            preset: req.query.datePreset,
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
            amount_min: req.query.amountMin ? parseFloat(req.query.amountMin) : null,
            amount_max: req.query.amountMax ? parseFloat(req.query.amountMax) : null,
        };
    }
    // Apply defaults
    return (0, global_filter_schema_1.validateGlobalFilter)(filter);
}
/**
 * Build permission context from authenticated request
 */
function buildPermissionContext(req) {
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
async function applyListFilters(req, config, systemConstraints = {}) {
    const filterPayload = parseGlobalFilter(req);
    const permissionContext = buildPermissionContext(req);
    // Apply filters
    const result = await (0, global_filter_engine_1.applyGlobalFilters)(config, filterPayload, permissionContext, systemConstraints);
    // Build pagination
    const page = filterPayload.pagination.page;
    const limit = filterPayload.pagination.limit;
    const skip = (page - 1) * limit;
    // Audit log filter application
    try {
        await (0, audit_log_1.createAuditLog)({
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
            req: req,
        });
    }
    catch (error) {
        logger_1.default.error('Failed to create filter audit log:', error);
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
function calculatePagination(page, limit, total) {
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
//# sourceMappingURL=global-filter-helper.js.map