"use strict";
/**
 * Enhanced Properties API Routes
 * Includes auto-sync workflows, expenses, tenancies, and maintenance
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const zod_1 = require("zod");
const client_1 = __importDefault(require("../prisma/client"));
const rbac_1 = require("../middleware/rbac");
const audit_log_1 = require("../services/audit-log");
const workflows_1 = require("../services/workflows");
const attachments_1 = require("../services/attachments");
const analytics_1 = require("../services/analytics");
const id_generation_service_1 = require("../services/id-generation-service");
const multer_1 = __importDefault(require("multer"));
const router = express_1.default.Router();
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
// Validation schemas
const createPropertySchema = zod_1.z.object({
    tid: zod_1.z.string().min(1, "TID is required"), // Transaction ID - unique across Property, Deal, Client
    name: zod_1.z.string().min(1),
    title: zod_1.z.string().optional(),
    type: zod_1.z.string().min(1),
    address: zod_1.z.string().min(1),
    city: zod_1.z.string().optional(),
    location: zod_1.z.string().optional(),
    size: zod_1.z.number().positive().optional(),
    status: zod_1.z.enum(['Vacant', 'Occupied', 'Under-Maintenance']).default('Vacant'),
    description: zod_1.z.string().optional(),
    yearBuilt: zod_1.z.number().int().positive().optional(),
    totalArea: zod_1.z.number().positive().optional(),
    totalUnits: zod_1.z.number().int().nonnegative().default(0),
    ownerName: zod_1.z.string().optional(),
    ownerPhone: zod_1.z.string().optional(),
    rentAmount: zod_1.z.number().nonnegative().optional(),
    securityDeposit: zod_1.z.number().nonnegative().default(0),
    rentEscalationPercentage: zod_1.z.number().nonnegative().default(0),
});
const updatePropertySchema = createPropertySchema.partial();
const createPropertyExpenseSchema = zod_1.z.object({
    propertyId: zod_1.z.string().uuid(),
    category: zod_1.z.enum(['repair', 'maintenance', 'tax', 'utilities', 'insurance', 'other']),
    amount: zod_1.z.number().positive(),
    date: zod_1.z.string().datetime().optional(),
    description: zod_1.z.string().optional(),
});
const assignTenantSchema = zod_1.z.object({
    propertyId: zod_1.z.string().uuid(),
    tenantId: zod_1.z.string().uuid(),
    leaseId: zod_1.z.string().uuid().optional(),
    leaseStart: zod_1.z.string().datetime(),
    leaseEnd: zod_1.z.string().datetime(),
    monthlyRent: zod_1.z.number().positive(),
});
const createMaintenanceRequestSchema = zod_1.z.object({
    propertyId: zod_1.z.string().uuid(),
    tenantId: zod_1.z.string().uuid().optional(),
    unitId: zod_1.z.string().uuid().optional(),
    issueTitle: zod_1.z.string().min(1),
    issueDescription: zod_1.z.string().min(1),
    priority: zod_1.z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
});
// Get all properties
router.get('/', rbac_1.requireAuth, (0, rbac_1.requirePermission)('properties.view'), async (req, res) => {
    try {
        const { status, type, city, search } = req.query;
        const where = { isDeleted: false };
        if (status)
            where.status = status;
        if (type)
            where.type = type;
        if (city)
            where.city = { contains: city, mode: 'insensitive' };
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { address: { contains: search, mode: 'insensitive' } },
                { propertyCode: { contains: search, mode: 'insensitive' } },
                { manualUniqueId: { contains: search, mode: 'insensitive' } },
                // Note: tid search will be enabled after migration is applied
                // { tid: { contains: search as string, mode: 'insensitive' } },
            ];
        }
        const properties = await client_1.default.property.findMany({
            where,
            include: {
                tenancies: { where: { status: 'active' }, include: { tenant: true } },
                propertyExpenses: { where: { isDeleted: false }, take: 5, orderBy: { date: 'desc' } },
                maintenanceRequests: { where: { isDeleted: false }, take: 5, orderBy: { createdAt: 'desc' } },
            },
            orderBy: { createdAt: 'desc' },
        });
        res.json(properties);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Get property by ID
router.get('/:id', rbac_1.requireAuth, (0, rbac_1.requirePermission)('properties.view'), async (req, res) => {
    try {
        const property = await client_1.default.property.findUnique({
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
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Get property dashboard
router.get('/:id/dashboard', rbac_1.requireAuth, (0, rbac_1.requirePermission)('properties.view'), async (req, res) => {
    try {
        const dashboard = await (0, analytics_1.getPropertyDashboard)(req.params.id);
        res.json(dashboard);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Create property
router.post('/', rbac_1.requireAuth, (0, rbac_1.requirePermission)('properties.create'), async (req, res) => {
    try {
        const data = createPropertySchema.parse(req.body);
        const { manualUniqueId, tid, ...propertyData } = data;
        // Validate TID - must be unique across Property, Deal, and Client
        await (0, id_generation_service_1.validateTID)(tid.trim());
        // Validate manual unique ID if provided
        if (manualUniqueId) {
            await (0, id_generation_service_1.validateManualUniqueId)(manualUniqueId, 'prop');
        }
        // Generate system ID: prop-YY-####
        const propertyCode = await (0, id_generation_service_1.generateSystemId)('prop');
        const property = await client_1.default.$transaction(async (tx) => {
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
        await (0, audit_log_1.createAuditLog)({
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
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: error.errors });
        }
        res.status(500).json({ error: error.message });
    }
});
// Update property
router.put('/:id', rbac_1.requireAuth, (0, rbac_1.requirePermission)('properties.update'), async (req, res) => {
    try {
        const oldProperty = await client_1.default.property.findUnique({
            where: { id: req.params.id },
        });
        if (!oldProperty) {
            return res.status(404).json({ error: 'Property not found' });
        }
        const data = updatePropertySchema.parse(req.body);
        const { tid, ...updateData } = data;
        // TID cannot be changed after creation
        if (tid !== undefined && tid !== oldProperty.tid) {
            return res.status(400).json({ error: 'TID cannot be changed after property creation' });
        }
        const property = await client_1.default.property.update({
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
            await client_1.default.property.update({
                where: { id: req.params.id },
                data: { status: 'Vacant' },
            });
        }
        else if (occupiedUnits > 0 || property.tenancies.length > 0) {
            await client_1.default.property.update({
                where: { id: req.params.id },
                data: { status: 'Occupied' },
            });
        }
        // Audit log
        await (0, audit_log_1.createAuditLog)({
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
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: error.errors });
        }
        res.status(500).json({ error: error.message });
    }
});
// Delete property (soft delete)
router.delete('/:id', rbac_1.requireAuth, (0, rbac_1.requirePermission)('properties.delete'), async (req, res) => {
    try {
        const { id } = req.params;
        const property = await client_1.default.property.findFirst({
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
        await client_1.default.$transaction(async (tx) => {
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
        await (0, audit_log_1.createAuditLog)({
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
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Assign tenant to property
router.post('/:id/assign-tenant', rbac_1.requireAuth, (0, rbac_1.requirePermission)('properties.update'), async (req, res) => {
    try {
        const { tenantId, leaseId, leaseStart, leaseEnd, monthlyRent } = assignTenantSchema.parse({
            ...req.body,
            propertyId: req.params.id,
        });
        // Create or update tenancy
        const tenancy = await client_1.default.tenancy.upsert({
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
        const property = await client_1.default.property.update({
            where: { id: req.params.id },
            data: { status: 'Occupied' },
        });
        // If lease exists, create tenancy from lease
        if (leaseId) {
            await (0, workflows_1.createTenancyFromLease)(leaseId);
        }
        // Audit log
        await (0, audit_log_1.createAuditLog)({
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
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: error.errors });
        }
        res.status(500).json({ error: error.message });
    }
});
// Remove tenant from property
router.delete('/:id/remove-tenant/:tenantId', rbac_1.requireAuth, (0, rbac_1.requirePermission)('properties.update'), async (req, res) => {
    try {
        // End tenancy
        await client_1.default.tenancy.updateMany({
            where: {
                propertyId: req.params.id,
                tenantId: req.params.tenantId,
                status: 'active',
            },
            data: { status: 'ended' },
        });
        // Update property status if no active tenancies
        const activeTenancies = await client_1.default.tenancy.count({
            where: {
                propertyId: req.params.id,
                status: 'active',
            },
        });
        if (activeTenancies === 0) {
            await client_1.default.property.update({
                where: { id: req.params.id },
                data: { status: 'Vacant' },
            });
        }
        res.json({ message: 'Tenant removed successfully' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Add property expense
router.post('/:id/expenses', rbac_1.requireAuth, (0, rbac_1.requirePermission)('properties.update'), async (req, res) => {
    try {
        const data = createPropertyExpenseSchema.parse({
            ...req.body,
            propertyId: req.params.id,
        });
        const expense = await client_1.default.propertyExpense.create({
            data: {
                ...data,
                date: data.date ? new Date(data.date) : new Date(),
                createdBy: req.user?.id,
            },
        });
        // Auto-sync to Finance Ledger
        await (0, workflows_1.syncPropertyExpenseToFinanceLedger)(expense.id);
        // Refetch expense to get updated financeLedgerId
        const updatedExpense = await client_1.default.propertyExpense.findUnique({
            where: { id: expense.id },
        });
        // Audit log
        await (0, audit_log_1.createAuditLog)({
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
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: error.errors });
        }
        res.status(500).json({ error: error.message });
    }
});
const updateMaintenanceRequestSchema = zod_1.z.object({
    status: zod_1.z.enum(['open', 'assigned', 'in-progress', 'completed', 'cancelled']).optional(),
    actualCost: zod_1.z.number().positive().optional(),
    completedAt: zod_1.z.string().datetime().optional(),
    assignedTo: zod_1.z.string().optional(),
    assignedToName: zod_1.z.string().optional(),
});
// Create maintenance request
router.post('/:id/maintenance', rbac_1.requireAuth, (0, rbac_1.requirePermission)('properties.update'), async (req, res) => {
    try {
        const data = createMaintenanceRequestSchema.parse({
            ...req.body,
            propertyId: req.params.id,
        });
        const maintenance = await client_1.default.maintenanceRequest.create({
            data: {
                ...data,
                createdBy: req.user?.id,
            },
        });
        // Update property status if high priority
        await (0, workflows_1.updatePropertyStatusOnMaintenance)(maintenance.id);
        // Audit log
        await (0, audit_log_1.createAuditLog)({
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
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: error.errors });
        }
        res.status(500).json({ error: error.message });
    }
});
// Update maintenance request
router.put('/:id/maintenance/:maintenanceId', rbac_1.requireAuth, (0, rbac_1.requirePermission)('properties.update'), async (req, res) => {
    try {
        const oldMaintenance = await client_1.default.maintenanceRequest.findUnique({
            where: { id: req.params.maintenanceId },
        });
        if (!oldMaintenance) {
            return res.status(404).json({ error: 'Maintenance request not found' });
        }
        const data = updateMaintenanceRequestSchema.parse(req.body);
        const maintenance = await client_1.default.maintenanceRequest.update({
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
                await (0, workflows_1.syncMaintenanceToFinanceLedger)(maintenance.id);
            }
        }
        // Update property status back to normal if maintenance completed
        if (maintenance.status === 'completed' && oldMaintenance.status !== 'completed') {
            const property = await client_1.default.property.findUnique({
                where: { id: req.params.id },
                include: {
                    units: { where: { isDeleted: false, status: 'Occupied' } },
                    tenancies: { where: { status: 'active' } },
                },
            });
            if (property) {
                const hasOccupiedUnits = property.units.length > 0 || property.tenancies.length > 0;
                await client_1.default.property.update({
                    where: { id: req.params.id },
                    data: { status: hasOccupiedUnits ? 'Occupied' : 'Vacant' },
                });
            }
        }
        // Audit log
        await (0, audit_log_1.createAuditLog)({
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
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: error.errors });
        }
        res.status(500).json({ error: error.message });
    }
});
// Upload property documents
router.post('/:id/upload', rbac_1.requireAuth, (0, rbac_1.requirePermission)('properties.update'), upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        const { saveUploadedFile, createAttachment } = await Promise.resolve().then(() => __importStar(require('../services/attachments')));
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
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Get property attachments
router.get('/:id/attachments', rbac_1.requireAuth, (0, rbac_1.requirePermission)('properties.view'), async (req, res) => {
    try {
        const attachments = await (0, attachments_1.getAttachments)('property', req.params.id);
        res.json(attachments);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
//# sourceMappingURL=properties-enhanced.js.map