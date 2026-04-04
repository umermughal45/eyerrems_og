/**
 * Frontend Validation Schemas
 * 
 * These schemas mirror the backend schemas to ensure consistency.
 * In production, consider using a shared package or code generation.
 */

import { z } from 'zod';

/**
 * Common preprocessors
 */
const emptyToNull = (val: unknown) => 
  val === '' || val === 'null' || val === 'undefined' ? null : val;

const stringToNumber = (val: unknown) => 
  val === '' || val === null || val === undefined ? undefined : Number(val);

const stringToBoolean = (val: unknown) => 
  val === 'true' || val === true;

/**
 * Common field schemas
 */
export const commonFields = {
  uuid: z.string().uuid('Invalid UUID format'),
  optionalUuid: z.preprocess(emptyToNull, z.string().uuid().nullable().optional()),
  email: z.string().email('Invalid email format').optional().nullable().or(z.literal('')),
  phone: z.string().optional().nullable(),
  tid: z.string().min(1, 'TID is required'),
  manualUniqueId: z.string().optional().nullable(),
  imageUrl: z.string().optional().refine(
    (val) => {
      if (!val || val === '') return true;
      return val.startsWith('http') || val.startsWith('/') || val.startsWith('data:');
    },
    { message: 'Image URL must be a valid URL or relative path starting with /' }
  ),
};

/**
 * Property Schemas
 */
export const propertyStatusEnum = z.enum([
  'Active',
  'Maintenance',
  'Vacant',
  'For Sale',
  'For Rent',
  'Sold',
]);

export const createPropertySchema = z.object({
  tid: commonFields.tid,
  name: z.string().min(1, 'Property name is required'),
  type: z.string().min(1, 'Property type is required'),
  category: z.string().optional(),
  size: z.preprocess(stringToNumber, z.number().nonnegative().optional()),
  address: z.string().min(1, 'Address is required'),
  location: z.string().optional(),
  locationId: commonFields.optionalUuid,
  subsidiaryOptionId: commonFields.optionalUuid,
  status: propertyStatusEnum.optional(),
  imageUrl: commonFields.imageUrl,
  description: z.string().optional(),
  yearBuilt: z.preprocess(
    stringToNumber,
    z.number().int().positive().optional()
  ),
  totalArea: z.preprocess(
    stringToNumber,
    z.number().positive().optional()
  ),
  totalUnits: z.preprocess(
    stringToNumber,
    z.number().int().nonnegative().default(0)
  ),
  dealerId: commonFields.optionalUuid,
  salePrice: z.preprocess(
    stringToNumber,
    z.number().nonnegative().optional()
  ),
  amenities: z.preprocess(
    (val) => {
      if (typeof val === 'string') {
        try {
          const parsed = JSON.parse(val);
          return Array.isArray(parsed) ? parsed : [val];
        } catch {
          return [val];
        }
      }
      return val;
    },
    z.array(z.string()).optional().default([])
  ),
});

export const updatePropertySchema = createPropertySchema.partial();

/**
 * Unit Schemas
 */
export const unitStatusEnum = z.enum(['Occupied', 'Vacant', 'Maintenance', 'Reserved']);

export const createUnitSchema = z.object({
  tid: commonFields.tid,
  unitNumber: z.string().min(1, 'Unit number is required'),
  unitName: z.string().optional().nullable(),
  propertyId: commonFields.uuid,
  blockId: commonFields.optionalUuid,
  floorId: commonFields.optionalUuid,
  status: unitStatusEnum,
  monthlyRent: z.preprocess(
    stringToNumber,
    z.number().positive().optional()
  ),
  sizeSqFt: z.preprocess(
    stringToNumber,
    z.number().positive().optional()
  ),
  securityDeposit: z.preprocess(
    stringToNumber,
    z.number().nonnegative().optional()
  ),
  description: z.string().optional().nullable(),
  amenities: z.array(z.string()).optional().default([]),
});

export const updateUnitSchema = createUnitSchema.partial();

/**
 * Client Schemas
 */
export const createClientSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: commonFields.email,
  phone: commonFields.phone,
  company: z.string().optional().nullable(),
  status: z.string().default('active'),
  address: z.string().optional().nullable(),
  cnic: z.string().optional().nullable(),
  assignedAgentId: commonFields.optionalUuid,
  assignedDealerId: commonFields.optionalUuid,
  billingAddress: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  clientCategory: z.string().optional().nullable(),
  clientType: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  postalCode: z.string().optional().nullable(),
  propertyInterest: z.string().optional().nullable(),
  manualUniqueId: commonFields.manualUniqueId,
  propertySubsidiary: z.string().optional().nullable(),
  tid: commonFields.tid,
});

export const updateClientSchema = createClientSchema.partial();

/**
 * Deal Schemas
 */
export const dealStatusEnum = z.enum(['open', 'won', 'lost', 'closed', 'cancelled']);
export const dealStageEnum = z.enum([
  'prospecting',
  'qualification',
  'proposal',
  'negotiation',
  'closed-won',
  'closed-lost',
]);

export const createDealSchema = z.object({
  tid: commonFields.tid,
  title: z.string().min(1, 'Deal title is required'),
  clientId: commonFields.uuid,
  propertyId: commonFields.uuid,
  dealerId: commonFields.optionalUuid,
  dealAmount: z.preprocess(
    stringToNumber,
    z.number().positive('Deal amount must be greater than 0')
  ),
  status: dealStatusEnum.optional().default('open'),
  stage: dealStageEnum.optional(),
  description: z.string().optional().nullable(),
  expectedCloseDate: z.string().datetime().optional().nullable(),
  actualCloseDate: z.string().datetime().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const updateDealSchema = createDealSchema.partial();

/**
 * TypeScript types
 */
export type CreatePropertyInput = z.infer<typeof createPropertySchema>;
export type UpdatePropertyInput = z.infer<typeof updatePropertySchema>;
export type CreateUnitInput = z.infer<typeof createUnitSchema>;
export type UpdateUnitInput = z.infer<typeof updateUnitSchema>;
export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
export type CreateDealInput = z.infer<typeof createDealSchema>;
export type UpdateDealInput = z.infer<typeof updateDealSchema>;


