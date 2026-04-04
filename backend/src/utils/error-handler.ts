/**
 * Error Handler Utility
 * Standardized error handling and response formatting
 */

import { Response } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '../prisma/client';
import logger from './logger';

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
export function successResponse<T>(
  res: Response,
  data: T,
  statusCode: number = 200,
  pagination?: ApiResponse<T>['pagination'],
): Response {
  const response: ApiResponse<T> = {
    success: true,
    data,
  };

  if (pagination) {
    response.pagination = pagination;
  }

  return res.status(statusCode).json(response);
}

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
export function errorResponse(
  res: Response,
  error: string | Error | unknown,
  statusCode: number = 500,
  details?: unknown,
): Response {
  let errorMessage = 'Internal server error';
  let errorDetails: unknown = details;

  if (typeof error === 'string') {
    errorMessage = error;
  } else if (error instanceof Error) {
    errorMessage = error.message || 'Internal server error';
    errorDetails = errorDetails || (error as ApiError).details;
  }

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    statusCode = 400;
    errorMessage = 'Validation error';
    errorDetails = error.errors.map((err) => ({
      path: err.path.join('.'),
      message: err.message,
    }));
  }

  // Handle Prisma errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    statusCode = 400;
    errorMessage = 'Database error';

    switch (error.code) {
      case 'P2002':
        // Unique constraint violation
        const target = error.meta?.target as string[] | string;
        if (Array.isArray(target)) {
          errorMessage = `A record with this ${target.join(' and ')} already exists`;
        } else if (target) {
          errorMessage = `A record with this ${target} already exists`;
        } else {
          errorMessage = 'This record already exists (duplicate entry)';
        }
        errorDetails = { field: target, code: error.code };
        break;
      case 'P2025':
        statusCode = 404;
        errorMessage = 'Record not found';
        break;
      case 'P2003':
        errorMessage = 'Referenced record does not exist. Please check the related data.';
        errorDetails = {
          field: error.meta?.field_name,
          code: error.code,
        };
        break;
      case 'P2011':
        errorMessage = 'Required field is missing or null';
        errorDetails = { field: error.meta?.constraint, code: error.code };
        break;
      case 'P2012':
        errorMessage = 'Missing required value in the database operation';
        errorDetails = { code: error.code };
        break;
      case 'P2014':
        errorMessage = 'The required relation is missing';
        errorDetails = { code: error.code };
        break;
      case 'P2022':
        // Column not found - usually means migration hasn't been run
        // Try to extract column and table names from error message
        let columnName = 'unknown';
        let tableName = 'unknown';

        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/7293d0cd-bbb9-40ce-87ee-9763b81d9a43', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'error-handler.ts:P2022', message: 'P2022 error caught', data: { code: error.code, meta: error.meta, message: error.message, stack: error.stack }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'B' }) }).catch(() => { });
        // #endregion

        // Check error.meta first
        if (error.meta) {
          columnName = (error.meta as any).column_name || (error.meta as any).column || columnName;
          tableName = (error.meta as any).table_name || (error.meta as any).table || tableName;

          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/7293d0cd-bbb9-40ce-87ee-9763b81d9a43', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'error-handler.ts:meta', message: 'Extracted from meta', data: { columnName, tableName, meta: error.meta }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'B' }) }).catch(() => { });
          // #endregion
        }

        // Parse error message if meta doesn't have the info
        const errorMsg = error.message || '';
        if (columnName === 'unknown' || tableName === 'unknown') {
          // Try to extract from error message patterns like:
          // "The column `ColumnName` does not exist in the current database."
          // "Column `ColumnName` does not exist in table `TableName`."
          const columnMatch = errorMsg.match(/column\s+[`"]?(\w+)[`"]?/i);
          if (columnMatch) {
            columnName = columnMatch[1];
          }

          const tableMatch = errorMsg.match(/table\s+[`"]?(\w+)[`"]?/i) ||
            errorMsg.match(/from\s+[`"]?(\w+)[`"]?/i);
          if (tableMatch) {
            tableName = tableMatch[1];
          }

          // Try to extract from Prisma's error format
          if (errorMsg.includes('Property') && errorMsg.includes('.')) {
            const propertyMatch = errorMsg.match(/Property\.(\w+)/);
            if (propertyMatch) {
              tableName = 'Property';
              columnName = propertyMatch[1];
            }
          }

          if (errorMsg.includes('FinanceLedger') && errorMsg.includes('.')) {
            const ledgerMatch = errorMsg.match(/FinanceLedger\.(\w+)/);
            if (ledgerMatch) {
              tableName = 'FinanceLedger';
              columnName = ledgerMatch[1];
            }
          }

          // Try to extract Client column error (relation name used as column)
          if (errorMsg.includes('Client') && !errorMsg.includes('clientId')) {
            const clientMatch = errorMsg.match(/[`"]?Client[`"]?/i);
            if (clientMatch && columnName === 'unknown') {
              columnName = 'Client';
              // Try to find table name from context
              if (errorMsg.includes('Deal')) tableName = 'Deal';
              else if (errorMsg.includes('FinanceLedger')) tableName = 'FinanceLedger';
              else if (errorMsg.includes('Property')) tableName = 'Property';
            }
          }

          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/7293d0cd-bbb9-40ce-87ee-9763b81d9a43', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'error-handler.ts:parsed', message: 'After parsing error message', data: { columnName, tableName, errorMsg }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'B' }) }).catch(() => { });
          // #endregion
        }

        errorMessage = `Database column "${columnName}" not found in table "${tableName}". Please run database migrations.`;
        errorDetails = {
          code: error.code,
          meta: error.meta,
          missingColumn: columnName,
          table: tableName,
          originalMessage: errorMsg,
          hint: 'This usually means the database schema is out of sync with the code. Run: npm run fix-missing-columns (in server directory)'
        };
        break;
      default:
        errorMessage = `Database error: ${error.code || 'Unknown error'}`;
        errorDetails = { code: error.code, meta: error.meta };
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    statusCode = 400;
    errorMessage = 'Invalid data provided';
    errorDetails = error.message;
  }

  // Log full error details server-side
  logger.error('API Error:', {
    message: errorMessage,
    statusCode,
    details: errorDetails,
    stack: error instanceof Error ? error.stack : undefined,
    path: (res.req as any)?.path,
    method: (res.req as any)?.method,
    // Log full Prisma error for P2022 to help debug
    ...(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2022' ? {
      prismaError: {
        code: error.code,
        meta: error.meta,
        message: error.message,
        clientVersion: error.clientVersion,
      }
    } : {}),
  });

  // #region agent log
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2022') {
    fetch('http://127.0.0.1:7242/ingest/7293d0cd-bbb9-40ce-87ee-9763b81d9a43', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'error-handler.ts:finalLog', message: 'P2022 error final details', data: { errorMessage, errorDetails, path: (res.req as any)?.path, method: (res.req as any)?.method, prismaError: error instanceof Prisma.PrismaClientKnownRequestError ? { code: error.code, meta: error.meta, message: error.message } : null }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'B' }) }).catch(() => { });
  }
  // #endregion

  // Sanitize error response for production
  const isProduction = process.env.NODE_ENV === 'production';

  const response: ApiResponse = {
    success: false,
    error: isProduction
      ? sanitizeErrorMessage(errorMessage, statusCode)
      : errorMessage,
    ...(isProduction ? {} : { details: errorDetails }),
  };

  return res.status(statusCode).json(response);
}

/**
 * Sanitize error messages in production
 * Prevents leaking internal errors, stack traces, or sensitive information
 */
function sanitizeErrorMessage(message: string, statusCode: number): string {
  // Generic error messages for production
  if (statusCode >= 500) {
    return 'Internal server error. Please try again later.';
  }

  if (statusCode === 401) {
    return 'Authentication required';
  }

  if (statusCode === 403) {
    return 'Access forbidden';
  }

  if (statusCode === 404) {
    return 'Resource not found';
  }

  // For 400 errors, return sanitized message (validation errors are usually safe)
  if (statusCode === 400) {
    // Remove any potential sensitive information
    return message
      .replace(/password/gi, '***')
      .replace(/token/gi, '***')
      .replace(/secret/gi, '***')
      .replace(/key/gi, '***')
      .substring(0, 200); // Limit length
  }

  // Default: return generic message
  return 'An error occurred';
}

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
export function asyncHandler(
  fn: (req: unknown, res: Response, next?: () => void) => Promise<unknown>,
) {
  return (req: unknown, res: Response, next: () => void) => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      errorResponse(res, error);
    });
  };
}

