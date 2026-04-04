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
const id_generation_service_1 = require("../services/id-generation-service");
const workflows_1 = require("../services/workflows");
const code_generator_1 = require("../utils/code-generator");
const lease_history_1 = require("../services/lease-history");
const logger_1 = __importDefault(require("../utils/logger"));
const error_handler_1 = require("../utils/error-handler");
const pagination_1 = require("../utils/pagination");
const router = express_1.default.Router();
// Validation schemas
const createLeaseSchema = zod_1.z.object({
    tenantId: zod_1.z.string().uuid('Invalid tenant ID'),
    unitId: zod_1.z.string().uuid('Invalid unit ID'),
    leaseStart: zod_1.z.string().datetime().or(zod_1.z.date()),
    leaseEnd: zod_1.z.string().datetime().or(zod_1.z.date()),
    rent: zod_1.z.number().positive('Rent must be positive'),
    status: zod_1.z.enum(['Active', 'Expired', 'Terminated']).optional(),
    notes: zod_1.z.string().optional(),
    leaseNumber: zod_1.z.string().optional(),
    tid: zod_1.z.string().min(1, "TID is required"),
});
const updateLeaseSchema = createLeaseSchema.partial();
// Get all leases
router.get('/', auth_1.authenticate, async (req, res) => {
    try {
        const { tenantId, unitId, propertyId, status, search } = req.query;
        const { page, limit } = (0, pagination_1.parsePaginationQuery)(req.query);
        const skip = (page - 1) * limit;
        const where = {
            isDeleted: false,
        };
        if (tenantId) {
            where.tenantId = tenantId;
        }
        if (unitId) {
            where.unitId = unitId;
        }
        if (propertyId) {
            where.unit = {
                propertyId: propertyId,
                isDeleted: false,
            };
        }
        if (status) {
            const statusStr = Array.isArray(status) ? status[0] : status;
            where.status = String(statusStr);
        }
        if (search) {
            where.OR = [
                {
                    tenant: {
                        name: { contains: search, mode: 'insensitive' },
                        isDeleted: false,
                    }
                },
                { unit: { unitName: { contains: search, mode: 'insensitive' } } },
            ];
        }
        // Ensure tenant is not deleted
        if (!where.OR) {
            where.tenant = {
                isDeleted: false,
            };
        }
        const [leases, total] = await Promise.all([
            client_1.default.lease.findMany({
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
            client_1.default.lease.count({ where }),
        ]);
        // Map leases to include tenant name and property name
        const leasesWithDetails = leases.map((lease) => ({
            ...lease,
            tenantName: lease.tenant?.name || null,
            propertyName: lease.unit?.property?.name || null,
            unitName: lease.unit?.unitName || null,
        }));
        const pagination = (0, pagination_1.calculatePagination)(page, limit, total);
        return (0, error_handler_1.successResponse)(res, leasesWithDetails, 200, pagination);
    }
    catch (error) {
        logger_1.default.error('Get leases error:', error);
        return (0, error_handler_1.errorResponse)(res, error);
    }
});
// Get lease by ID
router.get('/:id', auth_1.authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const lease = await client_1.default.lease.findFirst({
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
            return (0, error_handler_1.errorResponse)(res, 'Lease not found', 404);
        }
        // Get lease history
        const history = await (0, lease_history_1.getLeaseHistory)(id);
        return (0, error_handler_1.successResponse)(res, {
            ...lease,
            history: history?.history || [],
        });
    }
    catch (error) {
        logger_1.default.error('Get lease error:', error);
        return (0, error_handler_1.errorResponse)(res, error);
    }
});
// Create lease
router.post('/', auth_1.authenticate, async (req, res) => {
    try {
        const data = createLeaseSchema.parse(req.body);
        // Verify tenant exists
        const tenant = await client_1.default.tenant.findFirst({
            where: { id: data.tenantId, isDeleted: false },
        });
        if (!tenant) {
            return (0, error_handler_1.errorResponse)(res, 'Tenant not found', 404);
        }
        // Verify unit exists
        const unit = await client_1.default.unit.findFirst({
            where: { id: data.unitId, isDeleted: false },
        });
        if (!unit) {
            return (0, error_handler_1.errorResponse)(res, 'Unit not found', 404);
        }
        // Convert date strings to Date objects
        const leaseStart = typeof data.leaseStart === 'string' ? new Date(data.leaseStart) : data.leaseStart;
        const leaseEnd = typeof data.leaseEnd === 'string' ? new Date(data.leaseEnd) : data.leaseEnd;
        if (leaseStart >= leaseEnd) {
            return (0, error_handler_1.errorResponse)(res, 'Lease end date must be after lease start date', 400);
        }
        // Auto-generate lease number if not provided
        const leaseNumber = data.leaseNumber || await (0, code_generator_1.generateLeaseNumber)();
        const tid = data.tid;
        // Validate TID
        await (0, id_generation_service_1.validateTID)(tid);
        const lease = await client_1.default.lease.create({
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
        const tenancy = await (0, workflows_1.createTenancyFromLease)(lease.id);
        // Auto-generate first month invoice
        let generatedInvoice = null;
        if (tenancy) {
            try {
                const today = new Date();
                const dueDate = new Date(leaseStart);
                dueDate.setDate(dueDate.getDate() + 7); // 7 days from lease start
                // Auto-generate invoice number
                const invoiceNumber = await (0, code_generator_1.generateInvoiceNumber)();
                // Create first month invoice
                generatedInvoice = await client_1.default.invoice.create({
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
                await (0, workflows_1.syncInvoiceToFinanceLedger)(generatedInvoice.id);
                // Update tenant ledger
                await (0, workflows_1.updateTenantLedger)(lease.tenantId, {
                    entryType: 'debit',
                    description: `First month rent invoice ${invoiceNumber}`,
                    amount: lease.rent,
                    referenceId: generatedInvoice.id,
                    referenceType: 'invoice',
                });
            }
            catch (error) {
                logger_1.default.error('Error generating invoice from lease:', error);
                // Don't fail lease creation if invoice generation fails
            }
        }
        // Create lease history entry
        await (0, lease_history_1.createLeaseHistory)(lease.id, 'created', {
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
        await (0, activity_1.createActivity)({
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
        return (0, error_handler_1.successResponse)(res, {
            ...lease,
            tenancy,
            invoice: generatedInvoice,
        }, 201);
    }
    catch (error) {
        logger_1.default.error('Create lease error:', error);
        return (0, error_handler_1.errorResponse)(res, error);
    }
});
// Update lease
router.put('/:id', auth_1.authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const data = updateLeaseSchema.parse(req.body);
        const lease = await client_1.default.lease.findFirst({
            where: { id, isDeleted: false },
        });
        if (!lease) {
            return (0, error_handler_1.errorResponse)(res, 'Lease not found', 404);
        }
        // Convert date strings to Date objects if provided
        const updateData = { ...data };
        let newLeaseStart;
        let newLeaseEnd;
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
                return (0, error_handler_1.errorResponse)(res, 'Lease end date must be after lease start date', 400);
            }
        }
        // Track changes for history
        const changes = [];
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
            await (0, lease_history_1.trackLeaseStatusChange)(id, statusValue, req.user?.id);
        }
        const updatedLease = await client_1.default.lease.update({
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
                await (0, lease_history_1.createLeaseHistory)(id, 'updated', {
                    field: change.field,
                    oldValue: change.oldValue,
                    newValue: change.newValue,
                    changedBy: req.user?.id,
                    notes: `${change.field} updated`,
                });
            }
        }
        return (0, error_handler_1.successResponse)(res, updatedLease);
    }
    catch (error) {
        logger_1.default.error('Update lease error:', error);
        return (0, error_handler_1.errorResponse)(res, error);
    }
});
// Delete lease (soft delete)
router.delete('/:id', auth_1.authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const lease = await client_1.default.lease.findFirst({
            where: { id, isDeleted: false },
        });
        if (!lease) {
            return (0, error_handler_1.errorResponse)(res, 'Lease not found', 404);
        }
        // Track termination before deletion
        if (lease.status === 'Active') {
            await (0, lease_history_1.trackLeaseStatusChange)(id, 'Terminated', req.user?.id, 'Lease terminated and deleted');
        }
        await client_1.default.lease.update({
            where: { id },
            data: { isDeleted: true },
        });
        // Create history entry for deletion
        await (0, lease_history_1.createLeaseHistory)(id, 'terminated', {
            changedBy: req.user?.id,
            notes: 'Lease terminated and deleted',
        });
        return (0, error_handler_1.successResponse)(res, { message: 'Lease deleted successfully' });
    }
    catch (error) {
        logger_1.default.error('Delete lease error:', error);
        return (0, error_handler_1.errorResponse)(res, error);
    }
});
// Get lease history
router.get('/:id/history', auth_1.authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const lease = await client_1.default.lease.findFirst({
            where: { id, isDeleted: false },
        });
        if (!lease) {
            return (0, error_handler_1.errorResponse)(res, 'Lease not found', 404);
        }
        const history = await (0, lease_history_1.getLeaseHistory)(id);
        if (!history) {
            return (0, error_handler_1.errorResponse)(res, 'Lease history not found', 404);
        }
        return (0, error_handler_1.successResponse)(res, history);
    }
    catch (error) {
        logger_1.default.error('Get lease history error:', error);
        return (0, error_handler_1.errorResponse)(res, error);
    }
});
// Renew lease
router.post('/:id/renew', auth_1.authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const { newLeaseEnd, newRent, notes } = req.body;
        if (!newLeaseEnd) {
            return (0, error_handler_1.errorResponse)(res, 'newLeaseEnd is required', 400);
        }
        const lease = await client_1.default.lease.findFirst({
            where: { id, isDeleted: false },
        });
        if (!lease) {
            return (0, error_handler_1.errorResponse)(res, 'Lease not found', 404);
        }
        const newLeaseEndDate = typeof newLeaseEnd === 'string' ? new Date(newLeaseEnd) : newLeaseEnd;
        if (newLeaseEndDate <= lease.leaseEnd) {
            return (0, error_handler_1.errorResponse)(res, 'New lease end date must be after current lease end date', 400);
        }
        // Track renewal
        await (0, lease_history_1.trackLeaseRenewal)(id, {
            newLeaseEnd: newLeaseEndDate,
            newRent: newRent ? Number(newRent) : undefined,
            renewedBy: req.user?.id,
            notes,
        });
        // Update status to Renewed
        await (0, lease_history_1.trackLeaseStatusChange)(id, 'Renewed', req.user?.id, notes || 'Lease renewed');
        const updatedLease = await client_1.default.lease.findUnique({
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
        const leaseWithRelations = await client_1.default.lease.findUnique({
            where: { id: lease.id },
            include: { tenant: true, unit: true },
        });
        // Log activity
        await (0, activity_1.createActivity)({
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
        return (0, error_handler_1.successResponse)(res, updatedLease);
    }
    catch (error) {
        logger_1.default.error('Renew lease error:', error);
        return (0, error_handler_1.errorResponse)(res, error);
    }
});
exports.default = router;
//# sourceMappingURL=leases.js.map