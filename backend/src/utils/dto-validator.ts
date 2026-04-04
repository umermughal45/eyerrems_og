/**
 * DTO Validator Utility
 * Provides strict DTO validation and transformation
 */

import { z } from 'zod';
import { Response } from 'express';

export interface ValidationError {
  path: string;
  message: string;
}

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: ValidationError[];
}

/**
 * Validate request body against a Zod schema
 * Returns structured validation errors
 */
export function validateDTO<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): ValidationResult<T> {
  const result = schema.safeParse(data);

  if (result.success) {
    return {
      success: true,
      data: result.data,
    };
  }

  return {
    success: false,
    errors: result.error.errors.map((err) => ({
      path: err.path.join('.'),
      message: err.message,
    })),
  };
}

/**
 * Validate and return error response if validation fails
 */
export function validateAndRespond<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  res: Response
): T | null {
  const validation = validateDTO(schema, data);

  if (!validation.success) {
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: validation.errors,
    });
    return null;
  }

  return validation.data!;
}

/**
 * Create a strict DTO schema for common entity operations
 */
export function createEntityDTOSchema<T extends z.ZodRawShape>(shape: T) {
  return z.object(shape).strict(); // Reject unknown fields
}

