/**
 * Query Parameter Validation Middleware
 * Uses Zod to validate all req.query parameters in every route
 * Ensures UUIDs, dates, enums, pagination, and optional fields are validated
 * Rejects invalid queries with 400 error
 */

import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema, ZodError } from 'zod';
import { errorResponse } from '../utils/error-handler';
import logger from '../utils/logger';

/**
 * Common query parameter schemas
 */
export const commonQuerySchemas = {
  // UUID parameter
  uuid: z.string().uuid('Invalid UUID format'),
  
  // Optional UUID
  optionalUuid: z.string().uuid('Invalid UUID format').optional(),
  
  // Date parameter (ISO string)
  date: z.string().datetime('Invalid date format'),
  
  // Optional date
  optionalDate: z.string().datetime('Invalid date format').optional(),
  
  // Pagination
  pagination: z.object({
    page: z.string().regex(/^\d+$/).transform(Number).default('1'),
    limit: z.string().regex(/^\d+$/).transform(Number).default('10'),
  }).partial(),
  
  // Search query
  search: z.string().min(1).max(255).optional(),
  
  // Sort order
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  
  // Status enum (common statuses)
  status: z.enum(['active', 'inactive', 'pending', 'approved', 'rejected', 'completed', 'cancelled']).optional(),
  
  // Boolean string
  boolean: z.enum(['true', 'false']).transform((val) => val === 'true').optional(),
  
  // Number parameter
  number: z.string().regex(/^-?\d+(\.\d+)?$/).transform(Number),
  
  // Optional number
  optionalNumber: z.string().regex(/^-?\d+(\.\d+)?$/).transform(Number).optional(),
};

/**
 * Validate query parameters using Zod schema
 * @param schema - Zod schema for query parameters
 * @returns Express middleware function
 */
export function validateQuery<T extends z.ZodTypeAny>(schema: T) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Parse and validate query parameters
      const validated = await schema.parseAsync(req.query);
      
      // Replace req.query with validated data
      req.query = validated as any;
      
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        logger.warn('Query validation failed:', {
          path: req.path,
          method: req.method,
          errors: error.errors,
        });
        
        errorResponse(
          res,
          'Invalid query parameters',
          400,
          error.errors.map((e) => ({
            path: e.path.join('.'),
            message: e.message,
          }))
        );
        return;
      }
      
      logger.error('Query validation error:', error);
      errorResponse(res, 'Query validation failed', 400);
      return;
    }
  };
}

/**
 * Helper to create query schema with common patterns
 */
export function createQuerySchema<T extends z.ZodRawShape>(shape: T) {
  return z.object(shape).partial();
}

/**
 * Example usage:
 * 
 * router.get(
 *   '/properties',
 *   validateQuery(
 *     createQuerySchema({
 *       search: commonQuerySchemas.search,
 *       locationId: commonQuerySchemas.optionalUuid,
 *       page: z.string().regex(/^\d+$/).transform(Number).default('1'),
 *       limit: z.string().regex(/^\d+$/).transform(Number).default('10'),
 *     })
 *   ),
 *   async (req, res) => {
 *     // req.query is now validated and typed
 *     const { search, locationId, page, limit } = req.query;
 *     // ...
 *   }
 * );
 */

