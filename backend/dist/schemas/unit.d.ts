/**
 * Unit validation schemas
 */
import { z } from 'zod';
/**
 * Unit Status Enum
 */
export declare const unitStatusEnum: z.ZodEnum<["Occupied", "Vacant", "Maintenance", "Reserved"]>;
/**
 * Create Unit Schema
 */
export declare const createUnitSchema: z.ZodObject<{
    tid: z.ZodString;
    unitNumber: z.ZodString;
    unitName: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    propertyId: z.ZodString;
    blockId: z.ZodEffects<z.ZodOptional<z.ZodNullable<z.ZodString>>, string | null | undefined, unknown>;
    floorId: z.ZodEffects<z.ZodOptional<z.ZodNullable<z.ZodString>>, string | null | undefined, unknown>;
    status: z.ZodEnum<["Occupied", "Vacant", "Maintenance", "Reserved"]>;
    monthlyRent: z.ZodEffects<z.ZodOptional<z.ZodNumber>, number | undefined, unknown>;
    sizeSqFt: z.ZodEffects<z.ZodOptional<z.ZodNumber>, number | undefined, unknown>;
    securityDeposit: z.ZodEffects<z.ZodOptional<z.ZodNumber>, number | undefined, unknown>;
    description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    amenities: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
}, "strip", z.ZodTypeAny, {
    status: "Maintenance" | "Vacant" | "Occupied" | "Reserved";
    tid: string;
    propertyId: string;
    amenities: string[];
    unitNumber: string;
    description?: string | null | undefined;
    securityDeposit?: number | undefined;
    unitName?: string | null | undefined;
    blockId?: string | null | undefined;
    monthlyRent?: number | undefined;
    floorId?: string | null | undefined;
    sizeSqFt?: number | undefined;
}, {
    status: "Maintenance" | "Vacant" | "Occupied" | "Reserved";
    tid: string;
    propertyId: string;
    unitNumber: string;
    description?: string | null | undefined;
    securityDeposit?: unknown;
    amenities?: string[] | undefined;
    unitName?: string | null | undefined;
    blockId?: unknown;
    monthlyRent?: unknown;
    floorId?: unknown;
    sizeSqFt?: unknown;
}>;
/**
 * Update Unit Schema
 */
export declare const updateUnitSchema: z.ZodObject<{
    tid: z.ZodOptional<z.ZodString>;
    unitNumber: z.ZodOptional<z.ZodString>;
    unitName: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    propertyId: z.ZodOptional<z.ZodString>;
    blockId: z.ZodOptional<z.ZodEffects<z.ZodOptional<z.ZodNullable<z.ZodString>>, string | null | undefined, unknown>>;
    floorId: z.ZodOptional<z.ZodEffects<z.ZodOptional<z.ZodNullable<z.ZodString>>, string | null | undefined, unknown>>;
    status: z.ZodOptional<z.ZodEnum<["Occupied", "Vacant", "Maintenance", "Reserved"]>>;
    monthlyRent: z.ZodOptional<z.ZodEffects<z.ZodOptional<z.ZodNumber>, number | undefined, unknown>>;
    sizeSqFt: z.ZodOptional<z.ZodEffects<z.ZodOptional<z.ZodNumber>, number | undefined, unknown>>;
    securityDeposit: z.ZodOptional<z.ZodEffects<z.ZodOptional<z.ZodNumber>, number | undefined, unknown>>;
    description: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    amenities: z.ZodOptional<z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>>;
}, "strip", z.ZodTypeAny, {
    status?: "Maintenance" | "Vacant" | "Occupied" | "Reserved" | undefined;
    tid?: string | undefined;
    propertyId?: string | undefined;
    description?: string | null | undefined;
    securityDeposit?: number | undefined;
    amenities?: string[] | undefined;
    unitName?: string | null | undefined;
    blockId?: string | null | undefined;
    monthlyRent?: number | undefined;
    floorId?: string | null | undefined;
    sizeSqFt?: number | undefined;
    unitNumber?: string | undefined;
}, {
    status?: "Maintenance" | "Vacant" | "Occupied" | "Reserved" | undefined;
    tid?: string | undefined;
    propertyId?: string | undefined;
    description?: string | null | undefined;
    securityDeposit?: unknown;
    amenities?: string[] | undefined;
    unitName?: string | null | undefined;
    blockId?: unknown;
    monthlyRent?: unknown;
    floorId?: unknown;
    sizeSqFt?: unknown;
    unitNumber?: string | undefined;
}>;
/**
 * TypeScript types
 */
export type CreateUnitInput = z.infer<typeof createUnitSchema>;
export type UpdateUnitInput = z.infer<typeof updateUnitSchema>;
//# sourceMappingURL=unit.d.ts.map