import express, { Response } from 'express';
import { z } from 'zod';
import prisma from '../prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { createActivity } from '../utils/activity';
import { validateTID } from '../services/id-generation-service';
import logger from '../utils/logger';
import { successResponse, errorResponse } from '../utils/error-handler';
import { parsePaginationQuery, calculatePagination } from '../utils/pagination';

const router = (express as any).Router();

// Sellers are stored as Clients with clientType = 'Seller'
// The Seller model does not exist in the current schema.

const createSellerSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  phone: z.string().min(1, 'Phone is required'),
  cnic: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(['Active', 'Inactive']).optional(),
  tid: z.string().min(1, 'TID is required'),
});

const updateSellerSchema = createSellerSchema.partial();

/**
 * Get all sellers
 * @route GET /api/sellers
 */
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { status, search } = req.query;
    const { page, limit } = parsePaginationQuery(req.query);
    const skip = (page - 1) * limit;

    const where: any = {
      isDeleted: false,
      clientType: 'Seller',
    };

    if (status) {
      where.status = (status as string).toLowerCase() === 'active' ? 'active' : 'inactive';
    }

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { phone: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } },
        { cnic: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const [sellers, total] = await Promise.all([
      prisma.client.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.client.count({ where }),
    ]);

    const pagination = calculatePagination(page, limit, total);
    return successResponse(res, sellers, 200, pagination);
  } catch (error) {
    logger.error('Get sellers error:', error);
    return errorResponse(res, 'Failed to fetch sellers', 500);
  }
});

/**
 * Get seller by ID
 * @route GET /api/sellers/:id
 */
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const seller = await prisma.client.findFirst({
      where: { id, isDeleted: false, clientType: 'Seller' },
    });

    if (!seller) {
      return errorResponse(res, 'Seller not found', 404);
    }

    return successResponse(res, seller, 200);
  } catch (error) {
    logger.error('Get seller error:', error);
    return errorResponse(res, 'Failed to fetch seller', 500);
  }
});

/**
 * Create new seller
 * @route POST /api/sellers
 */
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const validatedData = createSellerSchema.parse(req.body);

    await validateTID(validatedData.tid);

    const seller = await prisma.client.create({
      data: {
        name: validatedData.fullName,
        phone: validatedData.phone,
        cnic: validatedData.cnic || null,
        email: validatedData.email || null,
        address: validatedData.address || null,
        status: validatedData.status?.toLowerCase() === 'inactive' ? 'inactive' : 'active',
        clientType: 'Seller',
        tid: validatedData.tid,
      },
    });

    await createActivity({
      type: 'client',
      action: 'created',
      entityId: seller.id,
      entityName: seller.name,
      message: `Seller "${seller.name}" created`,
      userId: req.user?.id,
    });

    return successResponse(res, seller, 201);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return errorResponse(res, 'Invalid seller data', 400, error.errors);
    }
    logger.error('Create seller error:', error);
    return errorResponse(res, 'Failed to create seller', 500);
  }
});

/**
 * Update seller
 * @route PUT /api/sellers/:id
 */
router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const validatedData = updateSellerSchema.parse(req.body);

    const existing = await prisma.client.findFirst({
      where: { id, isDeleted: false, clientType: 'Seller' },
    });

    if (!existing) {
      return errorResponse(res, 'Seller not found', 404);
    }

    const seller = await prisma.client.update({
      where: { id },
      data: {
        ...(validatedData.fullName && { name: validatedData.fullName }),
        ...(validatedData.phone && { phone: validatedData.phone }),
        ...(validatedData.cnic !== undefined && { cnic: validatedData.cnic || null }),
        ...(validatedData.email !== undefined && { email: validatedData.email || null }),
        ...(validatedData.address !== undefined && { address: validatedData.address || null }),
        ...(validatedData.notes !== undefined && { notes: validatedData.notes || null }),
        ...(validatedData.status && { status: validatedData.status.toLowerCase() }),
      },
    });

    await createActivity({
      type: 'client',
      action: 'updated',
      entityId: seller.id,
      entityName: seller.name,
      message: `Seller "${seller.name}" updated`,
      userId: req.user?.id,
    });

    return successResponse(res, seller, 200);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return errorResponse(res, 'Invalid seller data', 400, error.errors);
    }
    logger.error('Update seller error:', error);
    return errorResponse(res, 'Failed to update seller', 500);
  }
});

/**
 * Delete seller (soft delete)
 * @route DELETE /api/sellers/:id
 */
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const seller = await prisma.client.findFirst({
      where: { id, isDeleted: false, clientType: 'Seller' },
    });

    if (!seller) {
      return errorResponse(res, 'Seller not found', 404);
    }

    await prisma.client.update({
      where: { id },
      data: { isDeleted: true },
    });

    await createActivity({
      type: 'client',
      action: 'deleted',
      entityId: id,
      entityName: seller.name,
      message: `Seller "${seller.name}" deleted`,
      userId: req.user?.id,
    });

    return successResponse(res, { message: 'Seller deleted successfully' }, 200);
  } catch (error) {
    logger.error('Delete seller error:', error);
    return errorResponse(res, 'Failed to delete seller', 500);
  }
});

export default router;
