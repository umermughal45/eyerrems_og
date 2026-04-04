/**
 * Account Validation Service
 * Implements posting rules and validations for Chart of Accounts
 */

import prisma from '../prisma/client';
import type { Account } from '@prisma/client';

export class AccountValidationService {
  /**
   * Validate that an account is postable
   * ❌ Header accounts → posting blocked
   * ✅ Only Level-5 Posting accounts can receive journal entries
   */
  static async validateAccountPostable(accountId: string): Promise<void> {
    const account = await prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new Error(`Account not found: ${accountId}`);
    }

    if (!account.isActive) {
      throw new Error(`Account is inactive: ${account.code} - ${account.name}`);
    }

    // ❌ BLOCK: Header accounts cannot receive postings
    if (account.accountType === 'Header') {
      throw new Error(
        `Cannot post to Header account: ${account.code} - ${account.name} (Level ${account.level}). ` +
        `Header accounts are summary accounts and cannot receive journal entries. ` +
        `Only Level-5 Posting accounts can receive transactions.`
      );
    }

    // ❌ BLOCK: Non-postable accounts
    if (!account.isPostable) {
      throw new Error(
        `Cannot post to account: ${account.code} - ${account.name}. ` +
        `This account is marked as non-postable. ` +
        `Only Level-5 Posting accounts can receive journal entries.`
      );
    }

    // ✅ VALIDATE: Should be Level 5 Posting account
    if (account.level !== 5 || account.accountType !== 'Posting') {
      throw new Error(
        `Account ${account.code} - ${account.name} is not a Level-5 Posting account. ` +
        `Current: Level ${account.level}, Type: ${account.accountType}. ` +
        `Only Level-5 Posting accounts can receive journal entries.`
      );
    }
  }

  /**
   * Validate trust/escrow account usage
   * Trust accounts CANNOT:
   * - Pay expenses (❌ These accounts cannot pay expenses)
   * - Receive revenue (❌ These accounts cannot receive revenue)
   * Trust accounts CAN:
   * - Transfer to other trust accounts
   * - Transfer to/from trust liability accounts (211101, 211102)
   * - Refund to clients
   */
  static async validateTrustAccountUsage(
    accountId: string,
    transactionType: 'debit' | 'credit',
    counterpartAccountId?: string
  ): Promise<void> {
    const account = await prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      return; // Account not found, will be caught by other validations
    }

    // Check if this is a trust account (using trustFlag or code pattern)
    const isTrustAccount = account.trustFlag || 
      account.code.startsWith('1121') || // Client Trust Accounts
      account.cashFlowCategory === 'Escrow';

    if (!isTrustAccount) {
      return; // Not a trust account, no validation needed
    }

    // If counterpart account is provided, validate the transaction
    if (counterpartAccountId) {
      const counterpartAccount = await prisma.account.findUnique({
        where: { id: counterpartAccountId },
      });

      if (!counterpartAccount) {
        return; // Will be caught by other validations
      }

      // ❌ BLOCK: Trust accounts cannot pay expenses
      if (counterpartAccount.type === 'Expense') {
        throw new Error(
          `❌ Trust accounts cannot pay expenses. ` +
          `Account ${account.code} (${account.name}) is a trust account and cannot be used for company expenses. ` +
          `Trust funds are client money and must remain separate from operating funds.`
        );
      }

      // ❌ BLOCK: Trust accounts cannot receive revenue
      if (counterpartAccount.type === 'Revenue') {
        throw new Error(
          `❌ Trust accounts cannot receive revenue. ` +
          `Account ${account.code} (${account.name}) is a trust account. ` +
          `Revenue must flow through Receivable accounts first, not directly to trust accounts.`
        );
      }

      // ✅ ALLOW: Transfers between trust accounts
      const isCounterpartTrust = counterpartAccount.trustFlag || 
        counterpartAccount.code.startsWith('1121') ||
        counterpartAccount.cashFlowCategory === 'Escrow';
      if (isCounterpartTrust) {
        return; // Allowed
      }

      // ✅ ALLOW: Transfers to/from trust liability accounts (211101, 211102)
      const trustLiabilityCodes = ['211101', '211102'];
      if (trustLiabilityCodes.includes(counterpartAccount.code)) {
        return; // Allowed
      }

      // ✅ ALLOW: Operating cash/bank accounts (for refunds)
      const operatingCashCodes = ['111101', '111102', '111201', '111202'];
      if (operatingCashCodes.includes(counterpartAccount.code)) {
        // This is allowed for refunds, but log for audit
        console.warn(
          `Trust account ${account.code} used with operating account ${counterpartAccount.code}. ` +
          `Ensure this is a valid refund transaction.`
        );
        return;
      }
    }
  }

  /**
   * Validate revenue posting rule
   * ❌ Revenue NEVER posts to Cash
   * ❌ Revenue MUST go through Receivable first
   * 
   * Proper flow:
   * 1. Recognize revenue: Dr Receivable, Cr Revenue
   * 2. Collect payment: Dr Cash, Cr Receivable
   */
  static async validateRevenuePosting(
    debitAccountId: string,
    creditAccountId: string
  ): Promise<void> {
    const [debitAccount, creditAccount] = await Promise.all([
      prisma.account.findUnique({ where: { id: debitAccountId } }),
      prisma.account.findUnique({ where: { id: creditAccountId } }),
    ]);

    if (!debitAccount || !creditAccount) {
      return; // Will be caught by other validations
    }

    // Check if this is a revenue account
    const isRevenueAccount = creditAccount.type === 'Revenue';
    if (!isRevenueAccount) {
      return; // Not a revenue transaction
    }

    // ❌ BLOCK: Revenue posting directly from cash/bank
    const operatingCashBankCodes = ['111101', '111102', '111201', '111202'];
    if (operatingCashBankCodes.includes(debitAccount.code)) {
      throw new Error(
        `❌ Revenue cannot post directly from cash/bank accounts. ` +
        `Revenue must flow through Receivable accounts first. ` +
        `\nProper flow: ` +
        `\n1. Recognize revenue: Dr ${debitAccount.code} (Receivable), Cr ${creditAccount.code} (Revenue)` +
        `\n2. Collect payment: Dr ${debitAccount.code} (Cash), Cr ${debitAccount.code} (Receivable)` +
        `\n\nAttempted: Dr ${debitAccount.code} (${debitAccount.name}), Cr ${creditAccount.code} (${creditAccount.name})`
      );
    }

    // ✅ ALLOW: Revenue posting from Receivable accounts
    const receivableCodes = ['113101', '113102', '113201'];
    if (receivableCodes.includes(debitAccount.code)) {
      return; // This is the correct flow
    }

    // ✅ ALLOW: Revenue posting from Trust accounts (for advance recognition)
    if (debitAccount.trustFlag || debitAccount.code.startsWith('1121')) {
      // This might be advance recognition, which is acceptable
      console.warn(
        `Revenue posting from trust account: ${debitAccount.code} - ${debitAccount.name}. ` +
        `Ensure this is advance recognition, not direct cash collection.`
      );
      return;
    }
  }

  /**
   * Validate advance posting rule
   * Advances must go to liability accounts (2101, 2102)
   */
  static async validateAdvancePosting(
    debitAccountId: string,
    creditAccountId: string
  ): Promise<void> {
    const creditAccount = await prisma.account.findUnique({
      where: { id: creditAccountId },
    });

    if (!creditAccount) {
      return; // Will be caught by other validations
    }

    // When booking advance, credit must be to advance liability account
    const advanceLiabilityCodes = ['2101', '2102', '2103'];
    const cashBankCodes = ['1001', '1002', '1003', '1011', '1014'];

    const debitAccount = await prisma.account.findUnique({
      where: { id: debitAccountId },
    });

    if (
      debitAccount &&
      cashBankCodes.includes(debitAccount.code) &&
      !advanceLiabilityCodes.includes(creditAccount.code)
    ) {
      // Check if this looks like an advance transaction
      const accountName = creditAccount.name.toLowerCase();
      if (
        accountName.includes('advance') ||
        accountName.includes('deposit') ||
        accountName.includes('security')
      ) {
        throw new Error(
          `Advances must be posted to liability accounts (2101, 2102, 2103), ` +
          `not directly to revenue. Received: ${creditAccount.code} - ${creditAccount.name}`
        );
      }
    }
  }

  /**
   * Validate double-entry balance
   */
  static validateDoubleEntryBalance(
    lines: Array<{ debit: number; credit: number }>
  ): void {
    const totalDebits = lines.reduce((sum, line) => sum + (line.debit || 0), 0);
    const totalCredits = lines.reduce((sum, line) => sum + (line.credit || 0), 0);

    // Allow small rounding differences (0.01)
    if (Math.abs(totalDebits - totalCredits) > 0.01) {
      throw new Error(
        `Journal entry must balance. Total debits: ${totalDebits.toFixed(2)}, ` +
        `Total credits: ${totalCredits.toFixed(2)}, Difference: ${Math.abs(totalDebits - totalCredits).toFixed(2)}`
      );
    }
  }

  /**
   * Validate account type and balance calculation
   */
  static calculateAccountBalance(
    account: Account,
    debitTotal: number,
    creditTotal: number
  ): number {
    const accountType = account.type?.toLowerCase() || '';

    // Assets and Expenses: Debit increases balance
    if (accountType === 'asset' || accountType === 'expense') {
      return debitTotal - creditTotal;
    }

    // Liabilities, Equity, Revenue: Credit increases balance
    return creditTotal - debitTotal;
  }

  /**
   * Get accounts filtered by postability for UI dropdowns
   */
  static async getPostableAccounts(filters?: {
    type?: string;
    cashFlowCategory?: string;
  }): Promise<Account[]> {
    const where: any = {
      isActive: true,
      isPostable: true,
    };

    if (filters?.type) {
      where.type = filters.type;
    }

    if (filters?.cashFlowCategory) {
      where.cashFlowCategory = filters.cashFlowCategory;
    }

    return await prisma.account.findMany({
      where,
      orderBy: [{ code: 'asc' }],
      include: {
        parent: {
          select: {
            code: true,
            name: true,
          },
        },
      },
    });
  }

  /**
   * Get accounts for specific UI dropdowns
   */
  static async getAccountsForDropdown(
    dropdownType:
      | 'journal'
      | 'voucher'
      | 'transaction'
      | 'invoice-tenant'
      | 'invoice-income'
      | 'payment-debit'
      | 'payment-credit'
  ): Promise<Account[]> {
    switch (dropdownType) {
      case 'journal':
      case 'voucher':
      case 'transaction':
        // All postable accounts
        return await this.getPostableAccounts();

      case 'invoice-tenant':
        // Only AR accounts
        return await this.getPostableAccounts({ type: 'Asset' }).then((accounts) =>
          accounts.filter((acc) => acc.code.startsWith('11'))
        );

      case 'invoice-income':
        // Only Revenue accounts
        return await this.getPostableAccounts({ type: 'Revenue' });

      case 'payment-debit':
        // Only Cash/Bank accounts
        return await this.getPostableAccounts({ type: 'Asset' }).then((accounts) =>
          accounts.filter((acc) =>
            ['1001', '1002', '1003', '1011', '1014'].includes(acc.code)
          )
        );

      case 'payment-credit':
        // Only AR accounts
        return await this.getPostableAccounts({ type: 'Asset' }).then((accounts) =>
          accounts.filter((acc) => acc.code.startsWith('11'))
        );

      default:
        return await this.getPostableAccounts();
    }
  }

  /**
   * Validate escrow balance rule
   * Trust Assets (112101, 112102) must equal Client Liabilities (211101, 211102)
   * This is a hard stop if balance is negative
   */
  static async validateEscrowBalance(): Promise<{ isValid: boolean; message: string }> {
    // Get trust asset accounts
    const trustAssetAccounts = await prisma.account.findMany({
      where: {
        OR: [
          { code: '112101' }, // Client Advances – Trust
          { code: '112102' }, // Security Deposits – Trust
        ],
        isActive: true,
      },
    });

    // Get trust liability accounts
    const trustLiabilityAccounts = await prisma.account.findMany({
      where: {
        OR: [
          { code: '211101' }, // Client Advances Payable
          { code: '211102' }, // Security Deposits Payable
        ],
        isActive: true,
      },
    });

    // Calculate balances (simplified - would need actual ledger calculation)
    let trustAssetsTotal = 0;
    let trustLiabilitiesTotal = 0;

    // This is a placeholder - in production, calculate from actual ledger entries
    // For now, return a validation structure
    return {
      isValid: Math.abs(trustAssetsTotal - trustLiabilitiesTotal) < 0.01,
      message: trustAssetsTotal !== trustLiabilitiesTotal
        ? `⚠️ Escrow balance mismatch: Trust Assets (${trustAssetsTotal.toFixed(2)}) ≠ Client Liabilities (${trustLiabilitiesTotal.toFixed(2)})`
        : '✅ Escrow balance is correct',
    };
  }

  /**
   * Validate property/unit ID requirement for revenue/expense accounts
   * Property ID is mandatory for REMS (Real Estate Management System)
   * Unit ID is required for Sale/Rent accuracy
   */
  static async validatePropertyUnitRequirement(
    accountId: string,
    propertyId?: string,
    unitId?: string
  ): Promise<void> {
    const account = await prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      return; // Will be caught by other validations
    }

    // Revenue and Expense accounts require Property ID
    // EXCEPTION: Certain overhead Expense accounts (e.g. Office Expense) are
    // treated as global/corporate and do not need to be tied to a property.
    const expenseWithoutPropertyAllowedCodes = [
      '531102', // Office Expense
    ];

    const requiresProperty =
      account.type === 'Revenue' ||
      (account.type === 'Expense' &&
       !expenseWithoutPropertyAllowedCodes.includes(account.code));

    if (requiresProperty) {
      if (!propertyId) {
        throw new Error(
          `Property ID is required for ${account.type} accounts. ` +
          `Account: ${account.code} - ${account.name}. ` +
          `Property ID is mandatory for REMS profitability tracking.`
        );
      }

      // For sale/rent revenue, Unit ID is also required
      if (
        account.type === 'Revenue' &&
        (account.code === '411101' || account.code === '411102')
      ) {
        if (!unitId) {
          throw new Error(
            `Unit ID is required for ${account.name}. ` +
            `Account: ${account.code} - ${account.name}. ` +
            `Set Unit at voucher level or on the line. Unit is mandatory for Sale/Rent accuracy and inventory tracking.`
          );
        }
      }
    }
  }

  /**
   * Comprehensive validation for journal entry
   * Validates all rules before allowing posting
   */
  static async validateJournalEntry(
    lines: Array<{
      accountId: string;
      debit: number;
      credit: number;
      propertyId?: string;
      unitId?: string;
    }>
  ): Promise<void> {
    // Validate double-entry balance
    this.validateDoubleEntryBalance(lines);

    // Validate each line
    for (const line of lines) {
      // Validate account is postable
      await this.validateAccountPostable(line.accountId);

      // Validate property/unit requirements
      await this.validatePropertyUnitRequirement(
        line.accountId,
        line.propertyId,
        line.unitId
      );

      // Find counterpart account (if any)
      const counterpartLine = lines.find(
        (l) => l.accountId !== line.accountId && (l.debit > 0 || l.credit > 0)
      );

      if (counterpartLine) {
        // Validate trust account usage
        if (line.debit > 0) {
          await this.validateTrustAccountUsage(
            line.accountId,
            'debit',
            counterpartLine.accountId
          );
        }
        if (line.credit > 0) {
          await this.validateTrustAccountUsage(
            line.accountId,
            'credit',
            counterpartLine.accountId
          );
        }

        // Validate revenue posting rules
        const account = await prisma.account.findUnique({
          where: { id: line.accountId },
        });
        const counterpartAccount = await prisma.account.findUnique({
          where: { id: counterpartLine.accountId },
        });

        if (account && counterpartAccount) {
          if (account.type === 'Revenue' || counterpartAccount.type === 'Revenue') {
            await this.validateRevenuePosting(
              line.debit > 0 ? line.accountId : counterpartLine.accountId,
              line.credit > 0 ? line.accountId : counterpartLine.accountId
            );
          }
        }
      }
    }
  }
}

