"use strict";
/**
 * DTO Validator Utility
 * Provides strict DTO validation and transformation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateDTO = validateDTO;
exports.validateAndRespond = validateAndRespond;
exports.createEntityDTOSchema = createEntityDTOSchema;
const zod_1 = require("zod");
/**
 * Validate request body against a Zod schema
 * Returns structured validation errors
 */
function validateDTO(schema, data) {
    const result = schema.safeParse(data);
    if (result.success) {
        return {
            success: true,
            data: result.data,
        };
    }
    return {
        success: false,
        errors: result.error.errors.map((err) => ({
            path: err.path.join('.'),
            message: err.message,
        })),
    };
}
/**
 * Validate and return error response if validation fails
 */
function validateAndRespond(schema, data, res) {
    const validation = validateDTO(schema, data);
    if (!validation.success) {
        res.status(400).json({
            success: false,
            error: 'Validation failed',
            details: validation.errors,
        });
        return null;
    }
    return validation.data;
}
/**
 * Create a strict DTO schema for common entity operations
 */
function createEntityDTOSchema(shape) {
    return zod_1.z.object(shape).strict(); // Reject unknown fields
}
//# sourceMappingURL=dto-validator.js.map