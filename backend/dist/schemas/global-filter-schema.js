"use strict";
/**
 * Global Filter Schema
 * Backend-first contract used by ALL modules
 * Enforced via Zod validation - rejects unknown fields
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportRequestSchema = exports.globalFilterSchema = void 0;
exports.validateGlobalFilter = validateGlobalFilter;
const zod_1 = require("zod");
/**
 * Global Filter Schema (Strict)
 * This is the ONLY filter contract allowed in the system
 */
exports.globalFilterSchema = zod_1.z.object({
    identity: zod_1.z.object({
        system_ids: zod_1.z.array(zod_1.z.string()).default([]),
        reference_codes: zod_1.z.array(zod_1.z.string()).default([]),
        tids: zod_1.z.array(zod_1.z.string()).default([]),
    }).default({}),
    status: zod_1.z.array(zod_1.z.string()).default([]),
    lifecycle: zod_1.z.array(zod_1.z.string()).default([]),
    priority: zod_1.z.array(zod_1.z.string()).default([]),
    stage: zod_1.z.array(zod_1.z.string()).default([]),
    ownership: zod_1.z.object({
        assigned_users: zod_1.z.array(zod_1.z.string().uuid()).default([]),
        teams: zod_1.z.array(zod_1.z.string()).default([]),
        departments: zod_1.z.array(zod_1.z.string()).default([]),
        dealers: zod_1.z.array(zod_1.z.string().uuid()).default([]),
        agents: zod_1.z.array(zod_1.z.string().uuid()).default([]),
        created_by: zod_1.z.array(zod_1.z.string().uuid()).default([]),
        approved_by: zod_1.z.array(zod_1.z.string().uuid()).default([]),
    }).default({}),
    date: zod_1.z.object({
        field: zod_1.z.enum(['created_at', 'updated_at', 'approved_at', 'posted_at', 'date', 'follow_up_date', 'expected_close_date', 'deal_date', 'join_date']).optional(),
        from: zod_1.z.string().datetime().nullable().optional(),
        to: zod_1.z.string().datetime().nullable().optional(),
        preset: zod_1.z.enum(['today', 'last_7_days', 'month_to_date', 'quarter', 'last_month', 'this_year', 'custom']).optional(),
    }).optional(),
    numeric_ranges: zod_1.z.object({
        amount_min: zod_1.z.number().nullable().optional(),
        amount_max: zod_1.z.number().nullable().optional(),
        balance_min: zod_1.z.number().nullable().optional(),
        balance_max: zod_1.z.number().nullable().optional(),
        debit_min: zod_1.z.number().nullable().optional(),
        debit_max: zod_1.z.number().nullable().optional(),
        credit_min: zod_1.z.number().nullable().optional(),
        credit_max: zod_1.z.number().nullable().optional(),
        tax_min: zod_1.z.number().nullable().optional(),
        tax_max: zod_1.z.number().nullable().optional(),
    }).optional(),
    relationships: zod_1.z.object({
        has_related: zod_1.z.array(zod_1.z.object({
            type: zod_1.z.string(), // "property", "client", "deal", "employee", etc.
            id: zod_1.z.string().uuid(),
        })).default([]),
        missing_related: zod_1.z.array(zod_1.z.string()).default([]), // Relationship types that must be missing
    }).default({}),
    pagination: zod_1.z.object({
        page: zod_1.z.number().int().positive().default(1),
        limit: zod_1.z.number().int().positive().max(1000).default(25),
    }).default({}),
    sorting: zod_1.z.object({
        field: zod_1.z.string().default('created_at'),
        direction: zod_1.z.enum(['asc', 'desc']).default('desc'),
    }).default({}),
    // Search (applied last, never widens scope)
    search: zod_1.z.string().optional(),
}).strict(); // Reject unknown fields
/**
 * Validate and normalize filter payload
 * Rejects unknown fields, applies defaults
 */
function validateGlobalFilter(input) {
    return exports.globalFilterSchema.parse(input);
}
/**
 * Export Request Schema (includes filter + export options)
 */
exports.exportRequestSchema = zod_1.z.object({
    module: zod_1.z.string().min(1),
    tab: zod_1.z.string().optional(),
    format: zod_1.z.enum(['csv', 'excel', 'pdf', 'word']), // Changed 'xlsx' to 'excel' to match ExportFormat
    scope: zod_1.z.enum(['current_page', 'all_filtered', 'custom_limit']),
    custom_limit: zod_1.z.number().int().positive().max(100000).optional(), // Required if scope is custom_limit
    columns: zod_1.z.array(zod_1.z.string()).optional(), // Selected columns (if column selection enabled)
    data_shape: zod_1.z.enum(['raw', 'grouped', 'aggregated']).default('raw'),
    filter: exports.globalFilterSchema,
    preset_name: zod_1.z.string().optional(), // If saving as preset
});
//# sourceMappingURL=global-filter-schema.js.map