"use strict";
/**
 * Tenant validation schemas
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateTenantSchema = exports.createTenantSchema = exports.tenantStatusEnum = void 0;
const zod_1 = require("zod");
const common_1 = require("./common");
/**
 * Tenant Status Enum
 */
exports.tenantStatusEnum = zod_1.z.enum(['active', 'inactive', 'pending', 'terminated']);
/**
 * Create Tenant Schema
 */
exports.createTenantSchema = zod_1.z.object({
    tid: common_1.commonFields.tid,
    name: zod_1.z.string().min(1, 'Tenant name is required'),
    email: common_1.commonFields.email,
    phone: common_1.commonFields.phone,
    cnic: zod_1.z.string().optional().nullable(),
    address: zod_1.z.string().optional().nullable(),
    status: exports.tenantStatusEnum.optional().default('active'),
    emergencyContact: zod_1.z.string().optional().nullable(),
    emergencyPhone: zod_1.z.string().optional().nullable(),
    notes: zod_1.z.string().optional().nullable(),
    propertyId: common_1.commonFields.optionalUuid,
    unitId: common_1.commonFields.optionalUuid,
});
/**
 * Update Tenant Schema
 */
exports.updateTenantSchema = exports.createTenantSchema.partial();
//# sourceMappingURL=tenant.js.map