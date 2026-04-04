/**
 * Query Parameter Validation Middleware
 * Uses Zod to validate all req.query parameters in every route
 * Ensures UUIDs, dates, enums, pagination, and optional fields are validated
 * Rejects invalid queries with 400 error
 */
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
/**
 * Common query parameter schemas
 */
export declare const commonQuerySchemas: {
    uuid: z.ZodString;
    optionalUuid: z.ZodOptional<z.ZodString>;
    date: z.ZodString;
    optionalDate: z.ZodOptional<z.ZodString>;
    pagination: z.ZodObject<{
        page: z.ZodOptional<z.ZodDefault<z.ZodEffects<z.ZodString, number, string>>>;
        limit: z.ZodOptional<z.ZodDefault<z.ZodEffects<z.ZodString, number, string>>>;
    }, "strip", z.ZodTypeAny, {
        limit?: number | undefined;
        page?: number | undefined;
    }, {
        limit?: string | undefined;
        page?: string | undefined;
    }>;
    search: z.ZodOptional<z.ZodString>;
    sortOrder: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
    status: z.ZodOptional<z.ZodEnum<["active", "inactive", "pending", "approved", "rejected", "completed", "cancelled"]>>;
    boolean: z.ZodOptional<z.ZodEffects<z.ZodEnum<["true", "false"]>, boolean, "true" | "false">>;
    number: z.ZodEffects<z.ZodString, number, string>;
    optionalNumber: z.ZodOptional<z.ZodEffects<z.ZodString, number, string>>;
};
/**
 * Validate query parameters using Zod schema
 * @param schema - Zod schema for query parameters
 * @returns Express middleware function
 */
export declare function validateQuery<T extends z.ZodTypeAny>(schema: T): (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * Helper to create query schema with common patterns
 */
export declare function createQuerySchema<T extends z.ZodRawShape>(shape: T): z.ZodObject<{ [k in keyof T]: z.ZodOptional<T[k]>; }, "strip", z.ZodTypeAny, z.objectUtil.addQuestionMarks<z.baseObjectOutputType<{ [k in keyof T]: z.ZodOptional<T[k]>; }>, any> extends infer T_1 ? { [k_1 in keyof T_1]: T_1[k_1]; } : never, z.baseObjectInputType<{ [k in keyof T]: z.ZodOptional<T[k]>; }> extends infer T_2 ? { [k_2 in keyof T_2]: T_2[k_2]; } : never>;
/**
 * Example usage:
 *
 * router.get(
 *   '/properties',
 *   validateQuery(
 *     createQuerySchema({
 *       search: commonQuerySchemas.search,
 *       locationId: commonQuerySchemas.optionalUuid,
 *       page: z.string().regex(/^\d+$/).transform(Number).default('1'),
 *       limit: z.string().regex(/^\d+$/).transform(Number).default('10'),
 *     })
 *   ),
 *   async (req, res) => {
 *     // req.query is now validated and typed
 *     const { search, locationId, page, limit } = req.query;
 *     // ...
 *   }
 * );
 */
//# sourceMappingURL=query-validation.d.ts.map