"use strict";
/**
 * Finance Operations Extension - Refund, Transfer, Merge
 * Additive only. Execution happens here only.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const zod_1 = require("zod");
const rbac_1 = require("../middleware/rbac");
const finance_operations_service_1 = require("../services/finance-operations-service");
const client_1 = require("@prisma/client");
const logger_1 = __importDefault(require("../utils/logger"));
const router = express_1.default.Router();
const requestRefundSchema = zod_1.z.object({
    operationType: zod_1.z.literal('REFUND'),
    reason: zod_1.z.string().min(1, 'Reason is required'),
    dealId: zod_1.z.string().uuid().optional(),
    sourcePaymentId: zod_1.z.string().uuid(),
    amount: zod_1.z.number().positive().optional(),
    partialAmount: zod_1.z.number().positive().optional(),
});
const requestTransferSchema = zod_1.z.object({
    operationType: zod_1.z.literal('TRANSFER'),
    reason: zod_1.z.string().min(1, 'Reason is required'),
    dealId: zod_1.z.string().uuid().optional(),
    sourcePaymentId: zod_1.z.string().uuid(),
    sourceClientId: zod_1.z.string().uuid(),
    targetClientId: zod_1.z.string().uuid(),
    amount: zod_1.z.number().positive().optional(),
    partialAmount: zod_1.z.number().positive().optional(),
});
const requestMergeSchema = zod_1.z.object({
    operationType: zod_1.z.literal('MERGE'),
    reason: zod_1.z.string().min(1, 'Reason is required'),
    dealId: zod_1.z.string().uuid().optional(),
    sourcePaymentId: zod_1.z.string().uuid(),
    sourceDealId: zod_1.z.string().uuid(),
    targetDealId: zod_1.z.string().uuid().optional(),
    sourcePropertyId: zod_1.z.string().uuid().optional(),
    targetPropertyId: zod_1.z.string().uuid().optional(),
    amount: zod_1.z.number().positive().optional(),
    partialAmount: zod_1.z.number().positive().optional(),
});
const requestSchema = zod_1.z.discriminatedUnion('operationType', [
    requestRefundSchema,
    requestTransferSchema,
    requestMergeSchema,
]);
router.post('/request', rbac_1.requireAuth, (0, rbac_1.requirePermission)('finance.vouchers.view'), async (req, res) => {
    try {
        const parsed = requestSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
        }
        const data = parsed.data;
        if (data.operationType === 'TRANSFER' && (data.amount ?? data.partialAmount ?? 0) <= 0) {
            return res.status(400).json({ error: 'Amount or partialAmount must be positive' });
        }
        if (data.operationType === 'MERGE') {
            if ((data.amount ?? data.partialAmount ?? 0) <= 0) {
                return res.status(400).json({ error: 'Amount or partialAmount must be positive' });
            }
            if (!data.targetDealId && !data.targetPropertyId) {
                return res.status(400).json({ error: 'Target deal or target property is required' });
            }
        }
        const op = await (0, finance_operations_service_1.createOperationRequest)(data, req.user.id);
        res.status(201).json({ success: true, data: op });
    }
    catch (err) {
        logger_1.default.error('Finance operation request error:', err);
        res.status(400).json({ error: err.message || 'Failed to create request' });
    }
});
router.get('/', rbac_1.requireAuth, (0, rbac_1.requirePermission)('finance.vouchers.view'), async (req, res) => {
    try {
        const status = req.query.status;
        const operationType = req.query.operationType;
        const dealId = req.query.dealId;
        const limit = req.query.limit ? parseInt(req.query.limit, 10) : 50;
        const offset = req.query.offset ? parseInt(req.query.offset, 10) : 0;
        const validStatuses = Object.values(client_1.FinancialOperationStatus);
        const validTypes = Object.values(client_1.FinancialOperationType);
        const { rows, total } = await (0, finance_operations_service_1.listOperations)({
            status: status && validStatuses.includes(status) ? status : undefined,
            operationType: operationType && validTypes.includes(operationType) ? operationType : undefined,
            dealId,
            limit,
            offset,
        });
        res.json({ success: true, data: rows, total });
    }
    catch (err) {
        logger_1.default.error('List finance operations error:', err);
        res.status(500).json({ error: err.message || 'Failed to list operations' });
    }
});
router.get('/deal/:dealId', rbac_1.requireAuth, (0, rbac_1.requirePermission)('finance.vouchers.view'), async (req, res) => {
    try {
        const ops = await (0, finance_operations_service_1.getOperationsByDealId)(req.params.dealId);
        res.json({ success: true, data: ops });
    }
    catch (err) {
        logger_1.default.error('Get deal operations error:', err);
        res.status(500).json({ error: err.message || 'Failed to fetch operations' });
    }
});
router.get('/:id', rbac_1.requireAuth, (0, rbac_1.requirePermission)('finance.vouchers.view'), async (req, res) => {
    try {
        const op = await (0, finance_operations_service_1.getOperationById)(req.params.id);
        if (!op)
            return res.status(404).json({ error: 'Operation not found' });
        res.json({ success: true, data: op });
    }
    catch (err) {
        logger_1.default.error('Get operation error:', err);
        res.status(500).json({ error: err.message || 'Failed to fetch operation' });
    }
});
router.put('/:id/approve', rbac_1.requireAuth, (0, rbac_1.requirePermission)('finance.vouchers.approve'), async (req, res) => {
    try {
        const op = await (0, finance_operations_service_1.approveOperation)(req.params.id, req.user.id);
        res.json({ success: true, data: op });
    }
    catch (err) {
        logger_1.default.error('Approve operation error:', err);
        res.status(400).json({ error: err.message || 'Failed to approve' });
    }
});
router.put('/:id/reject', rbac_1.requireAuth, (0, rbac_1.requirePermission)('finance.vouchers.approve'), async (req, res) => {
    try {
        const op = await (0, finance_operations_service_1.rejectOperation)(req.params.id);
        res.json({ success: true, data: op });
    }
    catch (err) {
        logger_1.default.error('Reject operation error:', err);
        res.status(400).json({ error: err.message || 'Failed to reject' });
    }
});
router.put('/:id/execute', rbac_1.requireAuth, (0, rbac_1.requirePermission)('finance.vouchers.approve'), async (req, res) => {
    try {
        const op = await (0, finance_operations_service_1.executeOperation)(req.params.id, req.user.id);
        res.json({ success: true, data: op });
    }
    catch (err) {
        logger_1.default.error('Execute operation error:', err);
        res.status(400).json({ error: err.message || 'Failed to execute' });
    }
});
exports.default = router;
//# sourceMappingURL=finance-operations.js.map