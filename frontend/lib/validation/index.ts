/**
 * Frontend Validation Utilities
 * 
 * This module provides validation utilities for the frontend.
 * It re-exports Zod schemas from the backend and provides React Hook Form integration.
 */

// Re-export Zod for convenience
export { z } from 'zod';

// Note: In a monorepo or shared package setup, you would import schemas from a shared package.
// For now, we'll create frontend-specific schemas that mirror the backend ones.
// In production, consider using a shared package or code generation.

export * from './schemas';
export * from './utils';
export * from './hooks';


