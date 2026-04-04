import express, { Response } from 'express';
import { z } from 'zod';
import { Prisma } from '../prisma/client';
import prisma from '../prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { createActivity } from '../utils/activity';
import { updateTenantLedger } from '../services/workflows';
import { getAllTenantAlerts, getOverdueRentAlerts, getTenantLeaseExpiryAlerts } from '../services/tenant-alerts';
import logger from '../utils/logger';
import { successResponse, errorResponse } from '../utils/error-handler';
import { validateTID } from '../services/id-generation-service';
import { parsePaginationQuery, calculatePagination } from '../utils/pagination';

const router = (express as any).Router();

// Helper function to generate unique tenant code
async function generateTenantCode(): Promise<string> {
  let code: string = '';
  let exists = true;
  while (exists) {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(1000 + Math.random() * 9000);
    code = `TENANT-${dateStr}-${random}`;
    const existing = await prisma.tenant.findUnique({ where: { tenantCode: code } });
    exists = !!existing;
  }
  return code;
}

// Convert client to tenant
router.post('/convert-from-client/:clientId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { clientId } = req.params;
    const { unitId, tid } = req.body;

    if (!unitId) {
      return errorResponse(res, 'Unit ID is required', 400);
    }

    if (!tid) {
      return errorResponse(res, 'TID is required', 400);
    }

    // Validate TID
    await validateTID(tid);

    // Get client
    const client = await prisma.client.findFirst({
      where: { id: clientId, isDeleted: false },
      include: {
        deals: {
          where: { isDeleted: false },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!client) {
      return errorResponse(res, 'Client not found', 404);
    }

    // Verify unit exists and is not occupied
    const unit = await prisma.unit.findFirst({
      where: { id: unitId, isDeleted: false },
      include: {
        tenant: { where: { isDeleted: false } },
        property: true,
      },
    });

    if (!unit) {
      return errorResponse(res, 'Unit not found', 404);
    }

    if (unit.tenant) {
      return errorResponse(res, 'Unit is already occupied', 400);
    }

    // Generate tenant code
    const tenantCode = await generateTenantCode();

    // Create tenant from client
    const tenant = await prisma.tenant.create({
      data: {
        name: client.name,
        email: client.email || undefined,
        phone: client.phone || undefined,
        address: client.address || undefined,
        cnic: client.cnic || undefined,
        cnicDocumentUrl: client.cnicDocumentUrl || undefined,
        tenantCode,
        tid,
        unitId,
        outstandingBalance: 0,
        advanceBalance: 0,
        isActive: true,
      },
      include: {
        unit: {
          include: {
            property: true,
            block: true,
          },
        },
      },
    });

    // Update unit status
    await prisma.unit.update({
      where: { id: unitId },
      data: { status: 'Occupied' },
    });

    // Update property status
    await prisma.property.update({
      where: { id: unit.propertyId },
      data: { status: 'Occupied' },
    });

    // Link client deals to tenant (if any)
    if (client.deals.length > 0) {
      // You can add metadata or notes about the conversion
      await createActivity({
        type: 'tenant',
        action: 'created',
        entityId: tenant.id,
        entityName: tenant.name,
        message: `Tenant created from client "${client.name}" (Client Code: ${client.clientCode})`,
        userId: req.user?.id,
        metadata: {
          tenantId: tenant.id,
          clientId: client.id,
          clientCode: client.clientCode,
          convertedFromClient: true,
          relatedDeals: client.deals.map(d => d.id),
        },
      });
    } else {
      await createActivity({
        type: 'tenant',
        action: 'created',
        entityId: tenant.id,
        entityName: tenant.name,
        message: `Tenant created from client "${client.name}"`,
        userId: req.user?.id,
        metadata: {
          tenantId: tenant.id,
          clientId: client.id,
          clientCode: client.clientCode,
          convertedFromClient: true,
        },
      });
    }

    return successResponse(res, tenant, 201);
  } catch (error) {
    logger.error('Convert client to tenant error:', error);
    return errorResponse(res, error);
    return errorResponse(res, error);
  }
});

// Validation schemas
const createTenantSchema = z.object({
  tid: z.string().min(1, 'TID is required'),
  name: z.string().min(1, 'Tenant name is required'),
  email: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? undefined : val),
    z.string().email().optional()
  ),
  phone: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? undefined : val),
    z.string().optional()
  ),
  address: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? undefined : val),
    z.string().optional()
  ),
  cnic: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? undefined : val),
    z.string().optional()
  ),
  unitId: z.string().uuid('Invalid unit ID'),
});

const updateTenantSchema = createTenantSchema.partial();

// Get all tenants
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { unitId, propertyId, blockId, search } = req.query;

    const { page, limit } = parsePaginationQuery(req.query);
    const skip = (page - 1) * limit;

    const where: Prisma.TenantWhereInput = {
      isDeleted: false,
    };

    if (unitId) {
      where.unitId = unitId as string;
    }

    if (blockId) {
      where.unit = {
        blockId: blockId as string,
        isDeleted: false,
      };
    } else if (propertyId) {
      where.unit = {
        propertyId: propertyId as string,
        isDeleted: false,
      };
    }

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } },
        { phone: { contains: search as string, mode: 'insensitive' } },
        { tenantCode: { contains: search as string, mode: 'insensitive' } },
        { cnic: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const [tenants, total] = await Promise.all([
      prisma.tenant.findMany({
      where,
      include: {
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
        leases: {
          where: { isDeleted: false },
          orderBy: { leaseStart: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.tenant.count({ where }),
    ]);

    const pagination = calculatePagination(page, limit, total);

    return successResponse(res, tenants, 200, pagination);
  } catch (error) {
    logger.error('Get tenants error:', error);
    return errorResponse(res, error);
  }
});

// Get tenant by ID
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const tenant = await prisma.tenant.findFirst({
      where: {
        id,
        isDeleted: false,
      },
      include: {
        unit: {
          include: {
            property: true,
            block: true,
          },
        },
        leases: {
          where: { isDeleted: false },
          orderBy: { leaseStart: 'desc' },
        },
      },
    });

    if (!tenant) {
      return errorResponse(res, 'Tenant not found', 404);
    }

    return successResponse(res, tenant);
  } catch (error) {
    logger.error('Get tenant error:', error);
    return errorResponse(res, error);
  }
});

// Create tenant
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    logger.info('Tenant creation request payload:', req.body);
    const data = createTenantSchema.parse(req.body);
    logger.info('Tenant creation data after validation:', data);

    // Verify unit exists and is not already occupied
    const unit = await prisma.unit.findFirst({
      where: { id: data.unitId, isDeleted: false },
      include: {
        tenant: {
          where: { isDeleted: false },
        },
        property: true,
      },
    });

    if (!unit) {
      return errorResponse(res, 'Unit not found', 404);
    }

    // Double-assignment validation: Check if unit already has an active tenant
    if (unit.tenant) {
      return errorResponse(res, 'Unit is already occupied by another tenant', 400, {
          existingTenantId: unit.tenant.id,
          existingTenantName: unit.tenant.name,
          unitId: unit.id,
          unitName: unit.unitName,
      });
    }

    // Additional check: Verify unit status
    if (unit.status === 'Occupied') {
      return errorResponse(res, 'Unit status indicates it is already occupied. Please verify the unit status before assigning a tenant.', 400);
    }

    // Validate TID
    await validateTID(data.tid);

    const tenantCode = await generateTenantCode();

    const tenant = await prisma.tenant.create({
      data: {
        ...data,
        tenantCode,
        tid: data.tid,
        email: data.email || undefined,
      },
      include: {
        unit: {
          include: {
            property: true,
            block: true,
          },
        },
      },
    });

    // Auto-sync: Update unit status to Occupied
    await prisma.unit.update({
      where: { id: data.unitId },
      data: { status: 'Occupied' },
    });

    // Auto-sync: Update property status to Occupied if needed
    const property = await prisma.property.findUnique({
      where: { id: tenant.unit.property.id },
      include: {
        units: { where: { isDeleted: false, status: 'Occupied' } },
      },
    });

    if (property && property.status !== 'Occupied') {
      await prisma.property.update({
        where: { id: property.id },
        data: { status: 'Occupied' },
      });
    }

    // Auto-sync: Update dashboard KPIs (occupancy rate, revenue calculations)
    // This will be handled by dashboard refresh, but we trigger it here
    // The dashboard will recalculate based on updated unit/property status

    // Log activity
    await createActivity({
      type: 'tenant',
      action: 'created',
      entityId: tenant.id,
      entityName: tenant.name,
      message: `Tenant "${tenant.name}" was added to unit "${tenant.unit.unitName}"`,
      userId: req.user?.id,
      metadata: {
        tenantId: tenant.id,
        tenantName: tenant.name,
        unitId: tenant.unit.id,
        unitName: tenant.unit.unitName,
        propertyId: tenant.unit.property.id,
        propertyName: tenant.unit.property.name,
      },
    });

    return successResponse(res, tenant, 201);
  } catch (error) {
    logger.error('Create tenant error:', error);
    return errorResponse(res, error);
  }
});

// Update tenant
router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const data = updateTenantSchema.parse(req.body);

    const tenant = await prisma.tenant.findFirst({
      where: { id, isDeleted: false },
    });

    if (!tenant) {
      return errorResponse(res, 'Tenant not found', 404);
    }

    const updatedTenant = await prisma.tenant.update({
      where: { id },
      data: {
        ...data,
        email: data.email !== undefined ? (data.email || undefined) : undefined,
      },
      include: {
        unit: {
          include: {
            property: true,
            block: true,
          },
        },
      },
    });

    return successResponse(res, updatedTenant);
  } catch (error) {
    logger.error('Update tenant error:', error);
    return errorResponse(res, error);
  }
});

// Delete tenant (soft delete)
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const tenant = await prisma.tenant.findFirst({
      where: { id, isDeleted: false },
      include: {
        unit: true,
      },
    });

    if (!tenant) {
      return errorResponse(res, 'Tenant not found', 404);
    }

    await prisma.tenant.update({
      where: { id },
      data: { isDeleted: true },
    });

    // Update unit status to Vacant
    await prisma.unit.update({
      where: { id: tenant.unitId },
      data: { status: 'Vacant' },
    });

    // Check if property should be marked as Vacant
    const property = await prisma.property.findUnique({
      where: { id: tenant.unit.propertyId },
      include: {
        units: { where: { isDeleted: false, status: 'Occupied' } },
        tenancies: { where: { status: 'active' } },
      },
    });

    if (property) {
      const hasOccupiedUnits = property.units.length > 0;
      const hasActiveTenancies = property.tenancies.length > 0;

      if (!hasOccupiedUnits && !hasActiveTenancies) {
        await prisma.property.update({
          where: { id: property.id },
          data: { status: 'Vacant' },
        });
      }
    }

    // End all active tenancies for this tenant
    await prisma.tenancy.updateMany({
      where: {
        tenantId: id,
        status: 'active',
      },
      data: { status: 'ended' },
    });

    // Log activity
    await createActivity({
      type: 'tenant',
      action: 'deleted',
      entityId: tenant.id,
      entityName: tenant.name,
      message: `Tenant "${tenant.name}" was deleted`,
      userId: req.user?.id,
      metadata: {
        tenantId: tenant.id,
        tenantName: tenant.name,
        unitId: tenant.unitId,
      },
    });

    return successResponse(res, { message: 'Tenant deleted successfully' });
  } catch (error) {
    logger.error('Delete tenant error:', error);
    return errorResponse(res, error);
  }
});

// Get tenant alerts (overdue rent + lease expiry)
router.get('/:id/alerts', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const tenant = await prisma.tenant.findFirst({
      where: { id, isDeleted: false },
    });

    if (!tenant) {
      return errorResponse(res, 'Tenant not found', 404);
    }

    const alerts = await getAllTenantAlerts(id);

    return successResponse(res, alerts);
  } catch (error) {
    logger.error('Get tenant alerts error:', error);
    return errorResponse(res, error);
  }
});

// Get overdue rent alerts
router.get('/alerts/overdue-rent', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { tenantId } = req.query;

    const alerts = await getOverdueRentAlerts(
      tenantId ? (tenantId as string) : undefined
    );

    return successResponse(res, alerts);
  } catch (error) {
    logger.error('Get overdue rent alerts error:', error);
    return errorResponse(res, error);
  }
});

// Get lease expiry alerts
router.get('/alerts/lease-expiry', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { tenantId } = req.query;

    const alerts = await getTenantLeaseExpiryAlerts(
      tenantId ? (tenantId as string) : undefined
    );

    return successResponse(res, alerts);
  } catch (error) {
    logger.error('Get lease expiry alerts error:', error);
    return errorResponse(res, error);
  }
});

export default router;

