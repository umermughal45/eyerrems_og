/**
 * Unit validation schemas
 */

import { z } from 'zod';
import { commonFields, preprocessors } from './common';

/**
 * Unit Status Enum
 */
export const unitStatusEnum = z.enum(['Occupied', 'Vacant', 'Maintenance', 'Reserved']);

/**
 * Create Unit Schema
 */
export const createUnitSchema = z.object({
  tid: commonFields.tid,
  unitNumber: z.string().min(1, 'Unit number is required'),
  unitName: z.string().optional().nullable(),
  propertyId: commonFields.uuid,
  blockId: commonFields.optionalUuid,
  floorId: commonFields.optionalUuid,
  status: unitStatusEnum,
  monthlyRent: z.preprocess(
    preprocessors.stringToNumber,
    z.number().positive('Monthly rent must be positive').optional()
  ),
  sizeSqFt: z.preprocess(
    preprocessors.stringToNumber,
    z.number().positive('Size must be positive').optional()
  ),
  securityDeposit: z.preprocess(
    preprocessors.stringToNumber,
    z.number().nonnegative('Security deposit cannot be negative').optional()
  ),
  description: z.string().optional().nullable(),
  amenities: z.array(z.string()).optional().default([]),
});

/**
 * Update Unit Schema
 */
export const updateUnitSchema = createUnitSchema.partial();

/**
 * TypeScript types
 */
export type CreateUnitInput = z.infer<typeof createUnitSchema>;
export type UpdateUnitInput = z.infer<typeof updateUnitSchema>;


