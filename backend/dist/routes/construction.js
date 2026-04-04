"use strict";
/**
 * Construction Module API Routes
 * Finance-Safe Extension of REMS
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const zod_1 = require("zod");
const client_1 = __importDefault(require("../prisma/client"));
const auth_1 = require("../middleware/auth");
const construction_posting_service_1 = require("../services/construction-posting-service");
const logger_1 = __importDefault(require("../utils/logger"));
const pagination_1 = require("../utils/pagination");
const error_handler_1 = require("../utils/error-handler");
const router = express_1.default.Router();
// ============================================
// UTILITY FUNCTIONS
// ============================================
const generateProjectCode = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const random = Math.floor(1000 + Math.random() * 9000).toString();
    return `PROJ-${year}${month}-${random}`;
};
const generateDocumentCode = (prefix) => {
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
const projectSchema = zod_1.z.object({
    code: zod_1.z.string().optional(),
    name: zod_1.z.string().min(1),
    description: zod_1.z.string().optional(),
    propertyId: zod_1.z.string().uuid().optional(),
    status: zod_1.z.enum(['planning', 'active', 'on-hold', 'completed', 'closed']).optional(),
    accountingMode: zod_1.z.enum(['WIP', 'DirectExpense']).optional(),
    costCodeMandatory: zod_1.z.boolean().optional(),
    budgetEnforcement: zod_1.z.boolean().optional(),
    startDate: zod_1.z.string().datetime().optional(),
    endDate: zod_1.z.string().datetime().optional(),
    budgetAmount: zod_1.z.number().positive().optional(),
});
// GET /api/construction/projects
router.get('/projects', auth_1.authenticate, async (req, res) => {
    try {
        const { page, limit, skip } = (0, pagination_1.parsePaginationQuery)(req.query);
        const { status, propertyId, search } = req.query;
        const where = { isDeleted: false };
        if (status)
            where.status = status;
        if (propertyId)
            where.propertyId = propertyId;
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { code: { contains: search, mode: 'insensitive' } },
            ];
        }
        const [projects, total] = await Promise.all([
            client_1.default.constructionProject.findMany({
                where,
                include: {
                    property: {
                        select: { id: true, name: true, propertyCode: true },
                    },
                },
                orderBy: { createdAt: 'desc' },
                skip: skip,
                take: limit,
            }),
            client_1.default.constructionProject.count({ where }),
        ]);
        return (0, error_handler_1.successResponse)(res, projects, 200, (0, pagination_1.calculatePagination)(page, limit, total));
    }
    catch (error) {
        logger_1.default.error('Error fetching construction projects:', error);
        res.status(500).json({ error: error.message || 'Failed to fetch projects' });
    }
});
// GET /api/construction/projects/:id
router.get('/projects/:id', auth_1.authenticate, async (req, res) => {
    try {
        const project = await client_1.default.constructionProject.findUnique({
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
        return (0, error_handler_1.successResponse)(res, project);
    }
    catch (error) {
        logger_1.default.error('Error fetching project:', error);
        res.status(500).json({ error: error.message || 'Failed to fetch project' });
    }
});
// POST /api/construction/projects
router.post('/projects', auth_1.authenticate, async (req, res) => {
    try {
        const data = projectSchema.parse(req.body);
        const code = data.code || generateProjectCode();
        const project = await client_1.default.constructionProject.create({
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
        return (0, error_handler_1.successResponse)(res, project, 201);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Validation error', details: error.errors });
        }
        logger_1.default.error('Error creating project:', error);
        res.status(500).json({ error: error.message || 'Failed to create project' });
    }
});
// PUT /api/construction/projects/:id
router.put('/projects/:id', auth_1.authenticate, async (req, res) => {
    try {
        const data = projectSchema.partial().parse(req.body);
        const project = await client_1.default.constructionProject.update({
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
        return (0, error_handler_1.successResponse)(res, project);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Validation error', details: error.errors });
        }
        logger_1.default.error('Error updating project:', error);
        res.status(500).json({ error: error.message || 'Failed to update project' });
    }
});
// DELETE /api/construction/projects/:id
router.delete('/projects/:id', auth_1.authenticate, async (req, res) => {
    try {
        await client_1.default.constructionProject.update({
            where: { id: req.params.id },
            data: { isDeleted: true },
        });
        return (0, error_handler_1.successResponse)(res, { message: 'Project deleted successfully' });
    }
    catch (error) {
        logger_1.default.error('Error deleting project:', error);
        res.status(500).json({ error: error.message || 'Failed to delete project' });
    }
});
// ============================================
// COST CODES
// ============================================
const costCodeSchema = zod_1.z.object({
    code: zod_1.z.string().min(1),
    name: zod_1.z.string().min(1),
    level: zod_1.z.number().int().min(1).max(3),
    parentId: zod_1.z.string().uuid().optional(),
    description: zod_1.z.string().optional(),
    projectId: zod_1.z.string().uuid().optional(),
});
// GET /api/construction/cost-codes
router.get('/cost-codes', auth_1.authenticate, async (req, res) => {
    try {
        const { projectId, level, parentId } = req.query;
        const where = { isActive: true };
        if (projectId)
            where.projectId = projectId;
        if (level)
            where.level = parseInt(level);
        if (parentId)
            where.parentId = parentId;
        const costCodes = await client_1.default.costCode.findMany({
            where,
            include: {
                parent: true,
                children: true,
            },
            orderBy: [{ level: 'asc' }, { code: 'asc' }],
        });
        return (0, error_handler_1.successResponse)(res, costCodes);
    }
    catch (error) {
        logger_1.default.error('Error fetching cost codes:', error);
        res.status(500).json({ error: error.message || 'Failed to fetch cost codes' });
    }
});
// POST /api/construction/cost-codes
router.post('/cost-codes', auth_1.authenticate, async (req, res) => {
    try {
        const data = costCodeSchema.parse(req.body);
        const costCode = await client_1.default.costCode.create({
            data,
            include: {
                parent: true,
                children: true,
            },
        });
        return (0, error_handler_1.successResponse)(res, costCode, 201);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Validation error', details: error.errors });
        }
        logger_1.default.error('Error creating cost code:', error);
        res.status(500).json({ error: error.message || 'Failed to create cost code' });
    }
});
// PUT /api/construction/cost-codes/:id
router.put('/cost-codes/:id', auth_1.authenticate, async (req, res) => {
    try {
        const data = costCodeSchema.partial().parse(req.body);
        const costCode = await client_1.default.costCode.update({
            where: { id: req.params.id },
            data,
            include: {
                parent: true,
                children: true,
            },
        });
        return (0, error_handler_1.successResponse)(res, costCode);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Validation error', details: error.errors });
        }
        logger_1.default.error('Error updating cost code:', error);
        res.status(500).json({ error: error.message || 'Failed to update cost code' });
    }
});
// ============================================
// DAILY LOGS
// ============================================
const dailyLogSchema = zod_1.z.object({
    projectId: zod_1.z.string().uuid(),
    logDate: zod_1.z.string().datetime(),
    weather: zod_1.z.string().optional(),
    siteActivities: zod_1.z.array(zod_1.z.string()).optional(),
    laborHours: zod_1.z.number().default(0),
    equipmentHours: zod_1.z.number().default(0),
    notes: zod_1.z.string().optional(),
    attachments: zod_1.z.any().optional(),
});
// GET /api/construction/daily-logs
router.get('/daily-logs', auth_1.authenticate, async (req, res) => {
    try {
        const { page, limit, skip } = (0, pagination_1.parsePaginationQuery)(req.query);
        const { projectId, status, fromDate, toDate } = req.query;
        const where = { isDeleted: false };
        if (projectId)
            where.projectId = projectId;
        if (status)
            where.status = status;
        if (fromDate || toDate) {
            where.logDate = {};
            if (fromDate)
                where.logDate.gte = new Date(fromDate);
            if (toDate)
                where.logDate.lte = new Date(toDate);
        }
        const [logs, total] = await Promise.all([
            client_1.default.constructionDailyLog.findMany({
                where,
                include: {
                    project: {
                        select: { id: true, code: true, name: true },
                    },
                },
                orderBy: { logDate: 'desc' },
                skip: skip,
                take: limit,
            }),
            client_1.default.constructionDailyLog.count({ where }),
        ]);
        return (0, error_handler_1.successResponse)(res, logs, 200, (0, pagination_1.calculatePagination)(page, limit, total));
    }
    catch (error) {
        logger_1.default.error('Error fetching daily logs:', error);
        res.status(500).json({ error: error.message || 'Failed to fetch daily logs' });
    }
});
// POST /api/construction/daily-logs
router.post('/daily-logs', auth_1.authenticate, async (req, res) => {
    try {
        const data = dailyLogSchema.parse(req.body);
        const log = await client_1.default.constructionDailyLog.create({
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
        return (0, error_handler_1.successResponse)(res, log, 201);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Validation error', details: error.errors });
        }
        logger_1.default.error('Error creating daily log:', error);
        res.status(500).json({ error: error.message || 'Failed to create daily log' });
    }
});
// PUT /api/construction/daily-logs/:id/approve
router.put('/daily-logs/:id/approve', auth_1.authenticate, async (req, res) => {
    try {
        const log = await client_1.default.constructionDailyLog.update({
            where: { id: req.params.id },
            data: {
                status: 'approved',
                approvedBy: req.user?.id,
                approvedAt: new Date(),
            },
        });
        return (0, error_handler_1.successResponse)(res, log);
    }
    catch (error) {
        logger_1.default.error('Error approving daily log:', error);
        res.status(500).json({ error: error.message || 'Failed to approve daily log' });
    }
});
// ============================================
// LABOR & CREW
// ============================================
const crewSchema = zod_1.z.object({
    code: zod_1.z.string().min(1),
    name: zod_1.z.string().min(1),
    description: zod_1.z.string().optional(),
    crewLeadId: zod_1.z.string().uuid().optional(),
});
// GET /api/construction/crews
router.get('/crews', auth_1.authenticate, async (req, res) => {
    try {
        const crews = await client_1.default.constructionCrew.findMany({
            where: { isActive: true },
            orderBy: { name: 'asc' },
        });
        return (0, error_handler_1.successResponse)(res, crews);
    }
    catch (error) {
        logger_1.default.error('Error fetching crews:', error);
        res.status(500).json({ error: error.message || 'Failed to fetch crews' });
    }
});
// POST /api/construction/crews
router.post('/crews', auth_1.authenticate, async (req, res) => {
    try {
        const data = crewSchema.parse(req.body);
        const crew = await client_1.default.constructionCrew.create({
            data,
        });
        return (0, error_handler_1.successResponse)(res, crew, 201);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Validation error', details: error.errors });
        }
        logger_1.default.error('Error creating crew:', error);
        res.status(500).json({ error: error.message || 'Failed to create crew' });
    }
});
const laborSchema = zod_1.z.object({
    projectId: zod_1.z.string().uuid(),
    costCodeId: zod_1.z.string().uuid(),
    crewId: zod_1.z.string().uuid().optional(),
    employeeId: zod_1.z.string().uuid().optional(),
    workDate: zod_1.z.string().datetime(),
    hours: zod_1.z.number().positive(),
    rate: zod_1.z.number().positive().optional(),
    amount: zod_1.z.number().positive(),
    description: zod_1.z.string().optional(),
});
// GET /api/construction/labor
router.get('/labor', auth_1.authenticate, async (req, res) => {
    try {
        const { page, limit, skip } = (0, pagination_1.parsePaginationQuery)(req.query);
        const { projectId, status, fromDate, toDate } = req.query;
        const where = { isDeleted: false };
        if (projectId)
            where.projectId = projectId;
        if (status)
            where.status = status;
        if (fromDate || toDate) {
            where.workDate = {};
            if (fromDate)
                where.workDate.gte = new Date(fromDate);
            if (toDate)
                where.workDate.lte = new Date(toDate);
        }
        const [labor, total] = await Promise.all([
            client_1.default.constructionLabor.findMany({
                where,
                include: {
                    project: { select: { id: true, code: true, name: true } },
                    costCode: true,
                    crew: true,
                },
                orderBy: { workDate: 'desc' },
                skip: skip,
                take: limit,
            }),
            client_1.default.constructionLabor.count({ where }),
        ]);
        return (0, error_handler_1.successResponse)(res, labor, 200, (0, pagination_1.calculatePagination)(page, limit, total));
    }
    catch (error) {
        logger_1.default.error('Error fetching labor:', error);
        res.status(500).json({ error: error.message || 'Failed to fetch labor' });
    }
});
// POST /api/construction/labor
router.post('/labor', auth_1.authenticate, async (req, res) => {
    try {
        const data = laborSchema.parse(req.body);
        const labor = await client_1.default.constructionLabor.create({
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
        return (0, error_handler_1.successResponse)(res, labor, 201);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Validation error', details: error.errors });
        }
        logger_1.default.error('Error creating labor entry:', error);
        res.status(500).json({ error: error.message || 'Failed to create labor entry' });
    }
});
// PUT /api/construction/labor/:id/approve
router.put('/labor/:id/approve', auth_1.authenticate, async (req, res) => {
    try {
        const labor = await client_1.default.constructionLabor.findUnique({
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
        const updated = await client_1.default.constructionLabor.update({
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
            sourceModule: 'Construction',
            referenceDocumentId: labor.id,
            referenceDocumentType: 'LaborApproval',
            approvalMetadata: {
                approvedBy: req.user?.id || '',
                approvedAt: new Date(),
                userId: req.user?.id || '',
            },
        };
        await construction_posting_service_1.ConstructionPostingService.postLaborApproval(labor.id, dimensions, labor.amount, req.user?.id || '');
        return (0, error_handler_1.successResponse)(res, updated);
    }
    catch (error) {
        logger_1.default.error('Error approving labor:', error);
        res.status(500).json({ error: error.message || 'Failed to approve labor' });
    }
});
// ============================================
// EQUIPMENT
// ============================================
const equipmentSchema = zod_1.z.object({
    code: zod_1.z.string().min(1),
    name: zod_1.z.string().min(1),
    type: zod_1.z.string().optional(),
    make: zod_1.z.string().optional(),
    model: zod_1.z.string().optional(),
    serialNumber: zod_1.z.string().optional(),
    hourlyRate: zod_1.z.number().positive().optional(),
    dailyRate: zod_1.z.number().positive().optional(),
    costingMethod: zod_1.z.enum(['hourly', 'daily']).default('hourly'),
});
// GET /api/construction/equipment
router.get('/equipment', auth_1.authenticate, async (req, res) => {
    try {
        const equipment = await client_1.default.constructionEquipment.findMany({
            where: { isActive: true },
            orderBy: { name: 'asc' },
        });
        return (0, error_handler_1.successResponse)(res, equipment);
    }
    catch (error) {
        logger_1.default.error('Error fetching equipment:', error);
        res.status(500).json({ error: error.message || 'Failed to fetch equipment' });
    }
});
// POST /api/construction/equipment
router.post('/equipment', auth_1.authenticate, async (req, res) => {
    try {
        const data = equipmentSchema.parse(req.body);
        const equipment = await client_1.default.constructionEquipment.create({
            data,
        });
        return (0, error_handler_1.successResponse)(res, equipment, 201);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Validation error', details: error.errors });
        }
        logger_1.default.error('Error creating equipment:', error);
        res.status(500).json({ error: error.message || 'Failed to create equipment' });
    }
});
const equipmentUsageSchema = zod_1.z.object({
    projectId: zod_1.z.string().uuid(),
    costCodeId: zod_1.z.string().uuid(),
    equipmentId: zod_1.z.string().uuid(),
    usageDate: zod_1.z.string().datetime(),
    hours: zod_1.z.number().positive().optional(),
    days: zod_1.z.number().positive().optional(),
    description: zod_1.z.string().optional(),
});
// GET /api/construction/equipment-usage
router.get('/equipment-usage', auth_1.authenticate, async (req, res) => {
    try {
        const { page, limit, skip } = (0, pagination_1.parsePaginationQuery)(req.query);
        const { projectId, equipmentId, status } = req.query;
        const where = { isDeleted: false };
        if (projectId)
            where.projectId = projectId;
        if (equipmentId)
            where.equipmentId = equipmentId;
        if (status)
            where.status = status;
        const [usages, total] = await Promise.all([
            client_1.default.constructionEquipmentUsage.findMany({
                where,
                include: {
                    project: { select: { id: true, code: true, name: true } },
                    costCode: true,
                    equipment: true,
                },
                orderBy: { usageDate: 'desc' },
                skip: skip,
                take: limit,
            }),
            client_1.default.constructionEquipmentUsage.count({ where }),
        ]);
        return (0, error_handler_1.successResponse)(res, usages, 200, (0, pagination_1.calculatePagination)(page, limit, total));
    }
    catch (error) {
        logger_1.default.error('Error fetching equipment usage:', error);
        res.status(500).json({ error: error.message || 'Failed to fetch equipment usage' });
    }
});
// POST /api/construction/equipment-usage
router.post('/equipment-usage', auth_1.authenticate, async (req, res) => {
    try {
        const data = equipmentUsageSchema.parse(req.body);
        // Get equipment to calculate amount
        const equipment = await client_1.default.constructionEquipment.findUnique({
            where: { id: data.equipmentId },
        });
        if (!equipment) {
            return res.status(404).json({ error: 'Equipment not found' });
        }
        let amount = 0;
        if (equipment.costingMethod === 'hourly' && data.hours) {
            amount = data.hours * (equipment.hourlyRate || 0);
        }
        else if (equipment.costingMethod === 'daily' && data.days) {
            amount = data.days * (equipment.dailyRate || 0);
        }
        const usage = await client_1.default.constructionEquipmentUsage.create({
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
        return (0, error_handler_1.successResponse)(res, usage, 201);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Validation error', details: error.errors });
        }
        logger_1.default.error('Error creating equipment usage:', error);
        res.status(500).json({ error: error.message || 'Failed to create equipment usage' });
    }
});
// PUT /api/construction/equipment-usage/:id/approve
router.put('/equipment-usage/:id/approve', auth_1.authenticate, async (req, res) => {
    try {
        const usage = await client_1.default.constructionEquipmentUsage.findUnique({
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
        const updated = await client_1.default.constructionEquipmentUsage.update({
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
            sourceModule: 'Construction',
            referenceDocumentId: usage.id,
            referenceDocumentType: 'EquipmentUsage',
            approvalMetadata: {
                approvedBy: req.user?.id || '',
                approvedAt: new Date(),
                userId: req.user?.id || '',
            },
        };
        await construction_posting_service_1.ConstructionPostingService.postEquipmentUsage(usage.id, dimensions, usage.amount, req.user?.id || '');
        return (0, error_handler_1.successResponse)(res, updated);
    }
    catch (error) {
        logger_1.default.error('Error approving equipment usage:', error);
        res.status(500).json({ error: error.message || 'Failed to approve equipment usage' });
    }
});
// ============================================
// INVENTORY
// ============================================
const inventoryItemSchema = zod_1.z.object({
    code: zod_1.z.string().min(1),
    name: zod_1.z.string().min(1),
    category: zod_1.z.string().optional(),
    unit: zod_1.z.string().default('pcs'),
    unitPrice: zod_1.z.number().positive().optional(),
});
// GET /api/construction/inventory-items
router.get('/inventory-items', auth_1.authenticate, async (req, res) => {
    try {
        const { category, search } = req.query;
        const where = { isActive: true };
        if (category)
            where.category = category;
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { code: { contains: search, mode: 'insensitive' } },
            ];
        }
        const items = await client_1.default.constructionInventoryItem.findMany({
            where,
            orderBy: { name: 'asc' },
        });
        return (0, error_handler_1.successResponse)(res, items);
    }
    catch (error) {
        logger_1.default.error('Error fetching inventory items:', error);
        res.status(500).json({ error: error.message || 'Failed to fetch inventory items' });
    }
});
// POST /api/construction/inventory-items
router.post('/inventory-items', auth_1.authenticate, async (req, res) => {
    try {
        const data = inventoryItemSchema.parse(req.body);
        const item = await client_1.default.constructionInventoryItem.create({
            data,
        });
        return (0, error_handler_1.successResponse)(res, item, 201);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Validation error', details: error.errors });
        }
        logger_1.default.error('Error creating inventory item:', error);
        res.status(500).json({ error: error.message || 'Failed to create inventory item' });
    }
});
// ============================================
// WAREHOUSES
// ============================================
const warehouseSchema = zod_1.z.object({
    code: zod_1.z.string().min(1),
    name: zod_1.z.string().min(1),
    location: zod_1.z.string().optional(),
});
// GET /api/construction/warehouses
router.get('/warehouses', auth_1.authenticate, async (req, res) => {
    try {
        const warehouses = await client_1.default.constructionWarehouse.findMany({
            where: { isActive: true },
            orderBy: { name: 'asc' },
        });
        return (0, error_handler_1.successResponse)(res, warehouses);
    }
    catch (error) {
        logger_1.default.error('Error fetching warehouses:', error);
        res.status(500).json({ error: error.message || 'Failed to fetch warehouses' });
    }
});
// POST /api/construction/warehouses
router.post('/warehouses', auth_1.authenticate, async (req, res) => {
    try {
        const data = warehouseSchema.parse(req.body);
        const warehouse = await client_1.default.constructionWarehouse.create({
            data,
        });
        return (0, error_handler_1.successResponse)(res, warehouse, 201);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Validation error', details: error.errors });
        }
        logger_1.default.error('Error creating warehouse:', error);
        res.status(500).json({ error: error.message || 'Failed to create warehouse' });
    }
});
// GET /api/construction/warehouses/:id/stock
router.get('/warehouses/:id/stock', auth_1.authenticate, async (req, res) => {
    try {
        const stock = await client_1.default.constructionStockBalance.findMany({
            where: { warehouseId: req.params.id },
            include: {
                item: true,
            },
            orderBy: { item: { name: 'asc' } },
        });
        return (0, error_handler_1.successResponse)(res, stock);
    }
    catch (error) {
        logger_1.default.error('Error fetching stock:', error);
        res.status(500).json({ error: error.message || 'Failed to fetch stock' });
    }
});
// ============================================
// GRN (Goods Receipt Note)
// ============================================
const grnSchema = zod_1.z.object({
    warehouseId: zod_1.z.string().uuid(),
    projectId: zod_1.z.string().uuid().optional(),
    supplierName: zod_1.z.string().optional(),
    receiptDate: zod_1.z.string().datetime(),
    notes: zod_1.z.string().optional(),
    items: zod_1.z.array(zod_1.z.object({
        itemId: zod_1.z.string().uuid(),
        quantity: zod_1.z.number().positive(),
        unitPrice: zod_1.z.number().positive(),
    })),
});
// GET /api/construction/grns
router.get('/grns', auth_1.authenticate, async (req, res) => {
    try {
        const { page, limit, skip } = (0, pagination_1.parsePaginationQuery)(req.query);
        const { warehouseId, projectId, status } = req.query;
        const where = { isDeleted: false };
        if (warehouseId)
            where.warehouseId = warehouseId;
        if (projectId)
            where.projectId = projectId;
        if (status)
            where.status = status;
        const [grns, total] = await Promise.all([
            client_1.default.constructionGRN.findMany({
                where,
                include: {
                    warehouse: true,
                    project: { select: { id: true, code: true, name: true } },
                    items: {
                        include: { item: true },
                    },
                },
                orderBy: { receiptDate: 'desc' },
                skip: skip,
                take: limit,
            }),
            client_1.default.constructionGRN.count({ where }),
        ]);
        return (0, error_handler_1.successResponse)(res, grns, 200, (0, pagination_1.calculatePagination)(page, limit, total));
    }
    catch (error) {
        logger_1.default.error('Error fetching GRNs:', error);
        res.status(500).json({ error: error.message || 'Failed to fetch GRNs' });
    }
});
// POST /api/construction/grns
router.post('/grns', auth_1.authenticate, async (req, res) => {
    try {
        const data = grnSchema.parse(req.body);
        const grnNumber = generateDocumentCode('GRN');
        const grn = await client_1.default.$transaction(async (tx) => {
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
                }
                else {
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
        return (0, error_handler_1.successResponse)(res, grn, 201);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Validation error', details: error.errors });
        }
        logger_1.default.error('Error creating GRN:', error);
        res.status(500).json({ error: error.message || 'Failed to create GRN' });
    }
});
// PUT /api/construction/grns/:id/post
router.put('/grns/:id/post', auth_1.authenticate, async (req, res) => {
    try {
        const grn = await client_1.default.constructionGRN.update({
            where: { id: req.params.id },
            data: {
                status: 'posted',
                postedBy: req.user?.id,
                postedAt: new Date(),
            },
        });
        return (0, error_handler_1.successResponse)(res, grn);
    }
    catch (error) {
        logger_1.default.error('Error posting GRN:', error);
        res.status(500).json({ error: error.message || 'Failed to post GRN' });
    }
});
// ============================================
// ISSUE TO PROJECT
// ============================================
const issueSchema = zod_1.z.object({
    projectId: zod_1.z.string().uuid(),
    warehouseId: zod_1.z.string().uuid(),
    costCodeId: zod_1.z.string().uuid(),
    issueDate: zod_1.z.string().datetime(),
    notes: zod_1.z.string().optional(),
    items: zod_1.z.array(zod_1.z.object({
        itemId: zod_1.z.string().uuid(),
        quantity: zod_1.z.number().positive(),
    })),
});
// GET /api/construction/issues
router.get('/issues', auth_1.authenticate, async (req, res) => {
    try {
        const { page, limit, skip } = (0, pagination_1.parsePaginationQuery)(req.query);
        const { projectId, warehouseId, status } = req.query;
        const where = { isDeleted: false };
        if (projectId)
            where.projectId = projectId;
        if (warehouseId)
            where.warehouseId = warehouseId;
        if (status)
            where.status = status;
        const [issues, total] = await Promise.all([
            client_1.default.constructionIssue.findMany({
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
                skip: skip,
                take: limit,
            }),
            client_1.default.constructionIssue.count({ where }),
        ]);
        return (0, error_handler_1.successResponse)(res, issues, 200, (0, pagination_1.calculatePagination)(page, limit, total));
    }
    catch (error) {
        logger_1.default.error('Error fetching issues:', error);
        res.status(500).json({ error: error.message || 'Failed to fetch issues' });
    }
});
// POST /api/construction/issues
router.post('/issues', auth_1.authenticate, async (req, res) => {
    try {
        const data = issueSchema.parse(req.body);
        const issueNumber = generateDocumentCode('ISS');
        // Validate project requires cost code
        const project = await client_1.default.constructionProject.findUnique({
            where: { id: data.projectId },
        });
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }
        if (project.costCodeMandatory && !data.costCodeId) {
            return res.status(400).json({ error: 'Cost code is mandatory for this project' });
        }
        // Get stock balances and calculate amounts
        const issueItems = await Promise.all(data.items.map(async (item) => {
            const stock = await client_1.default.constructionStockBalance.findUnique({
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
        }));
        const issue = await client_1.default.$transaction(async (tx) => {
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
        return (0, error_handler_1.successResponse)(res, issue, 201);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Validation error', details: error.errors });
        }
        logger_1.default.error('Error creating issue:', error);
        res.status(500).json({ error: error.message || 'Failed to create issue' });
    }
});
// PUT /api/construction/issues/:id/approve
router.put('/issues/:id/approve', auth_1.authenticate, async (req, res) => {
    try {
        const issue = await client_1.default.constructionIssue.findUnique({
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
        const updated = await client_1.default.constructionIssue.update({
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
            sourceModule: 'Construction',
            referenceDocumentId: issue.id,
            referenceDocumentType: 'MaterialIssue',
            approvalMetadata: {
                approvedBy: req.user?.id || '',
                approvedAt: new Date(),
                userId: req.user?.id || '',
            },
        };
        await construction_posting_service_1.ConstructionPostingService.postMaterialIssue(issue.id, dimensions, totalAmount, req.user?.id || '');
        return (0, error_handler_1.successResponse)(res, updated);
    }
    catch (error) {
        logger_1.default.error('Error approving issue:', error);
        res.status(500).json({ error: error.message || 'Failed to approve issue' });
    }
});
// ============================================
// BUDGETS
// ============================================
const budgetSchema = zod_1.z.object({
    projectId: zod_1.z.string().uuid(),
    costCodeId: zod_1.z.string().uuid(),
    budgetAmount: zod_1.z.number().positive(),
    description: zod_1.z.string().optional(),
    fiscalYear: zod_1.z.string().optional(),
});
// GET /api/construction/budgets
router.get('/budgets', auth_1.authenticate, async (req, res) => {
    try {
        const { projectId, costCodeId } = req.query;
        const where = {};
        if (projectId)
            where.projectId = projectId;
        if (costCodeId)
            where.costCodeId = costCodeId;
        const budgets = await client_1.default.constructionBudget.findMany({
            where,
            include: {
                project: { select: { id: true, code: true, name: true } },
                costCode: true,
            },
            orderBy: { costCode: { code: 'asc' } },
        });
        return (0, error_handler_1.successResponse)(res, budgets);
    }
    catch (error) {
        logger_1.default.error('Error fetching budgets:', error);
        res.status(500).json({ error: error.message || 'Failed to fetch budgets' });
    }
});
// POST /api/construction/budgets
router.post('/budgets', auth_1.authenticate, async (req, res) => {
    try {
        const data = budgetSchema.parse(req.body);
        const budget = await client_1.default.constructionBudget.create({
            data,
            include: {
                project: { select: { id: true, code: true, name: true } },
                costCode: true,
            },
        });
        return (0, error_handler_1.successResponse)(res, budget, 201);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Validation error', details: error.errors });
        }
        logger_1.default.error('Error creating budget:', error);
        res.status(500).json({ error: error.message || 'Failed to create budget' });
    }
});
// ============================================
// MILESTONES
// ============================================
const milestoneSchema = zod_1.z.object({
    projectId: zod_1.z.string().uuid(),
    milestoneNumber: zod_1.z.string().min(1),
    name: zod_1.z.string().min(1),
    description: zod_1.z.string().optional(),
    targetDate: zod_1.z.string().datetime().optional(),
    billingPercentage: zod_1.z.number().min(0).max(100).default(0),
    billingAmount: zod_1.z.number().min(0).default(0),
});
// GET /api/construction/milestones
router.get('/milestones', auth_1.authenticate, async (req, res) => {
    try {
        const { projectId, status } = req.query;
        const where = {};
        if (projectId)
            where.projectId = projectId;
        if (status)
            where.status = status;
        const milestones = await client_1.default.constructionMilestone.findMany({
            where,
            include: {
                project: { select: { id: true, code: true, name: true } },
            },
            orderBy: { milestoneNumber: 'asc' },
        });
        return (0, error_handler_1.successResponse)(res, milestones);
    }
    catch (error) {
        logger_1.default.error('Error fetching milestones:', error);
        res.status(500).json({ error: error.message || 'Failed to fetch milestones' });
    }
});
// POST /api/construction/milestones
router.post('/milestones', auth_1.authenticate, async (req, res) => {
    try {
        const data = milestoneSchema.parse(req.body);
        const milestone = await client_1.default.constructionMilestone.create({
            data: {
                ...data,
                targetDate: data.targetDate ? new Date(data.targetDate) : undefined,
            },
            include: {
                project: { select: { id: true, code: true, name: true } },
            },
        });
        return (0, error_handler_1.successResponse)(res, milestone, 201);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Validation error', details: error.errors });
        }
        logger_1.default.error('Error creating milestone:', error);
        res.status(500).json({ error: error.message || 'Failed to create milestone' });
    }
});
// PUT /api/construction/milestones/:id/bill
router.put('/milestones/:id/bill', auth_1.authenticate, async (req, res) => {
    try {
        const { retentionAmount } = req.body;
        const retention = retentionAmount ? parseFloat(retentionAmount) : 0;
        const milestone = await client_1.default.constructionMilestone.findUnique({
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
        const updated = await client_1.default.constructionMilestone.update({
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
            sourceModule: 'Construction',
            referenceDocumentId: milestone.id,
            referenceDocumentType: 'ClientBilling',
            approvalMetadata: {
                approvedBy: req.user?.id || '',
                approvedAt: new Date(),
                userId: req.user?.id || '',
            },
        };
        await construction_posting_service_1.ConstructionPostingService.postClientBilling(milestone.id, dimensions, milestone.billingAmount, retention, req.user?.id || '');
        return (0, error_handler_1.successResponse)(res, updated);
    }
    catch (error) {
        logger_1.default.error('Error billing milestone:', error);
        res.status(500).json({ error: error.message || 'Failed to bill milestone' });
    }
});
// ============================================
// REPORTING
// ============================================
// GET /api/construction/reports/project-cost-summary/:projectId
router.get('/reports/project-cost-summary/:projectId', auth_1.authenticate, async (req, res) => {
    try {
        const { projectId } = req.params;
        // Get all journal lines for this project
        const journalLines = await client_1.default.journalLine.findMany({
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
        const costCodeSummary = {};
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
        return (0, error_handler_1.successResponse)(res, {
            projectId,
            costCodeSummary: Object.values(costCodeSummary),
            totalDebit,
            totalCredit,
            netCost: totalDebit - totalCredit,
        });
    }
    catch (error) {
        logger_1.default.error('Error generating project cost summary:', error);
        res.status(500).json({ error: error.message || 'Failed to generate report' });
    }
});
// GET /api/construction/reports/budget-vs-actual/:projectId
router.get('/reports/budget-vs-actual/:projectId', auth_1.authenticate, async (req, res) => {
    try {
        const { projectId } = req.params;
        // Get budgets
        const budgets = await client_1.default.constructionBudget.findMany({
            where: { projectId },
            include: { costCode: true },
        });
        // Get actual costs from journal lines
        const journalLines = await client_1.default.journalLine.findMany({
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
        return (0, error_handler_1.successResponse)(res, budgetVsActual);
    }
    catch (error) {
        logger_1.default.error('Error generating budget vs actual:', error);
        res.status(500).json({ error: error.message || 'Failed to generate report' });
    }
});
// GET /api/construction/reports/wip-movement/:projectId
router.get('/reports/wip-movement/:projectId', auth_1.authenticate, async (req, res) => {
    try {
        const { projectId } = req.params;
        const { fromDate, toDate } = req.query;
        const where = {
            constructionProjectId: projectId,
            sourceModule: 'Construction',
            account: {
                code: { startsWith: '5201' }, // WIP account
            },
        };
        if (fromDate || toDate) {
            where.entry = {};
            if (fromDate)
                where.entry.date = { gte: new Date(fromDate) };
            if (toDate)
                where.entry.date = { lte: new Date(toDate) };
        }
        const movements = await client_1.default.journalLine.findMany({
            where,
            include: {
                entry: true,
                costCode: true,
            },
            orderBy: { entry: { date: 'asc' } },
        });
        return (0, error_handler_1.successResponse)(res, movements);
    }
    catch (error) {
        logger_1.default.error('Error generating WIP movement:', error);
        res.status(500).json({ error: error.message || 'Failed to generate report' });
    }
});
exports.default = router;
//# sourceMappingURL=construction.js.map