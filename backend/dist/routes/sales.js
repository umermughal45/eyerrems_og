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
const logger_1 = __importDefault(require("../utils/logger"));
const error_handler_1 = require("../utils/error-handler");
const pagination_1 = require("../utils/pagination");
const router = express_1.default.Router();
// Validation schemas
const createSaleSchema = zod_1.z.object({
    propertyId: zod_1.z.string().uuid('Invalid property ID'),
    saleValue: zod_1.z.number().positive('Sale value must be positive'),
    commissionRate: zod_1.z.number().min(0).max(100).optional(),
    saleDate: zod_1.z.string().datetime().or(zod_1.z.date()).or(zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
    status: zod_1.z.enum(['Completed', 'Pending', 'Cancelled']).optional(),
    notes: zod_1.z.string().optional(),
    actualPropertyValue: zod_1.z.number().optional(),
    profit: zod_1.z.number().optional(),
    documents: zod_1.z.array(zod_1.z.string()).optional(), // Array of document URLs
    dealerId: zod_1.z.string().uuid().optional(), // Optional dealer ID
    tid: zod_1.z.string().min(1, "TID is required"),
});
const updateSaleSchema = createSaleSchema.partial();
/**
 * Get all sales with pagination and filtering
 * @route GET /api/sales
 * @access Private
 */
router.get('/', auth_1.authenticate, async (req, res) => {
    try {
        const { propertyId, status, search } = req.query;
        const { page, limit } = (0, pagination_1.parsePaginationQuery)(req.query);
        const skip = (page - 1) * limit;
        const where = {
            isDeleted: false,
        };
        if (propertyId) {
            where.propertyId = propertyId;
        }
        if (status) {
            where.status = status;
        }
        if (search) {
            where.OR = [
                { property: { name: { contains: search, mode: 'insensitive' } } },
                { notes: { contains: search, mode: 'insensitive' } },
            ];
        }
        const [sales, total] = await Promise.all([
            client_1.default.sale.findMany({
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
            client_1.default.sale.count({ where }),
        ]);
        // Calculate average price per property type
        const salesWithAvgPrice = sales.map((sale) => ({
            ...sale,
            propertyName: sale.property.name,
            avgPrice: sale.saleValue, // This can be enhanced to calculate average per property type
        }));
        const pagination = (0, pagination_1.calculatePagination)(page, limit, total);
        return (0, error_handler_1.successResponse)(res, salesWithAvgPrice, 200, pagination);
    }
    catch (error) {
        logger_1.default.error('Get sales error:', error);
        return (0, error_handler_1.errorResponse)(res, error);
    }
});
// ========== INSTALLMENT ROUTES (must be before /:id route) ==========
/**
 * Get all installments for a sale
 * @route GET /api/sales/:saleId/installments
 * @access Private
 */
router.get('/:saleId/installments', auth_1.authenticate, async (req, res) => {
    try {
        const { saleId } = req.params;
        const installments = await client_1.default.saleInstallment.findMany({
            where: {
                saleId,
                isDeleted: false,
            },
            orderBy: {
                installmentNumber: 'asc',
            },
        });
        return (0, error_handler_1.successResponse)(res, installments);
    }
    catch (error) {
        logger_1.default.error('Get installments error:', error);
        return (0, error_handler_1.errorResponse)(res, error);
    }
});
/**
 * Create installments for a sale
 * @route POST /api/sales/:saleId/installments
 * @access Private
 */
router.post('/:saleId/installments', auth_1.authenticate, async (req, res) => {
    try {
        const { saleId } = req.params;
        const installmentSchema = zod_1.z.object({
            installments: zod_1.z.array(zod_1.z.object({
                installmentNumber: zod_1.z.number().int().positive(),
                amount: zod_1.z.number().positive(),
                dueDate: zod_1.z.string().datetime().or(zod_1.z.date()),
            })),
        });
        const { installments } = installmentSchema.parse(req.body);
        // Verify sale exists
        const sale = await client_1.default.sale.findFirst({
            where: { id: saleId, isDeleted: false },
        });
        if (!sale) {
            return (0, error_handler_1.errorResponse)(res, 'Sale not found', 404);
        }
        // Delete existing installments for this sale
        await client_1.default.saleInstallment.updateMany({
            where: { saleId, isDeleted: false },
            data: { isDeleted: true },
        });
        // Create new installments
        const createdInstallments = await Promise.all(installments.map((inst) => client_1.default.saleInstallment.create({
            data: {
                saleId,
                installmentNumber: inst.installmentNumber,
                amount: inst.amount,
                dueDate: new Date(inst.dueDate),
                status: 'Unpaid',
            },
        })));
        return (0, error_handler_1.successResponse)(res, createdInstallments, 201);
    }
    catch (error) {
        logger_1.default.error('Create installments error:', error);
        return (0, error_handler_1.errorResponse)(res, error);
    }
});
/**
 * Update installment (mark as paid, partial payment, etc.)
 * @route PUT /api/sales/installments/:id
 * @access Private
 */
router.put('/installments/:id', auth_1.authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const updateSchema = zod_1.z.object({
            paidAmount: zod_1.z.number().nonnegative().optional(),
            paidDate: zod_1.z.string().datetime().or(zod_1.z.date()).optional(),
            status: zod_1.z.enum(['Unpaid', 'Partial', 'Paid']).optional(),
            notes: zod_1.z.string().optional(),
        });
        const data = updateSchema.parse(req.body);
        const installment = await client_1.default.saleInstallment.findFirst({
            where: { id, isDeleted: false },
        });
        if (!installment) {
            return (0, error_handler_1.errorResponse)(res, 'Installment not found', 404);
        }
        const updateData = {};
        if (data.paidAmount !== undefined)
            updateData.paidAmount = data.paidAmount;
        if (data.paidDate !== undefined)
            updateData.paidDate = new Date(data.paidDate);
        if (data.status !== undefined)
            updateData.status = data.status;
        if (data.notes !== undefined)
            updateData.notes = data.notes;
        // Auto-update status based on paid amount
        if (data.paidAmount !== undefined) {
            if (data.paidAmount >= installment.amount) {
                updateData.status = 'Paid';
                updateData.paidAmount = installment.amount;
            }
            else if (data.paidAmount > 0) {
                updateData.status = 'Partial';
            }
            else {
                updateData.status = 'Unpaid';
            }
        }
        const updated = await client_1.default.saleInstallment.update({
            where: { id },
            data: updateData,
        });
        return (0, error_handler_1.successResponse)(res, updated);
    }
    catch (error) {
        logger_1.default.error('Update installment error:', error);
        return (0, error_handler_1.errorResponse)(res, error);
    }
});
/**
 * Delete installment
 * @route DELETE /api/sales/installments/:id
 * @access Private
 */
router.delete('/installments/:id', auth_1.authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const installment = await client_1.default.saleInstallment.findFirst({
            where: { id, isDeleted: false },
        });
        if (!installment) {
            return (0, error_handler_1.errorResponse)(res, 'Installment not found', 404);
        }
        await client_1.default.saleInstallment.update({
            where: { id },
            data: { isDeleted: true },
        });
        return (0, error_handler_1.successResponse)(res, { message: 'Installment deleted successfully' });
    }
    catch (error) {
        logger_1.default.error('Delete installment error:', error);
        return (0, error_handler_1.errorResponse)(res, error);
    }
});
// Get sale by ID
router.get('/:id', auth_1.authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const sale = await client_1.default.sale.findFirst({
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
        let documents = [];
        if (sale.documents) {
            if (Array.isArray(sale.documents)) {
                documents = sale.documents.filter((doc) => typeof doc === 'string');
            }
            else if (typeof sale.documents === 'object' && 'documents' in sale.documents) {
                const docs = sale.documents;
                if (Array.isArray(docs.documents)) {
                    documents = docs.documents.filter((doc) => typeof doc === 'string');
                }
            }
        }
        return (0, error_handler_1.successResponse)(res, {
            ...sale,
            documents: documents,
            actualPropertyValue: sale.actualPropertyValue || 0,
            profit: sale.profit || (sale.actualPropertyValue ? sale.saleValue - sale.actualPropertyValue : 0),
        });
    }
    catch (error) {
        logger_1.default.error('Get sale error:', error);
        return (0, error_handler_1.errorResponse)(res, error);
    }
});
/**
 * Create sale
 * @route POST /api/sales
 * @access Private
 */
router.post('/', auth_1.authenticate, async (req, res) => {
    try {
        logger_1.default.debug('Create sale request body:', JSON.stringify(req.body, null, 2));
        const data = createSaleSchema.parse(req.body);
        // Validate TID
        await (0, id_generation_service_1.validateTID)(data.tid);
        // Verify property exists
        const property = await client_1.default.property.findFirst({
            where: { id: data.propertyId, isDeleted: false },
        });
        if (!property) {
            return (0, error_handler_1.errorResponse)(res, 'Property not found', 404);
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
        const sale = await client_1.default.sale.create({
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
        await client_1.default.property.update({
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
        await (0, activity_1.createActivity)({
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
        return (0, error_handler_1.successResponse)(res, sale, 201);
    }
    catch (error) {
        logger_1.default.error('Create sale error:', error);
        return (0, error_handler_1.errorResponse)(res, error);
    }
});
/**
 * Update sale
 * @route PUT /api/sales/:id
 * @access Private
 */
router.put('/:id', auth_1.authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const data = updateSaleSchema.parse(req.body);
        const sale = await client_1.default.sale.findFirst({
            where: { id, isDeleted: false },
        });
        if (!sale) {
            return (0, error_handler_1.errorResponse)(res, 'Sale not found', 404);
        }
        // Recalculate commission if saleValue or commissionRate changed
        const updateData = { ...data };
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
        const updatedSale = await client_1.default.sale.update({
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
            await client_1.default.property.update({
                where: { id: updatedSale.propertyId },
                data: { status: 'Sold' },
            });
        }
        else if (data.status === 'Cancelled' && sale.status === 'Completed') {
            // Revert property status if sale is cancelled
            await client_1.default.property.update({
                where: { id: updatedSale.propertyId },
                data: { status: 'For Sale' },
            });
        }
        return (0, error_handler_1.successResponse)(res, updatedSale);
    }
    catch (error) {
        logger_1.default.error('Update sale error:', error);
        return (0, error_handler_1.errorResponse)(res, error);
    }
});
/**
 * Delete sale (soft delete)
 * @route DELETE /api/sales/:id
 * @access Private
 */
router.delete('/:id', auth_1.authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const sale = await client_1.default.sale.findFirst({
            where: { id, isDeleted: false },
        });
        if (!sale) {
            return (0, error_handler_1.errorResponse)(res, 'Sale not found', 404);
        }
        await client_1.default.sale.update({
            where: { id },
            data: { isDeleted: true },
        });
        // Revert property status if sale was completed
        if (sale.status === 'Completed') {
            await client_1.default.property.update({
                where: { id: sale.propertyId },
                data: { status: 'For Sale' },
            });
        }
        return (0, error_handler_1.successResponse)(res, { message: 'Sale deleted successfully' });
    }
    catch (error) {
        logger_1.default.error('Delete sale error:', error);
        return (0, error_handler_1.errorResponse)(res, error);
    }
});
exports.default = router;
//# sourceMappingURL=sales.js.map