/**
 * Tenant validation schemas
 */
import { z } from 'zod';
/**
 * Tenant Status Enum
 */
export declare const tenantStatusEnum: z.ZodEnum<["active", "inactive", "pending", "terminated"]>;
/**
 * Create Tenant Schema
 */
export declare const createTenantSchema: z.ZodObject<{
    tid: z.ZodString;
    name: z.ZodString;
    email: z.ZodUnion<[z.ZodNullable<z.ZodOptional<z.ZodString>>, z.ZodLiteral<"">]>;
    phone: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    cnic: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    address: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    status: z.ZodDefault<z.ZodOptional<z.ZodEnum<["active", "inactive", "pending", "terminated"]>>>;
    emergencyContact: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    emergencyPhone: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    notes: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    propertyId: z.ZodEffects<z.ZodOptional<z.ZodNullable<z.ZodString>>, string | null | undefined, unknown>;
    unitId: z.ZodEffects<z.ZodOptional<z.ZodNullable<z.ZodString>>, string | null | undefined, unknown>;
}, "strip", z.ZodTypeAny, {
    status: "active" | "pending" | "inactive" | "terminated";
    name: string;
    tid: string;
    email?: string | null | undefined;
    phone?: string | null | undefined;
    address?: string | null | undefined;
    cnic?: string | null | undefined;
    notes?: string | null | undefined;
    propertyId?: string | null | undefined;
    unitId?: string | null | undefined;
    emergencyContact?: string | null | undefined;
    emergencyPhone?: string | null | undefined;
}, {
    name: string;
    tid: string;
    status?: "active" | "pending" | "inactive" | "terminated" | undefined;
    email?: string | null | undefined;
    phone?: string | null | undefined;
    address?: string | null | undefined;
    cnic?: string | null | undefined;
    notes?: string | null | undefined;
    propertyId?: unknown;
    unitId?: unknown;
    emergencyContact?: string | null | undefined;
    emergencyPhone?: string | null | undefined;
}>;
/**
 * Update Tenant Schema
 */
export declare const updateTenantSchema: z.ZodObject<{
    tid: z.ZodOptional<z.ZodString>;
    name: z.ZodOptional<z.ZodString>;
    email: z.ZodOptional<z.ZodUnion<[z.ZodNullable<z.ZodOptional<z.ZodString>>, z.ZodLiteral<"">]>>;
    phone: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    cnic: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    address: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    status: z.ZodOptional<z.ZodDefault<z.ZodOptional<z.ZodEnum<["active", "inactive", "pending", "terminated"]>>>>;
    emergencyContact: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    emergencyPhone: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    notes: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    propertyId: z.ZodOptional<z.ZodEffects<z.ZodOptional<z.ZodNullable<z.ZodString>>, string | null | undefined, unknown>>;
    unitId: z.ZodOptional<z.ZodEffects<z.ZodOptional<z.ZodNullable<z.ZodString>>, string | null | undefined, unknown>>;
}, "strip", z.ZodTypeAny, {
    status?: "active" | "pending" | "inactive" | "terminated" | undefined;
    name?: string | undefined;
    email?: string | null | undefined;
    phone?: string | null | undefined;
    address?: string | null | undefined;
    cnic?: string | null | undefined;
    tid?: string | undefined;
    notes?: string | null | undefined;
    propertyId?: string | null | undefined;
    unitId?: string | null | undefined;
    emergencyContact?: string | null | undefined;
    emergencyPhone?: string | null | undefined;
}, {
    status?: "active" | "pending" | "inactive" | "terminated" | undefined;
    name?: string | undefined;
    email?: string | null | undefined;
    phone?: string | null | undefined;
    address?: string | null | undefined;
    cnic?: string | null | undefined;
    tid?: string | undefined;
    notes?: string | null | undefined;
    propertyId?: unknown;
    unitId?: unknown;
    emergencyContact?: string | null | undefined;
    emergencyPhone?: string | null | undefined;
}>;
/**
 * TypeScript types
 */
export type CreateTenantInput = z.infer<typeof createTenantSchema>;
export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;
//# sourceMappingURL=tenant.d.ts.map