/**
 * Validation Middleware
 * 
 * Centralized validation middleware using Zod schemas.
 * This ensures all API endpoints use the same validation logic as the frontend.
 */

import { Request, Response, NextFunction } from 'express';
import { z, ZodError, ZodSchema } from 'zod';
import { errorResponse } from '../utils/error-handler';
import logger from '../utils/logger';
import { AuthRequest } from './auth';

/**
 * Validate request body using Zod schema
 * @param schema - Zod schema for request body
 * @returns Express middleware function
 */
export function validateBody<T extends ZodSchema>(schema: T) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Parse and validate request body
      const validated = await schema.parseAsync(req.body);
      
      // Replace req.body with validated data
      req.body = validated as z.infer<T>;
      
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        logger.warn('Body validation failed:', {
          path: req.path,
          method: req.method,
          errors: error.errors,
        });
        
        errorResponse(
          res,
          'Validation error',
          400,
          error.errors.map((e) => ({
            path: e.path.join('.'),
            message: e.message,
            code: e.code,
          }))
        );
        return;
      }
      
      logger.error('Body validation error:', error);
      errorResponse(res, 'Validation failed', 400);
      return;
    }
  };
}

/**
 * Validate request query parameters using Zod schema
 * @param schema - Zod schema for query parameters
 * @returns Express middleware function
 */
export function validateQuery<T extends ZodSchema>(schema: T) {
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
            code: e.code,
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
 * Validate request params using Zod schema
 * @param schema - Zod schema for route parameters
 * @returns Express middleware function
 */
export function validateParams<T extends ZodSchema>(schema: T) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Parse and validate route parameters
      const validated = await schema.parseAsync(req.params);
      
      // Replace req.params with validated data
      req.params = validated as any;
      
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        logger.warn('Params validation failed:', {
          path: req.path,
          method: req.method,
          errors: error.errors,
        });
        
        errorResponse(
          res,
          'Invalid route parameters',
          400,
          error.errors.map((e) => ({
            path: e.path.join('.'),
            message: e.message,
            code: e.code,
          }))
        );
        return;
      }
      
      logger.error('Params validation error:', error);
      errorResponse(res, 'Params validation failed', 400);
      return;
    }
  };
}

/**
 * Helper to create a combined validation middleware
 * @param options - Validation options for body, query, and params
 * @returns Express middleware function
 */
export function validate(options: {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (options.body) {
        const validated = await options.body.parseAsync(req.body);
        req.body = validated as any;
      }
      
      if (options.query) {
        const validated = await options.query.parseAsync(req.query);
        req.query = validated as any;
      }
      
      if (options.params) {
        const validated = await options.params.parseAsync(req.params);
        req.params = validated as any;
      }
      
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        logger.warn('Validation failed:', {
          path: req.path,
          method: req.method,
          errors: error.errors,
        });
        
        errorResponse(
          res,
          'Validation error',
          400,
          error.errors.map((e) => ({
            path: e.path.join('.'),
            message: e.message,
            code: e.code,
          }))
        );
        return;
      }
      
      logger.error('Validation error:', error);
      errorResponse(res, 'Validation failed', 400);
      return;
    }
  };
}


