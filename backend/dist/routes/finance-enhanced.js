"use strict";
/**
 * Enhanced Finance API Routes
 * Includes Finance Ledger with auto-sync
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const zod_1 = require("zod");
const client_1 = __importDefault(require("../prisma/client"));
const rbac_1 = require("../middleware/rbac");
const audit_log_1 = require("../services/audit-log");
const workflows_1 = require("../services/workflows");
const router = express_1.default.Router();
// Validation schemas
const createFinanceLedgerSchema = zod_1.z.object({
    referenceType: zod_1.z.enum(['invoice', 'salary', 'expense', 'deal', 'payment', 'maintenance', 'property_expense']),
    referenceId: zod_1.z.string().uuid().optional(),
    category: zod_1.z.string(), // Category: credit, debit, commission, etc.
    amount: zod_1.z.number().positive(),
    date: zod_1.z.string().datetime().optional(),
    notes: zod_1.z.string().optional(),
    description: zod_1.z.string().optional(),
    dealId: zod_1.z.string().uuid().optional(),
    propertyId: zod_1.z.string().uuid().optional(),
    tenantId: zod_1.z.string().uuid().optional(),
    payrollId: zod_1.z.string().uuid().optional(),
    invoiceId: zod_1.z.string().uuid().optional(),
    paymentId: zod_1.z.string().uuid().optional(),
});
// Get finance ledger entries
router.get('/ledger', rbac_1.requireAuth, (0, rbac_1.requirePermission)('finance.view'), async (req, res) => {
    try {
        const { category, referenceType, dealId, startDate, endDate, page = '1', limit = '50', } = req.query;
        const where = { isDeleted: false };
        if (category)
            where.category = category;
        if (referenceType)
            where.referenceType = referenceType;
        if (dealId)
            where.dealId = dealId;
        if (startDate && endDate) {
            where.date = {
                gte: new Date(startDate),
                lte: new Date(endDate),
            };
        }
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;
        const [entries, total] = await Promise.all([
            client_1.default.financeLedger.findMany({
                where,
                include: {
                    deal: {
                        select: {
                            id: true,
                            title: true,
                            dealCode: true,
                            property: { select: { id: true, name: true, propertyCode: true } },
                            client: { select: { id: true, name: true, clientCode: true } }
                        }
                    },
                },
                orderBy: { date: 'desc' },
                skip,
                take: limitNum,
            }),
            client_1.default.financeLedger.count({ where }),
        ]);
        res.json({
            entries,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum),
            },
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Get finance summary
router.get('/summary', rbac_1.requireAuth, (0, rbac_1.requirePermission)('finance.view'), async (req, res) => {
    try {
        const { startDate, endDate, dealId } = req.query;
        const where = { isDeleted: false };
        if (dealId)
            where.dealId = dealId;
        if (startDate && endDate) {
            where.date = {
                gte: new Date(startDate),
                lte: new Date(endDate),
            };
        }
        // Filter credit entries (category = 'credit' or positive amounts)
        // Filter debit entries (category = 'debit' or negative amounts)
        const [allEntries] = await Promise.all([
            client_1.default.financeLedger.findMany({
                where,
                select: { amount: true, category: true },
            }),
        ]);
        const income = allEntries
            .filter(e => e.category === 'credit' || (e.amount > 0 && e.category !== 'debit'))
            .reduce((acc, e) => ({ sum: acc.sum + e.amount, count: acc.count + 1 }), { sum: 0, count: 0 });
        const expenses = allEntries
            .filter(e => e.category === 'debit' || (e.amount < 0 && e.category !== 'credit'))
            .reduce((acc, e) => ({ sum: acc.sum + Math.abs(e.amount), count: acc.count + 1 }), { sum: 0, count: 0 });
        res.json({
            income: {
                total: income.sum,
                count: income.count,
            },
            expenses: {
                total: expenses.sum,
                count: expenses.count,
            },
            netProfit: income.sum - expenses.sum,
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Create finance ledger entry (manual)
router.post('/ledger', rbac_1.requireAuth, (0, rbac_1.requirePermission)('finance.create'), async (req, res) => {
    try {
        const data = createFinanceLedgerSchema.parse(req.body);
        const ledger = await client_1.default.financeLedger.create({
            data: {
                dealId: data.dealId,
                category: data.category,
                amount: data.amount,
                date: data.date ? new Date(data.date) : new Date(),
                notes: data.notes,
                description: data.description,
                referenceType: data.referenceType,
                referenceId: data.referenceId,
                propertyId: data.propertyId,
                tenantId: data.tenantId,
                payrollId: data.payrollId,
                invoiceId: data.invoiceId,
                paymentId: data.paymentId,
                createdBy: req.user?.id,
            },
        });
        // Audit log
        await (0, audit_log_1.createAuditLog)({
            entityType: 'finance_ledger',
            entityId: ledger.id,
            action: 'create',
            userId: req.user?.id,
            userName: req.user?.username,
            userRole: req.user?.role?.name,
            newValues: ledger,
            description: `Finance ledger entry created: ${ledger.category} - ${ledger.description || ledger.notes || 'N/A'} - ${ledger.amount}`,
            req,
        });
        res.status(201).json(ledger);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: error.errors });
        }
        res.status(500).json({ error: error.message });
    }
});
// Sync invoice to finance ledger (auto-sync)
router.post('/sync/invoice/:invoiceId', rbac_1.requireAuth, (0, rbac_1.requirePermission)('finance.sync'), async (req, res) => {
    try {
        const ledger = await (0, workflows_1.syncInvoiceToFinanceLedger)(req.params.invoiceId);
        if (!ledger) {
            return res.status(404).json({ error: 'Invoice not found' });
        }
        res.json(ledger);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Sync payment to finance ledger (auto-sync)
router.post('/sync/payment/:paymentId', rbac_1.requireAuth, (0, rbac_1.requirePermission)('finance.sync'), async (req, res) => {
    try {
        const ledger = await (0, workflows_1.syncPaymentToFinanceLedger)(req.params.paymentId);
        if (!ledger) {
            return res.status(404).json({ error: 'Payment not found' });
        }
        res.json(ledger);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Sync deal to finance ledger (auto-sync)
router.post('/sync/deal/:dealId', rbac_1.requireAuth, (0, rbac_1.requirePermission)('finance.sync'), async (req, res) => {
    try {
        const ledger = await (0, workflows_1.syncDealToFinanceLedger)(req.params.dealId);
        if (!ledger) {
            return res.status(404).json({ error: 'Deal not found or not closed' });
        }
        res.json(ledger);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Sync payroll to finance ledger (auto-sync)
router.post('/sync/payroll/:payrollId', rbac_1.requireAuth, (0, rbac_1.requirePermission)('finance.sync'), async (req, res) => {
    try {
        const ledger = await (0, workflows_1.syncPayrollToFinanceLedger)(req.params.payrollId);
        if (!ledger) {
            return res.status(404).json({ error: 'Payroll not found or not paid' });
        }
        res.json(ledger);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Get finance ledger by reference
router.get('/ledger/reference/:referenceType/:referenceId', rbac_1.requireAuth, (0, rbac_1.requirePermission)('finance.view'), async (req, res) => {
    try {
        const { referenceType, referenceId } = req.params;
        const ledger = await client_1.default.financeLedger.findFirst({
            where: {
                referenceType,
                referenceId,
                isDeleted: false,
            },
            include: {
                deal: {
                    include: {
                        property: { select: { id: true, name: true, propertyCode: true } },
                        client: { select: { id: true, name: true, clientCode: true } }
                    }
                },
            },
        });
        if (!ledger) {
            return res.status(404).json({ error: 'Ledger entry not found' });
        }
        res.json(ledger);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
//# sourceMappingURL=finance-enhanced.js.map