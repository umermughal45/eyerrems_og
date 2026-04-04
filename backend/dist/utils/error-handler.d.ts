/**
 * Error Handler Utility
 * Standardized error handling and response formatting
 */
import { Response } from 'express';
export interface ApiError extends Error {
    statusCode?: number;
    code?: string;
    details?: unknown;
}
/**
 * Standard API response format
 */
export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
    details?: unknown;
    pagination?: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}
/**
 * Create standardized success response
 * @param res - Express response object
 * @param data - Response data payload
 * @param statusCode - HTTP status code (default: 200)
 * @param pagination - Optional pagination metadata
 * @returns Express response with standardized format
 * @example
 * ```typescript
 * return successResponse(res, users, 200, { page: 1, limit: 10, total: 100, totalPages: 10 });
 * ```
 */
export declare function successResponse<T>(res: Response, data: T, statusCode?: number, pagination?: ApiResponse<T>['pagination']): Response;
/**
 * Create standardized error response
 * Automatically handles Zod validation errors, Prisma errors, and generic errors
 * @param res - Express response object
 * @param error - Error string, Error object, or unknown error type
 * @param statusCode - HTTP status code (default: 500)
 * @param details - Optional error details (only shown in development)
 * @returns Express response with standardized error format
 * @example
 * ```typescript
 * return errorResponse(res, 'User not found', 404);
 * return errorResponse(res, validationError);
 * return errorResponse(res, prismaError, 400, { field: 'email' });
 * ```
 */
export declare function errorResponse(res: Response, error: string | Error | unknown, statusCode?: number, details?: unknown): Response;
/**
 * Async route handler wrapper
 * Automatically catches errors and sends standardized responses
 * @param fn - Async route handler function
 * @returns Wrapped route handler that catches errors
 * @example
 * ```typescript
 * router.get('/', asyncHandler(async (req, res) => {
 *   const data = await getData();
 *   return successResponse(res, data);
 * }));
 * ```
 */
export declare function asyncHandler(fn: (req: unknown, res: Response, next?: () => void) => Promise<unknown>): (req: unknown, res: Response, next: () => void) => void;
//# sourceMappingURL=error-handler.d.ts.map