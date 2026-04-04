/**
 * Pagination Utility
 * Standardized pagination for list endpoints
 */
import { z } from 'zod';
/**
 * Pagination query schema
 * Uses .passthrough() to allow extra query parameters (like 'search') without validation errors
 */
export declare const paginationSchema: z.ZodObject<{
    page: z.ZodEffects<z.ZodOptional<z.ZodString>, number, string | undefined>;
    limit: z.ZodEffects<z.ZodOptional<z.ZodString>, number, string | undefined>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    page: z.ZodEffects<z.ZodOptional<z.ZodString>, number, string | undefined>;
    limit: z.ZodEffects<z.ZodOptional<z.ZodString>, number, string | undefined>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    page: z.ZodEffects<z.ZodOptional<z.ZodString>, number, string | undefined>;
    limit: z.ZodEffects<z.ZodOptional<z.ZodString>, number, string | undefined>;
}, z.ZodTypeAny, "passthrough">>;
export type PaginationQuery = z.infer<typeof paginationSchema>;
/**
 * Pagination result
 */
export interface PaginationResult {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    skip: number;
}
/**
 * Calculate pagination parameters
 * @param page - Current page number (1-indexed)
 * @param limit - Number of items per page
 * @param total - Total number of items
 * @returns Pagination result with calculated values
 * @example
 * ```typescript
 * const pagination = calculatePagination(2, 10, 95);
 * // Returns: { page: 2, limit: 10, total: 95, totalPages: 10, skip: 10 }
 * ```
 */
export declare function calculatePagination(page: number, limit: number, total: number): PaginationResult;
/**
 * Validate and parse pagination query parameters from request
 * @param query - Request query parameters object
 * @returns Parsed and validated pagination query
 * @throws ZodError if validation fails
 * @example
 * ```typescript
 * const { page, limit } = parsePaginationQuery(req.query);
 * // page defaults to 1, limit defaults to 10, max limit is 100
 * ```
 */
export declare function parsePaginationQuery(query: Record<string, unknown>): PaginationQuery;
//# sourceMappingURL=pagination.d.ts.map