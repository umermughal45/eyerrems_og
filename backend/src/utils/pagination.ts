/**
 * Pagination Utility
 * Standardized pagination for list endpoints
 */

import { z } from 'zod';

/**
 * Pagination query schema
 * Uses .passthrough() to allow extra query parameters (like 'search') without validation errors
 */
export const paginationSchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => {
      const parsed = val ? parseInt(val, 10) : 1;
      return isNaN(parsed) || parsed < 1 ? 1 : parsed;
    }),
  limit: z
    .string()
    .optional()
    .transform((val) => {
      const parsed = val ? parseInt(val, 10) : 10;
      if (isNaN(parsed) || parsed < 1) return 10;
      if (parsed > 100) return 100;
      return parsed;
    }),
}).passthrough();

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
export function calculatePagination(
  page: number,
  limit: number,
  total: number,
): PaginationResult {
  const totalPages = Math.ceil(total / limit);
  const skip = (page - 1) * limit;

  return {
    page,
    limit,
    total,
    totalPages,
    skip,
  };
}

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
export function parsePaginationQuery(
  query: Record<string, unknown>,
): PaginationQuery {
  return paginationSchema.parse(query);
}

