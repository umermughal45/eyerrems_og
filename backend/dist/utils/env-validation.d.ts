/**
 * Environment Variable Validation
 * Validates all required environment variables at startup using Zod
 * Fails startup if critical variables are missing or invalid
 */
import { z } from 'zod';
declare const envSchema: z.ZodObject<{
    DATABASE_URL: z.ZodString;
    JWT_SECRET: z.ZodString;
    JWT_EXPIRES_IN: z.ZodDefault<z.ZodString>;
    JWT_REFRESH_EXPIRES_IN: z.ZodDefault<z.ZodString>;
    PORT: z.ZodDefault<z.ZodEffects<z.ZodString, number, string>>;
    NODE_ENV: z.ZodDefault<z.ZodEnum<["development", "production", "test"]>>;
    FRONTEND_URL: z.ZodDefault<z.ZodString>;
    CSRF_SECRET: z.ZodOptional<z.ZodString>;
    MAX_FILE_SIZE: z.ZodDefault<z.ZodEffects<z.ZodString, number, string>>;
    UPLOAD_DIR: z.ZodDefault<z.ZodString>;
    REDIS_URL: z.ZodOptional<z.ZodString>;
    USE_REDIS_QUEUE: z.ZodOptional<z.ZodEnum<["true", "false"]>>;
    ALLOWED_ORIGINS: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    NODE_ENV: "production" | "development" | "test";
    DATABASE_URL: string;
    JWT_SECRET: string;
    JWT_EXPIRES_IN: string;
    JWT_REFRESH_EXPIRES_IN: string;
    PORT: number;
    FRONTEND_URL: string;
    MAX_FILE_SIZE: number;
    UPLOAD_DIR: string;
    CSRF_SECRET?: string | undefined;
    REDIS_URL?: string | undefined;
    USE_REDIS_QUEUE?: "true" | "false" | undefined;
    ALLOWED_ORIGINS?: string | undefined;
}, {
    DATABASE_URL: string;
    JWT_SECRET: string;
    NODE_ENV?: "production" | "development" | "test" | undefined;
    JWT_EXPIRES_IN?: string | undefined;
    JWT_REFRESH_EXPIRES_IN?: string | undefined;
    PORT?: string | undefined;
    FRONTEND_URL?: string | undefined;
    CSRF_SECRET?: string | undefined;
    MAX_FILE_SIZE?: string | undefined;
    UPLOAD_DIR?: string | undefined;
    REDIS_URL?: string | undefined;
    USE_REDIS_QUEUE?: "true" | "false" | undefined;
    ALLOWED_ORIGINS?: string | undefined;
}>;
type Env = z.infer<typeof envSchema>;
/**
 * Validate and return environment variables
 * Should be called at application startup
 */
export declare function validateEnv(): Env;
/**
 * Get validated environment variable
 * Throws if validateEnv() hasn't been called
 */
export declare function getEnv(): Env;
export {};
//# sourceMappingURL=env-validation.d.ts.map