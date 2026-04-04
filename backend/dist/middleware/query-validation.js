"use strict";
/**
 * Query Parameter Validation Middleware
 * Uses Zod to validate all req.query parameters in every route
 * Ensures UUIDs, dates, enums, pagination, and optional fields are validated
 * Rejects invalid queries with 400 error
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.commonQuerySchemas = void 0;
exports.validateQuery = validateQuery;
exports.createQuerySchema = createQuerySchema;
const zod_1 = require("zod");
const error_handler_1 = require("../utils/error-handler");
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * Common query parameter schemas
 */
exports.commonQuerySchemas = {
    // UUID parameter
    uuid: zod_1.z.string().uuid('Invalid UUID format'),
    // Optional UUID
    optionalUuid: zod_1.z.string().uuid('Invalid UUID format').optional(),
    // Date parameter (ISO string)
    date: zod_1.z.string().datetime('Invalid date format'),
    // Optional date
    optionalDate: zod_1.z.string().datetime('Invalid date format').optional(),
    // Pagination
    pagination: zod_1.z.object({
        page: zod_1.z.string().regex(/^\d+$/).transform(Number).default('1'),
        limit: zod_1.z.string().regex(/^\d+$/).transform(Number).default('10'),
    }).partial(),
    // Search query
    search: zod_1.z.string().min(1).max(255).optional(),
    // Sort order
    sortOrder: zod_1.z.enum(['asc', 'desc']).default('desc'),
    // Status enum (common statuses)
    status: zod_1.z.enum(['active', 'inactive', 'pending', 'approved', 'rejected', 'completed', 'cancelled']).optional(),
    // Boolean string
    boolean: zod_1.z.enum(['true', 'false']).transform((val) => val === 'true').optional(),
    // Number parameter
    number: zod_1.z.string().regex(/^-?\d+(\.\d+)?$/).transform(Number),
    // Optional number
    optionalNumber: zod_1.z.string().regex(/^-?\d+(\.\d+)?$/).transform(Number).optional(),
};
/**
 * Validate query parameters using Zod schema
 * @param schema - Zod schema for query parameters
 * @returns Express middleware function
 */
function validateQuery(schema) {
    return async (req, res, next) => {
        try {
            // Parse and validate query parameters
            const validated = await schema.parseAsync(req.query);
            // Replace req.query with validated data
            req.query = validated;
            next();
        }
        catch (error) {
            if (error instanceof zod_1.ZodError) {
                logger_1.default.warn('Query validation failed:', {
                    path: req.path,
                    method: req.method,
                    errors: error.errors,
                });
                (0, error_handler_1.errorResponse)(res, 'Invalid query parameters', 400, error.errors.map((e) => ({
                    path: e.path.join('.'),
                    message: e.message,
                })));
                return;
            }
            logger_1.default.error('Query validation error:', error);
            (0, error_handler_1.errorResponse)(res, 'Query validation failed', 400);
            return;
        }
    };
}
/**
 * Helper to create query schema with common patterns
 */
function createQuerySchema(shape) {
    return zod_1.z.object(shape).partial();
}
/**
 * Example usage:
 *
 * router.get(
 *   '/properties',
 *   validateQuery(
 *     createQuerySchema({
 *       search: commonQuerySchemas.search,
 *       locationId: commonQuerySchemas.optionalUuid,
 *       page: z.string().regex(/^\d+$/).transform(Number).default('1'),
 *       limit: z.string().regex(/^\d+$/).transform(Number).default('10'),
 *     })
 *   ),
 *   async (req, res) => {
 *     // req.query is now validated and typed
 *     const { search, locationId, page, limit } = req.query;
 *     // ...
 *   }
 * );
 */
//# sourceMappingURL=query-validation.js.map