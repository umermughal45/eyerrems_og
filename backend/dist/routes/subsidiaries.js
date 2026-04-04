"use strict";
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
const multer_1 = __importDefault(require("multer"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const client_1 = __importDefault(require("../prisma/client"));
const auth_1 = require("../middleware/auth");
const audit_log_1 = require("../services/audit-log");
const error_handler_1 = require("../utils/error-handler");
const location_1 = require("../services/location");
const file_security_1 = require("../utils/file-security");
// logger import removed (unused)
const router = express_1.default.Router();
// Configure multer for logo uploads
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (_req, file, cb) => {
        // Accept only image files
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        }
        else {
            cb(new Error('Only image files are allowed'), false);
        }
    },
});
// Helper function to build full path for a location
const buildLocationPath = (nodes, targetId) => {
    for (const node of nodes) {
        if (node.id === targetId) {
            return [node.name];
        }
        const childPath = buildLocationPath(node.children, targetId);
        if (childPath.length > 0) {
            return [node.name, ...childPath];
        }
    }
    return [];
};
// IMPORTANT: Route order matters! Specific routes must come before parameterized routes.
// GET all leaf locations with full paths for dropdown (specific route - must come first)
router.get('/locations/with-paths', auth_1.authenticate, async (_req, res) => {
    try {
        const { getLeafLocationsWithPaths } = await Promise.resolve().then(() => __importStar(require('../services/location')));
        const leaves = await getLeafLocationsWithPaths();
        return (0, error_handler_1.successResponse)(res, leaves || []);
    }
    catch (error) {
        console.error('Error fetching leaf locations with paths:', error);
        // Return empty array on error, don't crash the page
        return (0, error_handler_1.successResponse)(res, []);
    }
});
// GET subsidiary options for a location (parameterized - comes after specific routes)
router.get('/location/:locationId/options', auth_1.authenticate, async (req, res) => {
    try {
        const { locationId } = req.params;
        const subsidiary = await client_1.default.propertySubsidiary.findFirst({
            where: {
                locationId,
                isActive: true,
            },
            include: {
                options: {
                    orderBy: { sortOrder: 'asc' },
                },
            },
        });
        if (!subsidiary) {
            return (0, error_handler_1.successResponse)(res, []);
        }
        // Fetch location separately
        const location = await client_1.default.location.findUnique({
            where: { id: locationId },
            select: {
                id: true,
                name: true,
                type: true,
                parentId: true,
                isLeaf: true,
                isActive: true,
            },
        });
        // Only return options if location is active and leaf (if columns exist)
        if (location && location.isActive !== undefined && location.isLeaf !== undefined) {
            if (!location.isActive || !location.isLeaf) {
                return (0, error_handler_1.successResponse)(res, []);
            }
        }
        return (0, error_handler_1.successResponse)(res, subsidiary.options);
    }
    catch (error) {
        // If columns don't exist, try without isActive filter
        if (error?.message?.includes('isActive') || error?.message?.includes('isLeaf') || error?.message?.includes('does not exist')) {
            try {
                const { locationId } = req.params;
                const subsidiary = await client_1.default.propertySubsidiary.findFirst({
                    where: {
                        locationId,
                    },
                    include: {
                        options: {
                            orderBy: { sortOrder: 'asc' },
                        },
                    },
                });
                return (0, error_handler_1.successResponse)(res, subsidiary?.options || []);
            }
            catch (fallbackError) {
                return (0, error_handler_1.successResponse)(res, []);
            }
        }
        return (0, error_handler_1.errorResponse)(res, error);
    }
});
// GET subsidiaries by location ID (parameterized route)
router.get('/location/:locationId', auth_1.authenticate, async (req, res) => {
    try {
        const { locationId } = req.params;
        const subsidiaries = await client_1.default.propertySubsidiary.findMany({
            where: {
                locationId,
                isActive: true,
            },
            include: {
                options: {
                    orderBy: { sortOrder: 'asc' },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        // Fetch location separately and filter to only return subsidiaries for active leaf locations (if columns exist)
        const location = await client_1.default.location.findUnique({
            where: { id: locationId },
            select: {
                id: true,
                name: true,
                type: true,
                parentId: true,
                isLeaf: true,
                isActive: true,
            },
        });
        // Filter to only return subsidiaries for active leaf locations (if columns exist)
        const validSubsidiaries = location && location.isActive !== undefined && location.isLeaf !== undefined
            ? (location.isActive && location.isLeaf ? subsidiaries : [])
            : subsidiaries;
        return (0, error_handler_1.successResponse)(res, validSubsidiaries);
    }
    catch (error) {
        // If columns don't exist, try without isActive filter
        if (error?.message?.includes('isActive') || error?.message?.includes('isLeaf') || error?.message?.includes('does not exist')) {
            try {
                const { locationId } = req.params;
                const subsidiaries = await client_1.default.propertySubsidiary.findMany({
                    where: {
                        locationId,
                    },
                    include: {
                        options: {
                            orderBy: { sortOrder: 'asc' },
                        },
                    },
                    orderBy: { createdAt: 'desc' },
                });
                return (0, error_handler_1.successResponse)(res, subsidiaries);
            }
            catch (fallbackError) {
                return (0, error_handler_1.successResponse)(res, []);
            }
        }
        return (0, error_handler_1.errorResponse)(res, error);
    }
});
// GET all subsidiaries with their locations
router.get('/', auth_1.authenticate, async (_req, res) => {
    // Log route resolution for debugging
    console.log('[Subsidiaries Route] GET / - Resolved path:', _req.path, 'Original URL:', _req.originalUrl, 'Base URL:', _req.baseUrl);
    try {
        // Get only active subsidiaries, then filter by location status
        const allSubsidiaries = await client_1.default.propertySubsidiary.findMany({
            where: {
                isActive: true,
            },
            include: {
                options: {
                    orderBy: { sortOrder: 'asc' },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        // Fetch all locations for filtering
        const locationIds = [...new Set(allSubsidiaries.map(s => s.locationId))];
        const locations = await client_1.default.location.findMany({
            where: { id: { in: locationIds } },
            select: {
                id: true,
                name: true,
                type: true,
                parentId: true,
                isLeaf: true,
                isActive: true,
            },
        });
        const locationMap = new Map(locations.map(l => [l.id, l]));
        // Filter to only active leaf locations
        const subsidiaries = allSubsidiaries.filter((sub) => {
            const location = locationMap.get(sub.locationId);
            if (location && location.isActive !== undefined && location.isLeaf !== undefined) {
                return location.isActive && location.isLeaf;
            }
            return true; // If columns don't exist, include all
        });
        // If no subsidiaries, return empty array immediately
        if (!subsidiaries || subsidiaries.length === 0) {
            return (0, error_handler_1.successResponse)(res, []);
        }
        // Try to get location tree for path building, but don't fail if it errors
        let tree = [];
        try {
            tree = await (0, location_1.getLocationTree)();
        }
        catch (treeError) {
            console.warn('Could not fetch location tree for path building:', treeError);
            // Continue without tree - we'll use location name as fallback
        }
        // Add full path to each subsidiary
        const subsidiariesWithPaths = subsidiaries
            .map((sub) => {
            try {
                const location = locationMap.get(sub.locationId);
                if (tree.length > 0) {
                    const path = buildLocationPath(tree, sub.locationId);
                    // Only return if path was successfully built (all parents are active)
                    if (path.length > 0) {
                        return {
                            ...sub,
                            locationPath: path.join(' > '),
                        };
                    }
                }
                // Fallback: use location name if path building fails
                return {
                    ...sub,
                    locationPath: location?.name || 'Unknown Location',
                };
            }
            catch (err) {
                // If path building fails, skip this subsidiary
                return null;
            }
        })
            .filter((sub) => sub !== null); // Remove null entries
        return (0, error_handler_1.successResponse)(res, subsidiariesWithPaths);
    }
    catch (error) {
        console.error('Error fetching subsidiaries:', error);
        // If columns don't exist, try without isActive/isLeaf filters
        if (error?.message?.includes('isActive') || error?.message?.includes('isLeaf') || error?.message?.includes('does not exist')) {
            try {
                const subsidiaries = await client_1.default.propertySubsidiary.findMany({
                    include: {
                        options: {
                            orderBy: { sortOrder: 'asc' },
                        },
                    },
                    orderBy: { createdAt: 'desc' },
                });
                // Fetch all locations
                const locationIds = [...new Set(subsidiaries.map(s => s.locationId))];
                const locations = await client_1.default.location.findMany({
                    where: { id: { in: locationIds } },
                    select: {
                        id: true,
                        name: true,
                        type: true,
                        parentId: true,
                    },
                });
                const locationMap = new Map(locations.map(l => [l.id, l]));
                // Try to get location tree for path building, but don't fail if it errors
                let tree = [];
                try {
                    tree = await (0, location_1.getLocationTree)();
                }
                catch (treeError) {
                    console.warn('Could not fetch location tree for path building:', treeError);
                }
                const subsidiariesWithPaths = subsidiaries.map((sub) => {
                    try {
                        const location = locationMap.get(sub.locationId);
                        if (tree.length > 0) {
                            const path = buildLocationPath(tree, sub.locationId);
                            if (path.length > 0) {
                                return {
                                    ...sub,
                                    locationPath: path.join(' > '),
                                };
                            }
                        }
                        return {
                            ...sub,
                            locationPath: location?.name || 'Unknown Location',
                        };
                    }
                    catch (err) {
                        const location = locationMap.get(sub.locationId);
                        return {
                            ...sub,
                            locationPath: location?.name || 'Unknown Location',
                        };
                    }
                });
                return (0, error_handler_1.successResponse)(res, subsidiariesWithPaths);
            }
            catch (fallbackError) {
                // GET requests should NEVER return 400/500 - return empty array instead
                return (0, error_handler_1.successResponse)(res, []);
            }
        }
        // GET requests should NEVER return 400/500 - return empty array instead
        return (0, error_handler_1.successResponse)(res, []);
    }
});
// GET single subsidiary by ID (generic route - comes last)
router.get('/:id', auth_1.authenticate, async (req, res) => {
    // Log route resolution for debugging
    console.log('[Subsidiaries Route] GET /:id - Resolved path:', req.path, 'Original URL:', req.originalUrl, 'Base URL:', req.baseUrl, 'ID:', req.params.id);
    try {
        const { id } = req.params;
        const subsidiary = await client_1.default.propertySubsidiary.findUnique({
            where: { id },
            include: {
                options: {
                    orderBy: { sortOrder: 'asc' },
                },
            },
        });
        if (!subsidiary) {
            return (0, error_handler_1.errorResponse)(res, 'Subsidiary not found', 404);
        }
        return (0, error_handler_1.successResponse)(res, subsidiary);
    }
    catch (error) {
        return (0, error_handler_1.errorResponse)(res, error);
    }
});
const createSubsidiarySchema = zod_1.z.object({
    locationId: zod_1.z.string().uuid('Location ID must be a valid UUID'),
    options: zod_1.z.array(zod_1.z.string().min(1, 'Option name cannot be empty')).min(1, 'At least one option is required'),
    logoPath: zod_1.z.string().optional(), // Optional logo path if uploaded via base64
});
// POST create subsidiary with logo upload support
router.post('/', auth_1.authenticate, auth_1.requireAdmin, upload.single('logo'), async (req, res) => {
    // Log route resolution for debugging
    console.log('[Subsidiaries Route] POST / - Resolved path:', req.path, 'Original URL:', req.originalUrl, 'Base URL:', req.baseUrl);
    console.log('[Subsidiaries Route] POST / - Request Body:', JSON.stringify(req.body, null, 2));
    try {
        // Parse JSON body if sent as form-data
        let body = req.body;
        if (typeof body === 'string') {
            try {
                body = JSON.parse(body);
            }
            catch {
                // If parsing fails, use as is
            }
        }
        // Normalize options field to array if it's a string (common with FormData)
        if (body.options) {
            if (typeof body.options === 'string') {
                try {
                    // Try parsing as JSON first (e.g. "[\"A\",\"B\"]")
                    const parsed = JSON.parse(body.options);
                    if (Array.isArray(parsed)) {
                        body.options = parsed;
                    }
                    else {
                        // If valid JSON but not array (e.g. "some string"), wrap it
                        body.options = [body.options];
                    }
                }
                catch {
                    // Not valid JSON, treat as single string value -> wrap in array
                    body.options = [body.options];
                }
            }
            else if (!Array.isArray(body.options)) {
                // If it exists but is not an array (and not a string), wrap it
                body.options = [body.options];
            }
        }
        const payload = createSubsidiarySchema.parse(body);
        let logoPath = null;
        // Check if location exists and is a leaf
        const location = await client_1.default.location.findUnique({
            where: { id: payload.locationId },
        });
        if (!location) {
            return (0, error_handler_1.errorResponse)(res, 'Location not found', 404);
        }
        const locationData = location;
        if (locationData.isActive !== undefined && locationData.isActive === false) {
            return (0, error_handler_1.errorResponse)(res, 'Cannot create subsidiary for inactive location', 400);
        }
        if (locationData.isLeaf !== undefined && locationData.isLeaf === false) {
            return (0, error_handler_1.errorResponse)(res, 'Subsidiaries can only be created for leaf locations (locations without children)', 400);
        }
        // Check if subsidiary already exists for this location
        const existing = await client_1.default.propertySubsidiary.findFirst({
            where: { locationId: payload.locationId },
        });
        if (existing) {
            return (0, error_handler_1.errorResponse)(res, 'Subsidiary already exists for this location. Please update the existing one instead.', 400);
        }
        // Handle logo upload (from multer file or base64)
        if (req.file) {
            // Logo uploaded via multer (form-data)
            const validation = await (0, file_security_1.validateFileUpload)(req.file.buffer, req.file.mimetype, req.file.originalname);
            if (!validation.valid) {
                return (0, error_handler_1.errorResponse)(res, validation.error || 'Invalid logo file', 400);
            }
            // Scan for viruses
            const tempPath = path_1.default.join(process.cwd(), 'public', 'uploads', `temp-${Date.now()}-${req.file.originalname}`);
            fs_1.default.writeFileSync(tempPath, req.file.buffer);
            const scanResult = await (0, file_security_1.scanFileForViruses)(tempPath);
            if (!scanResult.clean) {
                fs_1.default.unlinkSync(tempPath);
                return (0, error_handler_1.errorResponse)(res, 'Logo file failed virus scan', 400);
            }
            // Save file securely
            const { relativePath } = await (0, file_security_1.saveFileSecurely)(req.file.buffer, req.file.originalname, 'logos', req.user.id);
            logoPath = relativePath;
            // Clean up temp file
            try {
                fs_1.default.unlinkSync(tempPath);
            }
            catch {
                // Ignore cleanup errors
            }
        }
        else if (payload.logoPath) {
            // Logo path provided directly (from base64 upload via /api/upload endpoint)
            logoPath = payload.logoPath;
        }
        // Create subsidiary with options in a transaction
        const result = await client_1.default.$transaction(async (tx) => {
            const subsidiary = await tx.propertySubsidiary.create({
                data: {
                    locationId: payload.locationId,
                    name: location.name, // Store location name for quick reference
                    logoPath: logoPath,
                    isActive: true,
                },
            });
            // Create all options
            const options = await Promise.all(payload.options.map((optionName, index) => tx.subsidiaryOption.create({
                data: {
                    propertySubsidiaryId: subsidiary.id,
                    name: optionName.trim(),
                    sortOrder: index,
                },
            })));
            return { subsidiary, options };
        });
        await (0, audit_log_1.createAuditLog)({
            entityType: 'property_subsidiary',
            entityId: result.subsidiary.id,
            action: 'create',
            description: `Subsidiary created for location ${location.name} with ${payload.options.length} options`,
            newValues: result,
            userId: req.user?.id,
            userName: req.user?.username,
            req,
        });
        return (0, error_handler_1.successResponse)(res, result, 201);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return (0, error_handler_1.errorResponse)(res, error.errors[0].message, 400);
        }
        return (0, error_handler_1.errorResponse)(res, error);
    }
});
const updateSubsidiarySchema = zod_1.z.object({
    options: zod_1.z.array(zod_1.z.string().min(1, 'Option name cannot be empty')).min(1, 'At least one option is required').optional(),
    logoPath: zod_1.z.string().optional(), // Optional logo path update
});
// PUT update subsidiary (options and logo can be updated)
router.put('/:id', auth_1.authenticate, auth_1.requireAdmin, upload.single('logo'), async (req, res) => {
    // Log route resolution for debugging
    console.log('[Subsidiaries Route] PUT /:id - Resolved path:', req.path, 'Original URL:', req.originalUrl, 'Base URL:', req.baseUrl, 'ID:', req.params.id);
    console.log('[Subsidiaries Route] PUT /:id - Request Body:', JSON.stringify(req.body, null, 2));
    try {
        const { id } = req.params;
        // Parse JSON body if sent as form-data
        let body = req.body;
        if (typeof body === 'string') {
            try {
                body = JSON.parse(body);
            }
            catch {
                // If parsing fails, use as is
            }
        }
        // Normalize options field to array if it's a string (common with FormData)
        if (body.options) {
            if (typeof body.options === 'string') {
                try {
                    // Try parsing as JSON first (e.g. "[\"A\",\"B\"]")
                    const parsed = JSON.parse(body.options);
                    if (Array.isArray(parsed)) {
                        body.options = parsed;
                    }
                    else {
                        // If valid JSON but not array (e.g. "some string"), wrap it
                        body.options = [body.options];
                    }
                }
                catch {
                    // Not valid JSON, treat as single string value -> wrap in array
                    body.options = [body.options];
                }
            }
            else if (!Array.isArray(body.options)) {
                // If it exists but is not an array (and not a string), wrap it
                body.options = [body.options];
            }
        }
        const payload = updateSubsidiarySchema.parse(body);
        let logoPath = undefined;
        const existing = await client_1.default.propertySubsidiary.findUnique({
            where: { id },
            include: { options: true },
        });
        if (!existing) {
            return (0, error_handler_1.errorResponse)(res, 'Subsidiary not found', 404);
        }
        // Handle logo upload if provided
        if (req.file) {
            // Logo uploaded via multer (form-data)
            const validation = await (0, file_security_1.validateFileUpload)(req.file.buffer, req.file.mimetype, req.file.originalname);
            if (!validation.valid) {
                return (0, error_handler_1.errorResponse)(res, validation.error || 'Invalid logo file', 400);
            }
            // Scan for viruses
            const tempPath = path_1.default.join(process.cwd(), 'public', 'uploads', `temp-${Date.now()}-${req.file.originalname}`);
            fs_1.default.writeFileSync(tempPath, req.file.buffer);
            const scanResult = await (0, file_security_1.scanFileForViruses)(tempPath);
            if (!scanResult.clean) {
                fs_1.default.unlinkSync(tempPath);
                return (0, error_handler_1.errorResponse)(res, 'Logo file failed virus scan', 400);
            }
            // Save file securely
            const { relativePath } = await (0, file_security_1.saveFileSecurely)(req.file.buffer, req.file.originalname, 'logos', req.user.id);
            logoPath = relativePath;
            // Clean up temp file
            try {
                fs_1.default.unlinkSync(tempPath);
            }
            catch {
                // Ignore cleanup errors
            }
        }
        else if (payload.logoPath !== undefined) {
            // Logo path provided directly (from base64 upload via /api/upload endpoint)
            logoPath = payload.logoPath || null;
        }
        // Update in transaction
        const result = await client_1.default.$transaction(async (tx) => {
            // Update logo if provided
            const updateData = {};
            if (logoPath !== undefined) {
                updateData.logoPath = logoPath;
            }
            // Update options if provided
            if (payload.options && payload.options.length > 0) {
                // Delete existing options
                await tx.subsidiaryOption.deleteMany({
                    where: { propertySubsidiaryId: id },
                });
                // Create new options
                const options = await Promise.all(payload.options.map((optionName, index) => tx.subsidiaryOption.create({
                    data: {
                        propertySubsidiaryId: id,
                        name: optionName.trim(),
                        sortOrder: index,
                    },
                })));
                updateData.options = options;
            }
            // Update subsidiary
            const updated = await tx.propertySubsidiary.update({
                where: { id },
                data: updateData,
                include: { options: { orderBy: { sortOrder: 'asc' } } },
            });
            return { subsidiary: updated, options: updated.options };
        });
        await (0, audit_log_1.createAuditLog)({
            entityType: 'property_subsidiary',
            entityId: id,
            action: 'update',
            description: payload.options && payload.options.length > 0
                ? `Subsidiary updated with ${payload.options.length} options`
                : 'Subsidiary updated',
            oldValues: existing,
            newValues: result,
            userId: req.user?.id,
            userName: req.user?.username,
            req,
        });
        return (0, error_handler_1.successResponse)(res, result);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return (0, error_handler_1.errorResponse)(res, error.errors[0].message, 400);
        }
        return (0, error_handler_1.errorResponse)(res, error);
    }
});
// DELETE subsidiary (soft delete)
router.delete('/:id', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    // Log route resolution for debugging
    console.log('[Subsidiaries Route] DELETE /:id - Resolved path:', req.path, 'Original URL:', req.originalUrl, 'Base URL:', req.baseUrl, 'ID:', req.params.id);
    try {
        const { id } = req.params;
        const existing = await client_1.default.propertySubsidiary.findUnique({
            where: { id },
            include: { options: true },
        });
        if (!existing) {
            return (0, error_handler_1.errorResponse)(res, 'Subsidiary not found', 404);
        }
        // Fetch location separately
        const location = await client_1.default.location.findUnique({
            where: { id: existing.locationId },
            select: { name: true },
        });
        // Check if any properties use this subsidiary's options
        const optionIds = existing.options.map(opt => opt.id);
        const propertiesCount = optionIds.length > 0 ? await client_1.default.property.count({
            where: {
                subsidiaryOptionId: { in: optionIds },
            },
        }) : 0;
        if (propertiesCount > 0) {
            return (0, error_handler_1.errorResponse)(res, `Cannot delete subsidiary. ${propertiesCount} propert${propertiesCount === 1 ? 'y' : 'ies'} use this subsidiary.`, 400);
        }
        // Soft delete: set isActive = false
        await client_1.default.propertySubsidiary.update({
            where: { id },
            data: { isActive: false },
        });
        await (0, audit_log_1.createAuditLog)({
            entityType: 'property_subsidiary',
            entityId: id,
            action: 'delete',
            description: `Subsidiary deactivated for location ${location?.name || existing.locationId}`,
            oldValues: existing,
            userId: req.user?.id,
            userName: req.user?.username,
            req,
        });
        return (0, error_handler_1.successResponse)(res, { message: 'Subsidiary deactivated successfully' });
    }
    catch (error) {
        return (0, error_handler_1.errorResponse)(res, error);
    }
});
exports.default = router;
//# sourceMappingURL=subsidiaries.js.map