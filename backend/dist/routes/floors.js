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
const createFloorSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Floor name is required'),
    floorNumber: zod_1.z.number().int().optional(),
    propertyId: zod_1.z.string().uuid('Invalid property ID'),
    description: zod_1.z.string().optional(),
});
const updateFloorSchema = createFloorSchema.partial();
// Get all floors for a property
router.get('/property/:propertyId', auth_1.authenticate, async (req, res) => {
    try {
        const { propertyId } = req.params;
        const floors = await client_1.default.floor.findMany({
            where: {
                propertyId,
                isDeleted: false,
            },
            include: {
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
            orderBy: {
                floorNumber: 'asc',
            },
        });
        res.json({
            success: true,
            data: floors,
        });
    }
    catch (error) {
        console.error('Get floors error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch floors',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
// Get floor by ID
router.get('/:id', auth_1.authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const floor = await client_1.default.floor.findFirst({
            where: {
                id,
                isDeleted: false,
            },
            include: {
                units: {
                    where: { isDeleted: false },
                },
                property: true,
            },
        });
        if (!floor) {
            return res.status(404).json({
                success: false,
                error: 'Floor not found',
            });
        }
        res.json({
            success: true,
            data: floor,
        });
    }
    catch (error) {
        console.error('Get floor error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch floor',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
// Create floor
router.post('/', auth_1.authenticate, async (req, res) => {
    try {
        const data = createFloorSchema.parse(req.body);
        // Check if property exists
        const property = await client_1.default.property.findFirst({
            where: { id: data.propertyId, isDeleted: false },
        });
        if (!property) {
            return res.status(404).json({
                success: false,
                error: 'Property not found',
            });
        }
        const floor = await client_1.default.floor.create({
            data,
            include: {
                units: true,
                property: true,
            },
        });
        res.status(201).json({
            success: true,
            message: 'Floor added successfully',
            data: floor,
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
        console.error('Create floor error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create floor',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
// Update floor
router.put('/:id', auth_1.authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const data = updateFloorSchema.parse(req.body);
        const existingFloor = await client_1.default.floor.findFirst({
            where: { id, isDeleted: false },
        });
        if (!existingFloor) {
            return res.status(404).json({
                success: false,
                error: 'Floor not found',
            });
        }
        const floor = await client_1.default.floor.update({
            where: { id },
            data,
            include: {
                units: {
                    where: { isDeleted: false },
                },
            },
        });
        res.json({
            success: true,
            message: 'Floor updated successfully',
            data: floor,
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
        console.error('Update floor error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update floor',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
// Delete floor (soft delete)
router.delete('/:id', auth_1.authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const floor = await client_1.default.floor.findFirst({
            where: { id, isDeleted: false },
        });
        if (!floor) {
            return res.status(404).json({
                success: false,
                error: 'Floor not found',
            });
        }
        await client_1.default.floor.update({
            where: { id },
            data: { isDeleted: true },
        });
        res.json({
            success: true,
            message: 'Floor deleted successfully',
        });
    }
    catch (error) {
        console.error('Delete floor error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete floor',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
exports.default = router;
//# sourceMappingURL=floors.js.map