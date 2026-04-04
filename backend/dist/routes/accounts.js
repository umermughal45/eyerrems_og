"use strict";
/**
 * Account Management Routes
 * Chart of Accounts CRUD, Tree View, Search, and Validation
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const zod_1 = require("zod");
const client_1 = __importDefault(require("../prisma/client"));
const auth_1 = require("../middleware/auth");
const account_validation_service_1 = require("../services/account-validation-service");
const logger_1 = __importDefault(require("../utils/logger"));
const error_handler_1 = require("../utils/error-handler");
const router = express_1.default.Router();
// Validation schemas
const createAccountSchema = zod_1.z.object({
    code: zod_1.z.string().min(1),
    name: zod_1.z.string().min(1),
    type: zod_1.z.enum(['Asset', 'Liability', 'Equity', 'Revenue', 'Expense']),
    level: zod_1.z.number().int().min(1).max(5),
    accountType: zod_1.z.enum(['Header', 'Control', 'Posting']),
    normalBalance: zod_1.z.enum(['Debit', 'Credit']),
    description: zod_1.z.string().optional(),
    parentId: zod_1.z.string().uuid().optional().nullable(),
    trustFlag: zod_1.z.boolean().optional().default(false),
    cashFlowCategory: zod_1.z.enum(['Operating', 'Investing', 'Financing', 'Escrow']).optional().nullable(),
});
const updateAccountSchema = createAccountSchema.partial();
/**
 * GET /accounts
 * Get all accounts with optional filters
 * Supports: tree view, search, filtering by type/level
 */
router.get('/', auth_1.authenticate, async (req, res) => {
    try {
        const { tree, search, type, level, accountType, postable, trustOnly } = req.query;
        const where = {
            isActive: true,
        };
        if (type)
            where.type = type;
        if (level)
            where.level = parseInt(level);
        if (accountType)
            where.accountType = accountType;
        if (postable === 'true') {
            where.isPostable = true;
            where.accountType = 'Posting';
            where.level = 5;
        }
        if (trustOnly === 'true')
            where.trustFlag = true;
        if (search) {
            where.OR = [
                { code: { contains: search, mode: 'insensitive' } },
                { name: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
            ];
        }
        const accounts = await client_1.default.account.findMany({
            where,
            include: {
                parent: {
                    select: {
                        id: true,
                        code: true,
                        name: true,
                        level: true,
                    },
                },
                children: {
                    select: {
                        id: true,
                        code: true,
                        name: true,
                        level: true,
                        accountType: true,
                        isPostable: true,
                    },
                },
                _count: {
                    select: {
                        children: true,
                        debitLedgerEntries: true,
                        creditLedgerEntries: true,
                    },
                },
            },
            orderBy: [{ code: 'asc' }],
        });
        // If tree view requested, build hierarchical structure
        if (tree === 'true') {
            const accountMap = new Map(accounts.map(acc => [acc.id, { ...acc, children: [] }]));
            const rootAccounts = [];
            accounts.forEach(account => {
                const accountNode = accountMap.get(account.id);
                if (account.parentId) {
                    const parent = accountMap.get(account.parentId);
                    if (parent) {
                        parent.children.push(accountNode);
                    }
                }
                else {
                    rootAccounts.push(accountNode);
                }
            });
            return (0, error_handler_1.successResponse)(res, rootAccounts);
        }
        // PHASE 3 OPTION A: General Ledger = journal_lines. Compute totals from JournalLine (posted entries only).
        const journalLines = await client_1.default.journalLine.findMany({
            where: { entry: { status: 'posted' } },
            select: { accountId: true, debit: true, credit: true },
        });
        const totalsByAccountId = {};
        journalLines.forEach((line) => {
            const id = line.accountId;
            if (!totalsByAccountId[id])
                totalsByAccountId[id] = { debit: 0, credit: 0 };
            totalsByAccountId[id].debit += Number(line.debit);
            totalsByAccountId[id].credit += Number(line.credit);
        });
        // Legacy LedgerEntry (deal-based) — add to totals for backward compatibility
        const legacyEntries = await client_1.default.ledgerEntry.findMany({
            where: { deletedAt: null },
            select: { debitAccountId: true, creditAccountId: true, amount: true },
        });
        legacyEntries.forEach((e) => {
            if (e.debitAccountId) {
                if (!totalsByAccountId[e.debitAccountId])
                    totalsByAccountId[e.debitAccountId] = { debit: 0, credit: 0 };
                totalsByAccountId[e.debitAccountId].debit += Number(e.amount);
            }
            if (e.creditAccountId) {
                if (!totalsByAccountId[e.creditAccountId])
                    totalsByAccountId[e.creditAccountId] = { debit: 0, credit: 0 };
                totalsByAccountId[e.creditAccountId].credit += Number(e.amount);
            }
        });
        const accountsWithBalances = accounts.map((account) => {
            const t = totalsByAccountId[account.id] || { debit: 0, credit: 0 };
            const debitSum = t.debit;
            const creditSum = t.credit;
            let balance = 0;
            if (account.normalBalance === 'Debit') {
                balance = debitSum - creditSum;
            }
            else {
                balance = creditSum - debitSum;
            }
            return {
                ...account,
                balance: Number(balance.toFixed(2)),
                debitTotal: Number(debitSum.toFixed(2)),
                creditTotal: Number(creditSum.toFixed(2)),
            };
        });
        return (0, error_handler_1.successResponse)(res, accountsWithBalances);
    }
    catch (error) {
        logger_1.default.error('Get accounts error:', error);
        return (0, error_handler_1.errorResponse)(res, error, 500);
    }
});
/**
 * GET /accounts/:id
 * Get single account with full details
 */
router.get('/:id', auth_1.authenticate, async (req, res) => {
    try {
        const account = await client_1.default.account.findUnique({
            where: { id: req.params.id },
            include: {
                parent: true,
                children: {
                    orderBy: [{ code: 'asc' }],
                },
                _count: {
                    select: {
                        debitLedgerEntries: true,
                        creditLedgerEntries: true,
                        journalLines: true,
                    },
                },
            },
        });
        if (!account) {
            return (0, error_handler_1.errorResponse)(res, 'Account not found', 404);
        }
        // PHASE 3 OPTION A: Balances from JournalLine (General Ledger)
        const journalLinesForAccount = await client_1.default.journalLine.findMany({
            where: { accountId: account.id, entry: { status: 'posted' } },
            select: { debit: true, credit: true },
        });
        let debitSum = 0;
        let creditSum = 0;
        journalLinesForAccount.forEach((line) => {
            debitSum += Number(line.debit);
            creditSum += Number(line.credit);
        });
        const legacyDebit = await client_1.default.ledgerEntry.aggregate({
            where: { debitAccountId: account.id, deletedAt: null },
            _sum: { amount: true },
        });
        const legacyCredit = await client_1.default.ledgerEntry.aggregate({
            where: { creditAccountId: account.id, deletedAt: null },
            _sum: { amount: true },
        });
        debitSum += legacyDebit._sum.amount || 0;
        creditSum += legacyCredit._sum.amount || 0;
        let balance = 0;
        if (account.normalBalance === 'Debit') {
            balance = debitSum - creditSum;
        }
        else {
            balance = creditSum - debitSum;
        }
        return (0, error_handler_1.successResponse)(res, {
            ...account,
            balance: Number(balance.toFixed(2)),
            debitTotal: Number(debitSum.toFixed(2)),
            creditTotal: Number(creditSum.toFixed(2)),
        });
    }
    catch (error) {
        logger_1.default.error('Get account error:', error);
        return (0, error_handler_1.errorResponse)(res, error, 500);
    }
});
/**
 * POST /accounts
 * Create new account with validation
 */
router.post('/', auth_1.authenticate, async (req, res) => {
    try {
        const data = createAccountSchema.parse(req.body);
        // Validate parent if provided
        if (data.parentId) {
            const parent = await client_1.default.account.findUnique({
                where: { id: data.parentId },
            });
            if (!parent) {
                return (0, error_handler_1.errorResponse)(res, 'Parent account not found', 400);
            }
            // Validate child level is parent level + 1
            if (data.level !== parent.level + 1) {
                return (0, error_handler_1.errorResponse)(res, `Account level must be ${parent.level + 1} (parent level + 1)`, 400);
            }
            // Validate child type matches parent type
            if (data.type !== parent.type) {
                return (0, error_handler_1.errorResponse)(res, 'Child account type must match parent account type', 400);
            }
        }
        else {
            // Root accounts must be level 1
            if (data.level !== 1) {
                return (0, error_handler_1.errorResponse)(res, 'Root accounts must be level 1', 400);
            }
        }
        // Validate account code uniqueness
        const existing = await client_1.default.account.findUnique({
            where: { code: data.code },
        });
        if (existing) {
            return (0, error_handler_1.errorResponse)(res, `Account code ${data.code} already exists`, 400);
        }
        // Determine if postable (only Level 5 Posting accounts)
        const isPostable = data.level === 5 && data.accountType === 'Posting';
        const account = await client_1.default.account.create({
            data: {
                ...data,
                isPostable,
                parentId: data.parentId || null,
            },
            include: {
                parent: true,
            },
        });
        return (0, error_handler_1.successResponse)(res, account, 201);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return (0, error_handler_1.errorResponse)(res, error, 400);
        }
        logger_1.default.error('Create account error:', error);
        return (0, error_handler_1.errorResponse)(res, error, 500);
    }
});
/**
 * PUT /accounts/:id
 * Update account
 */
router.put('/:id', auth_1.authenticate, async (req, res) => {
    try {
        const data = updateAccountSchema.parse(req.body);
        const accountId = req.params.id;
        const existing = await client_1.default.account.findUnique({
            where: { id: accountId },
        });
        if (!existing) {
            return (0, error_handler_1.errorResponse)(res, 'Account not found', 404);
        }
        // Validate code uniqueness if code is being changed
        if (data.code && data.code !== existing.code) {
            const codeExists = await client_1.default.account.findUnique({
                where: { code: data.code },
            });
            if (codeExists) {
                return (0, error_handler_1.errorResponse)(res, `Account code ${data.code} already exists`, 400);
            }
        }
        // Recalculate isPostable if level or accountType changed
        let isPostable = existing.isPostable;
        if (data.level !== undefined || data.accountType !== undefined) {
            const level = data.level ?? existing.level;
            const accountType = data.accountType ?? existing.accountType;
            isPostable = level === 5 && accountType === 'Posting';
        }
        const updated = await client_1.default.account.update({
            where: { id: accountId },
            data: {
                ...data,
                isPostable,
            },
            include: {
                parent: true,
                children: true,
            },
        });
        return (0, error_handler_1.successResponse)(res, updated);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return (0, error_handler_1.errorResponse)(res, error, 400);
        }
        logger_1.default.error('Update account error:', error);
        return (0, error_handler_1.errorResponse)(res, error, 500);
    }
});
/**
 * DELETE /accounts/:id
 * Soft delete account (set isActive = false)
 */
router.delete('/:id', auth_1.authenticate, async (req, res) => {
    try {
        const account = await client_1.default.account.findUnique({
            where: { id: req.params.id },
            include: {
                _count: {
                    select: {
                        debitLedgerEntries: true,
                        creditLedgerEntries: true,
                        children: true,
                    },
                },
            },
        });
        if (!account) {
            return (0, error_handler_1.errorResponse)(res, 'Account not found', 404);
        }
        // Check if account has children
        if (account._count.children > 0) {
            return (0, error_handler_1.errorResponse)(res, 'Cannot delete account with child accounts', 400);
        }
        // Check if account has transactions
        if (account._count.debitLedgerEntries > 0 || account._count.creditLedgerEntries > 0) {
            // Soft delete instead
            await client_1.default.account.update({
                where: { id: req.params.id },
                data: { isActive: false },
            });
            return (0, error_handler_1.successResponse)(res, { message: 'Account deactivated (has transactions)' });
        }
        // Hard delete if no transactions
        await client_1.default.account.delete({
            where: { id: req.params.id },
        });
        return (0, error_handler_1.successResponse)(res, { message: 'Account deleted successfully' });
    }
    catch (error) {
        logger_1.default.error('Delete account error:', error);
        return (0, error_handler_1.errorResponse)(res, error, 500);
    }
});
/**
 * GET /accounts/postable/list
 * Get list of postable accounts for dropdowns
 */
router.get('/postable/list', auth_1.authenticate, async (req, res) => {
    try {
        const { type, cashFlowCategory, dropdownType } = req.query;
        let accounts;
        if (dropdownType) {
            accounts = await account_validation_service_1.AccountValidationService.getAccountsForDropdown(dropdownType);
        }
        else {
            accounts = await account_validation_service_1.AccountValidationService.getPostableAccounts({
                type: type,
                cashFlowCategory: cashFlowCategory,
            });
        }
        return (0, error_handler_1.successResponse)(res, accounts);
    }
    catch (error) {
        logger_1.default.error('Get postable accounts error:', error);
        return (0, error_handler_1.errorResponse)(res, error, 500);
    }
});
/**
 * GET /accounts/validate/escrow-balance
 * Validate escrow balance (Trust Assets = Client Liabilities)
 */
router.get('/validate/escrow-balance', auth_1.authenticate, async (req, res) => {
    try {
        const validation = await account_validation_service_1.AccountValidationService.validateEscrowBalance();
        return (0, error_handler_1.successResponse)(res, validation);
    }
    catch (error) {
        logger_1.default.error('Validate escrow balance error:', error);
        return (0, error_handler_1.errorResponse)(res, error, 500);
    }
});
/**
 * GET /accounts/search
 * Search accounts by code or name
 */
router.get('/search', auth_1.authenticate, async (req, res) => {
    try {
        const { q, limit = '20' } = req.query;
        if (!q || q.length < 2) {
            return (0, error_handler_1.errorResponse)(res, 'Search query must be at least 2 characters', 400);
        }
        const accounts = await client_1.default.account.findMany({
            where: {
                isActive: true,
                OR: [
                    { code: { contains: q, mode: 'insensitive' } },
                    { name: { contains: q, mode: 'insensitive' } },
                ],
            },
            include: {
                parent: {
                    select: {
                        code: true,
                        name: true,
                    },
                },
            },
            take: parseInt(limit),
            orderBy: [{ code: 'asc' }],
        });
        return (0, error_handler_1.successResponse)(res, accounts);
    }
    catch (error) {
        logger_1.default.error('Search accounts error:', error);
        return (0, error_handler_1.errorResponse)(res, error, 500);
    }
});
exports.default = router;
//# sourceMappingURL=accounts.js.map