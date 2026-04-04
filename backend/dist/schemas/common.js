"use strict";
/**
 * Common validation utilities and base schemas
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.sortOrderSchema = exports.searchSchema = exports.paginationSchema = exports.commonFields = exports.preprocessors = void 0;
const zod_1 = require("zod");
/**
 * Common preprocessors for handling form data
 */
exports.preprocessors = {
    /**
     * Convert empty string, 'null', or 'undefined' to null
     */
    emptyToNull: (val) => val === '' || val === 'null' || val === 'undefined' ? null : val,
    /**
     * Convert string to number, or undefined if empty
     */
    stringToNumber: (val) => val === '' || val === null || val === undefined ? undefined : Number(val),
    /**
     * Convert string to boolean
     */
    stringToBoolean: (val) => val === 'true' || val === true,
    /**
     * Convert empty string to undefined
     */
    emptyToUndefined: (val) => val === '' ? undefined : val,
};
/**
 * Common field schemas that can be reused
 */
exports.commonFields = {
    /**
     * UUID field (required)
     */
    uuid: zod_1.z.string().uuid('Invalid UUID format'),
    /**
     * UUID field (optional)
     */
    optionalUuid: zod_1.z.preprocess(exports.preprocessors.emptyToNull, zod_1.z.string().uuid('Invalid UUID format').nullable().optional()),
    /**
     * Email field (optional, nullable)
     */
    email: zod_1.z.string().email('Invalid email format').optional().nullable().or(zod_1.z.literal('')),
    /**
     * Phone number field (optional, nullable)
     */
    phone: zod_1.z.string().optional().nullable(),
    /**
     * TID (Transaction ID) - required, must be non-empty
     */
    tid: zod_1.z.string().min(1, 'TID is required'),
    /**
     * TID (Transaction ID) - optional
     */
    optionalTid: zod_1.z.string().min(1, 'TID is required').optional(),
    /**
     * Manual unique ID (optional, nullable)
     */
    manualUniqueId: zod_1.z.string().optional().nullable(),
    /**
     * Status field with common statuses
     */
    status: zod_1.z.enum(['active', 'inactive', 'pending', 'approved', 'rejected', 'completed', 'cancelled']).optional(),
    /**
     * Positive number (optional)
     */
    positiveNumber: zod_1.z.preprocess(exports.preprocessors.stringToNumber, zod_1.z.number().positive('Must be a positive number').optional()),
    /**
     * Non-negative number (optional)
     */
    nonNegativeNumber: zod_1.z.preprocess(exports.preprocessors.stringToNumber, zod_1.z.number().nonnegative('Must be zero or positive').optional()),
    /**
     * Integer (optional)
     */
    integer: zod_1.z.preprocess(exports.preprocessors.stringToNumber, zod_1.z.number().int('Must be an integer').optional()),
    /**
     * Date string (ISO datetime)
     */
    dateTime: zod_1.z.string().datetime('Invalid date format').optional().nullable(),
    /**
     * Image URL validation
     */
    imageUrl: zod_1.z.string().optional().refine((val) => {
        if (!val || val === '')
            return true;
        return val.startsWith('http') || val.startsWith('/') || val.startsWith('data:');
    }, { message: 'Image URL must be a valid URL or relative path starting with /' }),
};
/**
 * Pagination schema
 */
exports.paginationSchema = zod_1.z.object({
    page: zod_1.z.string().regex(/^\d+$/).transform(Number).default('1'),
    limit: zod_1.z.string().regex(/^\d+$/).transform(Number).default('10'),
}).partial();
/**
 * Search query schema
 */
exports.searchSchema = zod_1.z.object({
    search: zod_1.z.string().min(1).max(255).optional(),
});
/**
 * Sort order schema
 */
exports.sortOrderSchema = zod_1.z.object({
    sortBy: zod_1.z.string().optional(),
    sortOrder: zod_1.z.enum(['asc', 'desc']).default('desc'),
});
//# sourceMappingURL=common.js.map