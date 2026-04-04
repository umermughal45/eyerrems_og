/**
 * Centralized Validation Schemas
 * 
 * This module exports all Zod schemas used for validation across the application.
 * Schemas are shared between frontend and backend to ensure consistency.
 * 
 * Usage:
 * - Backend: Import schemas and use with validateBody/validateQuery middleware
 * - Frontend: Import schemas and use with react-hook-form zodResolver
 * - Types: Use z.infer<typeof schema> to generate TypeScript types
 */

export * from './common';
export * from './property';
export * from './crm';
export * from './tenant';
export * from './unit';
export * from './deal';
export * from './client';
export * from './dealer';
export * from './lead';


