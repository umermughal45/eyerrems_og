"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const zod_1 = require("zod");
const client_1 = __importDefault(require("../prisma/client"));
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
// Validation schemas
const createBlockSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Block name is required'),
    propertyId: zod_1.z.string().uuid('Invalid property ID'),
    description: zod_1.z.string().optional(),
});
const updateBlockSchema = createBlockSchema.partial();
// Get all blocks
router.get('/', auth_1.authenticate, async (req, res) => {
    try {
        const { propertyId, search } = req.query;
        const where = {
            isDeleted: false,
        };
        if (propertyId) {
            where.propertyId = propertyId;
        }
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
            ];
        }
        const blocks = await client_1.default.block.findMany({
            where,
            include: {
                property: {
                    select: {
                        id: true,
                        name: true,
                        address: true,
                    },
                },
                units: {
                    where: { isDeleted: false },
                    select: {
                        id: true,
                        unitName: true,
                        status: true,
                        monthlyRent: true,
                    },
                },
                _count: {
                    select: {
                        units: { where: { isDeleted: false } },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        res.json({
            success: true,
            data: blocks,
        });
    }
    catch (error) {
        console.error('Get blocks error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch blocks',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
// Get block by ID
router.get('/:id', auth_1.authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const block = await client_1.default.block.findFirst({
            where: {
                id,
                isDeleted: false,
            },
            include: {
                property: true,
                units: {
                    where: { isDeleted: false },
                    include: {
                        tenant: {
                            where: { isDeleted: false },
                        },
                    },
                },
            },
        });
        if (!block) {
            return res.status(404).json({
                success: false,
                error: 'Block not found',
            });
        }
        res.json({
            success: true,
            data: block,
        });
    }
    catch (error) {
        console.error('Get block error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch block',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
// Create block
router.post('/', auth_1.authenticate, async (req, res) => {
    try {
        const data = createBlockSchema.parse(req.body);
        // Verify property exists
        const property = await client_1.default.property.findFirst({
            where: { id: data.propertyId, isDeleted: false },
        });
        if (!property) {
            return res.status(404).json({
                success: false,
                error: 'Property not found',
            });
        }
        const block = await client_1.default.block.create({
            data,
            include: {
                property: true,
                units: true,
            },
        });
        res.status(201).json({
            success: true,
            message: 'Block added successfully',
            data: block,
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
        console.error('Create block error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create block',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
// Update block
router.put('/:id', auth_1.authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const data = updateBlockSchema.parse(req.body);
        const block = await client_1.default.block.findFirst({
            where: { id, isDeleted: false },
        });
        if (!block) {
            return res.status(404).json({
                success: false,
                error: 'Block not found',
            });
        }
        const updatedBlock = await client_1.default.block.update({
            where: { id },
            data,
            include: {
                property: true,
                units: {
                    where: { isDeleted: false },
                },
            },
        });
        res.json({
            success: true,
            message: 'Block updated successfully',
            data: updatedBlock,
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
        console.error('Update block error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update block',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
// Delete block (soft delete)
router.delete('/:id', auth_1.authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const block = await client_1.default.block.findFirst({
            where: { id, isDeleted: false },
        });
        if (!block) {
            return res.status(404).json({
                success: false,
                error: 'Block not found',
            });
        }
        await client_1.default.block.update({
            where: { id },
            data: { isDeleted: true },
        });
        res.json({
            success: true,
            message: 'Block deleted successfully',
        });
    }
    catch (error) {
        console.error('Delete block error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete block',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
exports.default = router;
//# sourceMappingURL=blocks.js.map