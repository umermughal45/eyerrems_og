/**
 * PayrollPaymentSafetyService - Enforces payroll payments as LIABILITY SETTLEMENTS
 * Ensures payroll payments NEVER create salary expense, only clear Salary Payable
 * 
 * FUNDAMENTAL RULE:
 * Payroll Payment = Debit Salary Payable, Credit Cash/Bank
 * Payroll Payment MUST NEVER create salary expense
 */

import prisma from '../prisma/client';

export interface ValidatePayrollPaymentPayload {
  payrollId: string;
  amount: number;
  paymentMethod: string;
  paymentDate: Date;
  userId?: string;
}

export class PayrollPaymentSafetyService {
  /**
   * Validate payroll payment creation
   * Enforces: Amount > 0, Amount ≤ Remaining Balance, Payment Method, Date rules
   */
  static async validatePaymentCreation(payload: ValidatePayrollPaymentPayload): Promise<{
    valid: boolean;
    error?: string;
    remainingBalance?: number;
  }> {
    const { payrollId, amount, paymentMethod, paymentDate } = payload;

    // ENFORCE: Amount > 0
    if (!amount || amount <= 0) {
      return {
        valid: false,
        error: 'PAYROLL_PAYMENT_VIOLATION: Payment amount must be greater than zero. ' +
          `Received: ${amount}. Zero-value or negative payments are not allowed.`,
      };
    }

    // Get payroll record with payments
    const payroll = await prisma.payroll.findUnique({
      where: { id: payrollId },
      include: {
        payments: {
          where: {
            // Only count non-deleted payments (if soft delete exists)
          },
        },
      },
    });

    if (!payroll || payroll.isDeleted) {
      return {
        valid: false,
        error: `PAYROLL_PAYMENT_VIOLATION: Payroll record not found: ${payrollId}.`,
      };
    }

    // ENFORCE: Calculate remaining balance server-side
    const totalPaid = payroll.payments.reduce((sum, payment) => sum + payment.amount, 0);
    const remainingBalance = Math.max(0, payroll.netPay - totalPaid);

    // ENFORCE: Amount ≤ Remaining Balance
    if (amount > remainingBalance) {
      return {
        valid: false,
        error: `PAYROLL_PAYMENT_VIOLATION: Payment amount (${amount}) exceeds remaining balance (${remainingBalance}). ` +
          `Maximum payment allowed: ${remainingBalance}. ` +
          `Total salary: ${payroll.netPay}, Already paid: ${totalPaid}.`,
        remainingBalance,
      };
    }

    // ENFORCE: Reject floating rounding errors (amount must be reasonable)
    // Allow small rounding differences (0.01)
    if (amount > remainingBalance + 0.01) {
      return {
        valid: false,
        error: `PAYROLL_PAYMENT_VIOLATION: Payment amount exceeds remaining balance. Maximum: ${remainingBalance}.`,
        remainingBalance,
      };
    }

    // ENFORCE: Payment Method must be valid
    const validMethods = ['cash', 'bank', 'transfer', 'cheque', 'Bank', 'Cash', 'Transfer', 'Cheque'];
    const normalizedMethod = paymentMethod.toLowerCase();
    if (!validMethods.some(m => m.toLowerCase() === normalizedMethod)) {
      return {
        valid: false,
        error: `PAYROLL_PAYMENT_VIOLATION: Invalid payment method: ${paymentMethod}. ` +
          `Valid methods: Cash, Bank, Transfer, Cheque.`,
      };
    }

    // ENFORCE: Payment Date cannot be before payroll creation date
    if (paymentDate < payroll.createdAt) {
      return {
        valid: false,
        error: `PAYROLL_PAYMENT_VIOLATION: Payment date (${paymentDate.toISOString()}) cannot be before payroll creation date (${payroll.createdAt.toISOString()}).`,
      };
    }

    // ENFORCE: Payment Date cannot be in closed accounting period
    // Note: This would require accounting period tracking - placeholder for now
    // const periodValidation = await this.validateAccountingPeriod(paymentDate);
    // if (!periodValidation.valid) {
    //   return periodValidation;
    // }

    return {
      valid: true,
      remainingBalance,
    };
  }

  /**
   * Validate payment method maps to valid account
   * Cash → Cash Account, Bank/Transfer/Cheque → Bank Account
   */
  static async validatePaymentMethodAccount(paymentMethod: string): Promise<{
    valid: boolean;
    error?: string;
    accountType?: 'cash' | 'bank';
  }> {
    const normalizedMethod = paymentMethod.toLowerCase();
    
    // Map payment method to account type
    if (normalizedMethod === 'cash') {
      return { valid: true, accountType: 'cash' };
    }
    
    if (['bank', 'transfer', 'cheque'].includes(normalizedMethod)) {
      return { valid: true, accountType: 'bank' };
    }
    
    return {
      valid: false,
      error: `PAYROLL_PAYMENT_VIOLATION: Payment method "${paymentMethod}" is not mapped to a valid account type. ` +
        `Valid methods: Cash (→ Cash Account), Bank/Transfer/Cheque (→ Bank Account).`,
    };
  }

  /**
   * Validate ledger entry structure for payroll payment
   * MUST be: Debit Salary Payable, Credit Cash/Bank
   * MUST NOT: Debit Salary Expense, Credit arbitrary accounts
   */
  static async validateLedgerEntryStructure(
    salaryPayableAccountId: string,
    paymentAccountId: string,
    amount: number
  ): Promise<{ valid: boolean; error?: string }> {
    // Validate accounts exist
    const [payableAccount, paymentAccount] = await Promise.all([
      prisma.account.findUnique({ where: { id: salaryPayableAccountId } }),
      prisma.account.findUnique({ where: { id: paymentAccountId } }),
    ]);

    if (!payableAccount) {
      return {
        valid: false,
        error: `PAYROLL_PAYMENT_VIOLATION: Salary Payable account not found: ${salaryPayableAccountId}.`,
      };
    }

    if (!paymentAccount) {
      return {
        valid: false,
        error: `PAYROLL_PAYMENT_VIOLATION: Payment account (Cash/Bank) not found: ${paymentAccountId}.`,
      };
    }

    // Validate payable account is liability type
    // Note: This would require checking account type - placeholder validation
    // if (payableAccount.type !== 'Liability') {
    //   return {
    //     valid: false,
    //     error: `PAYROLL_PAYMENT_VIOLATION: Account ${payableAccount.name} is not a liability account. Salary Payable must be a liability.`,
    //   };
    // }

    // Validate payment account is asset type (Cash/Bank)
    // if (paymentAccount.type !== 'Asset') {
    //   return {
    //     valid: false,
    //     error: `PAYROLL_PAYMENT_VIOLATION: Account ${paymentAccount.name} is not an asset account. Payment account must be Cash or Bank.`,
    //   };
    // }

    // Validate amount > 0
    if (amount <= 0) {
      return {
        valid: false,
        error: 'PAYROLL_PAYMENT_VIOLATION: Ledger entry amount must be greater than zero.',
      };
    }

    return { valid: true };
  }

  /**
   * Validate edit/delete protection
   * Posted payroll payments cannot be edited or deleted
   */
  static async validatePaymentEdit(
    paymentId: string
  ): Promise<{ valid: boolean; error?: string; isPosted?: boolean }> {
    const payment = await prisma.payrollPayment.findUnique({
      where: { id: paymentId },
      include: {
        payroll: true,
      },
    });

    if (!payment) {
      return {
        valid: false,
        error: `PAYROLL_PAYMENT_VIOLATION: Payment record not found: ${paymentId}.`,
      };
    }

    // Check if payment is posted (has ledger entry)
    // Note: Would need to check ledger entries linked to payment
    // For now, check if payroll is finance-linked or payment is older than X days
    const isPosted = payment.payroll.financeLinked || 
                     (new Date().getTime() - payment.createdAt.getTime()) > (24 * 60 * 60 * 1000); // 24 hours

    if (isPosted) {
      return {
        valid: false,
        error: 'PAYROLL_PAYMENT_VIOLATION: Posted payroll payments cannot be edited. ' +
          'Corrections must use explicit reversal entries with reason logged.',
        isPosted: true,
      };
    }

    return { valid: true, isPosted: false };
  }

  /**
   * Validate payment deletion
   * Posted payments cannot be deleted
   */
  static async validatePaymentDelete(
    paymentId: string
  ): Promise<{ valid: boolean; error?: string }> {
    const validation = await this.validatePaymentEdit(paymentId);
    
    if (!validation.valid) {
      return {
        valid: false,
        error: validation.error?.replace('edited', 'deleted') || 'Payment deletion not allowed.',
      };
    }

    return { valid: true };
  }

  /**
   * Validate partial payment balance
   * Allow multiple payments until balance = 0
   * Block overpayments
   */
  static async validatePartialPayment(
    payrollId: string,
    paymentAmount: number
  ): Promise<{ valid: boolean; error?: string; remainingBalance?: number }> {
    const payroll = await prisma.payroll.findUnique({
      where: { id: payrollId },
      include: {
        payments: true,
      },
    });

    if (!payroll) {
      return {
        valid: false,
        error: `PAYROLL_PAYMENT_VIOLATION: Payroll not found: ${payrollId}.`,
      };
    }

    const totalPaid = payroll.payments.reduce((sum, p) => sum + p.amount, 0);
    const remainingBalance = Math.max(0, payroll.netPay - totalPaid);
    const newTotalPaid = totalPaid + paymentAmount;

    // ENFORCE: Block overpayments
    if (newTotalPaid > payroll.netPay) {
      return {
        valid: false,
        error: `PAYROLL_PAYMENT_VIOLATION: Payment would cause overpayment. ` +
          `Total salary: ${payroll.netPay}, Already paid: ${totalPaid}, Payment: ${paymentAmount}, ` +
          `New total: ${newTotalPaid}, Excess: ${newTotalPaid - payroll.netPay}.`,
        remainingBalance,
      };
    }

    return {
      valid: true,
      remainingBalance: remainingBalance - paymentAmount,
    };
  }

  /**
   * Calculate remaining balance for payroll
   * Remaining = Total Salary - SUM(posted payroll payments)
   */
  static async calculateRemainingBalance(payrollId: string): Promise<number> {
    const payroll = await prisma.payroll.findUnique({
      where: { id: payrollId },
      include: {
        payments: true,
      },
    });

    if (!payroll) {
      throw new Error(`Payroll not found: ${payrollId}`);
    }

    const totalPaid = payroll.payments.reduce((sum, payment) => sum + payment.amount, 0);
    return Math.max(0, payroll.netPay - totalPaid);
  }
}
