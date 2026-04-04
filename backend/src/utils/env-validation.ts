/**
 * Environment Variable Validation
 * Validates all required environment variables at startup using Zod
 * Fails startup if critical variables are missing or invalid
 */

import { z } from 'zod';
import logger from './logger';

// Define environment variable schema
const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  
  // JWT
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters long'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  
  // Server
  PORT: z.string().regex(/^\d+$/).transform(Number).default('3001'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // CORS
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
  
  // CSRF
  CSRF_SECRET: z.string().min(32, 'CSRF_SECRET must be at least 32 characters long').optional(),
  
  // File Upload
  MAX_FILE_SIZE: z.string().regex(/^\d+$/).transform(Number).default('5242880'), // 5MB in bytes
  UPLOAD_DIR: z.string().default('../uploads'), // Outside web root
  
  // Redis (optional, for CSRF token storage)
  REDIS_URL: z.string().url().optional(),
  USE_REDIS_QUEUE: z.enum(['true', 'false']).optional(),
  
  // Security
  ALLOWED_ORIGINS: z.string().optional(), // Comma-separated list
});

type Env = z.infer<typeof envSchema>;

let validatedEnv: Env | null = null;

/**
 * Validate and return environment variables
 * Should be called at application startup
 */
export function validateEnv(): Env {
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

    logger.info('✅ Environment variables validated successfully');
    return validatedEnv;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('\n');
      logger.error('❌ Environment variable validation failed:');
      logger.error(errors);
      throw new Error(`Environment variable validation failed:\n${errors}`);
    }
    throw error;
  }
}

/**
 * Get validated environment variable
 * Throws if validateEnv() hasn't been called
 */
export function getEnv(): Env {
  if (!validatedEnv) {
    throw new Error('Environment variables not validated. Call validateEnv() at startup.');
  }
  return validatedEnv;
}

