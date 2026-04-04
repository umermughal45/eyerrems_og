"use strict";
/**
 * Validation Middleware Usage Examples
 *
 * This file demonstrates how to use the validation middleware in your routes.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("./auth");
const validation_1 = require("./validation");
const schemas_1 = require("../schemas");
const zod_1 = require("zod");
const router = express_1.default.Router();
/**
 * Example 1: Validate request body
 */
router.post('/properties', auth_1.authenticate, (0, validation_1.validateBody)(schemas_1.createPropertySchema), async (req, res) => {
    // req.body is now validated and typed as CreatePropertyInput
    const propertyData = req.body;
    // ... create property logic
});
/**
 * Example 2: Validate query parameters
 */
router.get('/properties', auth_1.authenticate, (0, validation_1.validateQuery)(schemas_1.propertyQuerySchema), async (req, res) => {
    // req.query is now validated and typed
    const { status, type, page, limit } = req.query;
    // ... fetch properties logic
});
/**
 * Example 3: Validate route parameters
 */
const propertyIdSchema = zod_1.z.object({
    id: zod_1.z.string().uuid('Invalid property ID'),
});
router.get('/properties/:id', auth_1.authenticate, (0, validation_1.validateParams)(propertyIdSchema), async (req, res) => {
    // req.params.id is now validated as UUID
    const { id } = req.params;
    // ... fetch property logic
});
/**
 * Example 4: Validate multiple parts of the request
 */
router.put('/properties/:id', auth_1.authenticate, (0, validation_1.validate)({
    params: propertyIdSchema,
    body: schemas_1.updatePropertySchema,
}), async (req, res) => {
    // Both req.params and req.body are validated
    const { id } = req.params;
    const updateData = req.body;
    // ... update property logic
});
/**
 * Example 5: Custom validation schema inline
 */
const customQuerySchema = zod_1.z.object({
    search: zod_1.z.string().optional(),
    minPrice: zod_1.z.string().regex(/^\d+$/).transform(Number).optional(),
    maxPrice: zod_1.z.string().regex(/^\d+$/).transform(Number).optional(),
});
router.get('/properties/search', auth_1.authenticate, (0, validation_1.validateQuery)(customQuerySchema), async (req, res) => {
    // req.query is validated with custom schema
    const { search, minPrice, maxPrice } = req.query;
    // ... search logic
});
exports.default = router;
//# sourceMappingURL=validation.example.js.map