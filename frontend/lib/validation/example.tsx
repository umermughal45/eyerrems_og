/**
 * Frontend Validation Usage Examples
 * 
 * This file demonstrates how to use validation schemas in React components.
 */

'use client';

import { useZodForm } from './hooks';
import { createPropertySchema, CreatePropertyInput } from './schemas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

/**
 * Example 1: Using useZodForm hook with React Hook Form
 */
export function PropertyFormExample() {
  const { toast } = useToast();

  const form = useZodForm(createPropertySchema, {
    tid: '',
    name: '',
    type: '',
    address: '',
    status: 'Active',
  });

  const onSubmit = async (data: CreatePropertyInput) => {
    try {
      // Data is already validated and typed
      const response = await fetch('/api/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to create property');
      }

      toast({
        title: 'Success',
        description: 'Property created successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create property',
        variant: 'destructive',
      });
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <div>
        <label>TID</label>
        <Input
          {...form.register('tid')}
        />
        {form.formState.errors.tid?.message && (
          <p className="text-sm text-destructive mt-1">{form.formState.errors.tid.message}</p>
        )}
      </div>

      <div>
        <label>Name</label>
        <Input
          {...form.register('name')}
        />
        {form.formState.errors.name?.message && (
          <p className="text-sm text-destructive mt-1">{form.formState.errors.name.message}</p>
        )}
      </div>

      <div>
        <label>Type</label>
        <Input
          {...form.register('type')}
        />
        {form.formState.errors.type?.message && (
          <p className="text-sm text-destructive mt-1">{form.formState.errors.type.message}</p>
        )}
      </div>

      <div>
        <label>Address</label>
        <Input
          {...form.register('address')}
        />
        {form.formState.errors.address?.message && (
          <p className="text-sm text-destructive mt-1">{form.formState.errors.address.message}</p>
        )}
      </div>

      <Button type="submit" disabled={form.formState.isSubmitting}>
        Create Property
      </Button>
    </form>
  );
}

/**
 * Example 2: Manual validation before API call
 */
import { validateData } from './utils';


export async function createPropertyManually(formData: any) {
  // Validate data before sending
  const result = validateData(createPropertySchema, formData);

  if (!result.success) {
    // Handle validation errors
    Object.entries(result.errors).forEach(([field, message]) => {
      console.error(`${field}: ${message}`);
    });
    return;
  }

  // result.data is typed as CreatePropertyInput
  const response = await fetch('/api/properties', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(result.data),
  });

  return response.json();
}


