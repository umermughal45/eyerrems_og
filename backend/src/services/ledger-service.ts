/**
 * LedgerService - Business logic for Ledger Entry management
 * Handles double-entry bookkeeping and account lookups.
 *
 * AUDIT: General Ledger source of truth = JournalLine (table JournalLine via entry.status='posted').
 * - getCompanyLedger() reads from JournalEntry + JournalLine (posting date = JournalEntry.date).
 * - calculateAccountBalances() derives balances from JournalLine + legacy LedgerEntry.
 * - LedgerEntry is legacy (dealId required); vouchers do not create LedgerEntry rows.
 */

import { Prisma } from '../prisma/client';
import prisma from '../prisma/client';

import { createAuditLog } from './audit-log';

export interface CreateLedgerEntryPayload {
  dealId: string;
  paymentId?: string;
  debitAccountId?: string;
  creditAccountId?: string;
  amount: number;
  remarks?: string;
  date: Date;
  userId?: string;
  userName?: string;
}

export class LedgerService {
  /**
   * Create a ledger entry (single side of double-entry)
   * For double-entry, call this twice: once for debit, once for credit
   */
  static async createLedgerEntry(
    payload: CreateLedgerEntryPayload,
    tx?: Prisma.TransactionClient
  ): Promise<any> {
    const prismaClient = tx || prisma;

    // Validate at least one account is provided
    if (!payload.debitAccountId && !payload.creditAccountId) {
      throw new Error('Either debitAccountId or creditAccountId must be provided');
    }

    if (payload.debitAccountId && payload.creditAccountId) {
      throw new Error('Cannot specify both debitAccountId and creditAccountId in single entry');
    }

    // Validate account exists
    const accountId = payload.debitAccountId || payload.creditAccountId!;
    const account = await prismaClient.account.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new Error(`Account not found: ${accountId}`);
    }

    if (!account.isActive) {
      throw new Error(`Account is inactive: ${account.name}`);
    }

    // Get legacy account names for backwards compatibility
    const accountName = account.name;

    // Create ledger entry
    const entry = await prismaClient.ledgerEntry.create({
      data: {
        dealId: payload.dealId,
        paymentId: payload.paymentId || null,
        debitAccountId: payload.debitAccountId || null,
        creditAccountId: payload.creditAccountId || null,
        accountDebit: payload.debitAccountId ? accountName : '', // Legacy field
        accountCredit: payload.creditAccountId ? accountName : '', // Legacy field
        amount: payload.amount,
        remarks: payload.remarks || null,
        date: payload.date,
      },
    });

    // Audit Log
    if (payload.userId) {
      await createAuditLog({
        entityType: 'LedgerEntry',
        entityId: entry.id,
        action: 'create',
        userId: payload.userId,
        userName: payload.userName,
        description: `Created ledger entry for ${accountName}: ${payload.amount}`,
        newValues: entry,
      });
    }

    return entry;
  }

  /**
   * Get account by alias (for migration compatibility)
   */
  static async getAccountByAlias(alias: string): Promise<string | null> {
    const accountAlias = await prisma.accountAlias.findUnique({
      where: { alias },
      include: { account: true },
    });

    if (accountAlias && accountAlias.account.isActive) {
      return accountAlias.accountId;
    }

    // Fallback: try to find by name
    const account = await prisma.account.findFirst({
      where: {
        name: { contains: alias, mode: 'insensitive' },
        isActive: true,
      },
    });

    return account?.id || null;
  }

  /**
   * Get client ledger (all credit/debit entries with running balance)
   */
  static async getClientLedger(clientId?: string, filters?: { propertyId?: string; startDate?: Date; endDate?: Date; period?: 'thisMonth' | 'all' }): Promise<any[]> {
    const where: any = {
      deletedAt: null,
    };

    if (clientId) {
      where.clientId = clientId;
    }

    // Apply property filter if provided
    if (filters?.propertyId) {
      where.propertyId = filters.propertyId;
    }

    const deals = await prisma.deal.findMany({
      where: {
        ...where,
        isDeleted: false,
        deletedAt: null,
      },
      include: {
        client: { select: { id: true, name: true, clientCode: true } },
        property: { select: { id: true, name: true, propertyCode: true } },
        payments: {
          where: { 
            deletedAt: null,
            ...(filters?.startDate || filters?.endDate ? {
              date: {
                ...(filters.startDate ? { gte: filters.startDate } : {}),
                ...(filters.endDate ? { lte: filters.endDate } : {}),
              }
            } : {}),
          },
          orderBy: { date: 'asc' },
        },
        paymentPlan: {
          include: {
            installments: {
              where: { isDeleted: false },
              orderBy: { dueDate: 'asc' },
            },
          },
        },
      },
    });

    const rows: any[] = [];
    let runningBalance = 0;

    deals.forEach((deal) => {
      // Add deal creation as debit entry (amount owed)
      const dealDate = deal.dealDate || deal.createdAt;
      const dealAmount = deal.dealAmount || 0;
      
      // Apply date filter for deal entry
      let includeDeal = true;
      if (filters?.period === 'thisMonth') {
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        includeDeal = dealDate >= firstDay && dealDate <= lastDay;
      }
      
      if (includeDeal && (!filters?.startDate || dealDate >= filters.startDate) && (!filters?.endDate || dealDate <= filters.endDate)) {
        runningBalance += dealAmount;
        rows.push({
          id: `DEAL-${deal.id}`,
          clientId: deal.client?.id || null,
          clientName: deal.client?.name || 'Unassigned Client',
          propertyId: deal.property?.id || null,
          propertyName: deal.property?.name || 'Unassigned Property',
          dealTitle: deal.title,
          dealId: deal.id,
          paymentId: null,
          paymentType: 'deal',
          paymentMode: null,
          description: `Deal: ${deal.title}`,
          credit: 0,
          debit: Number(dealAmount.toFixed(2)),
          date: dealDate,
          runningBalance: Number(runningBalance.toFixed(2)),
        });
      }

      // Add payment entries as credit (payments received)
      deal.payments.forEach((payment) => {
        runningBalance -= payment.amount;
        rows.push({
          id: payment.id,
          clientId: deal.client?.id || null,
          clientName: deal.client?.name || 'Unassigned Client',
          propertyId: deal.property?.id || null,
          propertyName: deal.property?.name || 'Unassigned Property',
          dealTitle: deal.title,
          dealId: deal.id,
          paymentId: payment.paymentId,
          paymentType: payment.paymentType || 'payment',
          paymentMode: payment.paymentMode,
          description: payment.remarks || `Payment ${payment.paymentId || ''}`,
          credit: Number(payment.amount.toFixed(2)),
          debit: 0,
          date: payment.date,
          runningBalance: Number(runningBalance.toFixed(2)),
        });
      });
    });

    // Sort by date (ascending) for proper running balance calculation
    return rows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  /**
   * Get property ledger (aggregated by property)
   */
  static async getPropertyLedger(propertyId?: string): Promise<any[]> {
    const where: any = {
      deletedAt: null,
    };

    if (propertyId) {
      where.propertyId = propertyId;
    }

    const deals = await prisma.deal.findMany({
      where: {
        ...where,
        isDeleted: false,
        deletedAt: null,
      },
      include: {
        property: { select: { id: true, name: true, propertyCode: true } },
        payments: {
          where: { deletedAt: null },
          orderBy: { date: 'desc' },
        },
      },
    });

    const propertyMap = new Map<string, any>();

    deals.forEach((deal) => {
      const key = deal.property?.id || 'unassigned';
      
      if (!propertyMap.has(key)) {
        propertyMap.set(key, {
          propertyId: deal.property?.id || null,
          propertyName: deal.property?.name || 'Unassigned Property',
          propertyCode: deal.property?.propertyCode,
          totalDealAmount: 0,
          totalReceived: 0,
          outstanding: 0,
          payments: [],
        });
      }

      const bucket = propertyMap.get(key)!;
      bucket.totalDealAmount += deal.dealAmount;
      const received = deal.payments.reduce((sum, payment) => sum + payment.amount, 0);
      bucket.totalReceived += received;
      bucket.outstanding += Math.max(0, deal.dealAmount - received);

      deal.payments.forEach((payment) => {
        bucket.payments.push({
          id: payment.id,
          dealTitle: deal.title,
          dealId: deal.id,
          paymentId: payment.paymentId,
          amount: payment.amount,
          paymentMode: payment.paymentMode,
          paymentType: payment.paymentType,
          date: payment.date,
        });
      });
    });

    return Array.from(propertyMap.values());
  }

  /**
   * Get company ledger (all ledger entries with account details)
   * ARCHITECTURAL FIX: Reads from JournalLine (General Ledger) instead of LedgerEntry
   * JournalLine is the source of truth for all posted transactions (vouchers, receipts, invoices, etc.)
   * LedgerEntry is legacy and only contains deal-based entries
   */
  static async getCompanyLedger(filters?: {
    startDate?: Date;
    endDate?: Date;
    accountId?: string;
  }): Promise<{ entries: any[]; summary: any }> {
    // Build JournalEntry filter (uses posting date)
    const journalEntryWhere: any = {
      status: 'posted', // Only posted entries
    };

    if (filters?.startDate || filters?.endDate) {
      journalEntryWhere.date = {};
      if (filters.startDate) journalEntryWhere.date.gte = filters.startDate;
      if (filters.endDate) journalEntryWhere.date.lte = filters.endDate;
    }

    // Build JournalLine filter
    const journalLineWhere: any = {};
    if (filters?.accountId) {
      journalLineWhere.accountId = filters.accountId;
    }

    // Fetch journal entries with lines
    const journalEntries = await prisma.journalEntry.findMany({
      where: journalEntryWhere,
      include: {
        lines: {
          where: journalLineWhere,
          include: {
            account: true,
          },
        },
        vouchers: {
          include: {
            property: { select: { id: true, name: true } },
            deal: {
              include: {
                client: { select: { id: true, name: true } },
                property: { select: { id: true, name: true } },
              },
            },
          },
        },
        dealReceipts: {
          include: {
            deal: {
              include: {
                client: { select: { id: true, name: true } },
                property: { select: { id: true, name: true } },
              },
            },
          },
        },
        invoices: {
          include: {
            tenant: { select: { id: true, name: true } },
            property: { select: { id: true, name: true } },
          },
        },
        preparedBy: { select: { id: true, username: true, email: true } },
      },
      orderBy: { date: 'desc' },
      take: 1000, // Increased limit to capture more entries
    });

    // Flatten journal lines into ledger entries format
    const entries: any[] = [];
    for (const entry of journalEntries) {
      if (!entry.lines || entry.lines.length === 0) continue;
      
      for (const line of entry.lines) {
        // Determine entity context (voucher, receipt, invoice, etc.)
        const voucher = entry.vouchers?.[0];
        const receipt = entry.dealReceipts;
        const invoice = entry.invoices?.[0];

        // Determine which account is debit/credit
        const isDebit = line.debit > 0;
        const counterpartLine = entry.lines.find(
          (l: any) => l.id !== line.id && ((isDebit && l.credit > 0) || (!isDebit && l.debit > 0))
        );

        entries.push({
          id: line.id,
          date: entry.date, // Posting date
          accountDebit: isDebit ? line.account.name : (counterpartLine?.account.name || ''),
          accountCredit: !isDebit ? line.account.name : (counterpartLine?.account.name || ''),
          debitAccountId: isDebit ? line.accountId : null,
          creditAccountId: !isDebit ? line.accountId : null,
          amount: isDebit ? line.debit : line.credit,
          remarks: line.description || entry.description || entry.narration,
          dealTitle: voucher?.deal?.title || receipt?.deal?.title || null,
          clientName: voucher?.deal?.client?.name || receipt?.deal?.client?.name || null,
          propertyName: voucher?.property?.name || voucher?.deal?.property?.name || receipt?.deal?.property?.name || invoice?.property?.name || null,
          paymentId: receipt?.receiptNo || voucher?.voucherNumber || null,
          paymentMode: voucher?.paymentMethod || null,
          paymentType: voucher?.type || (receipt ? 'receipt' : null),
          journalEntryId: entry.id,
          journalEntryNumber: entry.entryNumber,
          voucherNo: entry.voucherNo,
        });
      }
    }

    // Sort by date descending
    entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Limit results for performance
    const limitedEntries = entries.slice(0, 500);

    // Calculate summary balances from JournalLine
    const summary = await this.calculateAccountBalances(filters);

    return {
      entries: limitedEntries,
      summary,
    };
  }

  /**
   * Calculate account balances from journal lines (General Ledger)
   * ARCHITECTURAL FIX: Uses JournalLine as source of truth instead of LedgerEntry
   * This ensures all posted transactions (vouchers, receipts, invoices) are included
   */
  static async calculateAccountBalances(filters?: {
    startDate?: Date;
    endDate?: Date;
    accountId?: string;
  }): Promise<any> {
    // Get all active accounts
    const accounts = await prisma.account.findMany({
      where: { isActive: true },
    });

    const balances: Record<string, number> = {};

    // Initialize balances
    accounts.forEach((account) => {
      balances[account.id] = 0;
    });

    // Build filter for journal entries (only posted, use posting date)
    const journalEntryWhere: any = {
      status: 'posted',
    };

    if (filters?.startDate || filters?.endDate) {
      journalEntryWhere.date = {};
      if (filters.startDate) journalEntryWhere.date.gte = filters.startDate;
      if (filters.endDate) journalEntryWhere.date.lte = filters.endDate;
    }

    // Build filter for journal lines
    const journalLineWhere: any = {};
    if (filters?.accountId) {
      journalLineWhere.accountId = filters.accountId;
    }

    // Calculate from journal lines (General Ledger)
    const journalEntries = await prisma.journalEntry.findMany({
      where: journalEntryWhere,
      include: {
        lines: {
          where: journalLineWhere,
          include: {
            account: true,
          },
        },
      },
    });

    // Calculate balances: Standard double-entry accounting
    // Debit increases asset/expense balances, Credit decreases them
    // Credit increases liability/equity/revenue balances, Debit decreases them
    // Standard formula: Balance = SUM(Debits) - SUM(Credits)
    // For liability/equity/revenue, interpret negative as positive (they have credit normal balance)
    journalEntries.forEach((entry) => {
      entry.lines.forEach((line) => {
        const accountId = line.accountId;
        if (!balances.hasOwnProperty(accountId)) {
          balances[accountId] = 0;
        }
        // Standard: Debit adds, Credit subtracts
        balances[accountId] = (balances[accountId] || 0) + line.debit - line.credit;
      });
    });

    // Also include legacy LedgerEntry records for backward compatibility
    const legacyEntries = await prisma.ledgerEntry.findMany({
      where: { deletedAt: null },
      include: {
        debitAccount: true,
        creditAccount: true,
      },
    });

    legacyEntries.forEach((entry) => {
      if (entry.debitAccountId) {
        balances[entry.debitAccountId] = (balances[entry.debitAccountId] || 0) + entry.amount;
      }
      if (entry.creditAccountId) {
        balances[entry.creditAccountId] = (balances[entry.creditAccountId] || 0) - entry.amount;
      }
    });

    // Get summary accounts by code patterns
    const cashAccount = accounts.find((a) => 
      a.code?.startsWith('1111') || 
      a.code?.startsWith('111101') || 
      a.code?.startsWith('111102') ||
      a.name?.toLowerCase().includes('cash')
    );
    const bankAccount = accounts.find((a) => 
      a.code?.startsWith('1112') || 
      a.code?.startsWith('111201') || 
      a.code?.startsWith('111202') ||
      a.name?.toLowerCase().includes('bank')
    );
    const arAccount = accounts.find((a) => 
      a.code?.startsWith('113') ||
      a.name?.toLowerCase().includes('receivable')
    );
    const dealerPayable = accounts.find((a) => 
      a.code?.startsWith('211') ||
      a.name?.toLowerCase().includes('dealer') && a.name?.toLowerCase().includes('payable')
    );

    return {
      cashBalance: cashAccount ? (balances[cashAccount.id] || 0) : 0,
      bankBalance: bankAccount ? (balances[bankAccount.id] || 0) : 0,
      receivables: arAccount ? Math.abs(balances[arAccount.id] || 0) : 0,
      payables: dealerPayable ? Math.abs(balances[dealerPayable.id] || 0) : 0,
    };
  }
}

