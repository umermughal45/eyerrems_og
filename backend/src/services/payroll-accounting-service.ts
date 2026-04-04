/**
 * PayrollAccountingService - Professional accounting integration for Payroll
 * Implements two-step accounting model:
 * 1. Payroll Approval → Expense Recognition + Liability Creation
 * 2. Payroll Payment → Liability Settlement
 * 
 * CRITICAL RULES:
 * - Salary Expense NEVER debited during payment
 * - Salary Payable NEVER credited during payment
 * - Cash/Bank NEVER touched during payroll approval
 */

import prisma from '../prisma/client';
import { generateSystemId } from '../services/id-generation-service';

export interface PayrollAccountMappings {
  salaryExpenseAccountId: string; // Expense account (DR on approval)
  salaryPayableAccountId: string; // Liability account (CR on approval, DR on payment)
  cashAccountId?: string; // Cash account (CR on payment)
  bankAccountId?: string; // Bank account (CR on payment)
}

export interface PayrollAccountingContext {
  payrollId: string;
  employeeId: string;
  month: string;
  amount: number; // Net pay amount
  userId?: string;
}

export interface PaymentAccountingContext {
  paymentId: string;
  payrollId: string;
  employeeId: string;
  amount: number;
  paymentMethod: string; // 'cash', 'bank', 'transfer', 'cheque'
  userId?: string;
}

export class PayrollAccountingService {
  /**
   * Get system-level payroll account mappings
   * These are configured at system level (admin only)
   * Returns null if mappings not configured (blocks posting)
   */
  static async getAccountMappings(): Promise<PayrollAccountMappings | null> {
    try {
      // For now, we'll use environment variables or database lookup
      // In production, this should be stored in a SystemSettings or Configuration table
      // Using account code lookup as fallback for backward compatibility
      
      // Try to find accounts by standard codes/names
      // Priority: Exact name match > Code pattern > Generic match
      const [salaryExpenseAccount, salaryPayableAccount, cashAccount, bankAccount] = await Promise.all([
        // Salary Expense - typically in 5xxx (Expenses)
        prisma.account.findFirst({
          where: {
            OR: [
              { name: { contains: 'Salary Expense', mode: 'insensitive' } },
              { name: { contains: 'Payroll Expense', mode: 'insensitive' } },
              { name: { contains: 'Salaries', mode: 'insensitive' } },
              { name: { contains: 'Wages Expense', mode: 'insensitive' } },
              { code: { startsWith: '51' } }, // Administrative Expenses
              { code: { startsWith: '5' }, type: 'Expense' },
            ],
            type: 'Expense',
            isActive: true,
            accountType: 'Posting', // Must be posting account
            level: 5, // Level-5 posting account only
          },
          orderBy: { code: 'asc' },
        }),
        // Salary Payable - typically in 2xxx (Liabilities)
        prisma.account.findFirst({
          where: {
            OR: [
              { name: { contains: 'Salary Payable', mode: 'insensitive' } },
              { name: { contains: 'Payroll Payable', mode: 'insensitive' } },
              { name: { contains: 'Wages Payable', mode: 'insensitive' } },
              { name: { contains: 'Employee Payable', mode: 'insensitive' } },
              { code: { startsWith: '21' } }, // Current Liabilities
              { code: { startsWith: '2' }, type: 'Liability' },
            ],
            type: 'Liability',
            isActive: true,
            accountType: 'Posting', // Must be posting account
            level: 5, // Level-5 posting account only
          },
          orderBy: { code: 'asc' },
        }),
        // Cash Account - typically in 1xxx (Assets)
        prisma.account.findFirst({
          where: {
            OR: [
              { code: '1100' }, // Standard cash code
              { name: { contains: 'Petty Cash', mode: 'insensitive' } },
              { name: { contains: 'Cash', mode: 'insensitive' } },
              { code: { startsWith: '11' }, type: 'Asset' },
            ],
            NOT: [
              { name: { contains: 'Bank', mode: 'insensitive' } },
            ],
            type: 'Asset',
            isActive: true,
            accountType: 'Posting', // Must be posting account
            level: 5, // Level-5 posting account only
          },
          orderBy: { code: 'asc' },
        }),
        // Bank Account - typically in 1xxx (Assets)
        prisma.account.findFirst({
          where: {
            OR: [
              { code: '1200' }, // Standard bank code
              { name: { contains: 'Bank', mode: 'insensitive' } },
              { name: { contains: 'Checking', mode: 'insensitive' } },
              { name: { contains: 'Current Account', mode: 'insensitive' } },
              { code: { startsWith: '12' }, type: 'Asset' },
            ],
            type: 'Asset',
            isActive: true,
            accountType: 'Posting', // Must be posting account
            level: 5, // Level-5 posting account only
          },
          orderBy: { code: 'asc' },
        }),
      ]);

      // CRITICAL: Salary Expense and Salary Payable are mandatory
      if (!salaryExpenseAccount || !salaryPayableAccount) {
        return null; // Block posting if required accounts not found
      }

      return {
        salaryExpenseAccountId: salaryExpenseAccount.id,
        salaryPayableAccountId: salaryPayableAccount.id,
        cashAccountId: cashAccount?.id || undefined,
        bankAccountId: bankAccount?.id || undefined,
      };
    } catch (error) {
      console.error('Error fetching payroll account mappings:', error);
      return null;
    }
  }

  /**
   * Post payroll approval to ledger
   * Step 1: DR Salary Expense, CR Salary Payable
   * This creates the liability when payroll is approved/created
   */
  static async postPayrollApproval(context: PayrollAccountingContext): Promise<string> {
    const { payrollId, employeeId, month, amount, userId } = context;

    // Validate amount
    if (!amount || amount <= 0) {
      throw new Error('PAYROLL_ACCOUNTING_ERROR: Payroll amount must be greater than zero');
    }

    // Get account mappings
    const mappings = await this.getAccountMappings();
    if (!mappings) {
      throw new Error(
        'PAYROLL_ACCOUNTING_ERROR: Payroll account mappings not configured. ' +
        'Please configure Salary Expense and Salary Payable accounts in system settings.'
      );
    }

    // Check if already posted
    const existingPayroll = await prisma.payroll.findUnique({
      where: { id: payrollId },
      select: { journalEntryId: true, financeLinked: true },
    });

    if (existingPayroll?.journalEntryId) {
      // Already posted - return existing journal entry ID
      return existingPayroll.journalEntryId;
    }

    // Get employee info for reference
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { name: true, employeeId: true, department: true },
    });

    // Validate accounts exist and are valid types
    const [expenseAccount, payableAccount] = await Promise.all([
      prisma.account.findUnique({ where: { id: mappings.salaryExpenseAccountId } }),
      prisma.account.findUnique({ where: { id: mappings.salaryPayableAccountId } }),
    ]);

    if (!expenseAccount || !expenseAccount.isActive) {
      throw new Error(
        `PAYROLL_ACCOUNTING_ERROR: Salary Expense account not found or inactive: ${mappings.salaryExpenseAccountId}`
      );
    }

    if (!payableAccount || !payableAccount.isActive) {
      throw new Error(
        `PAYROLL_ACCOUNTING_ERROR: Salary Payable account not found or inactive: ${mappings.salaryPayableAccountId}`
      );
    }

    if (expenseAccount.type !== 'Expense') {
      throw new Error(
        `PAYROLL_ACCOUNTING_ERROR: Account ${expenseAccount.name} is not an Expense account. Salary Expense must be an Expense type.`
      );
    }

    if (payableAccount.type !== 'Liability') {
      throw new Error(
        `PAYROLL_ACCOUNTING_ERROR: Account ${payableAccount.name} is not a Liability account. Salary Payable must be a Liability type.`
      );
    }

    // Create journal entry in transaction
    return await prisma.$transaction(async (tx) => {
      // Validate journal entry lines
      const { AccountValidationService } = await import('./account-validation-service');
      const journalLines = [
        { accountId: mappings.salaryExpenseAccountId, debit: amount, credit: 0 },
        { accountId: mappings.salaryPayableAccountId, debit: 0, credit: amount },
      ];

      await AccountValidationService.validateJournalEntry(journalLines);

      // Generate entry number
      const entryNumber = await generateSystemId('je'); // Journal Entry

      // Create journal entry
      const journalEntry = await tx.journalEntry.create({
        data: {
          entryNumber,
          voucherNo: `PAYROLL-${payrollId.slice(0, 8)}`,
          date: new Date(),
          description: `Payroll - ${employee?.name || employeeId} - ${month}`,
          narration: `Salary accrual for ${month}. Employee: ${employee?.name || employeeId} (${employee?.department || 'N/A'})`,
          status: 'posted',
          preparedByUserId: userId || null,
          lines: {
            create: [
              {
                accountId: mappings.salaryExpenseAccountId,
                debit: amount,
                credit: 0,
                description: `Salary Expense - ${employee?.name || employeeId} - ${month}`,
                // Store payroll reference in description (can be extended to use approvalMetadata JSON field if needed)
              },
              {
                accountId: mappings.salaryPayableAccountId,
                debit: 0,
                credit: amount,
                description: `Salary Payable - ${employee?.name || employeeId} - ${month}`,
              },
            ],
          },
        },
        include: {
          lines: true,
        },
      });

      // Update payroll with journal entry ID
      await tx.payroll.update({
        where: { id: payrollId },
        data: {
          journalEntryId: journalEntry.id,
          financeLinked: true,
        },
      });

      return journalEntry.id;
    });
  }

  /**
   * Post payroll payment to ledger
   * Step 2: DR Salary Payable, CR Cash/Bank
   * This settles the liability when payment is made
   */
  static async postPayrollPayment(context: PaymentAccountingContext): Promise<string> {
    const { paymentId, payrollId, employeeId, amount, paymentMethod, userId } = context;

    // Validate amount
    if (!amount || amount <= 0) {
      throw new Error('PAYROLL_ACCOUNTING_ERROR: Payment amount must be greater than zero');
    }

    // Get account mappings
    const mappings = await this.getAccountMappings();
    if (!mappings) {
      throw new Error(
        'PAYROLL_ACCOUNTING_ERROR: Payroll account mappings not configured. ' +
        'Please configure Salary Payable and Cash/Bank accounts in system settings.'
      );
    }

    // Get payroll to check balance and validate
    const payroll = await prisma.payroll.findUnique({
      where: { id: payrollId },
      include: {
        employee: {
          select: { name: true, employeeId: true, department: true },
        },
        payments: {
          include: {
            // Check if this payment already has journal entry
          },
        },
      },
    });

    if (!payroll) {
      throw new Error(`PAYROLL_ACCOUNTING_ERROR: Payroll not found: ${payrollId}`);
    }

    // Validate payroll has been posted (has journal entry)
    if (!payroll.journalEntryId) {
      throw new Error(
        'PAYROLL_ACCOUNTING_ERROR: Payroll must be approved and posted before payment can be recorded. ' +
        'Please ensure payroll has been created and approved first.'
      );
    }

    // Calculate current liability balance
    const totalPaid = payroll.payments.reduce((sum, p) => sum + p.amount, 0);
    const remainingBalance = payroll.netPay - totalPaid;

    // ENFORCE: Payment amount must not exceed remaining balance
    if (amount > remainingBalance) {
      throw new Error(
        `PAYROLL_ACCOUNTING_ERROR: Payment amount (${amount}) exceeds remaining Salary Payable balance (${remainingBalance}). ` +
        `Maximum payment allowed: ${remainingBalance}.`
      );
    }

    // Determine payment account based on payment method
    const normalizedMethod = paymentMethod.toLowerCase();
    let paymentAccountId: string | undefined;

    if (normalizedMethod === 'cash' && mappings.cashAccountId) {
      paymentAccountId = mappings.cashAccountId;
    } else if (
      ['bank', 'transfer', 'cheque', 'bank_transfer', 'online'].includes(normalizedMethod) &&
      mappings.bankAccountId
    ) {
      paymentAccountId = mappings.bankAccountId;
    } else {
      // Fallback: use cash if bank not available, or vice versa
      paymentAccountId = mappings.cashAccountId || mappings.bankAccountId;
    }

    if (!paymentAccountId) {
      throw new Error(
        'PAYROLL_ACCOUNTING_ERROR: Cash or Bank account not configured. ' +
        'Please configure payment accounts in system settings.'
      );
    }

    // Validate payment account
    const paymentAccount = await prisma.account.findUnique({
      where: { id: paymentAccountId },
    });

    if (!paymentAccount || !paymentAccount.isActive) {
      throw new Error(
        `PAYROLL_ACCOUNTING_ERROR: Payment account not found or inactive: ${paymentAccountId}`
      );
    }

    if (paymentAccount.type !== 'Asset') {
      throw new Error(
        `PAYROLL_ACCOUNTING_ERROR: Account ${paymentAccount.name} is not an Asset account. ` +
        `Payment account must be Cash or Bank (Asset type).`
      );
    }

    // Validate salary payable account
    const payableAccount = await prisma.account.findUnique({
      where: { id: mappings.salaryPayableAccountId },
    });

    if (!payableAccount || !payableAccount.isActive) {
      throw new Error(
        `PAYROLL_ACCOUNTING_ERROR: Salary Payable account not found or inactive: ${mappings.salaryPayableAccountId}`
      );
    }

    // Check if payment already has journal entry (prevent duplicate posting)
    const payment = await prisma.payrollPayment.findUnique({
      where: { id: paymentId },
      select: { id: true },
    });

    if (!payment) {
      throw new Error(`PAYROLL_ACCOUNTING_ERROR: Payment not found: ${paymentId}`);
    }

    // Prevent duplicate posting by checking for existing journal entry
    // Check if a journal entry with voucherNo matching this payment already exists
    const voucherNoPattern = `PAYROLL-PAY-${paymentId.slice(0, 8)}`;
    const existingJournalEntry = await prisma.journalEntry.findFirst({
      where: {
        voucherNo: voucherNoPattern,
      },
    });

    if (existingJournalEntry) {
      throw new Error(
        `PAYROLL_ACCOUNTING_ERROR: Payment has already been posted to ledger. ` +
        `Journal Entry: ${existingJournalEntry.entryNumber} (${existingJournalEntry.id}). ` +
        `Duplicate posting is not allowed.`
      );
    }

    // Create journal entry in transaction
    return await prisma.$transaction(async (tx) => {
      // Validate journal entry lines
      const { AccountValidationService } = await import('./account-validation-service');
      const journalLines = [
        { accountId: mappings.salaryPayableAccountId, debit: amount, credit: 0 }, // DR Salary Payable
        { accountId: paymentAccountId, debit: 0, credit: amount }, // CR Cash/Bank
      ];

      // Validate journal entry before creation
      await AccountValidationService.validateJournalEntry(journalLines);

      // Verify double-entry balance (debit = credit)
      const totalDebit = journalLines.reduce((sum, line) => sum + (line.debit || 0), 0);
      const totalCredit = journalLines.reduce((sum, line) => sum + (line.credit || 0), 0);
      if (Math.abs(totalDebit - totalCredit) > 0.01) {
        throw new Error(
          `PAYROLL_ACCOUNTING_ERROR: Double-entry balance mismatch. Debit: ${totalDebit}, Credit: ${totalCredit}`
        );
      }

      // Generate entry number
      const entryNumber = await generateSystemId('je'); // Journal Entry
      const voucherNo = `PAYROLL-PAY-${paymentId.slice(0, 8)}`;

      // Create journal entry
      const journalEntry = await tx.journalEntry.create({
        data: {
          entryNumber,
          voucherNo,
          date: new Date(),
          description: `Payroll Payment - ${payroll.employee?.name || employeeId} - ${payroll.month}`,
          narration: `Salary payment settlement for ${payroll.month}. Employee: ${payroll.employee?.name || employeeId}. Payment method: ${paymentMethod}`,
          status: 'posted',
          preparedByUserId: userId || null,
          lines: {
            create: [
              {
                accountId: mappings.salaryPayableAccountId,
                debit: amount,
                credit: 0,
                description: `Salary Payable Settlement - ${payroll.employee?.name || employeeId} - ${payroll.month}`,
              },
              {
                accountId: paymentAccountId,
                debit: 0,
                credit: amount,
                description: `Cash/Bank Payment - Payroll ${payroll.month} - ${paymentMethod}`,
              },
            ],
          },
        },
        include: {
          lines: true,
        },
      });

      // Verify journal entry was created with correct lines
      if (!journalEntry.lines || journalEntry.lines.length !== 2) {
        throw new Error(
          `PAYROLL_ACCOUNTING_ERROR: Journal entry created with incorrect number of lines. Expected 2, got ${journalEntry.lines?.length || 0}`
        );
      }

      // Verify double-entry balance in created journal entry
      const createdDebit = journalEntry.lines.reduce((sum, line) => sum + (line.debit || 0), 0);
      const createdCredit = journalEntry.lines.reduce((sum, line) => sum + (line.credit || 0), 0);
      if (Math.abs(createdDebit - createdCredit) > 0.01 || Math.abs(createdDebit - amount) > 0.01) {
        throw new Error(
          `PAYROLL_ACCOUNTING_ERROR: Journal entry balance verification failed. Debit: ${createdDebit}, Credit: ${createdCredit}, Expected: ${amount}`
        );
      }

      // Note: If PayrollPayment model had journalEntryId field, we would update it here
      // For backward compatibility, we're not adding it yet
      // Journal entry can be traced via voucherNo and description

      return journalEntry.id;
    });
  }

  /**
   * Validate that payroll can be posted (account mappings exist)
   */
  static async validatePayrollPosting(): Promise<{ valid: boolean; error?: string }> {
    const mappings = await this.getAccountMappings();
    if (!mappings) {
      return {
        valid: false,
        error: 'PAYROLL_ACCOUNTING_ERROR: Payroll account mappings not configured. ' +
          'Please configure Salary Expense and Salary Payable accounts in system settings.',
      };
    }
    return { valid: true };
  }

  /**
   * Validate that payment can be posted
   */
  static async validatePaymentPosting(payrollId: string, amount: number): Promise<{ valid: boolean; error?: string; remainingBalance?: number }> {
    const mappings = await this.getAccountMappings();
    if (!mappings) {
      return {
        valid: false,
        error: 'PAYROLL_ACCOUNTING_ERROR: Payroll account mappings not configured.',
      };
    }

    // Check payroll exists and is posted
    const payroll = await prisma.payroll.findUnique({
      where: { id: payrollId },
      include: {
        payments: true,
      },
    });

    if (!payroll) {
      return {
        valid: false,
        error: `PAYROLL_ACCOUNTING_ERROR: Payroll not found: ${payrollId}`,
      };
    }

    if (!payroll.journalEntryId) {
      return {
        valid: false,
        error: 'PAYROLL_ACCOUNTING_ERROR: Payroll must be approved and posted before payment can be recorded.',
      };
    }

    // Check balance
    const totalPaid = payroll.payments.reduce((sum, p) => sum + p.amount, 0);
    const remainingBalance = payroll.netPay - totalPaid;

    if (amount > remainingBalance) {
      return {
        valid: false,
        error: `PAYROLL_ACCOUNTING_ERROR: Payment amount exceeds remaining balance. Maximum: ${remainingBalance}`,
        remainingBalance,
      };
    }

    // Check payment accounts configured
    if (!mappings.cashAccountId && !mappings.bankAccountId) {
      return {
        valid: false,
        error: 'PAYROLL_ACCOUNTING_ERROR: Cash or Bank account must be configured for payments.',
      };
    }

    return { valid: true, remainingBalance };
  }
}
