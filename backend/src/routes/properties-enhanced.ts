/**
 * Enhanced Properties API Routes
 * Includes auto-sync workflows, expenses, tenancies, and maintenance
 */

import express, { Response } from 'express';
import { z } from 'zod';
import prisma from '../prisma/client';
import { requireAuth, AuthenticatedRequest, requirePermission } from '../middleware/rbac';
import { createAuditLog } from '../services/audit-log';
import {
  createTenancyFromLease,
  syncPropertyExpenseToFinanceLedger,
  syncMaintenanceToFinanceLedger,
  updatePropertyStatusOnMaintenance,
} from '../services/workflows';
import { createAttachment, getAttachments } from '../services/attachments';
import { getPropertyDashboard } from '../services/analytics';
import { generateSystemId, validateManualUniqueId, validateTID } from '../services/id-generation-service';
import multer from 'multer';

const router = (express as any).Router();
const upload = multer({ storage: multer.memoryStorage() });

// Validation schemas
const createPropertySchema = z.object({
  tid: z.string().min(1, "TID is required"), // Transaction ID - unique across Property, Deal, Client
  name: z.string().min(1),
  title: z.string().optional(),
  type: z.string().min(1),
  address: z.string().min(1),
  city: z.string().optional(),
  location: z.string().optional(),
  size: z.number().positive().optional(),
  status: z.enum(['Vacant', 'Occupied', 'Under-Maintenance']).default('Vacant'),
  description: z.string().optional(),
  yearBuilt: z.number().int().positive().optional(),
  totalArea: z.number().positive().optional(),
  totalUnits: z.number().int().nonnegative().default(0),
  ownerName: z.string().optional(),
  ownerPhone: z.string().optional(),
  rentAmount: z.number().nonnegative().optional(),
  securityDeposit: z.number().nonnegative().default(0),
  rentEscalationPercentage: z.number().nonnegative().default(0),
});

const updatePropertySchema = createPropertySchema.partial();

const createPropertyExpenseSchema = z.object({
  propertyId: z.string().uuid(),
  category: z.enum(['repair', 'maintenance', 'tax', 'utilities', 'insurance', 'other']),
  amount: z.number().positive(),
  date: z.string().datetime().optional(),
  description: z.string().optional(),
});

const assignTenantSchema = z.object({
  propertyId: z.string().uuid(),
  tenantId: z.string().uuid(),
  leaseId: z.string().uuid().optional(),
  leaseStart: z.string().datetime(),
  leaseEnd: z.string().datetime(),
  monthlyRent: z.number().positive(),
});

const createMaintenanceRequestSchema = z.object({
  propertyId: z.string().uuid(),
  tenantId: z.string().uuid().optional(),
  unitId: z.string().uuid().optional(),
  issueTitle: z.string().min(1),
  issueDescription: z.string().min(1),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
});

// Get all properties
router.get(
  '/',
  requireAuth,
  requirePermission('properties.view'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { status, type, city, search } = req.query;

      const where: any = { isDeleted: false };

      if (status) where.status = status;
      if (type) where.type = type;
      if (city) where.city = { contains: city as string, mode: 'insensitive' };
      if (search) {
        where.OR = [
          { name: { contains: search as string, mode: 'insensitive' } },
          { address: { contains: search as string, mode: 'insensitive' } },
          { propertyCode: { contains: search as string, mode: 'insensitive' } },
          { manualUniqueId: { contains: search as string, mode: 'insensitive' } },
          // Note: tid search will be enabled after migration is applied
          // { tid: { contains: search as string, mode: 'insensitive' } },
        ];
      }

      const properties = await prisma.property.findMany({
        where,
        include: {
          tenancies: { where: { status: 'active' }, include: { tenant: true } },
          propertyExpenses: { where: { isDeleted: false }, take: 5, orderBy: { date: 'desc' } },
          maintenanceRequests: { where: { isDeleted: false }, take: 5, orderBy: { createdAt: 'desc' } },
        },
        orderBy: { createdAt: 'desc' },
      });

      res.json(properties);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Get property by ID
router.get(
  '/:id',
  requireAuth,
  requirePermission('properties.view'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const property = await prisma.property.findUnique({
        where: { id: req.params.id, isDeleted: false },
        include: {
          tenancies: { include: { tenant: true, lease: true } },
          propertyExpenses: { where: { isDeleted: false }, orderBy: { date: 'desc' } },
          maintenanceRequests: { where: { isDeleted: false }, orderBy: { createdAt: 'desc' } },
          attachments: { where: { isDeleted: false } },
          deals: {
            where: { isDeleted: false },
            include: {
              financeLedgers: { where: { isDeleted: false }, orderBy: { date: 'desc' }, take: 20 },
            },
          },
        },
      });

      if (!property) {
        return res.status(404).json({ error: 'Property not found' });
      }

      res.json(property);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Get property dashboard
router.get(
  '/:id/dashboard',
  requireAuth,
  requirePermission('properties.view'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const dashboard = await getPropertyDashboard(req.params.id);
      res.json(dashboard);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Create property
router.post(
  '/',
  requireAuth,
  requirePermission('properties.create'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const data = createPropertySchema.parse(req.body);
      const { manualUniqueId, tid, ...propertyData } = data as any;

      // Validate TID - must be unique across Property, Deal, and Client
      await validateTID(tid.trim());

      // Validate manual unique ID if provided
      if (manualUniqueId) {
        await validateManualUniqueId(manualUniqueId, 'prop');
      }

      // Generate system ID: prop-YY-####
      const propertyCode = await generateSystemId('prop');

      const property = await prisma.$transaction(async (tx) => {
        return await tx.property.create({
          data: {
            ...propertyData,
            propertyCode,
            tid: tid.trim(),
            manualUniqueId: manualUniqueId?.trim() || null,
          },
        });
      });

      // Audit log
      await createAuditLog({
        entityType: 'property',
        entityId: property.id,
        action: 'create',
        userId: req.user?.id,
        userName: req.user?.username,
        userRole: req.user?.role?.name,
        newValues: property,
        description: `Property created: ${property.name}`,
        req,
      });

      res.status(201).json(property);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  }
);

// Update property
router.put(
  '/:id',
  requireAuth,
  requirePermission('properties.update'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const oldProperty = await prisma.property.findUnique({
        where: { id: req.params.id },
      });

      if (!oldProperty) {
        return res.status(404).json({ error: 'Property not found' });
      }

      const data = updatePropertySchema.parse(req.body);
      const { tid, ...updateData } = data as any;

      // TID cannot be changed after creation
      if (tid !== undefined && tid !== oldProperty.tid) {
        return res.status(400).json({ error: 'TID cannot be changed after property creation' });
      }

      const property = await prisma.property.update({
        where: { id: req.params.id },
        data: updateData,
        include: {
          units: { where: { isDeleted: false } },
          tenancies: { where: { status: 'active' } },
        },
      });

      // Recalculate occupancy and revenue if units/tenancies changed
      const occupiedUnits = property.units.filter(u => u.status === 'Occupied').length;
      const totalUnits = property.totalUnits || property.units.length;
      
      // Update property status based on occupancy
      if (occupiedUnits === 0 && property.tenancies.length === 0) {
        await prisma.property.update({
          where: { id: req.params.id },
          data: { status: 'Vacant' },
        });
      } else if (occupiedUnits > 0 || property.tenancies.length > 0) {
        await prisma.property.update({
          where: { id: req.params.id },
          data: { status: 'Occupied' },
        });
      }

      // Audit log
      await createAuditLog({
        entityType: 'property',
        entityId: property.id,
        action: 'update',
        userId: req.user?.id,
        userName: req.user?.username,
        userRole: req.user?.role?.name,
        oldValues: oldProperty,
        newValues: property,
        description: `Property updated: ${property.name}`,
        req,
      });

      res.json(property);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  }
);

// Delete property (soft delete)
router.delete(
  '/:id',
  requireAuth,
  requirePermission('properties.delete'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;

      const property = await prisma.property.findFirst({
        where: { id, isDeleted: false },
        include: {
          units: { where: { isDeleted: false } },
          blocks: { where: { isDeleted: false } },
          floors: { where: { isDeleted: false } },
        },
      });

      if (!property) {
        return res.status(404).json({ error: 'Property not found' });
      }

      // Use transaction to ensure all deletions happen together
      await prisma.$transaction(async (tx) => {
        // Soft delete all units related to this property
        await tx.unit.updateMany({
          where: {
            propertyId: id,
            isDeleted: false,
          },
          data: { 
            isDeleted: true,
            status: 'Vacant',
          },
        });

        // Soft delete all blocks related to this property
        await tx.block.updateMany({
          where: {
            propertyId: id,
            isDeleted: false,
          },
          data: { isDeleted: true },
        });

        // Soft delete all floors related to this property
        await tx.floor.updateMany({
          where: {
            propertyId: id,
            isDeleted: false,
          },
          data: { isDeleted: true },
        });

        // Soft delete property
        await tx.property.update({
          where: { id },
          data: { isDeleted: true },
        });
      });

      // Audit log
      await createAuditLog({
        entityType: 'property',
        entityId: property.id,
        action: 'delete',
        userId: req.user?.id,
        userName: req.user?.username,
        userRole: req.user?.role?.name,
        description: `Property deleted: ${property.name} (${property.units.length} units, ${property.blocks.length} blocks, ${property.floors.length} floors)`,
        req,
      });

      res.json({ 
        message: 'Property deleted successfully',
        data: {
          unitsDeleted: property.units.length,
          blocksDeleted: property.blocks.length,
          floorsDeleted: property.floors.length,
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Assign tenant to property
router.post(
  '/:id/assign-tenant',
  requireAuth,
  requirePermission('properties.update'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { tenantId, leaseId, leaseStart, leaseEnd, monthlyRent } = assignTenantSchema.parse({
        ...req.body,
        propertyId: req.params.id,
      });

      // Create or update tenancy
      const tenancy = await prisma.tenancy.upsert({
        where: {
          propertyId_tenantId_leaseStart: {
            propertyId: req.params.id,
            tenantId,
            leaseStart: new Date(leaseStart),
          },
        },
        create: {
          propertyId: req.params.id,
          tenantId,
          leaseId,
          leaseStart: new Date(leaseStart),
          leaseEnd: new Date(leaseEnd),
          monthlyRent,
          nextInvoiceDate: new Date(leaseStart),
          status: 'active',
        },
        update: {
          leaseEnd: new Date(leaseEnd),
          monthlyRent,
          status: 'active',
        },
      });

      // Update property status
      const property = await prisma.property.update({
        where: { id: req.params.id },
        data: { status: 'Occupied' },
      });

      // If lease exists, create tenancy from lease
      if (leaseId) {
        await createTenancyFromLease(leaseId);
      }

      // Audit log
      await createAuditLog({
        entityType: 'property',
        entityId: req.params.id,
        action: 'update',
        userId: req.user?.id,
        userName: req.user?.username,
        userRole: req.user?.role?.name,
        description: `Tenant assigned to property`,
        metadata: { tenantId, tenancyId: tenancy.id },
        req,
      });

      res.status(201).json({
        tenancy,
        property,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  }
);

// Remove tenant from property
router.delete(
  '/:id/remove-tenant/:tenantId',
  requireAuth,
  requirePermission('properties.update'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      // End tenancy
      await prisma.tenancy.updateMany({
        where: {
          propertyId: req.params.id,
          tenantId: req.params.tenantId,
          status: 'active',
        },
        data: { status: 'ended' },
      });

      // Update property status if no active tenancies
      const activeTenancies = await prisma.tenancy.count({
        where: {
          propertyId: req.params.id,
          status: 'active',
        },
      });

      if (activeTenancies === 0) {
        await prisma.property.update({
          where: { id: req.params.id },
          data: { status: 'Vacant' },
        });
      }

      res.json({ message: 'Tenant removed successfully' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Add property expense
router.post(
  '/:id/expenses',
  requireAuth,
  requirePermission('properties.update'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const data = createPropertyExpenseSchema.parse({
        ...req.body,
        propertyId: req.params.id,
      });

      const expense = await prisma.propertyExpense.create({
        data: {
          ...data,
          date: data.date ? new Date(data.date) : new Date(),
          createdBy: req.user?.id,
        },
      });

      // Auto-sync to Finance Ledger
      await syncPropertyExpenseToFinanceLedger(expense.id);

      // Refetch expense to get updated financeLedgerId
      const updatedExpense = await prisma.propertyExpense.findUnique({
        where: { id: expense.id },
      });

      // Audit log
      await createAuditLog({
        entityType: 'property_expense',
        entityId: expense.id,
        action: 'create',
        userId: req.user?.id,
        userName: req.user?.username,
        userRole: req.user?.role?.name,
        newValues: updatedExpense || expense,
        description: `Property expense added: ${expense.category}`,
        req,
      });

      res.status(201).json(updatedExpense || expense);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  }
);

const updateMaintenanceRequestSchema = z.object({
  status: z.enum(['open', 'assigned', 'in-progress', 'completed', 'cancelled']).optional(),
  actualCost: z.number().positive().optional(),
  completedAt: z.string().datetime().optional(),
  assignedTo: z.string().optional(),
  assignedToName: z.string().optional(),
});

// Create maintenance request
router.post(
  '/:id/maintenance',
  requireAuth,
  requirePermission('properties.update'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const data = createMaintenanceRequestSchema.parse({
        ...req.body,
        propertyId: req.params.id,
      });

      const maintenance = await prisma.maintenanceRequest.create({
        data: {
          ...data,
          createdBy: req.user?.id,
        },
      });

      // Update property status if high priority
      await updatePropertyStatusOnMaintenance(maintenance.id);

      // Audit log
      await createAuditLog({
        entityType: 'maintenance_request',
        entityId: maintenance.id,
        action: 'create',
        userId: req.user?.id,
        userName: req.user?.username,
        userRole: req.user?.role?.name,
        newValues: maintenance,
        description: `Maintenance request created: ${maintenance.issueTitle}`,
        req,
      });

      res.status(201).json(maintenance);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  }
);

// Update maintenance request
router.put(
  '/:id/maintenance/:maintenanceId',
  requireAuth,
  requirePermission('properties.update'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const oldMaintenance = await prisma.maintenanceRequest.findUnique({
        where: { id: req.params.maintenanceId },
      });

      if (!oldMaintenance) {
        return res.status(404).json({ error: 'Maintenance request not found' });
      }

      const data = updateMaintenanceRequestSchema.parse(req.body);

      const maintenance = await prisma.maintenanceRequest.update({
        where: { id: req.params.maintenanceId },
        data: {
          ...data,
          completedAt: data.completedAt ? new Date(data.completedAt) : undefined,
          updatedBy: req.user?.id,
        },
      });

      // Auto-sync to Finance Ledger if completed with actualCost
      if (maintenance.status === 'completed' && maintenance.actualCost && maintenance.actualCost > 0) {
        // Only sync if not already synced
        if (!oldMaintenance.financeLedgerId) {
          await syncMaintenanceToFinanceLedger(maintenance.id);
        }
      }

      // Update property status back to normal if maintenance completed
      if (maintenance.status === 'completed' && oldMaintenance.status !== 'completed') {
        const property = await prisma.property.findUnique({
          where: { id: req.params.id },
          include: {
            units: { where: { isDeleted: false, status: 'Occupied' } },
            tenancies: { where: { status: 'active' } },
          },
        });

        if (property) {
          const hasOccupiedUnits = property.units.length > 0 || property.tenancies.length > 0;
          await prisma.property.update({
            where: { id: req.params.id },
            data: { status: hasOccupiedUnits ? 'Occupied' : 'Vacant' },
          });
        }
      }

      // Audit log
      await createAuditLog({
        entityType: 'maintenance_request',
        entityId: maintenance.id,
        action: 'update',
        userId: req.user?.id,
        userName: req.user?.username,
        userRole: req.user?.role?.name,
        oldValues: oldMaintenance,
        newValues: maintenance,
        description: `Maintenance request updated: ${maintenance.issueTitle}`,
        req,
      });

      res.json(maintenance);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  }
);

// Upload property documents
router.post(
  '/:id/upload',
  requireAuth,
  requirePermission('properties.update'),
  upload.single('file'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const { saveUploadedFile, createAttachment } = await import('../services/attachments');
      const fileUrl = await saveUploadedFile(req.file, 'property', req.params.id);

      const attachment = await createAttachment({
        fileName: req.file.originalname,
        fileUrl,
        fileType: req.file.mimetype,
        fileSize: req.file.size,
        entityType: 'property',
        entityId: req.params.id,
        uploadedBy: req.user?.id,
      });

      res.status(201).json(attachment);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Get property attachments
router.get(
  '/:id/attachments',
  requireAuth,
  requirePermission('properties.view'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const attachments = await getAttachments('property', req.params.id);
      res.json(attachments);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

export default router;

