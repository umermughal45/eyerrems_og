"use strict";
/**
 * Environment Variable Validation
 * Validates all required environment variables at startup using Zod
 * Fails startup if critical variables are missing or invalid
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateEnv = validateEnv;
exports.getEnv = getEnv;
const zod_1 = require("zod");
const logger_1 = __importDefault(require("./logger"));
// Define environment variable schema
const envSchema = zod_1.z.object({
    // Database
    DATABASE_URL: zod_1.z.string().min(1, 'DATABASE_URL is required'),
    // JWT
    JWT_SECRET: zod_1.z.string().min(32, 'JWT_SECRET must be at least 32 characters long'),
    JWT_EXPIRES_IN: zod_1.z.string().default('15m'),
    JWT_REFRESH_EXPIRES_IN: zod_1.z.string().default('7d'),
    // Server
    PORT: zod_1.z.string().regex(/^\d+$/).transform(Number).default('3001'),
    NODE_ENV: zod_1.z.enum(['development', 'production', 'test']).default('development'),
    // CORS
    FRONTEND_URL: zod_1.z.string().url().default('http://localhost:3000'),
    // CSRF
    CSRF_SECRET: zod_1.z.string().min(32, 'CSRF_SECRET must be at least 32 characters long').optional(),
    // File Upload
    MAX_FILE_SIZE: zod_1.z.string().regex(/^\d+$/).transform(Number).default('5242880'), // 5MB in bytes
    UPLOAD_DIR: zod_1.z.string().default('../uploads'), // Outside web root
    // Redis (optional, for CSRF token storage)
    REDIS_URL: zod_1.z.string().url().optional(),
    USE_REDIS_QUEUE: zod_1.z.enum(['true', 'false']).optional(),
    // Security
    ALLOWED_ORIGINS: zod_1.z.string().optional(), // Comma-separated list
});
let validatedEnv = null;
/**
 * Validate and return environment variables
 * Should be called at application startup
 */
function validateEnv() {
    if (validatedEnv) {
        return validatedEnv;
    }
    try {
        // Parse environment variables
        const rawEnv = {
            DATABASE_URL: process.env.DATABASE_URL,
            JWT_SECRET: process.env.JWT_SECRET,
            JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN,
            JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN,
            PORT: process.env.PORT,
            NODE_ENV: process.env.NODE_ENV,
            FRONTEND_URL: process.env.FRONTEND_URL,
            CSRF_SECRET: process.env.CSRF_SECRET,
            MAX_FILE_SIZE: process.env.MAX_FILE_SIZE,
            UPLOAD_DIR: process.env.UPLOAD_DIR,
            REDIS_URL: process.env.REDIS_URL,
            USE_REDIS_QUEUE: process.env.USE_REDIS_QUEUE,
            ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
        };
        // Validate with Zod
        validatedEnv = envSchema.parse(rawEnv);
        // Additional validation for production
        if (validatedEnv.NODE_ENV === 'production') {
            if (!validatedEnv.JWT_SECRET || validatedEnv.JWT_SECRET.length < 32) {
                throw new Error('JWT_SECRET must be at least 32 characters in production');
            }
            if (validatedEnv.JWT_SECRET.includes('CHANGE-THIS') || validatedEnv.JWT_SECRET.includes('development')) {
                throw new Error('JWT_SECRET must be changed from default value in production');
            }
        }
        logger_1.default.info('✅ Environment variables validated successfully');
        return validatedEnv;
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            const errors = error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('\n');
            logger_1.default.error('❌ Environment variable validation failed:');
            logger_1.default.error(errors);
            throw new Error(`Environment variable validation failed:\n${errors}`);
        }
        throw error;
    }
}
/**
 * Get validated environment variable
 * Throws if validateEnv() hasn't been called
 */
function getEnv() {
    if (!validatedEnv) {
        throw new Error('Environment variables not validated. Call validateEnv() at startup.');
    }
    return validatedEnv;
}
//# sourceMappingURL=env-validation.js.map