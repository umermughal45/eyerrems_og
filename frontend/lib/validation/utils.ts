/**
 * Validation Utility Functions
 */

import { ZodError, ZodSchema } from 'zod';

/**
 * Format Zod errors for display
 */
export function formatZodErrors(error: ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  
  error.errors.forEach((err) => {
    const path = err.path.join('.');
    errors[path] = err.message;
  });
  
  return errors;
}

/**
 * Get first error message from Zod error
 */
export function getFirstError(error: ZodError): string {
  if (error.errors.length > 0) {
    return error.errors[0].message;
  }
  return 'Validation error';
}

/**
 * Validate data against schema and return formatted errors
 */
export function validateData<T>(
  schema: ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: Record<string, string> } {
  try {
    const validated = schema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof ZodError) {
      return { success: false, errors: formatZodErrors(error) };
    }
    throw error;
  }
}

/**
 * Safe parse that returns result object
 */
export function safeParse<T>(
  schema: ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}


