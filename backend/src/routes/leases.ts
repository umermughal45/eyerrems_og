import express, { Response } from 'express';
import { z } from 'zod';
import { Prisma } from '../prisma/client';
import prisma from '../prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { createActivity } from '../utils/activity';
import { validateTID } from '../services/id-generation-service';
import {
  createTenancyFromLease,
  syncInvoiceToFinanceLedger,
  updateTenantLedger,
} from '../services/workflows';
import { generateLeaseNumber, generateInvoiceNumber } from '../utils/code-generator';
import { createLeaseHistory, getLeaseHistory, trackLeaseRenewal, trackLeaseStatusChange } from '../services/lease-history';
import logger from '../utils/logger';
import { successResponse, errorResponse } from '../utils/error-handler';
import { parsePaginationQuery, calculatePagination } from '../utils/pagination';

const router = (express as any).Router();

// Validation schemas
const createLeaseSchema = z.object({
  tenantId: z.string().uuid('Invalid tenant ID'),
  unitId: z.string().uuid('Invalid unit ID'),
  leaseStart: z.string().datetime().or(z.date()),
  leaseEnd: z.string().datetime().or(z.date()),
  rent: z.number().positive('Rent must be positive'),
  status: z.enum(['Active', 'Expired', 'Terminated']).optional(),
  notes: z.string().optional(),
  leaseNumber: z.string().optional(),
  tid: z.string().min(1, "TID is required"),
});

const updateLeaseSchema = createLeaseSchema.partial();

// Get all leases
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { tenantId, unitId, propertyId, status, search } = req.query;
    const { page, limit } = parsePaginationQuery(req.query);
    const skip = (page - 1) * limit;

    const where: Prisma.LeaseWhereInput = {
      isDeleted: false,
    };

    if (tenantId) {
      where.tenantId = tenantId as string;
    }

    if (unitId) {
      where.unitId = unitId as string;
    }

    if (propertyId) {
      where.unit = {
        propertyId: propertyId as string,
        isDeleted: false,
      };
    }

    if (status) {
      const statusStr = Array.isArray(status) ? status[0] : status;
      where.status = String(statusStr) as 'Active' | 'Expired' | 'Terminated' | 'Renewed';
    }

    if (search) {
      where.OR = [
        {
          tenant: {
            name: { contains: search as string, mode: 'insensitive' },
            isDeleted: false,
          }
        },
        { unit: { unitName: { contains: search as string, mode: 'insensitive' } } },
      ];
    }

    // Ensure tenant is not deleted
    if (!where.OR) {
      where.tenant = {
        isDeleted: false,
      };
    }

    const [leases, total] = await Promise.all([
      prisma.lease.findMany({
        where,
        include: {
          tenant: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
          unit: {
            include: {
              property: {
                select: {
                  id: true,
                  name: true,
                  address: true,
                },
              },
              block: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: { leaseStart: 'desc' },
        skip,
        take: limit,
      }),
      prisma.lease.count({ where }),
    ]);

    // Map leases to include tenant name and property name
    const leasesWithDetails = leases.map((lease) => ({
      ...lease,
      tenantName: lease.tenant?.name || null,
      propertyName: lease.unit?.property?.name || null,
      unitName: lease.unit?.unitName || null,
    }));

    const pagination = calculatePagination(page, limit, total);

    return successResponse(res, leasesWithDetails, 200, pagination);
  } catch (error) {
    logger.error('Get leases error:', error);
    return errorResponse(res, error);
  }
});

// Get lease by ID
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const lease = await prisma.lease.findFirst({
      where: {
        id,
        isDeleted: false,
      },
      include: {
        tenant: true,
        unit: {
          include: {
            property: true,
            block: true,
          },
        },
      },
    });

    if (!lease) {
      return errorResponse(res, 'Lease not found', 404);
    }

    // Get lease history
    const history = await getLeaseHistory(id);

    return successResponse(res, {
      ...lease,
      history: history?.history || [],
    });
  } catch (error) {
    logger.error('Get lease error:', error);
    return errorResponse(res, error);
  }
});

// Create lease
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const data = createLeaseSchema.parse(req.body);

    // Verify tenant exists
    const tenant = await prisma.tenant.findFirst({
      where: { id: data.tenantId, isDeleted: false },
    });

    if (!tenant) {
      return errorResponse(res, 'Tenant not found', 404);
    }

    // Verify unit exists
    const unit = await prisma.unit.findFirst({
      where: { id: data.unitId, isDeleted: false },
    });

    if (!unit) {
      return errorResponse(res, 'Unit not found', 404);
    }

    // Convert date strings to Date objects
    const leaseStart = typeof data.leaseStart === 'string' ? new Date(data.leaseStart) : data.leaseStart;
    const leaseEnd = typeof data.leaseEnd === 'string' ? new Date(data.leaseEnd) : data.leaseEnd;

    if (leaseStart >= leaseEnd) {
      return errorResponse(res, 'Lease end date must be after lease start date', 400);
    }

    // Auto-generate lease number if not provided
    const leaseNumber = data.leaseNumber || await generateLeaseNumber();
    const tid = data.tid;

    // Validate TID
    await validateTID(tid);

    const lease = await prisma.lease.create({
      data: {
        ...data,
        leaseNumber,
        tid,
        leaseStart,
        leaseEnd,
        status: data.status || 'Active',
      },
      include: {
        tenant: {
          include: {
            unit: {
              include: {
                property: true,
              },
            },
          },
        },
        unit: {
          include: {
            property: true,
            block: true,
          },
        },
      },
    });

    // Auto-create tenancy from lease
    const tenancy = await createTenancyFromLease(lease.id);

    // Auto-generate first month invoice
    let generatedInvoice = null;
    if (tenancy) {
      try {
        const today = new Date();
        const dueDate = new Date(leaseStart);
        dueDate.setDate(dueDate.getDate() + 7); // 7 days from lease start

        // Auto-generate invoice number
        const invoiceNumber = await generateInvoiceNumber();

        // Create first month invoice
        generatedInvoice = await prisma.invoice.create({
          data: {
            invoiceNumber,
            tenantId: lease.tenantId,
            propertyId: lease.unit.property.id,
            billingDate: leaseStart,
            dueDate,
            amount: lease.rent,
            totalAmount: lease.rent,
            remainingAmount: lease.rent,
            status: 'unpaid',
          },
        });

        // Auto-sync to Finance Ledger
        await syncInvoiceToFinanceLedger(generatedInvoice.id);

        // Update tenant ledger
        await updateTenantLedger(lease.tenantId, {
          entryType: 'debit',
          description: `First month rent invoice ${invoiceNumber}`,
          amount: lease.rent,
          referenceId: generatedInvoice.id,
          referenceType: 'invoice',
        });
      } catch (error) {
        logger.error('Error generating invoice from lease:', error);
        // Don't fail lease creation if invoice generation fails
      }
    }

    // Create lease history entry
    await createLeaseHistory(lease.id, 'created', {
      changedBy: req.user?.id,
      notes: `Lease created for tenant "${tenant.name}" in unit "${lease.unit.unitName}"`,
      metadata: {
        tenantId: tenant.id,
        tenantName: tenant.name,
        unitId: lease.unit.id,
        unitName: lease.unit.unitName,
        propertyId: lease.unit.property.id,
        propertyName: lease.unit.property.name,
        rent: lease.rent,
        leaseStart: lease.leaseStart.toISOString(),
        leaseEnd: lease.leaseEnd.toISOString(),
        invoiceGenerated: !!generatedInvoice,
        invoiceId: generatedInvoice?.id,
      },
    });

    // Log activity
    await createActivity({
      type: 'lease',
      action: 'created',
      entityId: lease.id,
      entityName: `${tenant.name} - ${lease.unit.unitName}`,
      message: `Lease created for tenant "${tenant.name}" in unit "${lease.unit.unitName}"${generatedInvoice ? ' with first month invoice' : ''}`,
      userId: req.user?.id,
      metadata: {
        leaseId: lease.id,
        tenantId: tenant.id,
        tenantName: tenant.name,
        unitId: lease.unit.id,
        unitName: lease.unit.unitName,
        propertyId: lease.unit.property.id,
        propertyName: lease.unit.property.name,
        rent: lease.rent,
        leaseStart: lease.leaseStart,
        leaseEnd: lease.leaseEnd,
        invoiceGenerated: !!generatedInvoice,
        invoiceId: generatedInvoice?.id,
      },
    });

    return successResponse(res, {
      ...lease,
      tenancy,
      invoice: generatedInvoice,
    }, 201);
  } catch (error) {
    logger.error('Create lease error:', error);
    return errorResponse(res, error);
  }
});

// Update lease
router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const data = updateLeaseSchema.parse(req.body);

    const lease = await prisma.lease.findFirst({
      where: { id, isDeleted: false },
    });

    if (!lease) {
      return errorResponse(res, 'Lease not found', 404);
    }

    // Convert date strings to Date objects if provided
    const updateData: Prisma.LeaseUpdateInput = { ...data };
    let newLeaseStart: Date | undefined;
    let newLeaseEnd: Date | undefined;
    
    if (data.leaseStart) {
      newLeaseStart = typeof data.leaseStart === 'string' ? new Date(data.leaseStart) : data.leaseStart;
      updateData.leaseStart = newLeaseStart;
    }
    if (data.leaseEnd) {
      newLeaseEnd = typeof data.leaseEnd === 'string' ? new Date(data.leaseEnd) : data.leaseEnd;
      updateData.leaseEnd = newLeaseEnd;
    }

    // Validate dates if both are provided
    if (newLeaseStart && newLeaseEnd) {
      if (newLeaseStart >= newLeaseEnd) {
        return errorResponse(res, 'Lease end date must be after lease start date', 400);
      }
    }

    // Track changes for history
    const changes: Array<{ field: string; oldValue: unknown; newValue: unknown }> = [];

    if (newLeaseStart && newLeaseStart.getTime() !== lease.leaseStart.getTime()) {
      changes.push({
        field: 'leaseStart',
        oldValue: lease.leaseStart.toISOString(),
        newValue: newLeaseStart.toISOString(),
      });
    }

    if (newLeaseEnd && newLeaseEnd.getTime() !== lease.leaseEnd.getTime()) {
      changes.push({
        field: 'leaseEnd',
        oldValue: lease.leaseEnd.toISOString(),
        newValue: newLeaseEnd.toISOString(),
      });
    }

    if (updateData.rent && typeof updateData.rent === 'number' && updateData.rent !== lease.rent) {
      changes.push({
        field: 'rent',
        oldValue: lease.rent,
        newValue: updateData.rent,
      });
    }

    if (updateData.status && typeof updateData.status === 'string' && updateData.status !== lease.status) {
      const statusValue = updateData.status;
      changes.push({
        field: 'status',
        oldValue: lease.status,
        newValue: statusValue,
      });
      // Track status change separately
      await trackLeaseStatusChange(id, statusValue, req.user?.id);
    }

    const updatedLease = await prisma.lease.update({
      where: { id },
      data: {
        ...updateData,
        updatedBy: req.user?.id,
      },
      include: {
        tenant: true,
        unit: {
          include: {
            property: true,
            block: true,
          },
        },
      },
    });

    // Create history entries for each change
    for (const change of changes) {
      if (change.field !== 'status') {
        await createLeaseHistory(id, 'updated', {
          field: change.field,
          oldValue: change.oldValue,
          newValue: change.newValue,
          changedBy: req.user?.id,
          notes: `${change.field} updated`,
        });
      }
    }

    return successResponse(res, updatedLease);
  } catch (error) {
    logger.error('Update lease error:', error);
    return errorResponse(res, error);
  }
});

// Delete lease (soft delete)
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const lease = await prisma.lease.findFirst({
      where: { id, isDeleted: false },
    });

    if (!lease) {
      return errorResponse(res, 'Lease not found', 404);
    }

    // Track termination before deletion
    if (lease.status === 'Active') {
      await trackLeaseStatusChange(id, 'Terminated', req.user?.id, 'Lease terminated and deleted');
    }

    await prisma.lease.update({
      where: { id },
      data: { isDeleted: true },
    });

    // Create history entry for deletion
    await createLeaseHistory(id, 'terminated', {
      changedBy: req.user?.id,
      notes: 'Lease terminated and deleted',
    });

    return successResponse(res, { message: 'Lease deleted successfully' });
  } catch (error) {
    logger.error('Delete lease error:', error);
    return errorResponse(res, error);
  }
});

// Get lease history
router.get('/:id/history', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const lease = await prisma.lease.findFirst({
      where: { id, isDeleted: false },
    });

    if (!lease) {
      return errorResponse(res, 'Lease not found', 404);
    }

    const history = await getLeaseHistory(id);

    if (!history) {
      return errorResponse(res, 'Lease history not found', 404);
    }

    return successResponse(res, history);
  } catch (error) {
    logger.error('Get lease history error:', error);
    return errorResponse(res, error);
  }
});

// Renew lease
router.post('/:id/renew', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { newLeaseEnd, newRent, notes } = req.body;

    if (!newLeaseEnd) {
      return errorResponse(res, 'newLeaseEnd is required', 400);
    }

    const lease = await prisma.lease.findFirst({
      where: { id, isDeleted: false },
    });

    if (!lease) {
      return errorResponse(res, 'Lease not found', 404);
    }

    const newLeaseEndDate = typeof newLeaseEnd === 'string' ? new Date(newLeaseEnd) : newLeaseEnd;

    if (newLeaseEndDate <= lease.leaseEnd) {
      return errorResponse(res, 'New lease end date must be after current lease end date', 400);
    }

    // Track renewal
    await trackLeaseRenewal(id, {
      newLeaseEnd: newLeaseEndDate,
      newRent: newRent ? Number(newRent) : undefined,
      renewedBy: req.user?.id,
      notes,
    });

    // Update status to Renewed
    await trackLeaseStatusChange(id, 'Renewed', req.user?.id, notes || 'Lease renewed');

    const updatedLease = await prisma.lease.findUnique({
      where: { id },
      include: {
        tenant: true,
        unit: {
          include: {
            property: true,
            block: true,
          },
        },
      },
    });

    // Fetch lease with relations for activity
    const leaseWithRelations = await prisma.lease.findUnique({
      where: { id: lease.id },
      include: { tenant: true, unit: true },
    });

    // Log activity
    await createActivity({
      type: 'lease',
      action: 'updated',
      entityId: lease.id,
      entityName: `${leaseWithRelations?.tenant?.name || 'Tenant'} - ${leaseWithRelations?.unit?.unitName || 'Unit'}`,
      message: `Lease renewed until ${newLeaseEndDate.toISOString().split('T')[0]}`,
      userId: req.user?.id,
      metadata: {
        leaseId: lease.id,
        oldLeaseEnd: lease.leaseEnd.toISOString(),
        newLeaseEnd: newLeaseEndDate.toISOString(),
        oldRent: lease.rent,
        newRent: newRent || lease.rent,
      },
    });

    return successResponse(res, updatedLease);
  } catch (error) {
    logger.error('Renew lease error:', error);
    return errorResponse(res, error);
  }
});

export default router;

