"use strict";
/**
 * Property validation schemas
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.propertyQuerySchema = exports.updatePropertySchema = exports.createPropertySchema = exports.propertyStatusEnum = void 0;
const zod_1 = require("zod");
const common_1 = require("./common");
/**
 * Property status enum
 */
exports.propertyStatusEnum = zod_1.z.enum([
    'Active',
    'Maintenance',
    'Vacant',
    'For Sale',
    'For Rent',
    'Sold',
]);
/**
 * Create Property Schema - All fields optional for flexible data entry
 */
exports.createPropertySchema = zod_1.z.object({
    tid: zod_1.z.string().optional().nullable(),
    name: zod_1.z.string().optional().nullable(),
    type: zod_1.z.string().optional().nullable(),
    category: zod_1.z.string().optional().nullable(),
    size: zod_1.z.preprocess((val) => {
        if (val === undefined || val === null || val === '')
            return undefined;
        const num = common_1.preprocessors.stringToNumber(val);
        return num !== undefined && !isNaN(num) ? num : undefined;
    }, zod_1.z.number().nonnegative().optional().nullable()),
    address: zod_1.z.string().optional().nullable(),
    location: zod_1.z.string().optional().nullable(),
    locationId: common_1.commonFields.optionalUuid,
    subsidiaryOptionId: common_1.commonFields.optionalUuid,
    status: zod_1.z.string().optional().nullable(),
    imageUrl: zod_1.z.string().optional().nullable(),
    description: zod_1.z.string().optional().nullable(),
    yearBuilt: zod_1.z.preprocess((val) => {
        if (val === undefined || val === null || val === '')
            return undefined;
        const num = common_1.preprocessors.stringToNumber(val);
        return num !== undefined && !isNaN(num) ? num : undefined;
    }, zod_1.z.number().int().optional().nullable()),
    totalArea: zod_1.z.preprocess((val) => {
        if (val === undefined || val === null || val === '')
            return undefined;
        const num = common_1.preprocessors.stringToNumber(val);
        return num !== undefined && !isNaN(num) ? num : undefined;
    }, zod_1.z.number().optional().nullable()),
    totalUnits: zod_1.z.preprocess((val) => {
        if (val === undefined || val === null || val === '')
            return 0;
        const num = common_1.preprocessors.stringToNumber(val);
        return num !== undefined && !isNaN(num) ? num : 0;
    }, zod_1.z.number().int().nonnegative().default(0)),
    dealerId: common_1.commonFields.optionalUuid,
    salePrice: zod_1.z.preprocess((val) => {
        if (val === undefined || val === null || val === '')
            return undefined;
        const num = common_1.preprocessors.stringToNumber(val);
        return num !== undefined && !isNaN(num) ? num : undefined;
    }, zod_1.z.number().nonnegative().optional().nullable()),
    amenities: zod_1.z.preprocess((val) => {
        if (typeof val === 'string') {
            try {
                const parsed = JSON.parse(val);
                return Array.isArray(parsed) ? parsed : [val];
            }
            catch {
                return [val];
            }
        }
        return val || [];
    }, zod_1.z.array(zod_1.z.string()).optional().default([])),
}).passthrough(); // Allow additional fields without validation errors
/**
 * Update Property Schema (all fields optional)
 */
exports.updatePropertySchema = exports.createPropertySchema.partial();
/**
 * Property Query Schema (for filtering)
 * All fields are optional - returns empty array if no data matches
 * Uses same pattern as paginationSchema for consistent handling
 */
exports.propertyQuerySchema = zod_1.z.object({
    status: exports.propertyStatusEnum.optional(),
    type: zod_1.z.string().optional(),
    location: zod_1.z.string().optional(),
    locationId: common_1.commonFields.optionalUuid,
    search: zod_1.z.string().optional(),
    // Handle page - optional, defaults to 1 if missing or invalid
    page: zod_1.z
        .string()
        .optional()
        .transform((val) => {
        const parsed = val ? parseInt(val, 10) : 1;
        return isNaN(parsed) || parsed < 1 ? 1 : parsed;
    }),
    // Handle limit - optional, defaults to 10 if missing or invalid, max 100
    limit: zod_1.z
        .string()
        .optional()
        .transform((val) => {
        const parsed = val ? parseInt(val, 10) : 10;
        if (isNaN(parsed) || parsed < 1)
            return 10;
        if (parsed > 100)
            return 100;
        return parsed;
    }),
}).passthrough(); // Allow additional query params without validation errors
//# sourceMappingURL=property.js.map