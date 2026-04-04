import express, { Response } from 'express';
import { z } from 'zod';
import prisma from '../prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validateTID } from '../services/id-generation-service';

const router = (express as any).Router();

// Validation schemas
const createBuyerSchema = z.object({
  name: z.string().min(1, 'Buyer name is required'),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  propertyId: z.string().uuid().optional(),
  saleId: z.string().uuid().optional(),
  buyStatus: z.enum(['Pending', 'Completed', 'Cancelled']).optional(),
  buyValue: z.number().positive().optional(),

  notes: z.string().optional(),
  tid: z.string().min(1, 'TID is required'),
});

const updateBuyerSchema = createBuyerSchema.partial();

// Get all buyers
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { propertyId, saleId, buyStatus, search } = req.query;

    const where: any = {
      isDeleted: false,
    };

    if (propertyId) {
      where.propertyId = propertyId as string;
    }

    if (saleId) {
      where.saleId = saleId as string;
    }

    if (buyStatus) {
      where.buyStatus = buyStatus;
    }

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } },
        { phone: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const buyers = await prisma.buyer.findMany({
      where,
      include: {
        property: {
          select: {
            id: true,
            name: true,
            address: true,
            type: true,
          },
        },
        sale: {
          select: {
            id: true,
            saleValue: true,
            commission: true,
            saleDate: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: buyers,
    });
  } catch (error) {
    console.error('Get buyers error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch buyers',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get buyer by ID
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const buyer = await prisma.buyer.findFirst({
      where: {
        id,
        isDeleted: false,
      },
      include: {
        property: true,
        sale: {
          include: {
            property: true,
          },
        },
      },
    });

    if (!buyer) {
      return res.status(404).json({
        success: false,
        error: 'Buyer not found',
      });
    }

    res.json({
      success: true,
      data: buyer,
    });
  } catch (error) {
    console.error('Get buyer error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch buyer',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Create buyer
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const data = createBuyerSchema.parse(req.body);

    // Validate TID
    await validateTID(data.tid);

    // Verify property exists if provided
    if (data.propertyId) {
      const property = await prisma.property.findFirst({
        where: { id: data.propertyId, isDeleted: false },
      });

      if (!property) {
        return res.status(404).json({
          success: false,
          error: 'Property not found',
        });
      }
    }

    // Verify sale exists if provided
    if (data.saleId) {
      const sale = await prisma.sale.findFirst({
        where: { id: data.saleId, isDeleted: false },
      });

      if (!sale) {
        return res.status(404).json({
          success: false,
          error: 'Sale not found',
        });
      }
    }

    const buyer = await prisma.buyer.create({
      data: {

        ...data,
        email: data.email || undefined,
        buyStatus: data.buyStatus || 'Pending',
      },
      include: {
        property: true,
        sale: true,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Buyer added successfully',
      data: buyer,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors,
      });
    }
    console.error('Create buyer error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create buyer',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Update buyer
router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const data = updateBuyerSchema.parse(req.body);

    const buyer = await prisma.buyer.findFirst({
      where: { id, isDeleted: false },
    });

    if (!buyer) {
      return res.status(404).json({
        success: false,
        error: 'Buyer not found',
      });
    }

    // Verify property exists if provided
    if (data.propertyId) {
      const property = await prisma.property.findFirst({
        where: { id: data.propertyId, isDeleted: false },
      });

      if (!property) {
        return res.status(404).json({
          success: false,
          error: 'Property not found',
        });
      }
    }

    // Verify sale exists if provided
    if (data.saleId) {
      const sale = await prisma.sale.findFirst({
        where: { id: data.saleId, isDeleted: false },
      });

      if (!sale) {
        return res.status(404).json({
          success: false,
          error: 'Sale not found',
        });
      }
    }

    const updatedBuyer = await prisma.buyer.update({
      where: { id },
      data: {
        ...data,
        email: data.email !== undefined ? (data.email || undefined) : undefined,
      },
      include: {
        property: true,
        sale: true,
      },
    });

    res.json({
      success: true,
      message: 'Buyer updated successfully',
      data: updatedBuyer,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors,
      });
    }
    console.error('Update buyer error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update buyer',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Delete buyer (soft delete)
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const buyer = await prisma.buyer.findFirst({
      where: { id, isDeleted: false },
    });

    if (!buyer) {
      return res.status(404).json({
        success: false,
        error: 'Buyer not found',
      });
    }

    await prisma.buyer.update({
      where: { id },
      data: { isDeleted: true },
    });

    res.json({
      success: true,
      message: 'Buyer deleted successfully',
    });
  } catch (error) {
    console.error('Delete buyer error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete buyer',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

