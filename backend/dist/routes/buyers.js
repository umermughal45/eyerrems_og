"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const zod_1 = require("zod");
const client_1 = __importDefault(require("../prisma/client"));
const auth_1 = require("../middleware/auth");
const id_generation_service_1 = require("../services/id-generation-service");
const router = express_1.default.Router();
// Validation schemas
const createBuyerSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Buyer name is required'),
    email: zod_1.z.string().email().optional().or(zod_1.z.literal('')),
    phone: zod_1.z.string().optional(),
    address: zod_1.z.string().optional(),
    propertyId: zod_1.z.string().uuid().optional(),
    saleId: zod_1.z.string().uuid().optional(),
    buyStatus: zod_1.z.enum(['Pending', 'Completed', 'Cancelled']).optional(),
    buyValue: zod_1.z.number().positive().optional(),
    notes: zod_1.z.string().optional(),
    tid: zod_1.z.string().min(1, 'TID is required'),
});
const updateBuyerSchema = createBuyerSchema.partial();
// Get all buyers
router.get('/', auth_1.authenticate, async (req, res) => {
    try {
        const { propertyId, saleId, buyStatus, search } = req.query;
        const where = {
            isDeleted: false,
        };
        if (propertyId) {
            where.propertyId = propertyId;
        }
        if (saleId) {
            where.saleId = saleId;
        }
        if (buyStatus) {
            where.buyStatus = buyStatus;
        }
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search, mode: 'insensitive' } },
            ];
        }
        const buyers = await client_1.default.buyer.findMany({
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
                sale: {
                    select: {
                        id: true,
                        saleValue: true,
                        commission: true,
                        saleDate: true,
                        status: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        res.json({
            success: true,
            data: buyers,
        });
    }
    catch (error) {
        console.error('Get buyers error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch buyers',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
// Get buyer by ID
router.get('/:id', auth_1.authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const buyer = await client_1.default.buyer.findFirst({
            where: {
                id,
                isDeleted: false,
            },
            include: {
                property: true,
                sale: {
                    include: {
                        property: true,
                    },
                },
            },
        });
        if (!buyer) {
            return res.status(404).json({
                success: false,
                error: 'Buyer not found',
            });
        }
        res.json({
            success: true,
            data: buyer,
        });
    }
    catch (error) {
        console.error('Get buyer error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch buyer',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
// Create buyer
router.post('/', auth_1.authenticate, async (req, res) => {
    try {
        const data = createBuyerSchema.parse(req.body);
        // Validate TID
        await (0, id_generation_service_1.validateTID)(data.tid);
        // Verify property exists if provided
        if (data.propertyId) {
            const property = await client_1.default.property.findFirst({
                where: { id: data.propertyId, isDeleted: false },
            });
            if (!property) {
                return res.status(404).json({
                    success: false,
                    error: 'Property not found',
                });
            }
        }
        // Verify sale exists if provided
        if (data.saleId) {
            const sale = await client_1.default.sale.findFirst({
                where: { id: data.saleId, isDeleted: false },
            });
            if (!sale) {
                return res.status(404).json({
                    success: false,
                    error: 'Sale not found',
                });
            }
        }
        const buyer = await client_1.default.buyer.create({
            data: {
                ...data,
                email: data.email || undefined,
                buyStatus: data.buyStatus || 'Pending',
            },
            include: {
                property: true,
                sale: true,
            },
        });
        res.status(201).json({
            success: true,
            message: 'Buyer added successfully',
            data: buyer,
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({
                success: false,
                error: 'Validation error',
                details: error.errors,
            });
        }
        console.error('Create buyer error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create buyer',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
// Update buyer
router.put('/:id', auth_1.authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const data = updateBuyerSchema.parse(req.body);
        const buyer = await client_1.default.buyer.findFirst({
            where: { id, isDeleted: false },
        });
        if (!buyer) {
            return res.status(404).json({
                success: false,
                error: 'Buyer not found',
            });
        }
        // Verify property exists if provided
        if (data.propertyId) {
            const property = await client_1.default.property.findFirst({
                where: { id: data.propertyId, isDeleted: false },
            });
            if (!property) {
                return res.status(404).json({
                    success: false,
                    error: 'Property not found',
                });
            }
        }
        // Verify sale exists if provided
        if (data.saleId) {
            const sale = await client_1.default.sale.findFirst({
                where: { id: data.saleId, isDeleted: false },
            });
            if (!sale) {
                return res.status(404).json({
                    success: false,
                    error: 'Sale not found',
                });
            }
        }
        const updatedBuyer = await client_1.default.buyer.update({
            where: { id },
            data: {
                ...data,
                email: data.email !== undefined ? (data.email || undefined) : undefined,
            },
            include: {
                property: true,
                sale: true,
            },
        });
        res.json({
            success: true,
            message: 'Buyer updated successfully',
            data: updatedBuyer,
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({
                success: false,
                error: 'Validation error',
                details: error.errors,
            });
        }
        console.error('Update buyer error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update buyer',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
// Delete buyer (soft delete)
router.delete('/:id', auth_1.authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const buyer = await client_1.default.buyer.findFirst({
            where: { id, isDeleted: false },
        });
        if (!buyer) {
            return res.status(404).json({
                success: false,
                error: 'Buyer not found',
            });
        }
        await client_1.default.buyer.update({
            where: { id },
            data: { isDeleted: true },
        });
        res.json({
            success: true,
            message: 'Buyer deleted successfully',
        });
    }
    catch (error) {
        console.error('Delete buyer error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete buyer',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
exports.default = router;
//# sourceMappingURL=buyers.js.map