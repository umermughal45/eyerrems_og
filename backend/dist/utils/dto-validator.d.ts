/**
 * DTO Validator Utility
 * Provides strict DTO validation and transformation
 */
import { z } from 'zod';
import { Response } from 'express';
export interface ValidationError {
    path: string;
    message: string;
}
export interface ValidationResult<T> {
    success: boolean;
    data?: T;
    errors?: ValidationError[];
}
/**
 * Validate request body against a Zod schema
 * Returns structured validation errors
 */
export declare function validateDTO<T>(schema: z.ZodSchema<T>, data: unknown): ValidationResult<T>;
/**
 * Validate and return error response if validation fails
 */
export declare function validateAndRespond<T>(schema: z.ZodSchema<T>, data: unknown, res: Response): T | null;
/**
 * Create a strict DTO schema for common entity operations
 */
export declare function createEntityDTOSchema<T extends z.ZodRawShape>(shape: T): z.ZodObject<T, "strict", z.ZodTypeAny, z.objectUtil.addQuestionMarks<z.baseObjectOutputType<T>, any> extends infer T_1 ? { [k in keyof T_1]: T_1[k]; } : never, z.baseObjectInputType<T> extends infer T_2 ? { [k_1 in keyof T_2]: T_2[k_1]; } : never>;
//# sourceMappingURL=dto-validator.d.ts.map