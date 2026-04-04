import express, { Response, Request } from 'express';
import { z } from 'zod';
import logger from '../utils/logger';
import { authenticate, AuthRequest } from '../middleware/auth';
import { successResponse, errorResponse } from '../utils/error-handler';
import {
  createLocation,
  deleteLocation,
  getLocationChildren,
  getLocationSubtree,
  getLocationTree,
  searchLocations,
  updateLocation,
  getLeafLocationsWithPaths,
} from '../services/location';

const router = (express as any).Router();

const createLocationSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.string().min(1, 'Type is required'),
  parentId: z.string().uuid().nullable().optional(),
});

const updateLocationSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.string().min(1).optional(),
  parentId: z.string().uuid().nullable().optional(),
});

const searchSchema = z.object({
  q: z.string().min(1, 'Search query is required'),
});

router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const payload = createLocationSchema.parse(req.body);
    const location = await createLocation(payload);
    return successResponse(res, location, 201);
  } catch (error) {
    logger.error('Create location error:', error);
    return errorResponse(res, error);
  }
});

router.get('/tree', authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    const tree = await getLocationTree();
    return successResponse(res, tree);
  } catch (error) {
    logger.error('Fetch location tree error:', error);
    return errorResponse(res, error);
  }
});

// GET leaf locations with full paths (for dropdowns)
router.get('/leaves', authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    const leaves = await getLeafLocationsWithPaths();
    return successResponse(res, leaves);
  } catch (error) {
    logger.error('Fetch leaf locations error:', error);
    return errorResponse(res, error);
  }
});

router.get('/search', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { q } = searchSchema.parse(req.query);
    const data = await searchLocations(q);
    return successResponse(res, data);
  } catch (error) {
    logger.error('Search locations error:', error);
    return errorResponse(res, error);
  }
});

router.get('/:id/children', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const children = await getLocationChildren(id);
    return successResponse(res, children);
  } catch (error) {
    logger.error('Get location children error:', error);
    return errorResponse(res, error);
  }
});

router.get('/:id/subtree', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const subtree = await getLocationSubtree(id);
    if (!subtree) {
      return errorResponse(res, 'Location not found', 404);
    }

    return successResponse(res, {
      ...subtree,
    });
  } catch (error) {
    logger.error('Get location subtree error:', error);
    return errorResponse(res, error);
  }
});

router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const payload = updateLocationSchema.parse(req.body);
    const location = await updateLocation(id, payload);
    return successResponse(res, location);
  } catch (error) {
    logger.error('Update location error:', error);
    return errorResponse(res, error);
  }
});

router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    await deleteLocation(id);
    return successResponse(res, { message: 'Location deleted' });
  } catch (error) {
    logger.error('Delete location error:', error);
    return errorResponse(res, error);
  }
});

export default router;

