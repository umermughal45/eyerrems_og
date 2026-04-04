"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const zod_1 = require("zod");
const client_1 = __importDefault(require("../prisma/client"));
const auth_1 = require("../middleware/auth");
const activity_1 = require("../utils/activity");
const tenant_alerts_1 = require("../services/tenant-alerts");
const logger_1 = __importDefault(require("../utils/logger"));
const error_handler_1 = require("../utils/error-handler");
const id_generation_service_1 = require("../services/id-generation-service");
const pagination_1 = require("../utils/pagination");
const router = express_1.default.Router();
// Helper function to generate unique tenant code
async function generateTenantCode() {
    let code = '';
    let exists = true;
    while (exists) {
        const date = new Date();
        const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
        const random = Math.floor(1000 + Math.random() * 9000);
        code = `TENANT-${dateStr}-${random}`;
        const existing = await client_1.default.tenant.findUnique({ where: { tenantCode: code } });
        exists = !!existing;
    }
    return code;
}
// Convert client to tenant
router.post('/convert-from-client/:clientId', auth_1.authenticate, async (req, res) => {
    try {
        const { clientId } = req.params;
        const { unitId, tid } = req.body;
        if (!unitId) {
            return (0, error_handler_1.errorResponse)(res, 'Unit ID is required', 400);
        }
        if (!tid) {
            return (0, error_handler_1.errorResponse)(res, 'TID is required', 400);
        }
        // Validate TID
        await (0, id_generation_service_1.validateTID)(tid);
        // Get client
        const client = await client_1.default.client.findFirst({
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
            return (0, error_handler_1.errorResponse)(res, 'Client not found', 404);
        }
        // Verify unit exists and is not occupied
        const unit = await client_1.default.unit.findFirst({
            where: { id: unitId, isDeleted: false },
            include: {
                tenant: { where: { isDeleted: false } },
                property: true,
            },
        });
        if (!unit) {
            return (0, error_handler_1.errorResponse)(res, 'Unit not found', 404);
        }
        if (unit.tenant) {
            return (0, error_handler_1.errorResponse)(res, 'Unit is already occupied', 400);
        }
        // Generate tenant code
        const tenantCode = await generateTenantCode();
        // Create tenant from client
        const tenant = await client_1.default.tenant.create({
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
        await client_1.default.unit.update({
            where: { id: unitId },
            data: { status: 'Occupied' },
        });
        // Update property status
        await client_1.default.property.update({
            where: { id: unit.propertyId },
            data: { status: 'Occupied' },
        });
        // Link client deals to tenant (if any)
        if (client.deals.length > 0) {
            // You can add metadata or notes about the conversion
            await (0, activity_1.createActivity)({
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
        }
        else {
            await (0, activity_1.createActivity)({
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
        return (0, error_handler_1.successResponse)(res, tenant, 201);
    }
    catch (error) {
        logger_1.default.error('Convert client to tenant error:', error);
        return (0, error_handler_1.errorResponse)(res, error);
        return (0, error_handler_1.errorResponse)(res, error);
    }
});
// Validation schemas
const createTenantSchema = zod_1.z.object({
    tid: zod_1.z.string().min(1, 'TID is required'),
    name: zod_1.z.string().min(1, 'Tenant name is required'),
    email: zod_1.z.preprocess((val) => (val === '' || val === null || val === undefined ? undefined : val), zod_1.z.string().email().optional()),
    phone: zod_1.z.preprocess((val) => (val === '' || val === null || val === undefined ? undefined : val), zod_1.z.string().optional()),
    address: zod_1.z.preprocess((val) => (val === '' || val === null || val === undefined ? undefined : val), zod_1.z.string().optional()),
    cnic: zod_1.z.preprocess((val) => (val === '' || val === null || val === undefined ? undefined : val), zod_1.z.string().optional()),
    unitId: zod_1.z.string().uuid('Invalid unit ID'),
});
const updateTenantSchema = createTenantSchema.partial();
// Get all tenants
router.get('/', auth_1.authenticate, async (req, res) => {
    try {
        const { unitId, propertyId, blockId, search } = req.query;
        const { page, limit } = (0, pagination_1.parsePaginationQuery)(req.query);
        const skip = (page - 1) * limit;
        const where = {
            isDeleted: false,
        };
        if (unitId) {
            where.unitId = unitId;
        }
        if (blockId) {
            where.unit = {
                blockId: blockId,
                isDeleted: false,
            };
        }
        else if (propertyId) {
            where.unit = {
                propertyId: propertyId,
                isDeleted: false,
            };
        }
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search, mode: 'insensitive' } },
                { tenantCode: { contains: search, mode: 'insensitive' } },
                { cnic: { contains: search, mode: 'insensitive' } },
            ];
        }
        const [tenants, total] = await Promise.all([
            client_1.default.tenant.findMany({
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
            client_1.default.tenant.count({ where }),
        ]);
        const pagination = (0, pagination_1.calculatePagination)(page, limit, total);
        return (0, error_handler_1.successResponse)(res, tenants, 200, pagination);
    }
    catch (error) {
        logger_1.default.error('Get tenants error:', error);
        return (0, error_handler_1.errorResponse)(res, error);
    }
});
// Get tenant by ID
router.get('/:id', auth_1.authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const tenant = await client_1.default.tenant.findFirst({
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
            return (0, error_handler_1.errorResponse)(res, 'Tenant not found', 404);
        }
        return (0, error_handler_1.successResponse)(res, tenant);
    }
    catch (error) {
        logger_1.default.error('Get tenant error:', error);
        return (0, error_handler_1.errorResponse)(res, error);
    }
});
// Create tenant
router.post('/', auth_1.authenticate, async (req, res) => {
    try {
        logger_1.default.info('Tenant creation request payload:', req.body);
        const data = createTenantSchema.parse(req.body);
        logger_1.default.info('Tenant creation data after validation:', data);
        // Verify unit exists and is not already occupied
        const unit = await client_1.default.unit.findFirst({
            where: { id: data.unitId, isDeleted: false },
            include: {
                tenant: {
                    where: { isDeleted: false },
                },
                property: true,
            },
        });
        if (!unit) {
            return (0, error_handler_1.errorResponse)(res, 'Unit not found', 404);
        }
        // Double-assignment validation: Check if unit already has an active tenant
        if (unit.tenant) {
            return (0, error_handler_1.errorResponse)(res, 'Unit is already occupied by another tenant', 400, {
                existingTenantId: unit.tenant.id,
                existingTenantName: unit.tenant.name,
                unitId: unit.id,
                unitName: unit.unitName,
            });
        }
        // Additional check: Verify unit status
        if (unit.status === 'Occupied') {
            return (0, error_handler_1.errorResponse)(res, 'Unit status indicates it is already occupied. Please verify the unit status before assigning a tenant.', 400);
        }
        // Validate TID
        await (0, id_generation_service_1.validateTID)(data.tid);
        const tenantCode = await generateTenantCode();
        const tenant = await client_1.default.tenant.create({
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
        await client_1.default.unit.update({
            where: { id: data.unitId },
            data: { status: 'Occupied' },
        });
        // Auto-sync: Update property status to Occupied if needed
        const property = await client_1.default.property.findUnique({
            where: { id: tenant.unit.property.id },
            include: {
                units: { where: { isDeleted: false, status: 'Occupied' } },
            },
        });
        if (property && property.status !== 'Occupied') {
            await client_1.default.property.update({
                where: { id: property.id },
                data: { status: 'Occupied' },
            });
        }
        // Auto-sync: Update dashboard KPIs (occupancy rate, revenue calculations)
        // This will be handled by dashboard refresh, but we trigger it here
        // The dashboard will recalculate based on updated unit/property status
        // Log activity
        await (0, activity_1.createActivity)({
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
        return (0, error_handler_1.successResponse)(res, tenant, 201);
    }
    catch (error) {
        logger_1.default.error('Create tenant error:', error);
        return (0, error_handler_1.errorResponse)(res, error);
    }
});
// Update tenant
router.put('/:id', auth_1.authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const data = updateTenantSchema.parse(req.body);
        const tenant = await client_1.default.tenant.findFirst({
            where: { id, isDeleted: false },
        });
        if (!tenant) {
            return (0, error_handler_1.errorResponse)(res, 'Tenant not found', 404);
        }
        const updatedTenant = await client_1.default.tenant.update({
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
        return (0, error_handler_1.successResponse)(res, updatedTenant);
    }
    catch (error) {
        logger_1.default.error('Update tenant error:', error);
        return (0, error_handler_1.errorResponse)(res, error);
    }
});
// Delete tenant (soft delete)
router.delete('/:id', auth_1.authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const tenant = await client_1.default.tenant.findFirst({
            where: { id, isDeleted: false },
            include: {
                unit: true,
            },
        });
        if (!tenant) {
            return (0, error_handler_1.errorResponse)(res, 'Tenant not found', 404);
        }
        await client_1.default.tenant.update({
            where: { id },
            data: { isDeleted: true },
        });
        // Update unit status to Vacant
        await client_1.default.unit.update({
            where: { id: tenant.unitId },
            data: { status: 'Vacant' },
        });
        // Check if property should be marked as Vacant
        const property = await client_1.default.property.findUnique({
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
                await client_1.default.property.update({
                    where: { id: property.id },
                    data: { status: 'Vacant' },
                });
            }
        }
        // End all active tenancies for this tenant
        await client_1.default.tenancy.updateMany({
            where: {
                tenantId: id,
                status: 'active',
            },
            data: { status: 'ended' },
        });
        // Log activity
        await (0, activity_1.createActivity)({
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
        return (0, error_handler_1.successResponse)(res, { message: 'Tenant deleted successfully' });
    }
    catch (error) {
        logger_1.default.error('Delete tenant error:', error);
        return (0, error_handler_1.errorResponse)(res, error);
    }
});
// Get tenant alerts (overdue rent + lease expiry)
router.get('/:id/alerts', auth_1.authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const tenant = await client_1.default.tenant.findFirst({
            where: { id, isDeleted: false },
        });
        if (!tenant) {
            return (0, error_handler_1.errorResponse)(res, 'Tenant not found', 404);
        }
        const alerts = await (0, tenant_alerts_1.getAllTenantAlerts)(id);
        return (0, error_handler_1.successResponse)(res, alerts);
    }
    catch (error) {
        logger_1.default.error('Get tenant alerts error:', error);
        return (0, error_handler_1.errorResponse)(res, error);
    }
});
// Get overdue rent alerts
router.get('/alerts/overdue-rent', auth_1.authenticate, async (req, res) => {
    try {
        const { tenantId } = req.query;
        const alerts = await (0, tenant_alerts_1.getOverdueRentAlerts)(tenantId ? tenantId : undefined);
        return (0, error_handler_1.successResponse)(res, alerts);
    }
    catch (error) {
        logger_1.default.error('Get overdue rent alerts error:', error);
        return (0, error_handler_1.errorResponse)(res, error);
    }
});
// Get lease expiry alerts
router.get('/alerts/lease-expiry', auth_1.authenticate, async (req, res) => {
    try {
        const { tenantId } = req.query;
        const alerts = await (0, tenant_alerts_1.getTenantLeaseExpiryAlerts)(tenantId ? tenantId : undefined);
        return (0, error_handler_1.successResponse)(res, alerts);
    }
    catch (error) {
        logger_1.default.error('Get lease expiry alerts error:', error);
        return (0, error_handler_1.errorResponse)(res, error);
    }
});
exports.default = router;
//# sourceMappingURL=tenants.js.map