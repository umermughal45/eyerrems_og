/**
 * Common validation utilities and base schemas
 */

import { z } from 'zod';

/**
 * Common preprocessors for handling form data
 */
export const preprocessors = {
  /**
   * Convert empty string, 'null', or 'undefined' to null
   */
  emptyToNull: (val: unknown) => 
    val === '' || val === 'null' || val === 'undefined' ? null : val,
  
  /**
   * Convert string to number, or undefined if empty
   */
  stringToNumber: (val: unknown) => 
    val === '' || val === null || val === undefined ? undefined : Number(val),
  
  /**
   * Convert string to boolean
   */
  stringToBoolean: (val: unknown) => 
    val === 'true' || val === true,
  
  /**
   * Convert empty string to undefined
   */
  emptyToUndefined: (val: unknown) => 
    val === '' ? undefined : val,
};

/**
 * Common field schemas that can be reused
 */
export const commonFields = {
  /**
   * UUID field (required)
   */
  uuid: z.string().uuid('Invalid UUID format'),
  
  /**
   * UUID field (optional)
   */
  optionalUuid: z.preprocess(
    preprocessors.emptyToNull,
    z.string().uuid('Invalid UUID format').nullable().optional()
  ),
  
  /**
   * Email field (optional, nullable)
   */
  email: z.string().email('Invalid email format').optional().nullable().or(z.literal('')),
  
  /**
   * Phone number field (optional, nullable)
   */
  phone: z.string().optional().nullable(),
  
  /**
   * TID (Transaction ID) - required, must be non-empty
   */
  tid: z.string().min(1, 'TID is required'),
  
  /**
   * TID (Transaction ID) - optional
   */
  optionalTid: z.string().min(1, 'TID is required').optional(),
  
  /**
   * Manual unique ID (optional, nullable)
   */
  manualUniqueId: z.string().optional().nullable(),
  
  /**
   * Status field with common statuses
   */
  status: z.enum(['active', 'inactive', 'pending', 'approved', 'rejected', 'completed', 'cancelled']).optional(),
  
  /**
   * Positive number (optional)
   */
  positiveNumber: z.preprocess(
    preprocessors.stringToNumber,
    z.number().positive('Must be a positive number').optional()
  ),
  
  /**
   * Non-negative number (optional)
   */
  nonNegativeNumber: z.preprocess(
    preprocessors.stringToNumber,
    z.number().nonnegative('Must be zero or positive').optional()
  ),
  
  /**
   * Integer (optional)
   */
  integer: z.preprocess(
    preprocessors.stringToNumber,
    z.number().int('Must be an integer').optional()
  ),
  
  /**
   * Date string (ISO datetime)
   */
  dateTime: z.string().datetime('Invalid date format').optional().nullable(),
  
  /**
   * Image URL validation
   */
  imageUrl: z.string().optional().refine(
    (val) => {
      if (!val || val === '') return true;
      return val.startsWith('http') || val.startsWith('/') || val.startsWith('data:');
    },
    { message: 'Image URL must be a valid URL or relative path starting with /' }
  ),
};

/**
 * Pagination schema
 */
export const paginationSchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).default('1'),
  limit: z.string().regex(/^\d+$/).transform(Number).default('10'),
}).partial();

/**
 * Search query schema
 */
export const searchSchema = z.object({
  search: z.string().min(1).max(255).optional(),
});

/**
 * Sort order schema
 */
export const sortOrderSchema = z.object({
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});


