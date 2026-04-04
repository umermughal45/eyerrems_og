/**
 * Property validation schemas
 */

import { z } from 'zod';
import { commonFields, preprocessors } from './common';

/**
 * Property status enum
 */
export const propertyStatusEnum = z.enum([
  'Active',
  'Maintenance',
  'Vacant',
  'For Sale',
  'For Rent',
  'Sold',
]);

/**
 * Create Property Schema - All fields optional for flexible data entry
 */
export const createPropertySchema = z.object({
  tid: z.string().optional().nullable(),
  name: z.string().optional().nullable(),
  type: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  size: z.preprocess(
    (val) => {
      if (val === undefined || val === null || val === '') return undefined;
      const num = preprocessors.stringToNumber(val);
      return num !== undefined && !isNaN(num) ? num : undefined;
    },
    z.number().nonnegative().optional().nullable()
  ),
  address: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  locationId: commonFields.optionalUuid,
  subsidiaryOptionId: commonFields.optionalUuid,
  status: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  yearBuilt: z.preprocess(
    (val) => {
      if (val === undefined || val === null || val === '') return undefined;
      const num = preprocessors.stringToNumber(val);
      return num !== undefined && !isNaN(num) ? num : undefined;
    },
    z.number().int().optional().nullable()
  ),
  totalArea: z.preprocess(
    (val) => {
      if (val === undefined || val === null || val === '') return undefined;
      const num = preprocessors.stringToNumber(val);
      return num !== undefined && !isNaN(num) ? num : undefined;
    },
    z.number().optional().nullable()
  ),
  totalUnits: z.preprocess(
    (val) => {
      if (val === undefined || val === null || val === '') return 0;
      const num = preprocessors.stringToNumber(val);
      return num !== undefined && !isNaN(num) ? num : 0;
    },
    z.number().int().nonnegative().default(0)
  ),
  dealerId: commonFields.optionalUuid,
  salePrice: z.preprocess(
    (val) => {
      if (val === undefined || val === null || val === '') return undefined;
      const num = preprocessors.stringToNumber(val);
      return num !== undefined && !isNaN(num) ? num : undefined;
    },
    z.number().nonnegative().optional().nullable()
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
      return val || [];
    },
    z.array(z.string()).optional().default([])
  ),
}).passthrough(); // Allow additional fields without validation errors

/**
 * Update Property Schema (all fields optional)
 */
export const updatePropertySchema = createPropertySchema.partial();

/**
 * Property Query Schema (for filtering)
 * All fields are optional - returns empty array if no data matches
 * Uses same pattern as paginationSchema for consistent handling
 */
export const propertyQuerySchema = z.object({
  status: propertyStatusEnum.optional(),
  type: z.string().optional(),
  location: z.string().optional(),
  locationId: commonFields.optionalUuid,
  search: z.string().optional(),
  // Handle page - optional, defaults to 1 if missing or invalid
  page: z
    .string()
    .optional()
    .transform((val) => {
      const parsed = val ? parseInt(val, 10) : 1;
      return isNaN(parsed) || parsed < 1 ? 1 : parsed;
    }),
  // Handle limit - optional, defaults to 10 if missing or invalid, max 100
  limit: z
    .string()
    .optional()
    .transform((val) => {
      const parsed = val ? parseInt(val, 10) : 10;
      if (isNaN(parsed) || parsed < 1) return 10;
      if (parsed > 100) return 100;
      return parsed;
    }),
}).passthrough(); // Allow additional query params without validation errors

/**
 * TypeScript types inferred from schemas
 */
export type CreatePropertyInput = z.infer<typeof createPropertySchema>;
export type UpdatePropertyInput = z.infer<typeof updatePropertySchema>;
export type PropertyQueryInput = z.infer<typeof propertyQuerySchema>;


