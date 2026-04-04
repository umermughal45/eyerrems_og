"use strict";
/**
 * CRM validation schemas (Client, Dealer, Lead, Deal)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateDealSchema = exports.createDealSchema = exports.dealStageEnum = exports.dealStatusEnum = exports.updateLeadSchema = exports.createLeadSchema = exports.leadTemperatureEnum = exports.leadPriorityEnum = exports.updateDealerSchema = exports.createDealerSchema = exports.updateClientSchema = exports.createClientSchema = void 0;
const zod_1 = require("zod");
const common_1 = require("./common");
/**
 * Client Schema
 */
exports.createClientSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Name is required'),
    email: common_1.commonFields.email,
    phone: common_1.commonFields.phone,
    company: zod_1.z.string().optional().nullable(),
    status: zod_1.z.string().default('active'),
    address: zod_1.z.string().optional().nullable(),
    cnic: zod_1.z.string().optional().nullable(),
    assignedAgentId: common_1.commonFields.optionalUuid,
    assignedDealerId: common_1.commonFields.optionalUuid,
    billingAddress: zod_1.z.string().optional().nullable(),
    city: zod_1.z.string().optional().nullable(),
    clientCategory: zod_1.z.string().optional().nullable(),
    clientType: zod_1.z.string().optional().nullable(),
    country: zod_1.z.string().optional().nullable(),
    postalCode: zod_1.z.string().optional().nullable(),
    propertyInterest: zod_1.z.string().optional().nullable(),
    manualUniqueId: common_1.commonFields.manualUniqueId,
    propertySubsidiary: zod_1.z.string().optional().nullable(),
    tid: common_1.commonFields.tid,
});
exports.updateClientSchema = exports.createClientSchema.partial();
/**
 * Dealer Schema
 */
exports.createDealerSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Name is required'),
    email: common_1.commonFields.email,
    phone: common_1.commonFields.phone,
    company: zod_1.z.string().optional().nullable(),
    commissionRate: zod_1.z.preprocess(common_1.preprocessors.stringToNumber, zod_1.z.number().optional().default(0)),
    address: zod_1.z.string().optional().nullable(),
    cnic: zod_1.z.string().optional().nullable(),
    assignedRegion: zod_1.z.string().optional().nullable(),
    bankAccountNumber: zod_1.z.string().optional().nullable(),
    bankBranch: zod_1.z.string().optional().nullable(),
    bankName: zod_1.z.string().optional().nullable(),
    city: zod_1.z.string().optional().nullable(),
    country: zod_1.z.string().optional().nullable(),
    experienceYears: zod_1.z.preprocess(common_1.preprocessors.stringToNumber, zod_1.z.number().int('Experience years must be an integer').optional().default(0)),
    iban: zod_1.z.string().optional().nullable(),
    isActive: zod_1.z.preprocess(common_1.preprocessors.stringToBoolean, zod_1.z.boolean().default(true)),
    notes: zod_1.z.string().optional().nullable(),
    postalCode: zod_1.z.string().optional().nullable(),
    qualifications: zod_1.z.string().optional().nullable(),
    manualUniqueId: common_1.commonFields.manualUniqueId,
    tid: common_1.commonFields.tid,
});
exports.updateDealerSchema = exports.createDealerSchema.partial();
/**
 * Lead Schema
 */
exports.leadPriorityEnum = zod_1.z.enum(['low', 'medium', 'high', 'urgent']);
exports.leadTemperatureEnum = zod_1.z.enum(['cold', 'warm', 'hot']);
exports.createLeadSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Name is required'),
    email: common_1.commonFields.email,
    phone: common_1.commonFields.phone,
    source: zod_1.z.string().optional().nullable(),
    leadSourceDetails: zod_1.z.string().optional().nullable(),
    priority: exports.leadPriorityEnum.default('medium'),
    score: zod_1.z.preprocess(common_1.preprocessors.stringToNumber, zod_1.z.number().int('Score must be an integer').min(0, 'Score must be between 0 and 100').max(100, 'Score must be between 0 and 100').optional()),
    interest: zod_1.z.string().optional().nullable(),
    interestType: zod_1.z.string().optional().nullable(),
    budget: zod_1.z.string().optional().nullable(),
    budgetMin: zod_1.z.preprocess(common_1.preprocessors.stringToNumber, zod_1.z.number().optional()),
    budgetMax: zod_1.z.preprocess(common_1.preprocessors.stringToNumber, zod_1.z.number().optional()),
    expectedCloseDate: zod_1.z.string().datetime('Invalid date format').optional().nullable(),
    followUpDate: zod_1.z.string().datetime('Invalid date format').optional().nullable(),
    assignedToUserId: common_1.commonFields.optionalUuid,
    assignedDealerId: common_1.commonFields.optionalUuid,
    cnic: zod_1.z.string().optional().nullable(),
    address: zod_1.z.string().optional().nullable(),
    city: zod_1.z.string().optional().nullable(),
    manualUniqueId: common_1.commonFields.manualUniqueId,
    tid: common_1.commonFields.tid,
    status: zod_1.z.string().optional().default('new'),
    notes: zod_1.z.string().optional().nullable(),
    temperature: exports.leadTemperatureEnum.optional().default('cold'),
});
exports.updateLeadSchema = exports.createLeadSchema.partial();
/**
 * Deal Schema
 */
exports.dealStatusEnum = zod_1.z.enum(['open', 'won', 'lost', 'closed', 'cancelled']);
exports.dealStageEnum = zod_1.z.enum([
    'prospecting',
    'qualification',
    'proposal',
    'negotiation',
    'closed-won',
    'closed-lost',
]);
exports.createDealSchema = zod_1.z.object({
    tid: common_1.commonFields.tid,
    title: zod_1.z.string().min(1, 'Deal title is required'),
    clientId: common_1.commonFields.uuid,
    propertyId: common_1.commonFields.uuid,
    dealerId: common_1.commonFields.optionalUuid,
    dealAmount: zod_1.z.preprocess(common_1.preprocessors.stringToNumber, zod_1.z.number().positive('Deal amount must be greater than 0')),
    status: exports.dealStatusEnum.optional().default('open'),
    stage: exports.dealStageEnum.optional(),
    description: zod_1.z.string().optional().nullable(),
    expectedCloseDate: zod_1.z.string().datetime('Invalid date format').optional().nullable(),
    actualCloseDate: zod_1.z.string().datetime('Invalid date format').optional().nullable(),
    notes: zod_1.z.string().optional().nullable(),
});
exports.updateDealSchema = exports.createDealSchema.partial();
//# sourceMappingURL=crm.js.map