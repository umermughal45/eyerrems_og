import express, { Response } from 'express';
import { z } from 'zod';
import prisma from '../prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = (express as any).Router();

// Validation schemas
const createBlockSchema = z.object({
  name: z.string().min(1, 'Block name is required'),
  propertyId: z.string().uuid('Invalid property ID'),
  description: z.string().optional(),
});

const updateBlockSchema = createBlockSchema.partial();

// Get all blocks
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { propertyId, search } = req.query;

    const where: any = {
      isDeleted: false,
    };

    if (propertyId) {
      where.propertyId = propertyId as string;
    }

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const blocks = await prisma.block.findMany({
      where,
      include: {
        property: {
          select: {
            id: true,
            name: true,
            address: true,
          },
        },
        units: {
          where: { isDeleted: false },
          select: {
            id: true,
            unitName: true,
            status: true,
            monthlyRent: true,
          },
        },
        _count: {
          select: {
            units: { where: { isDeleted: false } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: blocks,
    });
  } catch (error) {
    console.error('Get blocks error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch blocks',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get block by ID
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const block = await prisma.block.findFirst({
      where: {
        id,
        isDeleted: false,
      },
      include: {
        property: true,
        units: {
          where: { isDeleted: false },
          include: {
            tenant: {
              where: { isDeleted: false },
            },
          },
        },
      },
    });

    if (!block) {
      return res.status(404).json({
        success: false,
        error: 'Block not found',
      });
    }

    res.json({
      success: true,
      data: block,
    });
  } catch (error) {
    console.error('Get block error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch block',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Create block
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const data = createBlockSchema.parse(req.body);

    // Verify property exists
    const property = await prisma.property.findFirst({
      where: { id: data.propertyId, isDeleted: false },
    });

    if (!property) {
      return res.status(404).json({
        success: false,
        error: 'Property not found',
      });
    }

    const block = await prisma.block.create({
      data,
      include: {
        property: true,
        units: true,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Block added successfully',
      data: block,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors,
      });
    }
    console.error('Create block error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create block',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Update block
router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const data = updateBlockSchema.parse(req.body);

    const block = await prisma.block.findFirst({
      where: { id, isDeleted: false },
    });

    if (!block) {
      return res.status(404).json({
        success: false,
        error: 'Block not found',
      });
    }

    const updatedBlock = await prisma.block.update({
      where: { id },
      data,
      include: {
        property: true,
        units: {
          where: { isDeleted: false },
        },
      },
    });

    res.json({
      success: true,
      message: 'Block updated successfully',
      data: updatedBlock,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors,
      });
    }
    console.error('Update block error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update block',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Delete block (soft delete)
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const block = await prisma.block.findFirst({
      where: { id, isDeleted: false },
    });

    if (!block) {
      return res.status(404).json({
        success: false,
        error: 'Block not found',
      });
    }

    await prisma.block.update({
      where: { id },
      data: { isDeleted: true },
    });

    res.json({
      success: true,
      message: 'Block deleted successfully',
    });
  } catch (error) {
    console.error('Delete block error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete block',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

