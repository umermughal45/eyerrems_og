"use strict";
/**
 * Unit validation schemas
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateUnitSchema = exports.createUnitSchema = exports.unitStatusEnum = void 0;
const zod_1 = require("zod");
const common_1 = require("./common");
/**
 * Unit Status Enum
 */
exports.unitStatusEnum = zod_1.z.enum(['Occupied', 'Vacant', 'Maintenance', 'Reserved']);
/**
 * Create Unit Schema
 */
exports.createUnitSchema = zod_1.z.object({
    tid: common_1.commonFields.tid,
    unitNumber: zod_1.z.string().min(1, 'Unit number is required'),
    unitName: zod_1.z.string().optional().nullable(),
    propertyId: common_1.commonFields.uuid,
    blockId: common_1.commonFields.optionalUuid,
    floorId: common_1.commonFields.optionalUuid,
    status: exports.unitStatusEnum,
    monthlyRent: zod_1.z.preprocess(common_1.preprocessors.stringToNumber, zod_1.z.number().positive('Monthly rent must be positive').optional()),
    sizeSqFt: zod_1.z.preprocess(common_1.preprocessors.stringToNumber, zod_1.z.number().positive('Size must be positive').optional()),
    securityDeposit: zod_1.z.preprocess(common_1.preprocessors.stringToNumber, zod_1.z.number().nonnegative('Security deposit cannot be negative').optional()),
    description: zod_1.z.string().optional().nullable(),
    amenities: zod_1.z.array(zod_1.z.string()).optional().default([]),
});
/**
 * Update Unit Schema
 */
exports.updateUnitSchema = exports.createUnitSchema.partial();
//# sourceMappingURL=unit.js.map