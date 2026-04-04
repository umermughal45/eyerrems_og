/**
 * Validation Middleware Usage Examples
 * 
 * This file demonstrates how to use the validation middleware in your routes.
 */

import express, { Response } from 'express';
import { authenticate, AuthRequest } from './auth';
import { validateBody, validateQuery, validateParams, validate } from './validation';
import {
  createPropertySchema,
  updatePropertySchema,
  propertyQuerySchema
} from '../schemas';
import { z } from 'zod';

const router = (express as any).Router();

/**
 * Example 1: Validate request body
 */
router.post(
  '/properties',
  authenticate,
  validateBody(createPropertySchema),
  async (req: AuthRequest, res: Response) => {
    // req.body is now validated and typed as CreatePropertyInput
    const propertyData = req.body;
    // ... create property logic
  }
);

/**
 * Example 2: Validate query parameters
 */
router.get(
  '/properties',
  authenticate,
  validateQuery(propertyQuerySchema),
  async (req: AuthRequest, res: Response) => {
    // req.query is now validated and typed
    const { status, type, page, limit } = req.query;
    // ... fetch properties logic
  }
);

/**
 * Example 3: Validate route parameters
 */
const propertyIdSchema = z.object({
  id: z.string().uuid('Invalid property ID'),
});

router.get(
  '/properties/:id',
  authenticate,
  validateParams(propertyIdSchema),
  async (req: AuthRequest, res: Response) => {
    // req.params.id is now validated as UUID
    const { id } = req.params;
    // ... fetch property logic
  }
);

/**
 * Example 4: Validate multiple parts of the request
 */
router.put(
  '/properties/:id',
  authenticate,
  validate({
    params: propertyIdSchema,
    body: updatePropertySchema,
  }),
  async (req: AuthRequest, res: Response) => {
    // Both req.params and req.body are validated
    const { id } = req.params;
    const updateData = req.body;
    // ... update property logic
  }
);

/**
 * Example 5: Custom validation schema inline
 */
const customQuerySchema = z.object({
  search: z.string().optional(),
  minPrice: z.string().regex(/^\d+$/).transform(Number).optional(),
  maxPrice: z.string().regex(/^\d+$/).transform(Number).optional(),
});

router.get(
  '/properties/search',
  authenticate,
  validateQuery(customQuerySchema),
  async (req: AuthRequest, res: Response) => {
    // req.query is validated with custom schema
    const { search, minPrice, maxPrice } = req.query;
    // ... search logic
  }
);

export default router;


