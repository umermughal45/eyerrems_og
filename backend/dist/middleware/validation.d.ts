/**
 * Validation Middleware
 *
 * Centralized validation middleware using Zod schemas.
 * This ensures all API endpoints use the same validation logic as the frontend.
 */
import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
/**
 * Validate request body using Zod schema
 * @param schema - Zod schema for request body
 * @returns Express middleware function
 */
export declare function validateBody<T extends ZodSchema>(schema: T): (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * Validate request query parameters using Zod schema
 * @param schema - Zod schema for query parameters
 * @returns Express middleware function
 */
export declare function validateQuery<T extends ZodSchema>(schema: T): (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * Validate request params using Zod schema
 * @param schema - Zod schema for route parameters
 * @returns Express middleware function
 */
export declare function validateParams<T extends ZodSchema>(schema: T): (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * Helper to create a combined validation middleware
 * @param options - Validation options for body, query, and params
 * @returns Express middleware function
 */
export declare function validate(options: {
    body?: ZodSchema;
    query?: ZodSchema;
    params?: ZodSchema;
}): (req: Request, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=validation.d.ts.map