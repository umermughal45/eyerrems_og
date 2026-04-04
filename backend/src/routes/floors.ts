import express, { Response } from 'express';
import { z } from 'zod';
import prisma from '../prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = (express as any).Router();

// Validation schemas
const createFloorSchema = z.object({
  name: z.string().min(1, 'Floor name is required'),
  floorNumber: z.number().int().optional(),
  propertyId: z.string().uuid('Invalid property ID'),
  description: z.string().optional(),
});

const updateFloorSchema = createFloorSchema.partial();

// Get all floors for a property
router.get('/property/:propertyId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { propertyId } = req.params;

    const floors = await prisma.floor.findMany({
      where: {
        propertyId,
        isDeleted: false,
      },
      include: {
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
      orderBy: {
        floorNumber: 'asc',
      },
    });

    res.json({
      success: true,
      data: floors,
    });
  } catch (error) {
    console.error('Get floors error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch floors',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get floor by ID
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const floor = await prisma.floor.findFirst({
      where: {
        id,
        isDeleted: false,
      },
      include: {
        units: {
          where: { isDeleted: false },
        },
        property: true,
      },
    });

    if (!floor) {
      return res.status(404).json({
        success: false,
        error: 'Floor not found',
      });
    }

    res.json({
      success: true,
      data: floor,
    });
  } catch (error) {
    console.error('Get floor error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch floor',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Create floor
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const data = createFloorSchema.parse(req.body);

    // Check if property exists
    const property = await prisma.property.findFirst({
      where: { id: data.propertyId, isDeleted: false },
    });

    if (!property) {
      return res.status(404).json({
        success: false,
        error: 'Property not found',
      });
    }

    const floor = await prisma.floor.create({
      data,
      include: {
        units: true,
        property: true,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Floor added successfully',
      data: floor,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors,
      });
    }
    console.error('Create floor error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create floor',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Update floor
router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const data = updateFloorSchema.parse(req.body);

    const existingFloor = await prisma.floor.findFirst({
      where: { id, isDeleted: false },
    });

    if (!existingFloor) {
      return res.status(404).json({
        success: false,
        error: 'Floor not found',
      });
    }

    const floor = await prisma.floor.update({
      where: { id },
      data,
      include: {
        units: {
          where: { isDeleted: false },
        },
      },
    });

    res.json({
      success: true,
      message: 'Floor updated successfully',
      data: floor,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors,
      });
    }
    console.error('Update floor error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update floor',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Delete floor (soft delete)
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const floor = await prisma.floor.findFirst({
      where: { id, isDeleted: false },
    });

    if (!floor) {
      return res.status(404).json({
        success: false,
        error: 'Floor not found',
      });
    }

    await prisma.floor.update({
      where: { id },
      data: { isDeleted: true },
    });

    res.json({
      success: true,
      message: 'Floor deleted successfully',
    });
  } catch (error) {
    console.error('Delete floor error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete floor',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

