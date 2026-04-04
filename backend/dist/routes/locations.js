"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const zod_1 = require("zod");
const logger_1 = __importDefault(require("../utils/logger"));
const auth_1 = require("../middleware/auth");
const error_handler_1 = require("../utils/error-handler");
const location_1 = require("../services/location");
const router = express_1.default.Router();
const createLocationSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Name is required'),
    type: zod_1.z.string().min(1, 'Type is required'),
    parentId: zod_1.z.string().uuid().nullable().optional(),
});
const updateLocationSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).optional(),
    type: zod_1.z.string().min(1).optional(),
    parentId: zod_1.z.string().uuid().nullable().optional(),
});
const searchSchema = zod_1.z.object({
    q: zod_1.z.string().min(1, 'Search query is required'),
});
router.post('/', auth_1.authenticate, async (req, res) => {
    try {
        const payload = createLocationSchema.parse(req.body);
        const location = await (0, location_1.createLocation)(payload);
        return (0, error_handler_1.successResponse)(res, location, 201);
    }
    catch (error) {
        logger_1.default.error('Create location error:', error);
        return (0, error_handler_1.errorResponse)(res, error);
    }
});
router.get('/tree', auth_1.authenticate, async (_req, res) => {
    try {
        const tree = await (0, location_1.getLocationTree)();
        return (0, error_handler_1.successResponse)(res, tree);
    }
    catch (error) {
        logger_1.default.error('Fetch location tree error:', error);
        return (0, error_handler_1.errorResponse)(res, error);
    }
});
// GET leaf locations with full paths (for dropdowns)
router.get('/leaves', auth_1.authenticate, async (_req, res) => {
    try {
        const leaves = await (0, location_1.getLeafLocationsWithPaths)();
        return (0, error_handler_1.successResponse)(res, leaves);
    }
    catch (error) {
        logger_1.default.error('Fetch leaf locations error:', error);
        return (0, error_handler_1.errorResponse)(res, error);
    }
});
router.get('/search', auth_1.authenticate, async (req, res) => {
    try {
        const { q } = searchSchema.parse(req.query);
        const data = await (0, location_1.searchLocations)(q);
        return (0, error_handler_1.successResponse)(res, data);
    }
    catch (error) {
        logger_1.default.error('Search locations error:', error);
        return (0, error_handler_1.errorResponse)(res, error);
    }
});
router.get('/:id/children', auth_1.authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const children = await (0, location_1.getLocationChildren)(id);
        return (0, error_handler_1.successResponse)(res, children);
    }
    catch (error) {
        logger_1.default.error('Get location children error:', error);
        return (0, error_handler_1.errorResponse)(res, error);
    }
});
router.get('/:id/subtree', auth_1.authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const subtree = await (0, location_1.getLocationSubtree)(id);
        if (!subtree) {
            return (0, error_handler_1.errorResponse)(res, 'Location not found', 404);
        }
        return (0, error_handler_1.successResponse)(res, {
            ...subtree,
        });
    }
    catch (error) {
        logger_1.default.error('Get location subtree error:', error);
        return (0, error_handler_1.errorResponse)(res, error);
    }
});
router.put('/:id', auth_1.authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const payload = updateLocationSchema.parse(req.body);
        const location = await (0, location_1.updateLocation)(id, payload);
        return (0, error_handler_1.successResponse)(res, location);
    }
    catch (error) {
        logger_1.default.error('Update location error:', error);
        return (0, error_handler_1.errorResponse)(res, error);
    }
});
router.delete('/:id', auth_1.authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        await (0, location_1.deleteLocation)(id);
        return (0, error_handler_1.successResponse)(res, { message: 'Location deleted' });
    }
    catch (error) {
        logger_1.default.error('Delete location error:', error);
        return (0, error_handler_1.errorResponse)(res, error);
    }
});
exports.default = router;
//# sourceMappingURL=locations.js.map