/**
 * Construction Module API Routes
 * Finance-Safe Extension of REMS
 */

import express, { Response } from 'express';
import { z } from 'zod';
import prisma from '../prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { ConstructionPostingService } from '../services/construction-posting-service';
import logger from '../utils/logger';
import { parsePaginationQuery, calculatePagination } from '../utils/pagination';
import { successResponse } from '../utils/error-handler';

const router = (express as any).Router();

// ============================================
// UTILITY FUNCTIONS
// ============================================

const generateProjectCode = (): string => {
  const date = new Date();
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const random = Math.floor(1000 + Math.random() * 9000).toString();
  return `PROJ-${year}${month}-${random}`;
};

const generateDocumentCode = (prefix: string): string => {
  const date = new Date();
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  const random = Math.floor(100 + Math.random() * 900).toString();
  return `${prefix}-${year}${month}${day}-${random}`;
};

// ============================================
// CONSTRUCTION PROJECTS
// ============================================

const projectSchema = z.object({
  code: z.string().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  propertyId: z.string().uuid().optional(),
  status: z.enum(['planning', 'active', 'on-hold', 'completed', 'closed']).optional(),
  accountingMode: z.enum(['WIP', 'DirectExpense']).optional(),
  costCodeMandatory: z.boolean().optional(),
  budgetEnforcement: z.boolean().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  budgetAmount: z.number().positive().optional(),
});

// GET /api/construction/projects
router.get('/projects', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit, skip } = parsePaginationQuery(req.query);
    const { status, propertyId, search } = req.query;

    const where: any = { isDeleted: false };
    if (status) where.status = status;
    if (propertyId) where.propertyId = propertyId;
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { code: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const [projects, total] = await Promise.all([
      prisma.constructionProject.findMany({
        where,
        include: {
          property: {
            select: { id: true, name: true, propertyCode: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: skip as number,
        take: limit,
      }),
      prisma.constructionProject.count({ where }),
    ]);

    return successResponse(res, projects, 200, calculatePagination(page, limit, total));
  } catch (error: any) {
    logger.error('Error fetching construction projects:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch projects' });
  }
});

// GET /api/construction/projects/:id
router.get('/projects/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const project = await prisma.constructionProject.findUnique({
      where: { id: req.params.id },
      include: {
        property: true,
        costCodes: true,
        budgets: {
          include: { costCode: true },
        },
        milestones: true,
      },
    });

    if (!project || project.isDeleted) {
      return res.status(404).json({ error: 'Project not found' });
    }

    return successResponse(res, project);
  } catch (error: any) {
    logger.error('Error fetching project:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch project' });
  }
});

// POST /api/construction/projects
router.post('/projects', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const data = projectSchema.parse(req.body);
    const code = data.code || generateProjectCode();

    const project = await prisma.constructionProject.create({
      data: {
        ...data,
        code,
        createdBy: req.user?.id,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
      },
      include: {
        property: {
          select: { id: true, name: true, propertyCode: true },
        },
      },
    });

    return successResponse(res, project, 201);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    logger.error('Error creating project:', error);
    res.status(500).json({ error: error.message || 'Failed to create project' });
  }
});

// PUT /api/construction/projects/:id
router.put('/projects/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const data = projectSchema.partial().parse(req.body);

    const project = await prisma.constructionProject.update({
      where: { id: req.params.id },
      data: {
        ...data,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
      },
      include: {
        property: {
          select: { id: true, name: true, propertyCode: true },
        },
      },
    });

    return successResponse(res, project);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    logger.error('Error updating project:', error);
    res.status(500).json({ error: error.message || 'Failed to update project' });
  }
});

// DELETE /api/construction/projects/:id
router.delete('/projects/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.constructionProject.update({
      where: { id: req.params.id },
      data: { isDeleted: true },
    });

    return successResponse(res, { message: 'Project deleted successfully' });
  } catch (error: any) {
    logger.error('Error deleting project:', error);
    res.status(500).json({ error: error.message || 'Failed to delete project' });
  }
});

// ============================================
// COST CODES
// ============================================

const costCodeSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  level: z.number().int().min(1).max(3),
  parentId: z.string().uuid().optional(),
  description: z.string().optional(),
  projectId: z.string().uuid().optional(),
});

// GET /api/construction/cost-codes
router.get('/cost-codes', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, level, parentId } = req.query;
    const where: any = { isActive: true };
    if (projectId) where.projectId = projectId;
    if (level) where.level = parseInt(level as string);
    if (parentId) where.parentId = parentId;

    const costCodes = await prisma.costCode.findMany({
      where,
      include: {
        parent: true,
        children: true,
      },
      orderBy: [{ level: 'asc' }, { code: 'asc' }],
    });

    return successResponse(res, costCodes);
  } catch (error: any) {
    logger.error('Error fetching cost codes:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch cost codes' });
  }
});

// POST /api/construction/cost-codes
router.post('/cost-codes', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const data = costCodeSchema.parse(req.body);

    const costCode = await prisma.costCode.create({
      data,
      include: {
        parent: true,
        children: true,
      },
    });

    return successResponse(res, costCode, 201);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    logger.error('Error creating cost code:', error);
    res.status(500).json({ error: error.message || 'Failed to create cost code' });
  }
});

// PUT /api/construction/cost-codes/:id
router.put('/cost-codes/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const data = costCodeSchema.partial().parse(req.body);

    const costCode = await prisma.costCode.update({
      where: { id: req.params.id },
      data,
      include: {
        parent: true,
        children: true,
      },
    });

    return successResponse(res, costCode);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    logger.error('Error updating cost code:', error);
    res.status(500).json({ error: error.message || 'Failed to update cost code' });
  }
});

// ============================================
// DAILY LOGS
// ============================================

const dailyLogSchema = z.object({
  projectId: z.string().uuid(),
  logDate: z.string().datetime(),
  weather: z.string().optional(),
  siteActivities: z.array(z.string()).optional(),
  laborHours: z.number().default(0),
  equipmentHours: z.number().default(0),
  notes: z.string().optional(),
  attachments: z.any().optional(),
});

// GET /api/construction/daily-logs
router.get('/daily-logs', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit, skip } = parsePaginationQuery(req.query);
    const { projectId, status, fromDate, toDate } = req.query;

    const where: any = { isDeleted: false };
    if (projectId) where.projectId = projectId;
    if (status) where.status = status;
    if (fromDate || toDate) {
      where.logDate = {};
      if (fromDate) where.logDate.gte = new Date(fromDate as string);
      if (toDate) where.logDate.lte = new Date(toDate as string);
    }

    const [logs, total] = await Promise.all([
      prisma.constructionDailyLog.findMany({
        where,
        include: {
          project: {
            select: { id: true, code: true, name: true },
          },
        },
        orderBy: { logDate: 'desc' },
        skip: skip as number,
        take: limit,
      }),
      prisma.constructionDailyLog.count({ where }),
    ]);

    return successResponse(res, logs, 200, calculatePagination(page, limit, total));
  } catch (error: any) {
    logger.error('Error fetching daily logs:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch daily logs' });
  }
});

// POST /api/construction/daily-logs
router.post('/daily-logs', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const data = dailyLogSchema.parse(req.body);

    const log = await prisma.constructionDailyLog.create({
      data: {
        ...data,
        logDate: new Date(data.logDate),
        createdBy: req.user?.id,
      },
      include: {
        project: {
          select: { id: true, code: true, name: true },
        },
      },
    });

    return successResponse(res, log, 201);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    logger.error('Error creating daily log:', error);
    res.status(500).json({ error: error.message || 'Failed to create daily log' });
  }
});

// PUT /api/construction/daily-logs/:id/approve
router.put('/daily-logs/:id/approve', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const log = await prisma.constructionDailyLog.update({
      where: { id: req.params.id },
      data: {
        status: 'approved',
        approvedBy: req.user?.id,
        approvedAt: new Date(),
      },
    });

    return successResponse(res, log);
  } catch (error: any) {
    logger.error('Error approving daily log:', error);
    res.status(500).json({ error: error.message || 'Failed to approve daily log' });
  }
});

// ============================================
// LABOR & CREW
// ============================================

const crewSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  crewLeadId: z.string().uuid().optional(),
});

// GET /api/construction/crews
router.get('/crews', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const crews = await prisma.constructionCrew.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });

    return successResponse(res, crews);
  } catch (error: any) {
    logger.error('Error fetching crews:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch crews' });
  }
});

// POST /api/construction/crews
router.post('/crews', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const data = crewSchema.parse(req.body);

    const crew = await prisma.constructionCrew.create({
      data,
    });

    return successResponse(res, crew, 201);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    logger.error('Error creating crew:', error);
    res.status(500).json({ error: error.message || 'Failed to create crew' });
  }
});

const laborSchema = z.object({
  projectId: z.string().uuid(),
  costCodeId: z.string().uuid(),
  crewId: z.string().uuid().optional(),
  employeeId: z.string().uuid().optional(),
  workDate: z.string().datetime(),
  hours: z.number().positive(),
  rate: z.number().positive().optional(),
  amount: z.number().positive(),
  description: z.string().optional(),
});

// GET /api/construction/labor
router.get('/labor', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit, skip } = parsePaginationQuery(req.query);
    const { projectId, status, fromDate, toDate } = req.query;

    const where: any = { isDeleted: false };
    if (projectId) where.projectId = projectId;
    if (status) where.status = status;
    if (fromDate || toDate) {
      where.workDate = {};
      if (fromDate) where.workDate.gte = new Date(fromDate as string);
      if (toDate) where.workDate.lte = new Date(toDate as string);
    }

    const [labor, total] = await Promise.all([
      prisma.constructionLabor.findMany({
        where,
        include: {
          project: { select: { id: true, code: true, name: true } },
          costCode: true,
          crew: true,
        },
        orderBy: { workDate: 'desc' },
        skip: skip as number,
        take: limit,
      }),
      prisma.constructionLabor.count({ where }),
    ]);

    return successResponse(res, labor, 200, calculatePagination(page, limit, total));
  } catch (error: any) {
    logger.error('Error fetching labor:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch labor' });
  }
});

// POST /api/construction/labor
router.post('/labor', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const data = laborSchema.parse(req.body);

    const labor = await prisma.constructionLabor.create({
      data: {
        ...data,
        workDate: new Date(data.workDate),
        createdBy: req.user?.id,
      },
      include: {
        project: { select: { id: true, code: true, name: true } },
        costCode: true,
        crew: true,
      },
    });

    return successResponse(res, labor, 201);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    logger.error('Error creating labor entry:', error);
    res.status(500).json({ error: error.message || 'Failed to create labor entry' });
  }
});

// PUT /api/construction/labor/:id/approve
router.put('/labor/:id/approve', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const labor = await prisma.constructionLabor.findUnique({
      where: { id: req.params.id },
      include: {
        project: true,
        costCode: true,
      },
    });

    if (!labor) {
      return res.status(404).json({ error: 'Labor entry not found' });
    }

    if (labor.status === 'posted') {
      return res.status(400).json({ error: 'Labor entry already posted' });
    }

    // Validate cost code is mandatory if project requires it
    if (labor.project.costCodeMandatory && !labor.costCodeId) {
      return res.status(400).json({ error: 'Cost code is mandatory for this project' });
    }

    // Update status
    const updated = await prisma.constructionLabor.update({
      where: { id: req.params.id },
      data: {
        status: 'approved',
        approvedBy: req.user?.id,
        approvedAt: new Date(),
      },
    });

    // Post to Finance
    const dimensions = {
      projectId: labor.projectId,
      costCodeId: labor.costCodeId,
      sourceModule: 'Construction' as const,
      referenceDocumentId: labor.id,
      referenceDocumentType: 'LaborApproval',
      approvalMetadata: {
        approvedBy: req.user?.id || '',
        approvedAt: new Date(),
        userId: req.user?.id || '',
      },
    };

    await ConstructionPostingService.postLaborApproval(
      labor.id,
      dimensions,
      labor.amount,
      req.user?.id || ''
    );

    return successResponse(res, updated);
  } catch (error: any) {
    logger.error('Error approving labor:', error);
    res.status(500).json({ error: error.message || 'Failed to approve labor' });
  }
});

// ============================================
// EQUIPMENT
// ============================================

const equipmentSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  type: z.string().optional(),
  make: z.string().optional(),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  hourlyRate: z.number().positive().optional(),
  dailyRate: z.number().positive().optional(),
  costingMethod: z.enum(['hourly', 'daily']).default('hourly'),
});

// GET /api/construction/equipment
router.get('/equipment', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const equipment = await prisma.constructionEquipment.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });

    return successResponse(res, equipment);
  } catch (error: any) {
    logger.error('Error fetching equipment:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch equipment' });
  }
});

// POST /api/construction/equipment
router.post('/equipment', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const data = equipmentSchema.parse(req.body);

    const equipment = await prisma.constructionEquipment.create({
      data,
    });

    return successResponse(res, equipment, 201);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    logger.error('Error creating equipment:', error);
    res.status(500).json({ error: error.message || 'Failed to create equipment' });
  }
});

const equipmentUsageSchema = z.object({
  projectId: z.string().uuid(),
  costCodeId: z.string().uuid(),
  equipmentId: z.string().uuid(),
  usageDate: z.string().datetime(),
  hours: z.number().positive().optional(),
  days: z.number().positive().optional(),
  description: z.string().optional(),
});

// GET /api/construction/equipment-usage
router.get('/equipment-usage', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit, skip } = parsePaginationQuery(req.query);
    const { projectId, equipmentId, status } = req.query;

    const where: any = { isDeleted: false };
    if (projectId) where.projectId = projectId;
    if (equipmentId) where.equipmentId = equipmentId;
    if (status) where.status = status;

    const [usages, total] = await Promise.all([
      prisma.constructionEquipmentUsage.findMany({
        where,
        include: {
          project: { select: { id: true, code: true, name: true } },
          costCode: true,
          equipment: true,
        },
        orderBy: { usageDate: 'desc' },
        skip: skip as number,
        take: limit,
      }),
      prisma.constructionEquipmentUsage.count({ where }),
    ]);

    return successResponse(res, usages, 200, calculatePagination(page, limit, total));
  } catch (error: any) {
    logger.error('Error fetching equipment usage:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch equipment usage' });
  }
});

// POST /api/construction/equipment-usage
router.post('/equipment-usage', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const data = equipmentUsageSchema.parse(req.body);

    // Get equipment to calculate amount
    const equipment = await prisma.constructionEquipment.findUnique({
      where: { id: data.equipmentId },
    });

    if (!equipment) {
      return res.status(404).json({ error: 'Equipment not found' });
    }

    let amount = 0;
    if (equipment.costingMethod === 'hourly' && data.hours) {
      amount = data.hours * (equipment.hourlyRate || 0);
    } else if (equipment.costingMethod === 'daily' && data.days) {
      amount = data.days * (equipment.dailyRate || 0);
    }

    const usage = await prisma.constructionEquipmentUsage.create({
      data: {
        ...data,
        usageDate: new Date(data.usageDate),
        amount,
        createdBy: req.user?.id,
      },
      include: {
        project: { select: { id: true, code: true, name: true } },
        costCode: true,
        equipment: true,
      },
    });

    return successResponse(res, usage, 201);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    logger.error('Error creating equipment usage:', error);
    res.status(500).json({ error: error.message || 'Failed to create equipment usage' });
  }
});

// PUT /api/construction/equipment-usage/:id/approve
router.put('/equipment-usage/:id/approve', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const usage = await prisma.constructionEquipmentUsage.findUnique({
      where: { id: req.params.id },
      include: {
        project: true,
        costCode: true,
      },
    });

    if (!usage) {
      return res.status(404).json({ error: 'Equipment usage not found' });
    }

    if (usage.status === 'posted') {
      return res.status(400).json({ error: 'Equipment usage already posted' });
    }

    const updated = await prisma.constructionEquipmentUsage.update({
      where: { id: req.params.id },
      data: {
        status: 'approved',
        approvedBy: req.user?.id,
        approvedAt: new Date(),
      },
    });

    // Post to Finance
    const dimensions = {
      projectId: usage.projectId,
      costCodeId: usage.costCodeId,
      sourceModule: 'Construction' as const,
      referenceDocumentId: usage.id,
      referenceDocumentType: 'EquipmentUsage',
      approvalMetadata: {
        approvedBy: req.user?.id || '',
        approvedAt: new Date(),
        userId: req.user?.id || '',
      },
    };

    await ConstructionPostingService.postEquipmentUsage(
      usage.id,
      dimensions,
      usage.amount,
      req.user?.id || ''
    );

    return successResponse(res, updated);
  } catch (error: any) {
    logger.error('Error approving equipment usage:', error);
    res.status(500).json({ error: error.message || 'Failed to approve equipment usage' });
  }
});

// ============================================
// INVENTORY
// ============================================

const inventoryItemSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  category: z.string().optional(),
  unit: z.string().default('pcs'),
  unitPrice: z.number().positive().optional(),
});

// GET /api/construction/inventory-items
router.get('/inventory-items', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { category, search } = req.query;
    const where: any = { isActive: true };
    if (category) where.category = category;
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { code: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const items = await prisma.constructionInventoryItem.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    return successResponse(res, items);
  } catch (error: any) {
    logger.error('Error fetching inventory items:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch inventory items' });
  }
});

// POST /api/construction/inventory-items
router.post('/inventory-items', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const data = inventoryItemSchema.parse(req.body);

    const item = await prisma.constructionInventoryItem.create({
      data,
    });

    return successResponse(res, item, 201);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    logger.error('Error creating inventory item:', error);
    res.status(500).json({ error: error.message || 'Failed to create inventory item' });
  }
});

// ============================================
// WAREHOUSES
// ============================================

const warehouseSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  location: z.string().optional(),
});

// GET /api/construction/warehouses
router.get('/warehouses', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const warehouses = await prisma.constructionWarehouse.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });

    return successResponse(res, warehouses);
  } catch (error: any) {
    logger.error('Error fetching warehouses:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch warehouses' });
  }
});

// POST /api/construction/warehouses
router.post('/warehouses', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const data = warehouseSchema.parse(req.body);

    const warehouse = await prisma.constructionWarehouse.create({
      data,
    });

    return successResponse(res, warehouse, 201);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    logger.error('Error creating warehouse:', error);
    res.status(500).json({ error: error.message || 'Failed to create warehouse' });
  }
});

// GET /api/construction/warehouses/:id/stock
router.get('/warehouses/:id/stock', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const stock = await prisma.constructionStockBalance.findMany({
      where: { warehouseId: req.params.id },
      include: {
        item: true,
      },
      orderBy: { item: { name: 'asc' } },
    });

    return successResponse(res, stock);
  } catch (error: any) {
    logger.error('Error fetching stock:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch stock' });
  }
});

// ============================================
// GRN (Goods Receipt Note)
// ============================================

const grnSchema = z.object({
  warehouseId: z.string().uuid(),
  projectId: z.string().uuid().optional(),
  supplierName: z.string().optional(),
  receiptDate: z.string().datetime(),
  notes: z.string().optional(),
  items: z.array(z.object({
    itemId: z.string().uuid(),
    quantity: z.number().positive(),
    unitPrice: z.number().positive(),
  })),
});

// GET /api/construction/grns
router.get('/grns', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit, skip } = parsePaginationQuery(req.query);
    const { warehouseId, projectId, status } = req.query;

    const where: any = { isDeleted: false };
    if (warehouseId) where.warehouseId = warehouseId;
    if (projectId) where.projectId = projectId;
    if (status) where.status = status;

    const [grns, total] = await Promise.all([
      prisma.constructionGRN.findMany({
        where,
        include: {
          warehouse: true,
          project: { select: { id: true, code: true, name: true } },
          items: {
            include: { item: true },
          },
        },
        orderBy: { receiptDate: 'desc' },
        skip: skip as number,
        take: limit,
      }),
      prisma.constructionGRN.count({ where }),
    ]);

    return successResponse(res, grns, 200, calculatePagination(page, limit, total));
  } catch (error: any) {
    logger.error('Error fetching GRNs:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch GRNs' });
  }
});

// POST /api/construction/grns
router.post('/grns', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const data = grnSchema.parse(req.body);
    const grnNumber = generateDocumentCode('GRN');

    const grn = await prisma.$transaction(async (tx) => {
      // Create GRN
      const grn = await tx.constructionGRN.create({
        data: {
          grnNumber,
          warehouseId: data.warehouseId,
          projectId: data.projectId,
          supplierName: data.supplierName,
          receiptDate: new Date(data.receiptDate),
          notes: data.notes,
          createdBy: req.user?.id,
          items: {
            create: data.items.map(item => ({
              itemId: item.itemId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalAmount: item.quantity * item.unitPrice,
            })),
          },
        },
        include: {
          items: {
            include: { item: true },
          },
        },
      });

      // Update stock balances
      for (const item of data.items) {
        const existing = await tx.constructionStockBalance.findUnique({
          where: {
            warehouseId_itemId: {
              warehouseId: data.warehouseId,
              itemId: item.itemId,
            },
          },
        });

        if (existing) {
          await tx.constructionStockBalance.update({
            where: { id: existing.id },
            data: {
              quantity: existing.quantity + item.quantity,
              unitPrice: item.unitPrice, // Update to latest price
              lastUpdated: new Date(),
            },
          });
        } else {
          await tx.constructionStockBalance.create({
            data: {
              warehouseId: data.warehouseId,
              itemId: item.itemId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
            },
          });
        }
      }

      return grn;
    });

    return successResponse(res, grn, 201);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    logger.error('Error creating GRN:', error);
    res.status(500).json({ error: error.message || 'Failed to create GRN' });
  }
});

// PUT /api/construction/grns/:id/post
router.put('/grns/:id/post', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const grn = await prisma.constructionGRN.update({
      where: { id: req.params.id },
      data: {
        status: 'posted',
        postedBy: req.user?.id,
        postedAt: new Date(),
      },
    });

    return successResponse(res, grn);
  } catch (error: any) {
    logger.error('Error posting GRN:', error);
    res.status(500).json({ error: error.message || 'Failed to post GRN' });
  }
});

// ============================================
// ISSUE TO PROJECT
// ============================================

const issueSchema = z.object({
  projectId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  costCodeId: z.string().uuid(),
  issueDate: z.string().datetime(),
  notes: z.string().optional(),
  items: z.array(z.object({
    itemId: z.string().uuid(),
    quantity: z.number().positive(),
  })),
});

// GET /api/construction/issues
router.get('/issues', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit, skip } = parsePaginationQuery(req.query);
    const { projectId, warehouseId, status } = req.query;

    const where: any = { isDeleted: false };
    if (projectId) where.projectId = projectId;
    if (warehouseId) where.warehouseId = warehouseId;
    if (status) where.status = status;

    const [issues, total] = await Promise.all([
      prisma.constructionIssue.findMany({
        where,
        include: {
          project: { select: { id: true, code: true, name: true } },
          warehouse: true,
          costCode: true,
          items: {
            include: { item: true },
          },
        },
        orderBy: { issueDate: 'desc' },
        skip: skip as number,
        take: limit,
      }),
      prisma.constructionIssue.count({ where }),
    ]);

    return successResponse(res, issues, 200, calculatePagination(page, limit, total));
  } catch (error: any) {
    logger.error('Error fetching issues:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch issues' });
  }
});

// POST /api/construction/issues
router.post('/issues', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const data = issueSchema.parse(req.body);
    const issueNumber = generateDocumentCode('ISS');

    // Validate project requires cost code
    const project = await prisma.constructionProject.findUnique({
      where: { id: data.projectId },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (project.costCodeMandatory && !data.costCodeId) {
      return res.status(400).json({ error: 'Cost code is mandatory for this project' });
    }

    // Get stock balances and calculate amounts
    const issueItems = await Promise.all(
      data.items.map(async (item) => {
        const stock = await prisma.constructionStockBalance.findUnique({
          where: {
            warehouseId_itemId: {
              warehouseId: data.warehouseId,
              itemId: item.itemId,
            },
          },
        });

        if (!stock || stock.quantity < item.quantity) {
          throw new Error(`Insufficient stock for item ${item.itemId}`);
        }

        return {
          itemId: item.itemId,
          quantity: item.quantity,
          unitPrice: stock.unitPrice,
          totalAmount: item.quantity * stock.unitPrice,
        };
      })
    );

    const issue = await prisma.$transaction(async (tx) => {
      // Create issue
      const issue = await tx.constructionIssue.create({
        data: {
          issueNumber,
          projectId: data.projectId,
          warehouseId: data.warehouseId,
          costCodeId: data.costCodeId,
          issueDate: new Date(data.issueDate),
          notes: data.notes,
          createdBy: req.user?.id,
          items: {
            create: issueItems,
          },
        },
        include: {
          items: {
            include: { item: true },
          },
        },
      });

      // Update stock balances
      for (const item of issueItems) {
        await tx.constructionStockBalance.update({
          where: {
            warehouseId_itemId: {
              warehouseId: data.warehouseId,
              itemId: item.itemId,
            },
          },
          data: {
            quantity: {
              decrement: item.quantity,
            },
          },
        });
      }

      return issue;
    });

    return successResponse(res, issue, 201);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    logger.error('Error creating issue:', error);
    res.status(500).json({ error: error.message || 'Failed to create issue' });
  }
});

// PUT /api/construction/issues/:id/approve
router.put('/issues/:id/approve', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const issue = await prisma.constructionIssue.findUnique({
      where: { id: req.params.id },
      include: {
        project: true,
        costCode: true,
        items: {
          include: { item: true },
        },
      },
    });

    if (!issue) {
      return res.status(404).json({ error: 'Issue not found' });
    }

    if (issue.status === 'posted') {
      return res.status(400).json({ error: 'Issue already posted' });
    }

    const totalAmount = issue.items.reduce((sum, item) => sum + item.totalAmount, 0);

    const updated = await prisma.constructionIssue.update({
      where: { id: req.params.id },
      data: {
        status: 'approved',
        approvedBy: req.user?.id,
        approvedAt: new Date(),
      },
    });

    // Post to Finance
    const dimensions = {
      projectId: issue.projectId,
      costCodeId: issue.costCodeId,
      sourceModule: 'Construction' as const,
      referenceDocumentId: issue.id,
      referenceDocumentType: 'MaterialIssue',
      approvalMetadata: {
        approvedBy: req.user?.id || '',
        approvedAt: new Date(),
        userId: req.user?.id || '',
      },
    };

    await ConstructionPostingService.postMaterialIssue(
      issue.id,
      dimensions,
      totalAmount,
      req.user?.id || ''
    );

    return successResponse(res, updated);
  } catch (error: any) {
    logger.error('Error approving issue:', error);
    res.status(500).json({ error: error.message || 'Failed to approve issue' });
  }
});

// ============================================
// BUDGETS
// ============================================

const budgetSchema = z.object({
  projectId: z.string().uuid(),
  costCodeId: z.string().uuid(),
  budgetAmount: z.number().positive(),
  description: z.string().optional(),
  fiscalYear: z.string().optional(),
});

// GET /api/construction/budgets
router.get('/budgets', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, costCodeId } = req.query;
    const where: any = {};
    if (projectId) where.projectId = projectId;
    if (costCodeId) where.costCodeId = costCodeId;

    const budgets = await prisma.constructionBudget.findMany({
      where,
      include: {
        project: { select: { id: true, code: true, name: true } },
        costCode: true,
      },
      orderBy: { costCode: { code: 'asc' } },
    });

    return successResponse(res, budgets);
  } catch (error: any) {
    logger.error('Error fetching budgets:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch budgets' });
  }
});

// POST /api/construction/budgets
router.post('/budgets', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const data = budgetSchema.parse(req.body);

    const budget = await prisma.constructionBudget.create({
      data,
      include: {
        project: { select: { id: true, code: true, name: true } },
        costCode: true,
      },
    });

    return successResponse(res, budget, 201);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    logger.error('Error creating budget:', error);
    res.status(500).json({ error: error.message || 'Failed to create budget' });
  }
});

// ============================================
// MILESTONES
// ============================================

const milestoneSchema = z.object({
  projectId: z.string().uuid(),
  milestoneNumber: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  targetDate: z.string().datetime().optional(),
  billingPercentage: z.number().min(0).max(100).default(0),
  billingAmount: z.number().min(0).default(0),
});

// GET /api/construction/milestones
router.get('/milestones', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, status } = req.query;
    const where: any = {};
    if (projectId) where.projectId = projectId;
    if (status) where.status = status;

    const milestones = await prisma.constructionMilestone.findMany({
      where,
      include: {
        project: { select: { id: true, code: true, name: true } },
      },
      orderBy: { milestoneNumber: 'asc' },
    });

    return successResponse(res, milestones);
  } catch (error: any) {
    logger.error('Error fetching milestones:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch milestones' });
  }
});

// POST /api/construction/milestones
router.post('/milestones', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const data = milestoneSchema.parse(req.body);

    const milestone = await prisma.constructionMilestone.create({
      data: {
        ...data,
        targetDate: data.targetDate ? new Date(data.targetDate) : undefined,
      },
      include: {
        project: { select: { id: true, code: true, name: true } },
      },
    });

    return successResponse(res, milestone, 201);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    logger.error('Error creating milestone:', error);
    res.status(500).json({ error: error.message || 'Failed to create milestone' });
  }
});

// PUT /api/construction/milestones/:id/bill
router.put('/milestones/:id/bill', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { retentionAmount } = req.body;
    const retention = retentionAmount ? parseFloat(retentionAmount) : 0;

    const milestone = await prisma.constructionMilestone.findUnique({
      where: { id: req.params.id },
      include: {
        project: true,
      },
    });

    if (!milestone) {
      return res.status(404).json({ error: 'Milestone not found' });
    }

    if (milestone.status === 'billed') {
      return res.status(400).json({ error: 'Milestone already billed' });
    }

    const updated = await prisma.constructionMilestone.update({
      where: { id: req.params.id },
      data: {
        status: 'billed',
        completionDate: new Date(),
      },
    });

    // Post to Finance
    const dimensions = {
      projectId: milestone.projectId,
      costCodeId: '', // Milestones may not have cost codes
      sourceModule: 'Construction' as const,
      referenceDocumentId: milestone.id,
      referenceDocumentType: 'ClientBilling',
      approvalMetadata: {
        approvedBy: req.user?.id || '',
        approvedAt: new Date(),
        userId: req.user?.id || '',
      },
    };

    await ConstructionPostingService.postClientBilling(
      milestone.id,
      dimensions,
      milestone.billingAmount,
      retention,
      req.user?.id || ''
    );

    return successResponse(res, updated);
  } catch (error: any) {
    logger.error('Error billing milestone:', error);
    res.status(500).json({ error: error.message || 'Failed to bill milestone' });
  }
});

// ============================================
// REPORTING
// ============================================

// GET /api/construction/reports/project-cost-summary/:projectId
router.get('/reports/project-cost-summary/:projectId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;

    // Get all journal lines for this project
    const journalLines = await prisma.journalLine.findMany({
      where: {
        constructionProjectId: projectId,
        sourceModule: 'Construction',
      },
      include: {
        account: true,
        costCode: true,
      },
    });

    // Calculate summary by cost code
    const costCodeSummary: Record<string, any> = {};
    let totalDebit = 0;
    let totalCredit = 0;

    for (const line of journalLines) {
      const costCodeKey = line.costCodeId || 'NO_COST_CODE';
      if (!costCodeSummary[costCodeKey]) {
        costCodeSummary[costCodeKey] = {
          costCode: line.costCode,
          debit: 0,
          credit: 0,
        };
      }
      costCodeSummary[costCodeKey].debit += line.debit;
      costCodeSummary[costCodeKey].credit += line.credit;
      totalDebit += line.debit;
      totalCredit += line.credit;
    }

    return successResponse(res, {
      projectId,
      costCodeSummary: Object.values(costCodeSummary),
      totalDebit,
      totalCredit,
      netCost: totalDebit - totalCredit,
    });
  } catch (error: any) {
    logger.error('Error generating project cost summary:', error);
    res.status(500).json({ error: error.message || 'Failed to generate report' });
  }
});

// GET /api/construction/reports/budget-vs-actual/:projectId
router.get('/reports/budget-vs-actual/:projectId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;

    // Get budgets
    const budgets = await prisma.constructionBudget.findMany({
      where: { projectId },
      include: { costCode: true },
    });

    // Get actual costs from journal lines
    const journalLines = await prisma.journalLine.findMany({
      where: {
        constructionProjectId: projectId,
        sourceModule: 'Construction',
      },
      include: {
        costCode: true,
      },
    });

    const budgetVsActual = budgets.map(budget => {
      const actual = journalLines
        .filter(line => line.costCodeId === budget.costCodeId)
        .reduce((sum, line) => sum + line.debit - line.credit, 0);

      return {
        costCode: budget.costCode,
        budgetAmount: budget.budgetAmount,
        actualAmount: actual,
        variance: budget.budgetAmount - actual,
        variancePercentage: budget.budgetAmount > 0 
          ? ((budget.budgetAmount - actual) / budget.budgetAmount) * 100 
          : 0,
      };
    });

    return successResponse(res, budgetVsActual);
  } catch (error: any) {
    logger.error('Error generating budget vs actual:', error);
    res.status(500).json({ error: error.message || 'Failed to generate report' });
  }
});

// GET /api/construction/reports/wip-movement/:projectId
router.get('/reports/wip-movement/:projectId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;
    const { fromDate, toDate } = req.query;

    const where: any = {
      constructionProjectId: projectId,
      sourceModule: 'Construction',
      account: {
        code: { startsWith: '5201' }, // WIP account
      },
    };

    if (fromDate || toDate) {
      where.entry = {};
      if (fromDate) where.entry.date = { gte: new Date(fromDate as string) };
      if (toDate) where.entry.date = { lte: new Date(toDate as string) };
    }

    const movements = await prisma.journalLine.findMany({
      where,
      include: {
        entry: true,
        costCode: true,
      },
      orderBy: { entry: { date: 'asc' } },
    });

    return successResponse(res, movements);
  } catch (error: any) {
    logger.error('Error generating WIP movement:', error);
    res.status(500).json({ error: error.message || 'Failed to generate report' });
  }
});

export default router;
