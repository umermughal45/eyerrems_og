/**
 * Account Management Routes
 * Chart of Accounts CRUD, Tree View, Search, and Validation
 */

import express, { Response } from 'express';
import { z } from 'zod';
import prisma from '../prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { AccountValidationService } from '../services/account-validation-service';
import logger from '../utils/logger';
import { successResponse, errorResponse } from '../utils/error-handler';

const router = (express as any).Router();

// Validation schemas
const createAccountSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(['Asset', 'Liability', 'Equity', 'Revenue', 'Expense']),
  level: z.number().int().min(1).max(5),
  accountType: z.enum(['Header', 'Control', 'Posting']),
  normalBalance: z.enum(['Debit', 'Credit']),
  description: z.string().optional(),
  parentId: z.string().uuid().optional().nullable(),
  trustFlag: z.boolean().optional().default(false),
  cashFlowCategory: z.enum(['Operating', 'Investing', 'Financing', 'Escrow']).optional().nullable(),
});

const updateAccountSchema = createAccountSchema.partial();

/**
 * GET /accounts
 * Get all accounts with optional filters
 * Supports: tree view, search, filtering by type/level
 */
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { 
      tree, 
      search, 
      type, 
      level, 
      accountType, 
      postable,
      trustOnly 
    } = req.query;

    const where: any = {
      isActive: true,
    };

    if (type) where.type = type;
    if (level) where.level = parseInt(level as string);
    if (accountType) where.accountType = accountType;
    if (postable === 'true') {
      where.isPostable = true;
      where.accountType = 'Posting';
      where.level = 5;
    }
    if (trustOnly === 'true') where.trustFlag = true;

    if (search) {
      where.OR = [
        { code: { contains: search as string, mode: 'insensitive' } },
        { name: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const accounts = await prisma.account.findMany({
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
      const accountMap = new Map(accounts.map(acc => [acc.id, { ...acc, children: [] as any[] }]));
      const rootAccounts: any[] = [];

      accounts.forEach(account => {
        const accountNode = accountMap.get(account.id)!;
        if (account.parentId) {
          const parent = accountMap.get(account.parentId);
          if (parent) {
            parent.children.push(accountNode);
          }
        } else {
          rootAccounts.push(accountNode);
        }
      });

      return successResponse(res, rootAccounts);
    }

    // PHASE 3 OPTION A: General Ledger = journal_lines. Compute totals from JournalLine (posted entries only).
    const journalLines = await prisma.journalLine.findMany({
      where: { entry: { status: 'posted' } },
      select: { accountId: true, debit: true, credit: true },
    });
    const totalsByAccountId: Record<string, { debit: number; credit: number }> = {};
    journalLines.forEach((line) => {
      const id = line.accountId;
      if (!totalsByAccountId[id]) totalsByAccountId[id] = { debit: 0, credit: 0 };
      totalsByAccountId[id].debit += Number(line.debit);
      totalsByAccountId[id].credit += Number(line.credit);
    });

    // Legacy LedgerEntry (deal-based) — add to totals for backward compatibility
    const legacyEntries = await prisma.ledgerEntry.findMany({
      where: { deletedAt: null },
      select: { debitAccountId: true, creditAccountId: true, amount: true },
    });
    legacyEntries.forEach((e) => {
      if (e.debitAccountId) {
        if (!totalsByAccountId[e.debitAccountId]) totalsByAccountId[e.debitAccountId] = { debit: 0, credit: 0 };
        totalsByAccountId[e.debitAccountId].debit += Number(e.amount);
      }
      if (e.creditAccountId) {
        if (!totalsByAccountId[e.creditAccountId]) totalsByAccountId[e.creditAccountId] = { debit: 0, credit: 0 };
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
      } else {
        balance = creditSum - debitSum;
      }
      return {
        ...account,
        balance: Number(balance.toFixed(2)),
        debitTotal: Number(debitSum.toFixed(2)),
        creditTotal: Number(creditSum.toFixed(2)),
      };
    });

    return successResponse(res, accountsWithBalances);
  } catch (error) {
    logger.error('Get accounts error:', error);
    return errorResponse(res, error, 500);
  }
});

/**
 * GET /accounts/:id
 * Get single account with full details
 */
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const account = await prisma.account.findUnique({
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
      return errorResponse(res, 'Account not found', 404);
    }

    // PHASE 3 OPTION A: Balances from JournalLine (General Ledger)
    const journalLinesForAccount = await prisma.journalLine.findMany({
      where: { accountId: account.id, entry: { status: 'posted' } },
      select: { debit: true, credit: true },
    });
    let debitSum = 0;
    let creditSum = 0;
    journalLinesForAccount.forEach((line) => {
      debitSum += Number(line.debit);
      creditSum += Number(line.credit);
    });
    const legacyDebit = await prisma.ledgerEntry.aggregate({
      where: { debitAccountId: account.id, deletedAt: null },
      _sum: { amount: true },
    });
    const legacyCredit = await prisma.ledgerEntry.aggregate({
      where: { creditAccountId: account.id, deletedAt: null },
      _sum: { amount: true },
    });
    debitSum += legacyDebit._sum.amount || 0;
    creditSum += legacyCredit._sum.amount || 0;

    let balance = 0;
    if (account.normalBalance === 'Debit') {
      balance = debitSum - creditSum;
    } else {
      balance = creditSum - debitSum;
    }

    return successResponse(res, {
      ...account,
      balance: Number(balance.toFixed(2)),
      debitTotal: Number(debitSum.toFixed(2)),
      creditTotal: Number(creditSum.toFixed(2)),
    });
  } catch (error) {
    logger.error('Get account error:', error);
    return errorResponse(res, error, 500);
  }
});

/**
 * POST /accounts
 * Create new account with validation
 */
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const data = createAccountSchema.parse(req.body);

    // Validate parent if provided
    if (data.parentId) {
      const parent = await prisma.account.findUnique({
        where: { id: data.parentId },
      });

      if (!parent) {
        return errorResponse(res, 'Parent account not found', 400);
      }

      // Validate child level is parent level + 1
      if (data.level !== parent.level + 1) {
        return errorResponse(res, `Account level must be ${parent.level + 1} (parent level + 1)`, 400);
      }

      // Validate child type matches parent type
      if (data.type !== parent.type) {
        return errorResponse(res, 'Child account type must match parent account type', 400);
      }
    } else {
      // Root accounts must be level 1
      if (data.level !== 1) {
        return errorResponse(res, 'Root accounts must be level 1', 400);
      }
    }

    // Validate account code uniqueness
    const existing = await prisma.account.findUnique({
      where: { code: data.code },
    });

    if (existing) {
      return errorResponse(res, `Account code ${data.code} already exists`, 400);
    }

    // Determine if postable (only Level 5 Posting accounts)
    const isPostable = data.level === 5 && data.accountType === 'Posting';

    const account = await prisma.account.create({
      data: {
        ...data,
        isPostable,
        parentId: data.parentId || null,
      },
      include: {
        parent: true,
      },
    });

    return successResponse(res, account, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(res, error, 400);
    }

    logger.error('Create account error:', error);
    return errorResponse(res, error, 500);
  }
});

/**
 * PUT /accounts/:id
 * Update account
 */
router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const data = updateAccountSchema.parse(req.body);
    const accountId = req.params.id;

    const existing = await prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!existing) {
      return errorResponse(res, 'Account not found', 404);
    }

    // Validate code uniqueness if code is being changed
    if (data.code && data.code !== existing.code) {
      const codeExists = await prisma.account.findUnique({
        where: { code: data.code },
      });

      if (codeExists) {
        return errorResponse(res, `Account code ${data.code} already exists`, 400);
      }
    }

    // Recalculate isPostable if level or accountType changed
    let isPostable = existing.isPostable;
    if (data.level !== undefined || data.accountType !== undefined) {
      const level = data.level ?? existing.level;
      const accountType = data.accountType ?? existing.accountType;
      isPostable = level === 5 && accountType === 'Posting';
    }

    const updated = await prisma.account.update({
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

    return successResponse(res, updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(res, error, 400);
    }

    logger.error('Update account error:', error);
    return errorResponse(res, error, 500);
  }
});

/**
 * DELETE /accounts/:id
 * Soft delete account (set isActive = false)
 */
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const account = await prisma.account.findUnique({
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
      return errorResponse(res, 'Account not found', 404);
    }

    // Check if account has children
    if (account._count.children > 0) {
      return errorResponse(res, 'Cannot delete account with child accounts', 400);
    }

    // Check if account has transactions
    if (account._count.debitLedgerEntries > 0 || account._count.creditLedgerEntries > 0) {
      // Soft delete instead
      await prisma.account.update({
        where: { id: req.params.id },
        data: { isActive: false },
      });

      return successResponse(res, { message: 'Account deactivated (has transactions)' });
    }

    // Hard delete if no transactions
    await prisma.account.delete({
      where: { id: req.params.id },
    });

    return successResponse(res, { message: 'Account deleted successfully' });
  } catch (error) {
    logger.error('Delete account error:', error);
    return errorResponse(res, error, 500);
  }
});

/**
 * GET /accounts/postable/list
 * Get list of postable accounts for dropdowns
 */
router.get('/postable/list', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { type, cashFlowCategory, dropdownType } = req.query;

    let accounts;
    if (dropdownType) {
      accounts = await AccountValidationService.getAccountsForDropdown(
        dropdownType as any
      );
    } else {
      accounts = await AccountValidationService.getPostableAccounts({
        type: type as string,
        cashFlowCategory: cashFlowCategory as string,
      });
    }

    return successResponse(res, accounts);
  } catch (error) {
    logger.error('Get postable accounts error:', error);
    return errorResponse(res, error, 500);
  }
});

/**
 * GET /accounts/validate/escrow-balance
 * Validate escrow balance (Trust Assets = Client Liabilities)
 */
router.get('/validate/escrow-balance', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const validation = await AccountValidationService.validateEscrowBalance();
    return successResponse(res, validation);
  } catch (error) {
    logger.error('Validate escrow balance error:', error);
    return errorResponse(res, error, 500);
  }
});

/**
 * GET /accounts/search
 * Search accounts by code or name
 */
router.get('/search', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { q, limit = '20' } = req.query;

    if (!q || (q as string).length < 2) {
      return errorResponse(res, 'Search query must be at least 2 characters', 400);
    }

    const accounts = await prisma.account.findMany({
      where: {
        isActive: true,
        OR: [
          { code: { contains: q as string, mode: 'insensitive' } },
          { name: { contains: q as string, mode: 'insensitive' } },
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
      take: parseInt(limit as string),
      orderBy: [{ code: 'asc' }],
    });

    return successResponse(res, accounts);
  } catch (error) {
    logger.error('Search accounts error:', error);
    return errorResponse(res, error, 500);
  }
});

export default router;

