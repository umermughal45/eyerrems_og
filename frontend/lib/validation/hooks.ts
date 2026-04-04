/**
 * React Hook Form Integration Hooks
 */

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, UseFormReturn, UseFormProps } from 'react-hook-form';
import { ZodSchema, z } from 'zod';

/**
 * Create a form hook with Zod validation
 */
export function useZodForm<T extends ZodSchema>(
  schema: T,
  defaultValues?: Partial<z.infer<T>>,
  options?: Omit<UseFormProps<z.infer<T>>, 'resolver' | 'defaultValues'>
): UseFormReturn<z.infer<T>> {
  return useForm<z.infer<T>>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues as any,
    ...options,
  });
}

// Re-export zodResolver for convenience
export { zodResolver };

