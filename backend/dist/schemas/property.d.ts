/**
 * Property validation schemas
 */
import { z } from 'zod';
/**
 * Property status enum
 */
export declare const propertyStatusEnum: z.ZodEnum<["Active", "Maintenance", "Vacant", "For Sale", "For Rent", "Sold"]>;
/**
 * Create Property Schema - All fields optional for flexible data entry
 */
export declare const createPropertySchema: z.ZodObject<{
    tid: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    name: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    type: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    category: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    size: z.ZodEffects<z.ZodNullable<z.ZodOptional<z.ZodNumber>>, number | null | undefined, unknown>;
    address: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    location: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    locationId: z.ZodEffects<z.ZodOptional<z.ZodNullable<z.ZodString>>, string | null | undefined, unknown>;
    subsidiaryOptionId: z.ZodEffects<z.ZodOptional<z.ZodNullable<z.ZodString>>, string | null | undefined, unknown>;
    status: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    imageUrl: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    yearBuilt: z.ZodEffects<z.ZodNullable<z.ZodOptional<z.ZodNumber>>, number | null | undefined, unknown>;
    totalArea: z.ZodEffects<z.ZodNullable<z.ZodOptional<z.ZodNumber>>, number | null | undefined, unknown>;
    totalUnits: z.ZodEffects<z.ZodDefault<z.ZodNumber>, number, unknown>;
    dealerId: z.ZodEffects<z.ZodOptional<z.ZodNullable<z.ZodString>>, string | null | undefined, unknown>;
    salePrice: z.ZodEffects<z.ZodNullable<z.ZodOptional<z.ZodNumber>>, number | null | undefined, unknown>;
    amenities: z.ZodEffects<z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>, string[], unknown>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    tid: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    name: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    type: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    category: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    size: z.ZodEffects<z.ZodNullable<z.ZodOptional<z.ZodNumber>>, number | null | undefined, unknown>;
    address: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    location: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    locationId: z.ZodEffects<z.ZodOptional<z.ZodNullable<z.ZodString>>, string | null | undefined, unknown>;
    subsidiaryOptionId: z.ZodEffects<z.ZodOptional<z.ZodNullable<z.ZodString>>, string | null | undefined, unknown>;
    status: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    imageUrl: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    yearBuilt: z.ZodEffects<z.ZodNullable<z.ZodOptional<z.ZodNumber>>, number | null | undefined, unknown>;
    totalArea: z.ZodEffects<z.ZodNullable<z.ZodOptional<z.ZodNumber>>, number | null | undefined, unknown>;
    totalUnits: z.ZodEffects<z.ZodDefault<z.ZodNumber>, number, unknown>;
    dealerId: z.ZodEffects<z.ZodOptional<z.ZodNullable<z.ZodString>>, string | null | undefined, unknown>;
    salePrice: z.ZodEffects<z.ZodNullable<z.ZodOptional<z.ZodNumber>>, number | null | undefined, unknown>;
    amenities: z.ZodEffects<z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>, string[], unknown>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    tid: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    name: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    type: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    category: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    size: z.ZodEffects<z.ZodNullable<z.ZodOptional<z.ZodNumber>>, number | null | undefined, unknown>;
    address: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    location: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    locationId: z.ZodEffects<z.ZodOptional<z.ZodNullable<z.ZodString>>, string | null | undefined, unknown>;
    subsidiaryOptionId: z.ZodEffects<z.ZodOptional<z.ZodNullable<z.ZodString>>, string | null | undefined, unknown>;
    status: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    imageUrl: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    yearBuilt: z.ZodEffects<z.ZodNullable<z.ZodOptional<z.ZodNumber>>, number | null | undefined, unknown>;
    totalArea: z.ZodEffects<z.ZodNullable<z.ZodOptional<z.ZodNumber>>, number | null | undefined, unknown>;
    totalUnits: z.ZodEffects<z.ZodDefault<z.ZodNumber>, number, unknown>;
    dealerId: z.ZodEffects<z.ZodOptional<z.ZodNullable<z.ZodString>>, string | null | undefined, unknown>;
    salePrice: z.ZodEffects<z.ZodNullable<z.ZodOptional<z.ZodNumber>>, number | null | undefined, unknown>;
    amenities: z.ZodEffects<z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>, string[], unknown>;
}, z.ZodTypeAny, "passthrough">>;
/**
 * Update Property Schema (all fields optional)
 */
export declare const updatePropertySchema: z.ZodObject<{
    tid: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    name: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    type: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    category: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    size: z.ZodOptional<z.ZodEffects<z.ZodNullable<z.ZodOptional<z.ZodNumber>>, number | null | undefined, unknown>>;
    address: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    location: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    locationId: z.ZodOptional<z.ZodEffects<z.ZodOptional<z.ZodNullable<z.ZodString>>, string | null | undefined, unknown>>;
    subsidiaryOptionId: z.ZodOptional<z.ZodEffects<z.ZodOptional<z.ZodNullable<z.ZodString>>, string | null | undefined, unknown>>;
    status: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    imageUrl: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    description: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    yearBuilt: z.ZodOptional<z.ZodEffects<z.ZodNullable<z.ZodOptional<z.ZodNumber>>, number | null | undefined, unknown>>;
    totalArea: z.ZodOptional<z.ZodEffects<z.ZodNullable<z.ZodOptional<z.ZodNumber>>, number | null | undefined, unknown>>;
    totalUnits: z.ZodOptional<z.ZodEffects<z.ZodDefault<z.ZodNumber>, number, unknown>>;
    dealerId: z.ZodOptional<z.ZodEffects<z.ZodOptional<z.ZodNullable<z.ZodString>>, string | null | undefined, unknown>>;
    salePrice: z.ZodOptional<z.ZodEffects<z.ZodNullable<z.ZodOptional<z.ZodNumber>>, number | null | undefined, unknown>>;
    amenities: z.ZodOptional<z.ZodEffects<z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>, string[], unknown>>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    tid: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    name: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    type: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    category: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    size: z.ZodOptional<z.ZodEffects<z.ZodNullable<z.ZodOptional<z.ZodNumber>>, number | null | undefined, unknown>>;
    address: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    location: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    locationId: z.ZodOptional<z.ZodEffects<z.ZodOptional<z.ZodNullable<z.ZodString>>, string | null | undefined, unknown>>;
    subsidiaryOptionId: z.ZodOptional<z.ZodEffects<z.ZodOptional<z.ZodNullable<z.ZodString>>, string | null | undefined, unknown>>;
    status: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    imageUrl: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    description: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    yearBuilt: z.ZodOptional<z.ZodEffects<z.ZodNullable<z.ZodOptional<z.ZodNumber>>, number | null | undefined, unknown>>;
    totalArea: z.ZodOptional<z.ZodEffects<z.ZodNullable<z.ZodOptional<z.ZodNumber>>, number | null | undefined, unknown>>;
    totalUnits: z.ZodOptional<z.ZodEffects<z.ZodDefault<z.ZodNumber>, number, unknown>>;
    dealerId: z.ZodOptional<z.ZodEffects<z.ZodOptional<z.ZodNullable<z.ZodString>>, string | null | undefined, unknown>>;
    salePrice: z.ZodOptional<z.ZodEffects<z.ZodNullable<z.ZodOptional<z.ZodNumber>>, number | null | undefined, unknown>>;
    amenities: z.ZodOptional<z.ZodEffects<z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>, string[], unknown>>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    tid: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    name: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    type: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    category: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    size: z.ZodOptional<z.ZodEffects<z.ZodNullable<z.ZodOptional<z.ZodNumber>>, number | null | undefined, unknown>>;
    address: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    location: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    locationId: z.ZodOptional<z.ZodEffects<z.ZodOptional<z.ZodNullable<z.ZodString>>, string | null | undefined, unknown>>;
    subsidiaryOptionId: z.ZodOptional<z.ZodEffects<z.ZodOptional<z.ZodNullable<z.ZodString>>, string | null | undefined, unknown>>;
    status: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    imageUrl: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    description: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    yearBuilt: z.ZodOptional<z.ZodEffects<z.ZodNullable<z.ZodOptional<z.ZodNumber>>, number | null | undefined, unknown>>;
    totalArea: z.ZodOptional<z.ZodEffects<z.ZodNullable<z.ZodOptional<z.ZodNumber>>, number | null | undefined, unknown>>;
    totalUnits: z.ZodOptional<z.ZodEffects<z.ZodDefault<z.ZodNumber>, number, unknown>>;
    dealerId: z.ZodOptional<z.ZodEffects<z.ZodOptional<z.ZodNullable<z.ZodString>>, string | null | undefined, unknown>>;
    salePrice: z.ZodOptional<z.ZodEffects<z.ZodNullable<z.ZodOptional<z.ZodNumber>>, number | null | undefined, unknown>>;
    amenities: z.ZodOptional<z.ZodEffects<z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>, string[], unknown>>;
}, z.ZodTypeAny, "passthrough">>;
/**
 * Property Query Schema (for filtering)
 * All fields are optional - returns empty array if no data matches
 * Uses same pattern as paginationSchema for consistent handling
 */
export declare const propertyQuerySchema: z.ZodObject<{
    status: z.ZodOptional<z.ZodEnum<["Active", "Maintenance", "Vacant", "For Sale", "For Rent", "Sold"]>>;
    type: z.ZodOptional<z.ZodString>;
    location: z.ZodOptional<z.ZodString>;
    locationId: z.ZodEffects<z.ZodOptional<z.ZodNullable<z.ZodString>>, string | null | undefined, unknown>;
    search: z.ZodOptional<z.ZodString>;
    page: z.ZodEffects<z.ZodOptional<z.ZodString>, number, string | undefined>;
    limit: z.ZodEffects<z.ZodOptional<z.ZodString>, number, string | undefined>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    status: z.ZodOptional<z.ZodEnum<["Active", "Maintenance", "Vacant", "For Sale", "For Rent", "Sold"]>>;
    type: z.ZodOptional<z.ZodString>;
    location: z.ZodOptional<z.ZodString>;
    locationId: z.ZodEffects<z.ZodOptional<z.ZodNullable<z.ZodString>>, string | null | undefined, unknown>;
    search: z.ZodOptional<z.ZodString>;
    page: z.ZodEffects<z.ZodOptional<z.ZodString>, number, string | undefined>;
    limit: z.ZodEffects<z.ZodOptional<z.ZodString>, number, string | undefined>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    status: z.ZodOptional<z.ZodEnum<["Active", "Maintenance", "Vacant", "For Sale", "For Rent", "Sold"]>>;
    type: z.ZodOptional<z.ZodString>;
    location: z.ZodOptional<z.ZodString>;
    locationId: z.ZodEffects<z.ZodOptional<z.ZodNullable<z.ZodString>>, string | null | undefined, unknown>;
    search: z.ZodOptional<z.ZodString>;
    page: z.ZodEffects<z.ZodOptional<z.ZodString>, number, string | undefined>;
    limit: z.ZodEffects<z.ZodOptional<z.ZodString>, number, string | undefined>;
}, z.ZodTypeAny, "passthrough">>;
/**
 * TypeScript types inferred from schemas
 */
export type CreatePropertyInput = z.infer<typeof createPropertySchema>;
export type UpdatePropertyInput = z.infer<typeof updatePropertySchema>;
export type PropertyQueryInput = z.infer<typeof propertyQuerySchema>;
//# sourceMappingURL=property.d.ts.map