/**
 * VoucherAccountingSafetyService - ERP-Grade Accounting Safety Enforcement
 * 
 * CRITICAL RULES:
 * - All validations MUST be server-side (backend authority)
 * - Prevent posting in closed periods
 * - Prevent duplicate posting (idempotency)
 * - Enforce negative balance prevention
 * - Enforce property/unit linkage for property-related transactions
 * - Enforce daily cash limits for CPV
 * - Support invoice allocation for BRV
 */

import prisma, { Prisma } from '../prisma/client';

export type VoucherType = 'BPV' | 'BRV' | 'CPV' | 'CRV' | 'JV';

export interface FinancialPeriod {
  id: string;
  startDate: Date;
  endDate: Date;
  status: 'open' | 'closed' | 'locked';
  fiscalYear: string;
}

export interface CashLimitConfig {
  dailyLimit: number;
  allowNegative: boolean;
  warningThreshold: number; // Percentage of limit
}

export class VoucherAccountingSafetyService {
  /**
   * Validate financial period is open for posting
   * Prevents posting in closed/locked periods
   */
  static async validateFinancialPeriod(
    postingDate: Date,
    tx?: Prisma.TransactionClient
  ): Promise<{ valid: boolean; error?: string; period?: FinancialPeriod }> {
    const client = tx || prisma;

    // For now, we'll use a simple date-based check
    // In production, you'd have a FinancialPeriod table
    // This is a placeholder that can be extended
    
    // Check if date is in the future (not allowed)
    const now = new Date();
    if (postingDate > now) {
      return {
        valid: false,
        error: `VOUCHER_ACCOUNTING_ERROR: Cannot post voucher with future date. Posting date: ${postingDate.toISOString().split('T')[0]}, Today: ${now.toISOString().split('T')[0]}`,
      };
    }

    // Check if date is too far in the past (e.g., > 1 year)
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    if (postingDate < oneYearAgo) {
      return {
        valid: false,
        error: `VOUCHER_ACCOUNTING_ERROR: Cannot post voucher with date more than 1 year in the past. Posting date: ${postingDate.toISOString().split('T')[0]}`,
      };
    }

    // TODO: Add actual FinancialPeriod table check when implemented
    // Example:
    // const period = await client.financialPeriod.findFirst({
    //   where: {
    //     startDate: { lte: postingDate },
    //     endDate: { gte: postingDate },
    //   },
    // });
    // 
    // if (!period) {
    //   return { valid: false, error: 'No financial period found for posting date' };
    // }
    // 
    // if (period.status === 'closed' || period.status === 'locked') {
    //   return {
    //     valid: false,
    //     error: `VOUCHER_ACCOUNTING_ERROR: Financial period is ${period.status}. Cannot post vouchers in closed/locked periods. Period: ${period.fiscalYear} (${period.startDate.toISOString().split('T')[0]} to ${period.endDate.toISOString().split('T')[0]})`,
    //     period,
    //   };
    // }

    return { valid: true };
  }

  /**
   * Validate idempotency - prevent double posting
   * Checks if voucher is already posted
   */
  static async validateIdempotency(
    voucherId: string,
    tx?: Prisma.TransactionClient
  ): Promise<{ valid: boolean; error?: string; alreadyPosted?: boolean }> {
    const client = tx || prisma;

    const voucher = await client.voucher.findUnique({
      where: { id: voucherId },
      select: {
        id: true,
        status: true,
        journalEntryId: true,
        voucherNumber: true,
      },
    });

    if (!voucher) {
      return {
        valid: false,
        error: `VOUCHER_ACCOUNTING_ERROR: Voucher not found: ${voucherId}`,
      };
    }

    if (voucher.status === 'posted' && voucher.journalEntryId) {
      return {
        valid: false,
        error: `VOUCHER_ACCOUNTING_ERROR: Voucher ${voucher.voucherNumber} has already been posted. Journal Entry ID: ${voucher.journalEntryId}. Duplicate posting is not allowed.`,
        alreadyPosted: true,
      };
    }

    if (voucher.status === 'reversed') {
      return {
        valid: false,
        error: `VOUCHER_ACCOUNTING_ERROR: Voucher ${voucher.voucherNumber} has been reversed and cannot be posted again.`,
        alreadyPosted: true,
      };
    }

    return { valid: true };
  }

  /**
   * Validate cash balance and daily limits for CPV
   * Enforces daily cash limits and prevents negative balances
   */
  static async validateCashBalance(
    accountId: string,
    creditAmount: number, // Amount being credited (reducing cash)
    voucherDate: Date,
    tx?: Prisma.TransactionClient
  ): Promise<{ valid: boolean; error?: string; currentBalance?: number; dailyTotal?: number }> {
    const client = tx || prisma;

    if (creditAmount <= 0) {
      return { valid: true }; // Only check when crediting (reducing) cash
    }

    const account = await client.account.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      return {
        valid: false,
        error: `VOUCHER_ACCOUNTING_ERROR: Cash account not found: ${accountId}`,
      };
    }

    // Validate account is a cash account
    if (!account.code.startsWith('1111') && !account.code.startsWith('111101') && !account.code.startsWith('111102')) {
      return { valid: true }; // Not a cash account, skip cash-specific validation
    }

    // Calculate current balance from journal entries
    const debitTotal = await client.journalLine.aggregate({
      where: {
        accountId,
        entry: {
          status: 'posted',
        },
      },
      _sum: { debit: true },
    });

    const creditTotal = await client.journalLine.aggregate({
      where: {
        accountId,
        entry: {
          status: 'posted',
        },
      },
      _sum: { credit: true },
    });

    const currentBalance = (debitTotal._sum.debit || 0) - (creditTotal._sum.credit || 0);
    const newBalance = currentBalance - creditAmount;

    // ENFORCE: Prevent negative balance unless trust account
    if (newBalance < 0 && !account.trustFlag) {
      return {
        valid: false,
        error: `VOUCHER_ACCOUNTING_ERROR: Insufficient cash balance. Account: ${account.code} (${account.name}). Current balance: ${currentBalance.toFixed(2)}, Payment amount: ${creditAmount.toFixed(2)}, New balance: ${newBalance.toFixed(2)}. Negative balances are not allowed for operating cash accounts.`,
        currentBalance,
      };
    }

    // Calculate daily total for CPV (cash payments on same day)
    const dayStart = new Date(voucherDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(voucherDate);
    dayEnd.setHours(23, 59, 59, 999);

    const dailyPayments = await client.voucher.aggregate({
      where: {
        type: 'CPV',
        accountId,
        date: { gte: dayStart, lte: dayEnd },
        status: { in: ['submitted', 'approved', 'posted'] },
      },
      _sum: { amount: true },
    });

    const dailyTotal = (dailyPayments._sum.amount || 0) + creditAmount;

    // ENFORCE: Daily cash limit (default: 100,000, configurable)
    // TODO: Load from system settings or account metadata
    const dailyLimit = 100000; // Default limit
    if (dailyTotal > dailyLimit) {
      return {
        valid: false,
        error: `VOUCHER_ACCOUNTING_ERROR: Daily cash payment limit exceeded. Account: ${account.code} (${account.name}). Daily limit: ${dailyLimit.toFixed(2)}, Current daily total: ${dailyTotal.toFixed(2)}, Payment amount: ${creditAmount.toFixed(2)}. Please use bank transfer for large payments.`,
        dailyTotal,
      };
    }

    return { valid: true, currentBalance, dailyTotal };
  }

  /**
   * Validate bank balance (prevent negative unless explicitly allowed)
   */
  static async validateBankBalance(
    accountId: string,
    creditAmount: number, // Amount being credited (reducing bank)
    tx?: Prisma.TransactionClient
  ): Promise<{ valid: boolean; error?: string; currentBalance?: number }> {
    const client = tx || prisma;

    if (creditAmount <= 0) {
      return { valid: true };
    }

    const account = await client.account.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      return {
        valid: false,
        error: `VOUCHER_ACCOUNTING_ERROR: Bank account not found: ${accountId}`,
      };
    }

    // Validate account is a bank account
    if (!account.code.startsWith('1112') && !account.code.startsWith('111201') && !account.code.startsWith('111202')) {
      return { valid: true }; // Not a bank account, skip bank-specific validation
    }

    // Calculate current balance from journal entries
    const debitTotal = await client.journalLine.aggregate({
      where: {
        accountId,
        entry: {
          status: 'posted',
        },
      },
      _sum: { debit: true },
    });

    const creditTotal = await client.journalLine.aggregate({
      where: {
        accountId,
        entry: {
          status: 'posted',
        },
      },
      _sum: { credit: true },
    });

    const currentBalance = (debitTotal._sum.debit || 0) - (creditTotal._sum.credit || 0);
    const newBalance = currentBalance - creditAmount;

    // ENFORCE: Prevent negative balance unless trust account
    if (newBalance < 0 && !account.trustFlag) {
      return {
        valid: false,
        error: `VOUCHER_ACCOUNTING_ERROR: Insufficient bank balance. Account: ${account.code} (${account.name}). Current balance: ${currentBalance.toFixed(2)}, Payment amount: ${creditAmount.toFixed(2)}, New balance: ${newBalance.toFixed(2)}. Negative balances are not allowed for operating bank accounts.`,
        currentBalance,
      };
    }

    return { valid: true, currentBalance };
  }

  /**
   * Validate property/unit linkage is mandatory for property-related vouchers
   */
  static async validatePropertyUnitLinkage(
    type: VoucherType,
    propertyId: string | undefined,
    unitId: string | undefined,
    lines: Array<{ propertyId?: string; unitId?: string }>,
    tx?: Prisma.TransactionClient
  ): Promise<{ valid: boolean; error?: string }> {
    const client = tx || prisma;

    // Property/Unit is mandatory for property-related transactions
    // This includes maintenance, rent, property expenses, etc.
    // For now, we'll enforce property for all vouchers except JV
    // In production, you might have a flag or category to determine if property is required

    if (type === 'JV') {
      return { valid: true }; // Journal vouchers may not require property
    }

    // Check if any line has property/unit allocation
    const hasLineLevelAllocation = lines.some(line => line.propertyId || line.unitId);

    // If no property at voucher level and no line-level allocation, require property
    if (!propertyId && !hasLineLevelAllocation) {
      return {
        valid: false,
        error: `VOUCHER_ACCOUNTING_ERROR: Property linkage is mandatory for ${type} vouchers. Please specify propertyId at voucher level or propertyId/unitId at line level.`,
      };
    }

    // Validate property exists if provided
    if (propertyId) {
      const property = await client.property.findUnique({
        where: { id: propertyId },
        select: { id: true, name: true, isDeleted: true },
      });

      if (!property) {
        return {
          valid: false,
          error: `VOUCHER_ACCOUNTING_ERROR: Property not found: ${propertyId}`,
        };
      }

      if (property.isDeleted) {
        return {
          valid: false,
          error: `VOUCHER_ACCOUNTING_ERROR: Property ${property.name} has been deleted and cannot be used in vouchers.`,
        };
      }
    }

    // Validate unit exists and belongs to property if provided
    if (unitId) {
      const unit = await client.unit.findUnique({
        where: { id: unitId },
        select: {
          id: true,
          unitName: true,
          propertyId: true,
          isDeleted: true,
          property: {
            select: { id: true, name: true },
          },
        },
      });

      if (!unit) {
        return {
          valid: false,
          error: `VOUCHER_ACCOUNTING_ERROR: Unit not found: ${unitId}`,
        };
      }

      if (unit.isDeleted) {
        return {
          valid: false,
          error: `VOUCHER_ACCOUNTING_ERROR: Unit ${unit.unitName} has been deleted and cannot be used in vouchers.`,
        };
      }

      if (propertyId && unit.propertyId !== propertyId) {
        return {
          valid: false,
          error: `VOUCHER_ACCOUNTING_ERROR: Unit ${unit.unitName} does not belong to the specified property ${unit.property.name}.`,
        };
      }
    }

    return { valid: true };
  }

  /**
   * Validate duplicate reference numbers (cheque/transfer)
   */
  static async validateDuplicateReference(
    type: VoucherType,
    paymentMethod: string,
    referenceNumber: string | undefined,
    voucherId: string | undefined,
    tx?: Prisma.TransactionClient
  ): Promise<{ valid: boolean; error?: string }> {
    const client = tx || prisma;

    // Only validate for bank vouchers with cheque/transfer
    if (!['BPV', 'BRV'].includes(type) || !['Cheque', 'Transfer'].includes(paymentMethod)) {
      return { valid: true };
    }

    if (!referenceNumber) {
      return {
        valid: false,
        error: `VOUCHER_ACCOUNTING_ERROR: Reference number (cheque number/transaction ID) is required for ${paymentMethod} ${type} vouchers.`,
      };
    }

    // Check for duplicate reference numbers in posted/submitted/approved vouchers
    const existing = await client.voucher.findFirst({
      where: {
        type,
        paymentMethod,
        referenceNumber,
        status: { in: ['submitted', 'approved', 'posted'] },
        id: voucherId ? { not: voucherId } : undefined,
      },
      select: {
        id: true,
        voucherNumber: true,
        status: true,
      },
    });

    if (existing) {
      return {
        valid: false,
        error: `VOUCHER_ACCOUNTING_ERROR: Duplicate reference number "${referenceNumber}" already used in voucher ${existing.voucherNumber} (Status: ${existing.status}). Reference numbers must be unique for ${paymentMethod} transactions.`,
      };
    }

    return { valid: true };
  }

  /**
   * Validate invoice allocation for BRV (Bank Receipt Voucher)
   * Supports partial payment allocation against open invoices
   */
  static async validateInvoiceAllocation(
    invoiceAllocations: Array<{ invoiceId: string; amount: number }> | undefined,
    totalAmount: number,
    tx?: Prisma.TransactionClient
  ): Promise<{ valid: boolean; error?: string; allocatedTotal?: number }> {
    const client = tx || prisma;

    if (!invoiceAllocations || invoiceAllocations.length === 0) {
      return { valid: true }; // Invoice allocation is optional
    }

    let allocatedTotal = 0;

    for (const allocation of invoiceAllocations) {
      if (!allocation.invoiceId || !allocation.amount || allocation.amount <= 0) {
        return {
          valid: false,
          error: `VOUCHER_ACCOUNTING_ERROR: Invalid invoice allocation. Each allocation must have invoiceId and positive amount.`,
        };
      }

      // Validate invoice exists and is open
      const invoice = await client.invoice.findUnique({
        where: { id: allocation.invoiceId },
        select: {
          id: true,
          invoiceNumber: true,
          totalAmount: true,
          remainingAmount: true,
          status: true,
        },
      });

      if (!invoice) {
        return {
          valid: false,
          error: `VOUCHER_ACCOUNTING_ERROR: Invoice not found: ${allocation.invoiceId}`,
        };
      }

      if (invoice.status === 'paid') {
        return {
          valid: false,
          error: `VOUCHER_ACCOUNTING_ERROR: Invoice ${invoice.invoiceNumber} is already fully paid. Cannot allocate payment to paid invoice.`,
        };
      }

      // Validate allocation amount doesn't exceed remaining balance
      if (allocation.amount > invoice.remainingAmount) {
        return {
          valid: false,
          error: `VOUCHER_ACCOUNTING_ERROR: Allocation amount (${allocation.amount.toFixed(2)}) exceeds remaining balance (${invoice.remainingAmount.toFixed(2)}) for invoice ${invoice.invoiceNumber}.`,
        };
      }

      allocatedTotal += allocation.amount;
    }

    // Validate total allocation doesn't exceed voucher amount
    if (allocatedTotal > totalAmount) {
      return {
        valid: false,
        error: `VOUCHER_ACCOUNTING_ERROR: Total invoice allocation (${allocatedTotal.toFixed(2)}) exceeds voucher amount (${totalAmount.toFixed(2)}).`,
        allocatedTotal,
      };
    }

    return { valid: true, allocatedTotal };
  }

  /**
   * Validate lines, one-sided entries, and totals (global rule)
   * - Each line must have exactly one side > 0 (debit or credit, not both)
   * - No zero lines
   * - Total debit must equal total credit and be > 0
   * - JV requires minimum 2 lines
   */
  static validateLinesAndTotals(
    type: VoucherType,
    lines: Array<{ debit: number; credit: number }>
  ): { valid: boolean; error?: string; totalDebit?: number; totalCredit?: number } {
    if (!lines || lines.length === 0) {
      return { valid: false, error: 'VOUCHER_ACCOUNTING_ERROR: Voucher must have at least one line item.' };
    }

    if (type === 'JV' && lines.length < 2) {
      return { valid: false, error: 'VOUCHER_ACCOUNTING_ERROR: Journal Voucher must have at least 2 line items.' };
    }

    let totalDebit = 0;
    let totalCredit = 0;

    for (const line of lines) {
      const debit = Number(line.debit || 0);
      const credit = Number(line.credit || 0);

      if (debit > 0 && credit > 0) {
        return { valid: false, error: 'VOUCHER_ACCOUNTING_ERROR: Each line must be one-sided. Debit and Credit cannot both be greater than zero.' };
      }

      if (debit <= 0 && credit <= 0) {
        return { valid: false, error: 'VOUCHER_ACCOUNTING_ERROR: Zero-value lines are not allowed. Each line must have either Debit > 0 or Credit > 0.' };
      }

      totalDebit += debit;
      totalCredit += credit;
    }

    // ENFORCE: Totals must balance and be > 0
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return { valid: false, error: `VOUCHER_ACCOUNTING_ERROR: Double-entry validation failed. Total Debit (${totalDebit.toFixed(2)}) must equal Total Credit (${totalCredit.toFixed(2)}).` };
    }

    if (totalDebit <= 0 || totalCredit <= 0) {
      return { valid: false, error: 'VOUCHER_ACCOUNTING_ERROR: Zero-value vouchers are forbidden. Totals must be greater than zero.' };
    }

    return { valid: true, totalDebit, totalCredit };
  }

  /**
   * Validate journal voucher cash/bank account usage requires elevated approval
   */
  static async validateJournalVoucherCashBank(
    lines: Array<{ accountId: string }>,
    hasElevatedApproval: boolean,
    tx?: Prisma.TransactionClient
  ): Promise<{ valid: boolean; error?: string }> {
    const client = tx || prisma;

    // Check if any line uses cash/bank account
    for (const line of lines) {
      const account = await client.account.findUnique({
        where: { id: line.accountId },
        select: { code: true, name: true },
      });

      if (!account) {
        continue;
      }

      const isCashBank = account.code.startsWith('1111') || account.code.startsWith('1112');

      if (isCashBank && !hasElevatedApproval) {
        return {
          valid: false,
          error: `VOUCHER_ACCOUNTING_ERROR: Journal Voucher cannot use cash/bank accounts (${account.code} - ${account.name}) without elevated approval. Use BPV/BRV/CPV/CRV for cash/bank transactions.`,
        };
      }
    }

    return { valid: true };
  }
}
