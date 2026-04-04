"use strict";
/**
 * Enhanced Finance Reports Routes
 * Includes: Income Statement, Cash Flow, Closing Balance, Overdue handling, Exports
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const zod_1 = require("zod");
const client_1 = __importDefault(require("../prisma/client"));
const rbac_1 = require("../middleware/rbac");
const workflows_1 = require("../services/workflows");
const reports_1 = require("../services/reports");
const property_analytics_service_1 = require("../services/property-analytics-service");
const router = express_1.default.Router();
// Validation schemas
const reportPeriodSchema = zod_1.z.object({
    startDate: zod_1.z.string().datetime(),
    endDate: zod_1.z.string().datetime(),
    propertyId: zod_1.z.string().uuid().optional(),
});
const createPaymentSchema = zod_1.z.object({
    tenantId: zod_1.z.string().uuid().optional(),
    invoiceId: zod_1.z.string().uuid().optional(),
    amount: zod_1.z.number().positive(),
    method: zod_1.z.enum(['cash', 'bank', 'online', 'card', 'other']),
    referenceNumber: zod_1.z.string().optional(),
    notes: zod_1.z.string().optional(),
    date: zod_1.z.string().datetime().optional(),
});
/**
 * GET /reports/income-statement
 * Generate Income Statement report
 */
router.get('/income-statement', rbac_1.requireAuth, (0, rbac_1.requirePermission)('finance.view'), async (req, res) => {
    try {
        const { startDate, endDate, propertyId } = reportPeriodSchema.parse(req.query);
        const report = await (0, reports_1.generateIncomeStatement)(new Date(startDate), new Date(endDate), propertyId);
        res.json(report);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: error.errors });
        }
        res.status(500).json({ error: error.message });
    }
});
/**
 * GET /reports/cash-flow
 * Generate Cash Flow Statement
 */
router.get('/cash-flow', rbac_1.requireAuth, (0, rbac_1.requirePermission)('finance.view'), async (req, res) => {
    try {
        const { startDate, endDate, propertyId } = reportPeriodSchema.parse(req.query);
        const report = await (0, reports_1.generateCashFlowStatement)(new Date(startDate), new Date(endDate), propertyId);
        res.json(report);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: error.errors });
        }
        res.status(500).json({ error: error.message });
    }
});
/**
 * GET /reports/closing-balance
 * Generate Closing Balance / Trial Balance report
 */
router.get('/closing-balance', rbac_1.requireAuth, (0, rbac_1.requirePermission)('finance.view'), async (req, res) => {
    try {
        const { asOfDate, propertyId } = zod_1.z.object({
            asOfDate: zod_1.z.string().datetime(),
            propertyId: zod_1.z.string().uuid().optional(),
        }).parse(req.query);
        const report = await (0, reports_1.generateClosingBalance)(new Date(asOfDate), propertyId);
        res.json(report);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: error.errors });
        }
        res.status(500).json({ error: error.message });
    }
});
/**
 * GET /overdue-invoices
 * Get overdue invoices with late fee calculation
 */
router.get('/overdue-invoices', rbac_1.requireAuth, (0, rbac_1.requirePermission)('finance.view'), async (req, res) => {
    try {
        const overdue = await (0, reports_1.calculateOverdueInvoices)();
        res.json(overdue);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
/**
 * GET /reports/property-profitability
 * Get property profitability report
 */
router.get('/property-profitability', rbac_1.requireAuth, (0, rbac_1.requirePermission)('finance.view'), async (req, res) => {
    try {
        const { startDate, endDate, propertyId } = reportPeriodSchema.parse(req.query);
        const report = await (0, property_analytics_service_1.generatePropertyProfitabilityReport)(new Date(startDate), new Date(endDate), propertyId);
        res.json(report);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: error.errors });
        }
        res.status(500).json({ error: error.message });
    }
});
/**
 * GET /ledger/account/:accountId
 * Get ledger entries for a specific account (General Ledger = journal_lines).
 * Returns entries in shape expected by Account Ledger UI.
 */
router.get('/ledger/account/:accountId', rbac_1.requireAuth, (0, rbac_1.requirePermission)('finance.view'), async (req, res) => {
    try {
        const { accountId } = req.params;
        const { startDate, endDate } = req.query;
        const journalWhere = {
            status: 'posted',
            lines: { some: { accountId } },
        };
        if (startDate && endDate) {
            journalWhere.date = {
                gte: new Date(startDate),
                lte: new Date(endDate),
            };
        }
        const journalEntries = await client_1.default.journalEntry.findMany({
            where: journalWhere,
            include: {
                lines: {
                    where: { accountId },
                    include: { account: true },
                },
                vouchers: {
                    include: {
                        property: { select: { name: true } },
                        deal: {
                            include: {
                                client: { select: { name: true } },
                                property: { select: { name: true } },
                            },
                        },
                    },
                },
                dealReceipts: {
                    include: {
                        deal: {
                            include: {
                                client: { select: { name: true } },
                                property: { select: { name: true } },
                            },
                        },
                    },
                },
            },
            orderBy: { date: 'desc' },
        });
        const entries = [];
        let balance = 0;
        for (const entry of journalEntries) {
            for (const line of entry.lines) {
                const isDebit = line.debit > 0;
                const amount = isDebit ? line.debit : line.credit;
                const voucher = entry.vouchers?.[0];
                const receipt = entry.dealReceipts;
                if (line.accountId === accountId) {
                    if (isDebit)
                        balance += amount;
                    else
                        balance -= amount;
                }
                const counterpartLine = entry.lines.find((l) => l.id !== line.id && ((isDebit && l.credit > 0) || (!isDebit && l.debit > 0)));
                entries.push({
                    id: line.id,
                    date: entry.date,
                    accountDebit: isDebit ? line.account.name : (counterpartLine?.account?.name || ''),
                    accountCredit: !isDebit ? line.account.name : (counterpartLine?.account?.name || ''),
                    debitAccountId: isDebit ? line.accountId : null,
                    creditAccountId: !isDebit ? line.accountId : null,
                    amount,
                    remarks: line.description || entry.description || entry.narration,
                    dealTitle: voucher?.deal?.title || receipt?.deal?.title || null,
                    clientName: voucher?.deal?.client?.name || receipt?.deal?.client?.name || null,
                    propertyName: voucher?.property?.name || voucher?.deal?.property?.name || receipt?.deal?.property?.name || null,
                    paymentId: receipt?.receiptNo || voucher?.voucherNumber || null,
                });
            }
        }
        res.json({
            accountId,
            balance: Number(balance.toFixed(2)),
            entries,
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
/**
 * POST /payments
 * Create payment with auto-linking and auto-journal entry
 */
router.post('/payments', rbac_1.requireAuth, (0, rbac_1.requirePermission)('finance.create'), async (req, res) => {
    try {
        const data = createPaymentSchema.parse(req.body);
        // Generate payment ID
        const paymentId = `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
        const payment = await client_1.default.tenantPayment.create({
            data: {
                paymentId,
                tenantId: data.tenantId,
                invoiceId: data.invoiceId,
                amount: data.amount,
                method: data.method,
                referenceNumber: data.referenceNumber,
                notes: data.notes,
                date: data.date ? new Date(data.date) : new Date(),
                status: 'completed',
                createdByUserId: req.user?.id,
            },
            include: {
                tenant: true,
                invoice: { include: { property: true } },
            },
        });
        // Auto-sync to Finance Ledger
        await (0, workflows_1.syncPaymentToFinanceLedger)(payment.id);
        // Auto-create journal entry if accounts configured
        if (payment.invoice) {
            // Journal entry already handled in syncPaymentToFinanceLedger workflow
        }
        res.status(201).json(payment);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: error.errors });
        }
        res.status(500).json({ error: error.message });
    }
});
/**
 * GET /invoices/export/:id
 * Export invoice as PDF (placeholder - implement PDF generation)
 */
router.get('/invoices/export/:id', rbac_1.requireAuth, (0, rbac_1.requirePermission)('finance.view'), async (req, res) => {
    try {
        const invoice = await client_1.default.invoice.findUnique({
            where: { id: req.params.id },
            include: {
                tenant: true,
                property: true,
                tenantPayments: true,
            },
        });
        if (!invoice) {
            return res.status(404).json({ error: 'Invoice not found' });
        }
        // TODO: Implement PDF generation using library like pdfkit or puppeteer
        // For now, return JSON data that can be used by frontend to generate PDF
        res.json({
            invoice,
            format: 'json',
            message: 'PDF generation not implemented. Use frontend PDF generator.',
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
/**
 * GET /transactions/export
 * Export transactions as Excel (placeholder)
 */
router.get('/transactions/export', rbac_1.requireAuth, (0, rbac_1.requirePermission)('finance.view'), async (req, res) => {
    try {
        const { startDate, endDate, category, propertyId } = req.query;
        const where = { isDeleted: false };
        if (startDate && endDate) {
            where.date = {
                gte: new Date(startDate),
                lte: new Date(endDate),
            };
        }
        if (category)
            where.category = category;
        if (propertyId)
            where.propertyId = propertyId;
        const transactions = await client_1.default.transaction.findMany({
            where,
            include: {
                tenant: true,
                property: true,
                transactionCategory: true,
            },
            orderBy: { date: 'desc' },
        });
        // TODO: Implement Excel export using library like exceljs
        // For now, return JSON data
        res.json({
            transactions,
            format: 'json',
            message: 'Excel export not implemented. Use frontend Excel generator.',
            count: transactions.length,
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
//# sourceMappingURL=finance-reports.js.map