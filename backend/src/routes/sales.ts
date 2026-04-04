import express, { Response } from 'express';
import { z } from 'zod';
import { Prisma } from '../prisma/client';
import prisma from '../prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { createActivity } from '../utils/activity';
import { validateTID } from '../services/id-generation-service';
import logger from '../utils/logger';
import { successResponse, errorResponse } from '../utils/error-handler';
import { parsePaginationQuery, calculatePagination } from '../utils/pagination';

const router = (express as any).Router();

// Validation schemas
const createSaleSchema = z.object({
  propertyId: z.string().uuid('Invalid property ID'),
  saleValue: z.number().positive('Sale value must be positive'),
  commissionRate: z.number().min(0).max(100).optional(),
  saleDate: z.string().datetime().or(z.date()).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  status: z.enum(['Completed', 'Pending', 'Cancelled']).optional(),
  notes: z.string().optional(),
  actualPropertyValue: z.number().optional(),
  profit: z.number().optional(),
  documents: z.array(z.string()).optional(), // Array of document URLs
  dealerId: z.string().uuid().optional(), // Optional dealer ID
  tid: z.string().min(1, "TID is required"),
});

const updateSaleSchema = createSaleSchema.partial();

/**
 * Get all sales with pagination and filtering
 * @route GET /api/sales
 * @access Private
 */
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { propertyId, status, search } = req.query;
    const { page, limit } = parsePaginationQuery(req.query);
    const skip = (page - 1) * limit;

    const where: Prisma.SaleWhereInput = {
      isDeleted: false,
    };

    if (propertyId) {
      where.propertyId = propertyId as string;
    }

    if (status) {
      where.status = status as string;
    }

    if (search) {
      where.OR = [
        { property: { name: { contains: search as string, mode: 'insensitive' } } },
        { notes: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const [sales, total] = await Promise.all([
      prisma.sale.findMany({
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
        buyers: {
          where: { isDeleted: false },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            buyStatus: true,
          },
        },
      },
      orderBy: { saleDate: 'desc' },
        skip,
        take: limit,
      }),
      prisma.sale.count({ where }),
    ]);

    // Calculate average price per property type
    const salesWithAvgPrice = sales.map((sale) => ({
      ...sale,
      propertyName: sale.property.name,
      avgPrice: sale.saleValue, // This can be enhanced to calculate average per property type
    }));

    const pagination = calculatePagination(page, limit, total);

    return successResponse(res, salesWithAvgPrice, 200, pagination);
  } catch (error) {
    logger.error('Get sales error:', error);
    return errorResponse(res, error);
  }
});

// ========== INSTALLMENT ROUTES (must be before /:id route) ==========

/**
 * Get all installments for a sale
 * @route GET /api/sales/:saleId/installments
 * @access Private
 */
router.get('/:saleId/installments', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { saleId } = req.params;

    const installments = await prisma.saleInstallment.findMany({
      where: {
        saleId,
        isDeleted: false,
      },
      orderBy: {
        installmentNumber: 'asc',
      },
    });

    return successResponse(res, installments);
  } catch (error) {
    logger.error('Get installments error:', error);
    return errorResponse(res, error);
  }
});

/**
 * Create installments for a sale
 * @route POST /api/sales/:saleId/installments
 * @access Private
 */
router.post('/:saleId/installments', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { saleId } = req.params;
    const installmentSchema = z.object({
      installments: z.array(z.object({
        installmentNumber: z.number().int().positive(),
        amount: z.number().positive(),
        dueDate: z.string().datetime().or(z.date()),
      })),
    });

    const { installments } = installmentSchema.parse(req.body);

    // Verify sale exists
    const sale = await prisma.sale.findFirst({
      where: { id: saleId, isDeleted: false },
    });

    if (!sale) {
      return errorResponse(res, 'Sale not found', 404);
    }

    // Delete existing installments for this sale
    await prisma.saleInstallment.updateMany({
      where: { saleId, isDeleted: false },
      data: { isDeleted: true },
    });

    // Create new installments
    const createdInstallments = await Promise.all(
      installments.map((inst) =>
        prisma.saleInstallment.create({
          data: {
            saleId,
            installmentNumber: inst.installmentNumber,
            amount: inst.amount,
            dueDate: new Date(inst.dueDate),
            status: 'Unpaid',
          },
        })
      )
    );

    return successResponse(res, createdInstallments, 201);
  } catch (error) {
    logger.error('Create installments error:', error);
    return errorResponse(res, error);
  }
});

/**
 * Update installment (mark as paid, partial payment, etc.)
 * @route PUT /api/sales/installments/:id
 * @access Private
 */
router.put('/installments/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updateSchema = z.object({
      paidAmount: z.number().nonnegative().optional(),
      paidDate: z.string().datetime().or(z.date()).optional(),
      status: z.enum(['Unpaid', 'Partial', 'Paid']).optional(),
      notes: z.string().optional(),
    });

    const data = updateSchema.parse(req.body);

    const installment = await prisma.saleInstallment.findFirst({
      where: { id, isDeleted: false },
    });

    if (!installment) {
      return errorResponse(res, 'Installment not found', 404);
    }

    const updateData: Prisma.SaleInstallmentUpdateInput = {};
    if (data.paidAmount !== undefined) updateData.paidAmount = data.paidAmount;
    if (data.paidDate !== undefined) updateData.paidDate = new Date(data.paidDate);
    if (data.status !== undefined) updateData.status = data.status;
    if (data.notes !== undefined) updateData.notes = data.notes;

    // Auto-update status based on paid amount
    if (data.paidAmount !== undefined) {
      if (data.paidAmount >= installment.amount) {
        updateData.status = 'Paid';
        updateData.paidAmount = installment.amount;
      } else if (data.paidAmount > 0) {
        updateData.status = 'Partial';
      } else {
        updateData.status = 'Unpaid';
      }
    }

    const updated = await prisma.saleInstallment.update({
      where: { id },
      data: updateData,
    });

    return successResponse(res, updated);
  } catch (error) {
    logger.error('Update installment error:', error);
    return errorResponse(res, error);
  }
});

/**
 * Delete installment
 * @route DELETE /api/sales/installments/:id
 * @access Private
 */
router.delete('/installments/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const installment = await prisma.saleInstallment.findFirst({
      where: { id, isDeleted: false },
    });

    if (!installment) {
      return errorResponse(res, 'Installment not found', 404);
    }

    await prisma.saleInstallment.update({
      where: { id },
      data: { isDeleted: true },
    });

    return successResponse(res, { message: 'Installment deleted successfully' });
  } catch (error) {
    logger.error('Delete installment error:', error);
    return errorResponse(res, error);
  }
});

// Get sale by ID
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const sale = await prisma.sale.findFirst({
      where: {
        id,
        isDeleted: false,
      },
      include: {
        property: true,
        buyers: {
          where: { isDeleted: false },
        },
        dealer: true, // Include dealer directly in sale
        installments: {
          where: { isDeleted: false },
          orderBy: { installmentNumber: 'asc' },
        },
      },
    });

    if (!sale) {
      return res.status(404).json({
        success: false,
        error: 'Sale not found',
      });
    }

    // Extract documents from JSON field if it's an array, otherwise return empty array
    let documents: string[] = [];
    if (sale.documents) {
      if (Array.isArray(sale.documents)) {
        documents = sale.documents.filter((doc): doc is string => typeof doc === 'string');
      } else if (typeof sale.documents === 'object' && 'documents' in sale.documents) {
        const docs = sale.documents as { documents?: unknown[] };
        if (Array.isArray(docs.documents)) {
          documents = docs.documents.filter((doc): doc is string => typeof doc === 'string');
        }
      }
    }

    return successResponse(res, {
        ...sale,
        documents: documents,
        actualPropertyValue: sale.actualPropertyValue || 0,
        profit: sale.profit || (sale.actualPropertyValue ? sale.saleValue - sale.actualPropertyValue : 0),
    });
  } catch (error) {
    logger.error('Get sale error:', error);
    return errorResponse(res, error);
  }
});

/**
 * Create sale
 * @route POST /api/sales
 * @access Private
 */
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    logger.debug('Create sale request body:', JSON.stringify(req.body, null, 2));
    const data = createSaleSchema.parse(req.body);

    // Validate TID
    await validateTID(data.tid);

    // Verify property exists
    const property = await prisma.property.findFirst({
      where: { id: data.propertyId, isDeleted: false },
    });

    if (!property) {
      return errorResponse(res, 'Property not found', 404);
    }

    // Calculate commission (default 2%)
    const commissionRate = data.commissionRate || 2.0;
    const commission = (data.saleValue * commissionRate) / 100;

    // Get actual property value (from property or provided value)
    const actualPropertyValue = data.actualPropertyValue || property.totalArea || property.size || 0;
    
    // Calculate profit
    const profit = data.profit !== undefined ? data.profit : (data.saleValue - actualPropertyValue);

    // Convert saleDate to Date if provided
    const saleDate = data.saleDate
      ? typeof data.saleDate === 'string'
        ? new Date(data.saleDate)
        : data.saleDate
      : new Date();

    const sale = await prisma.sale.create({
      data: {
        propertyId: data.propertyId,
        saleValue: data.saleValue,
        commission,
        commissionRate,
        saleDate,
        status: data.status || 'Completed',
        notes: data.notes || null,
        actualPropertyValue: actualPropertyValue,
        profit: profit,
        documents: data.documents && Array.isArray(data.documents) && data.documents.length > 0 ? data.documents : undefined,
        dealerId: data.dealerId || null,
        tid: data.tid,
      },
      include: {
        property: true,
        buyers: true,
        dealer: true,
      },
    });

    // Update property status to "Sold" when sale is created
    // This marks the property as sold regardless of sale status
    await prisma.property.update({
      where: { id: data.propertyId },
      data: { status: 'Sold' },
    });

    // Note: FinanceLedger now requires a dealId, but Sales don't have a direct Deal relation
    // Finance ledger entries for Sales should be created through Deal relationships if needed
    // Commenting out FinanceLedger creation for Sales until Sales are linked to Deals
    // if (sale.status === 'Completed' || sale.status === 'completed') {
    //   try {
    //     // Find or create a Deal for this Sale to link FinanceLedger
    //     // For now, skipping FinanceLedger creation for Sales
    //   } catch (ledgerErr) {
    //     logger.error('Failed to update finance ledger for sale:', ledgerErr);
    //   }
    // }

    // Log activity
    await createActivity({
      type: 'sale',
      action: 'created',
      entityId: sale.id,
      entityName: property.name,
      message: `Sale created for property "${property.name}" - Status: ${sale.status}`,
      userId: req.user?.id,
      metadata: {
        saleId: sale.id,
        propertyId: property.id,
        propertyName: property.name,
        saleValue: sale.saleValue,
        status: sale.status,
      },
    });

    return successResponse(res, sale, 201);
  } catch (error) {
    logger.error('Create sale error:', error);
    return errorResponse(res, error);
  }
});

/**
 * Update sale
 * @route PUT /api/sales/:id
 * @access Private
 */
router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const data = updateSaleSchema.parse(req.body);

    const sale = await prisma.sale.findFirst({
      where: { id, isDeleted: false },
    });

    if (!sale) {
      return errorResponse(res, 'Sale not found', 404);
    }

    // Recalculate commission if saleValue or commissionRate changed
    const updateData: Prisma.SaleUpdateInput = { ...data };
    if (data.saleValue || data.commissionRate !== undefined) {
      const saleValue = data.saleValue || sale.saleValue;
      const commissionRate = data.commissionRate !== undefined ? data.commissionRate : sale.commissionRate;
      updateData.commission = (saleValue * commissionRate) / 100;
    }

    // Convert saleDate to Date if provided
    if (data.saleDate) {
      updateData.saleDate =
        typeof data.saleDate === 'string' ? new Date(data.saleDate) : data.saleDate;
    }

    const updatedSale = await prisma.sale.update({
      where: { id },
      data: updateData,
      include: {
        property: true,
        buyers: {
          where: { isDeleted: false },
        },
      },
    });

    // Update property status if sale status changed
    if (data.status === 'Completed' && sale.status !== 'Completed') {
      await prisma.property.update({
        where: { id: updatedSale.propertyId },
        data: { status: 'Sold' },
      });
    } else if (data.status === 'Cancelled' && sale.status === 'Completed') {
      // Revert property status if sale is cancelled
      await prisma.property.update({
        where: { id: updatedSale.propertyId },
        data: { status: 'For Sale' },
      });
    }

    return successResponse(res, updatedSale);
  } catch (error) {
    logger.error('Update sale error:', error);
    return errorResponse(res, error);
  }
});

/**
 * Delete sale (soft delete)
 * @route DELETE /api/sales/:id
 * @access Private
 */
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const sale = await prisma.sale.findFirst({
      where: { id, isDeleted: false },
    });

    if (!sale) {
      return errorResponse(res, 'Sale not found', 404);
    }

    await prisma.sale.update({
      where: { id },
      data: { isDeleted: true },
    });

    // Revert property status if sale was completed
    if (sale.status === 'Completed') {
      await prisma.property.update({
        where: { id: sale.propertyId },
        data: { status: 'For Sale' },
      });
    }

    return successResponse(res, { message: 'Sale deleted successfully' });
  } catch (error) {
    logger.error('Delete sale error:', error);
    return errorResponse(res, error);
  }
});

export default router;

