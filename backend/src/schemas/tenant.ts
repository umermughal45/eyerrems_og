/**
 * Tenant validation schemas
 */

import { z } from 'zod';
import { commonFields, preprocessors } from './common';

/**
 * Tenant Status Enum
 */
export const tenantStatusEnum = z.enum(['active', 'inactive', 'pending', 'terminated']);

/**
 * Create Tenant Schema
 */
export const createTenantSchema = z.object({
  tid: commonFields.tid,
  name: z.string().min(1, 'Tenant name is required'),
  email: commonFields.email,
  phone: commonFields.phone,
  cnic: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  status: tenantStatusEnum.optional().default('active'),
  emergencyContact: z.string().optional().nullable(),
  emergencyPhone: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  propertyId: commonFields.optionalUuid,
  unitId: commonFields.optionalUuid,
});

/**
 * Update Tenant Schema
 */
export const updateTenantSchema = createTenantSchema.partial();

/**
 * TypeScript types
 */
export type CreateTenantInput = z.infer<typeof createTenantSchema>;
export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;


