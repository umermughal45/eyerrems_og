/**
 * Common validation utilities and base schemas
 */
import { z } from 'zod';
/**
 * Common preprocessors for handling form data
 */
export declare const preprocessors: {
    /**
     * Convert empty string, 'null', or 'undefined' to null
     */
    emptyToNull: (val: unknown) => unknown;
    /**
     * Convert string to number, or undefined if empty
     */
    stringToNumber: (val: unknown) => number | undefined;
    /**
     * Convert string to boolean
     */
    stringToBoolean: (val: unknown) => val is true | "true";
    /**
     * Convert empty string to undefined
     */
    emptyToUndefined: (val: unknown) => unknown;
};
/**
 * Common field schemas that can be reused
 */
export declare const commonFields: {
    /**
     * UUID field (required)
     */
    uuid: z.ZodString;
    /**
     * UUID field (optional)
     */
    optionalUuid: z.ZodEffects<z.ZodOptional<z.ZodNullable<z.ZodString>>, string | null | undefined, unknown>;
    /**
     * Email field (optional, nullable)
     */
    email: z.ZodUnion<[z.ZodNullable<z.ZodOptional<z.ZodString>>, z.ZodLiteral<"">]>;
    /**
     * Phone number field (optional, nullable)
     */
    phone: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    /**
     * TID (Transaction ID) - required, must be non-empty
     */
    tid: z.ZodString;
    /**
     * TID (Transaction ID) - optional
     */
    optionalTid: z.ZodOptional<z.ZodString>;
    /**
     * Manual unique ID (optional, nullable)
     */
    manualUniqueId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    /**
     * Status field with common statuses
     */
    status: z.ZodOptional<z.ZodEnum<["active", "inactive", "pending", "approved", "rejected", "completed", "cancelled"]>>;
    /**
     * Positive number (optional)
     */
    positiveNumber: z.ZodEffects<z.ZodOptional<z.ZodNumber>, number | undefined, unknown>;
    /**
     * Non-negative number (optional)
     */
    nonNegativeNumber: z.ZodEffects<z.ZodOptional<z.ZodNumber>, number | undefined, unknown>;
    /**
     * Integer (optional)
     */
    integer: z.ZodEffects<z.ZodOptional<z.ZodNumber>, number | undefined, unknown>;
    /**
     * Date string (ISO datetime)
     */
    dateTime: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    /**
     * Image URL validation
     */
    imageUrl: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, string | undefined>;
};
/**
 * Pagination schema
 */
export declare const paginationSchema: z.ZodObject<{
    page: z.ZodOptional<z.ZodDefault<z.ZodEffects<z.ZodString, number, string>>>;
    limit: z.ZodOptional<z.ZodDefault<z.ZodEffects<z.ZodString, number, string>>>;
}, "strip", z.ZodTypeAny, {
    limit?: number | undefined;
    page?: number | undefined;
}, {
    limit?: string | undefined;
    page?: string | undefined;
}>;
/**
 * Search query schema
 */
export declare const searchSchema: z.ZodObject<{
    search: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    search?: string | undefined;
}, {
    search?: string | undefined;
}>;
/**
 * Sort order schema
 */
export declare const sortOrderSchema: z.ZodObject<{
    sortBy: z.ZodOptional<z.ZodString>;
    sortOrder: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
}, "strip", z.ZodTypeAny, {
    sortOrder: "asc" | "desc";
    sortBy?: string | undefined;
}, {
    sortBy?: string | undefined;
    sortOrder?: "asc" | "desc" | undefined;
}>;
//# sourceMappingURL=common.d.ts.map