"use strict";
/**
 * Validation Middleware
 *
 * Centralized validation middleware using Zod schemas.
 * This ensures all API endpoints use the same validation logic as the frontend.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateBody = validateBody;
exports.validateQuery = validateQuery;
exports.validateParams = validateParams;
exports.validate = validate;
const zod_1 = require("zod");
const error_handler_1 = require("../utils/error-handler");
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * Validate request body using Zod schema
 * @param schema - Zod schema for request body
 * @returns Express middleware function
 */
function validateBody(schema) {
    return async (req, res, next) => {
        try {
            // Parse and validate request body
            const validated = await schema.parseAsync(req.body);
            // Replace req.body with validated data
            req.body = validated;
            next();
        }
        catch (error) {
            if (error instanceof zod_1.ZodError) {
                logger_1.default.warn('Body validation failed:', {
                    path: req.path,
                    method: req.method,
                    errors: error.errors,
                });
                (0, error_handler_1.errorResponse)(res, 'Validation error', 400, error.errors.map((e) => ({
                    path: e.path.join('.'),
                    message: e.message,
                    code: e.code,
                })));
                return;
            }
            logger_1.default.error('Body validation error:', error);
            (0, error_handler_1.errorResponse)(res, 'Validation failed', 400);
            return;
        }
    };
}
/**
 * Validate request query parameters using Zod schema
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
                    code: e.code,
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
 * Validate request params using Zod schema
 * @param schema - Zod schema for route parameters
 * @returns Express middleware function
 */
function validateParams(schema) {
    return async (req, res, next) => {
        try {
            // Parse and validate route parameters
            const validated = await schema.parseAsync(req.params);
            // Replace req.params with validated data
            req.params = validated;
            next();
        }
        catch (error) {
            if (error instanceof zod_1.ZodError) {
                logger_1.default.warn('Params validation failed:', {
                    path: req.path,
                    method: req.method,
                    errors: error.errors,
                });
                (0, error_handler_1.errorResponse)(res, 'Invalid route parameters', 400, error.errors.map((e) => ({
                    path: e.path.join('.'),
                    message: e.message,
                    code: e.code,
                })));
                return;
            }
            logger_1.default.error('Params validation error:', error);
            (0, error_handler_1.errorResponse)(res, 'Params validation failed', 400);
            return;
        }
    };
}
/**
 * Helper to create a combined validation middleware
 * @param options - Validation options for body, query, and params
 * @returns Express middleware function
 */
function validate(options) {
    return async (req, res, next) => {
        try {
            if (options.body) {
                const validated = await options.body.parseAsync(req.body);
                req.body = validated;
            }
            if (options.query) {
                const validated = await options.query.parseAsync(req.query);
                req.query = validated;
            }
            if (options.params) {
                const validated = await options.params.parseAsync(req.params);
                req.params = validated;
            }
            next();
        }
        catch (error) {
            if (error instanceof zod_1.ZodError) {
                logger_1.default.warn('Validation failed:', {
                    path: req.path,
                    method: req.method,
                    errors: error.errors,
                });
                (0, error_handler_1.errorResponse)(res, 'Validation error', 400, error.errors.map((e) => ({
                    path: e.path.join('.'),
                    message: e.message,
                    code: e.code,
                })));
                return;
            }
            logger_1.default.error('Validation error:', error);
            (0, error_handler_1.errorResponse)(res, 'Validation failed', 400);
            return;
        }
    };
}
//# sourceMappingURL=validation.js.map