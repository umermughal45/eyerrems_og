/**
 * Global Filter Schema
 * Backend-first contract used by ALL modules
 * Enforced via Zod validation - rejects unknown fields
 */

import { z } from 'zod';

/**
 * Global Filter Schema (Strict)
 * This is the ONLY filter contract allowed in the system
 */
export const globalFilterSchema = z.object({
  identity: z.object({
    system_ids: z.array(z.string()).default([]),
    reference_codes: z.array(z.string()).default([]),
    tids: z.array(z.string()).default([]),
  }).default({}),
  
  status: z.array(z.string()).default([]),
  lifecycle: z.array(z.string()).default([]),
  priority: z.array(z.string()).default([]),
  stage: z.array(z.string()).default([]),
  
  ownership: z.object({
    assigned_users: z.array(z.string().uuid()).default([]),
    teams: z.array(z.string()).default([]),
    departments: z.array(z.string()).default([]),
    dealers: z.array(z.string().uuid()).default([]),
    agents: z.array(z.string().uuid()).default([]),
    created_by: z.array(z.string().uuid()).default([]),
    approved_by: z.array(z.string().uuid()).default([]),
  }).default({}),
  
  date: z.object({
    field: z.enum(['created_at', 'updated_at', 'approved_at', 'posted_at', 'date', 'follow_up_date', 'expected_close_date', 'deal_date', 'join_date']).optional(),
    from: z.string().datetime().nullable().optional(),
    to: z.string().datetime().nullable().optional(),
    preset: z.enum(['today', 'last_7_days', 'month_to_date', 'quarter', 'last_month', 'this_year', 'custom']).optional(),
  }).optional(),
  
  numeric_ranges: z.object({
    amount_min: z.number().nullable().optional(),
    amount_max: z.number().nullable().optional(),
    balance_min: z.number().nullable().optional(),
    balance_max: z.number().nullable().optional(),
    debit_min: z.number().nullable().optional(),
    debit_max: z.number().nullable().optional(),
    credit_min: z.number().nullable().optional(),
    credit_max: z.number().nullable().optional(),
    tax_min: z.number().nullable().optional(),
    tax_max: z.number().nullable().optional(),
  }).optional(),
  
  relationships: z.object({
    has_related: z.array(z.object({
      type: z.string(), // "property", "client", "deal", "employee", etc.
      id: z.string().uuid(),
    })).default([]),
    missing_related: z.array(z.string()).default([]), // Relationship types that must be missing
  }).default({}),
  
  pagination: z.object({
    page: z.number().int().positive().default(1),
    limit: z.number().int().positive().max(1000).default(25),
  }).default({}),
  
  sorting: z.object({
    field: z.string().default('created_at'),
    direction: z.enum(['asc', 'desc']).default('desc'),
  }).default({}),
  
  // Search (applied last, never widens scope)
  search: z.string().optional(),
}).strict(); // Reject unknown fields

export type GlobalFilterPayload = z.infer<typeof globalFilterSchema>;

/**
 * Validate and normalize filter payload
 * Rejects unknown fields, applies defaults
 */
export function validateGlobalFilter(input: unknown): GlobalFilterPayload {
  return globalFilterSchema.parse(input);
}

/**
 * Export Request Schema (includes filter + export options)
 */
export const exportRequestSchema = z.object({
  module: z.string().min(1),
  tab: z.string().optional(),
  format: z.enum(['csv', 'excel', 'pdf', 'word']), // Changed 'xlsx' to 'excel' to match ExportFormat
  scope: z.enum(['current_page', 'all_filtered', 'custom_limit']),
  custom_limit: z.number().int().positive().max(100000).optional(), // Required if scope is custom_limit
  columns: z.array(z.string()).optional(), // Selected columns (if column selection enabled)
  data_shape: z.enum(['raw', 'grouped', 'aggregated']).default('raw'),
  filter: globalFilterSchema,
  preset_name: z.string().optional(), // If saving as preset
});

export type ExportRequestPayload = z.infer<typeof exportRequestSchema>;
