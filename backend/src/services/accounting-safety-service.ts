/**
 * Accounting Safety Service
 * Enforces strict accounting rules, lifecycle consistency, and fraud prevention
 * WITHOUT changing existing API contracts or database schemas
 */

import prisma from '../prisma/client';
import { AccountValidationService } from './account-validation-service';
import { Prisma } from '../prisma/client';

export class AccountingSafetyService {
  /**
   * Validate invoice creation
   * Enforces: tenant/property, amount > 0, account types, lifecycle consistency
   */
  static async validateInvoiceCreation(payload: {
    tenantId?: string | null;
    propertyId?: string | null;
    amount: number;
    totalAmount: number;
    tenantAccountId?: string | null;
    incomeAccountId?: string | null;
    dealId?: string | null;
  }): Promise<void> {
    // BLOCK: Tenant/Customer is not selected
    if (!payload.tenantId) {
      throw new Error(
        'ACCOUNTING_VIOLATION: Tenant/Customer is required for invoice creation. ' +
        'Invoices must be linked to a tenant/customer for proper receivable tracking.'
      );
    }

    // BLOCK: Property or Unit is missing (unless explicitly corporate-level)
    // Note: We allow null propertyId for corporate-level invoices, but log a warning
    // For most cases, property should be present
    if (!payload.propertyId) {
      // This is a warning, not a hard block, but log it
      console.warn('ACCOUNTING_WARNING: Invoice created without property. This should be corporate-level only.');
    }

    // BLOCK: Invoice total ≤ 0
    if (!payload.amount || payload.amount <= 0) {
      throw new Error(
        'ACCOUNTING_VIOLATION: Invoice amount must be greater than zero. ' +
        `Received: ${payload.amount}. Zero-value invoices are not allowed.`
      );
    }

    if (!payload.totalAmount || payload.totalAmount <= 0) {
      throw new Error(
        'ACCOUNTING_VIOLATION: Invoice total amount must be greater than zero. ' +
        `Received: ${payload.totalAmount}. Zero-value invoices are not allowed.`
      );
    }

    // BLOCK: Deal is not Approved or Active (if dealId is provided)
    if (payload.dealId) {
      const deal = await prisma.deal.findUnique({
        where: { id: payload.dealId },
        select: { status: true, id: true },
      });

      if (!deal) {
        throw new Error(
          `ACCOUNTING_VIOLATION: Deal not found: ${payload.dealId}. ` +
          'Invoice cannot be created for non-existent deal.'
        );
      }

      if (deal.status !== 'Approved' && deal.status !== 'Active') {
        throw new Error(
          `ACCOUNTING_VIOLATION: Deal must be Approved or Active to create invoice. ` +
          `Current deal status: ${deal.status}. ` +
          'Only approved/active deals can have invoices.'
        );
      }
    }

    // Validate account types if provided
    if (payload.tenantAccountId) {
      await this.validateAccountTypeForInvoice(
        payload.tenantAccountId,
        'debit',
        'Accounts Receivable'
      );
    }

    if (payload.incomeAccountId) {
      await this.validateAccountTypeForInvoice(
        payload.incomeAccountId,
        'credit',
        'Revenue'
      );
    }

    // FORCE: If accounts are provided, ensure they match expected types
    // This enforces the accounting behavior even if accounts are provided
    if (payload.tenantAccountId && payload.incomeAccountId) {
      const tenantAccount = await prisma.account.findUnique({
        where: { id: payload.tenantAccountId },
        select: { type: true, code: true, name: true },
      });

      const incomeAccount = await prisma.account.findUnique({
        where: { id: payload.incomeAccountId },
        select: { type: true, code: true, name: true },
      });

      if (tenantAccount && !this.isAccountsReceivableAccount(tenantAccount)) {
        throw new Error(
          `ACCOUNTING_VIOLATION: Tenant account must be Accounts Receivable type. ` +
          `Received: ${tenantAccount.type} (${tenantAccount.code} - ${tenantAccount.name}). ` +
          'Invoice debit must be Accounts Receivable ONLY.'
        );
      }

      if (incomeAccount && incomeAccount.type !== 'Revenue') {
        throw new Error(
          `ACCOUNTING_VIOLATION: Income account must be Revenue type. ` +
          `Received: ${incomeAccount.type} (${incomeAccount.code} - ${incomeAccount.name}). ` +
          'Invoice credit must be Revenue / Tax Payable ONLY.'
        );
      }
    }
  }

  /**
   * Validate account type for invoice usage
   */
  private static async validateAccountTypeForInvoice(
    accountId: string,
    side: 'debit' | 'credit',
    expectedType: string
  ): Promise<void> {
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      select: { type: true, code: true, name: true, accountType: true },
    });

    if (!account) {
      throw new Error(`Account not found: ${accountId}`);
    }

    // DISALLOW: Direct cash/bank impact in invoices
    const isCashBank = account.code?.startsWith('1111') || account.code?.startsWith('1112') ||
      account.name?.toLowerCase().includes('cash') || account.name?.toLowerCase().includes('bank');

    if (isCashBank) {
      throw new Error(
        `ACCOUNTING_VIOLATION: Cash/Bank accounts cannot be used in invoice creation. ` +
        `Received: ${account.code} - ${account.name}. ` +
        'Invoices recognize receivables and revenue ONLY, not cash/bank movement.'
      );
    }

    // DISALLOW: Asset accounts in invoices (except AR)
    if (side === 'credit' && account.type === 'Asset' && !this.isAccountsReceivableAccount(account)) {
      throw new Error(
        `ACCOUNTING_VIOLATION: Asset accounts (except Accounts Receivable) cannot be credited in invoices. ` +
        `Received: ${account.code} - ${account.name}. ` +
        'Invoice credit must be Revenue / Tax Payable ONLY.'
      );
    }

    // DISALLOW: Equity accounts in operational flows
    if (account.type === 'Equity') {
      throw new Error(
        `ACCOUNTING_VIOLATION: Equity accounts cannot be used in invoice creation. ` +
        `Received: ${account.code} - ${account.name}. ` +
        'Equity accounts are restricted from operational flows.'
      );
    }

    // Validate account is postable
    await AccountValidationService.validateAccountPostable(accountId);
  }

  /**
   * Check if account is Accounts Receivable type
   */
  private static isAccountsReceivableAccount(account: { code?: string | null; type: string; name?: string | null }): boolean {
    if (account.type !== 'Asset') {
      return false;
    }
    
    const code = account.code || '';
    const name = (account.name || '').toLowerCase();
    
    return (
      code.startsWith('1101') ||
      code.startsWith('1102') ||
      code.startsWith('1103') ||
      code.startsWith('1104') ||
      name.includes('receivable') ||
      name.includes('accounts receivable')
    );
  }

  /**
   * Validate payment recording
   * Enforces: deal selection, amount > 0, invoice linkage, account types
   */
  static async validatePaymentCreation(payload: {
    dealId: string;
    amount: number;
    paymentMode: string;
    invoiceId?: string | null;
    referenceNumber?: string | null;
    paymentType?: string;
  }): Promise<void> {
    // BLOCK: Deal is not selected
    if (!payload.dealId) {
      throw new Error(
        'ACCOUNTING_VIOLATION: Deal is required for payment recording. ' +
        'Payments must be linked to a deal for proper lifecycle tracking.'
      );
    }

    // BLOCK: Amount ≤ 0
    if (!payload.amount || payload.amount <= 0) {
      throw new Error(
        'ACCOUNTING_VIOLATION: Payment amount must be greater than zero. ' +
        `Received: ${payload.amount}. Zero-value payments are not allowed.`
      );
    }

    // Validate deal exists and is in valid status
    const deal = await prisma.deal.findUnique({
      where: { id: payload.dealId },
      select: { status: true, id: true, clientId: true },
    });

    if (!deal) {
      throw new Error(
        `ACCOUNTING_VIOLATION: Deal not found: ${payload.dealId}. ` +
        'Payment cannot be recorded for non-existent deal.'
      );
    }

    // Validate invoice linkage if provided
    if (payload.invoiceId) {
      const invoice = await prisma.invoice.findUnique({
        where: { id: payload.invoiceId },
        select: { id: true, totalAmount: true, remainingAmount: true, status: true },
      });

      if (!invoice) {
        throw new Error(
          `ACCOUNTING_VIOLATION: Invoice not found: ${payload.invoiceId}. ` +
          'Payment cannot be linked to non-existent invoice.'
        );
      }

      // BLOCK: Invoice is already fully paid (unless payment type is advance/token)
      const isAdvance = payload.paymentType === 'token' || payload.paymentType === 'booking';
      
      if (!isAdvance && invoice.status === 'paid') {
        throw new Error(
          `ACCOUNTING_VIOLATION: Invoice is already fully paid. ` +
          `Invoice ${payload.invoiceId} has status: ${invoice.status}. ` +
          'Cannot record payment against fully paid invoice (unless advance/token payment).'
        );
      }

      // BLOCK: Payment exceeds outstanding amount (unless advance logic applies)
      if (!isAdvance && invoice.remainingAmount < payload.amount) {
        throw new Error(
          `ACCOUNTING_VIOLATION: Payment amount exceeds outstanding invoice amount. ` +
          `Payment: ${payload.amount}, Outstanding: ${invoice.remainingAmount}. ` +
          'Payment cannot exceed outstanding amount (unless advance/token payment).'
        );
      }
    }

    // BLOCK: Duplicate reference numbers (for cheque/transfer)
    if (payload.referenceNumber && ['bank', 'online_transfer', 'card'].includes(payload.paymentMode)) {
      const existingPayment = await prisma.payment.findFirst({
        where: {
          referenceNumber: payload.referenceNumber,
          paymentMode: payload.paymentMode,
          id: { not: payload.invoiceId || '' }, // Exclude current payment if updating
        },
      });

      if (existingPayment) {
        throw new Error(
          `ACCOUNTING_VIOLATION: Duplicate reference number. ` +
          `Reference "${payload.referenceNumber}" already exists for ${payload.paymentMode} payment. ` +
          'Each cheque/transfer reference must be unique to prevent duplicate recording.'
        );
      }
    }
  }

  /**
   * Validate transaction creation
   * Enforces: resolves to invoice/payment/advance, blocks direct ledger posting
   */
  static async validateTransactionCreation(payload: {
    transactionType: string;
    amount: number;
    debitAccountId?: string | null;
    creditAccountId?: string | null;
    invoiceId?: string | null;
    tenantId?: string | null;
    dealerId?: string | null;
    propertyId?: string | null;
  }): Promise<void> {
    // BLOCK: Amount ≤ 0
    if (!payload.amount || payload.amount <= 0) {
      throw new Error(
        'ACCOUNTING_VIOLATION: Transaction amount must be greater than zero. ' +
        `Received: ${payload.amount}. Zero-value transactions are not allowed.`
      );
    }

    // BLOCK: Direct ledger posting without invoice/payment context
    // Transactions MUST internally resolve to invoice creation OR payment recording OR advance handling
    const hasInvoiceContext = !!payload.invoiceId;
    const hasTenantContext = !!payload.tenantId;
    const hasDealerContext = !!payload.dealerId;
    const hasPropertyContext = !!payload.propertyId;

    // If transaction has accounts but no lifecycle context, block it
    if ((payload.debitAccountId || payload.creditAccountId) && 
        !hasInvoiceContext && 
        !hasTenantContext && 
        !hasDealerContext) {
      throw new Error(
        'ACCOUNTING_VIOLATION: Transaction must resolve to invoice creation, payment recording, or advance handling. ' +
        'Transactions with accounts must be linked to invoice (invoiceId), tenant (tenantId), or dealer (dealerId). ' +
        'Direct ledger posting without lifecycle context is not allowed.'
      );
    }

    // Validate account types if provided
    if (payload.debitAccountId) {
      await this.validateAccountTypeForTransaction(payload.debitAccountId, 'debit', payload.transactionType);
    }

    if (payload.creditAccountId) {
      await this.validateAccountTypeForTransaction(payload.creditAccountId, 'credit', payload.transactionType);
    }

    // BLOCK: Revenue creation without invoice
    if (payload.transactionType === 'income' && !hasInvoiceContext) {
      const creditAccount = payload.creditAccountId 
        ? await prisma.account.findUnique({ where: { id: payload.creditAccountId }, select: { type: true } })
        : null;

      if (creditAccount?.type === 'Revenue' && !hasInvoiceContext) {
        throw new Error(
          'ACCOUNTING_VIOLATION: Revenue cannot be created without invoice. ' +
          'Income transactions with Revenue accounts must be linked to an invoice (invoiceId). ' +
          'Revenue recognition requires invoice creation first (DEAL → INVOICE → PAYMENT → LEDGER).'
        );
      }
    }

    // BLOCK: Cash/bank movement without payment context
    if (payload.debitAccountId || payload.creditAccountId) {
      const debitAccount = payload.debitAccountId
        ? await prisma.account.findUnique({ where: { id: payload.debitAccountId }, select: { code: true, name: true } })
        : null;

      const creditAccount = payload.creditAccountId
        ? await prisma.account.findUnique({ where: { id: payload.creditAccountId }, select: { code: true, name: true } })
        : null;

      const isCashBankDebit = debitAccount && (
        debitAccount.code?.startsWith('1111') || debitAccount.code?.startsWith('1112') ||
        debitAccount.name?.toLowerCase().includes('cash') || debitAccount.name?.toLowerCase().includes('bank')
      );

      const isCashBankCredit = creditAccount && (
        creditAccount.code?.startsWith('1111') || creditAccount.code?.startsWith('1112') ||
        creditAccount.name?.toLowerCase().includes('cash') || creditAccount.name?.toLowerCase().includes('bank')
      );

      if ((isCashBankDebit || isCashBankCredit) && !hasInvoiceContext && !hasTenantContext && !hasDealerContext) {
        throw new Error(
          'ACCOUNTING_VIOLATION: Cash/Bank movement requires payment context. ' +
          'Transactions affecting cash/bank accounts must be linked to invoice (invoiceId), tenant (tenantId), or dealer (dealerId). ' +
          'Use payment recording flow instead of direct transaction creation.'
        );
      }
    }
  }

  /**
   * Validate account type for transaction usage
   */
  private static async validateAccountTypeForTransaction(
    accountId: string,
    side: 'debit' | 'credit',
    transactionType: string
  ): Promise<void> {
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      select: { type: true, code: true, name: true },
    });

    if (!account) {
      throw new Error(`Account not found: ${accountId}`);
    }

    // Validate account is postable
    await AccountValidationService.validateAccountPostable(accountId);

    // Additional validations based on transaction type and side
    // These are additional safety checks beyond what AccountValidationService provides
  }

  /**
   * Validate deal payment
   * Enforces: deal status, lifecycle consistency
   */
  static async validateDealPayment(payload: {
    dealId: string;
    amount: number;
    paymentType?: string;
  }): Promise<void> {
    // BLOCK: Deal is not selected
    if (!payload.dealId) {
      throw new Error(
        'ACCOUNTING_VIOLATION: Deal is required for deal payment. ' +
        'Deal payments must be linked to a deal.'
      );
    }

    // BLOCK: Amount ≤ 0
    if (!payload.amount || payload.amount <= 0) {
      throw new Error(
        'ACCOUNTING_VIOLATION: Deal payment amount must be greater than zero. ' +
        `Received: ${payload.amount}. Zero-value payments are not allowed.`
      );
    }

    // Validate deal exists and status
    const deal = await prisma.deal.findUnique({
      where: { id: payload.dealId },
      select: { status: true, id: true },
    });

    if (!deal) {
      throw new Error(
        `ACCOUNTING_VIOLATION: Deal not found: ${payload.dealId}. ` +
        'Deal payment cannot be recorded for non-existent deal.'
      );
    }

    // ENFORCE: Deal status validation (deals can receive payments in various states)
    // But block payments to closed/cancelled deals
    if (deal.status === 'Closed' || deal.status === 'Cancelled') {
      throw new Error(
        `ACCOUNTING_VIOLATION: Cannot record payment for closed/cancelled deal. ` +
        `Deal status: ${deal.status}. ` +
        'Payments can only be recorded for active deals.'
      );
    }

    // LIFECYCLE ENFORCEMENT: Deals are COMMERCIAL ONLY and must NEVER create ledger entries directly
    // This is enforced in PaymentService - deals create payments, which create ledger entries
    // The validation here ensures the deal exists and is in a valid state
  }

  /**
   * Validate double-entry balance
   * Ensures Total Debit = Total Credit
   */
  static validateDoubleEntryBalance(lines: Array<{ debit: number; credit: number }>): void {
    const totalDebit = lines.reduce((sum, line) => sum + (line.debit || 0), 0);
    const totalCredit = lines.reduce((sum, line) => sum + (line.credit || 0), 0);
    const difference = Math.abs(totalDebit - totalCredit);

    if (difference > 0.01) { // Allow for floating point precision
      throw new Error(
        `ACCOUNTING_VIOLATION: Double-entry imbalance detected. ` +
        `Total Debit: ${totalDebit.toFixed(2)}, Total Credit: ${totalCredit.toFixed(2)}, Difference: ${difference.toFixed(2)}. ` +
        'Total Debit MUST equal Total Credit. All entries must balance before posting.'
      );
    }
  }

  /**
   * Validate posted record cannot be edited
   */
  static async validateRecordNotPosted(
    recordType: 'invoice' | 'payment' | 'transaction',
    recordId: string
  ): Promise<void> {
    let record: any = null;

    switch (recordType) {
      case 'invoice':
        record = await prisma.invoice.findUnique({
          where: { id: recordId },
          select: { journalEntryId: true, status: true },
        });
        if (record?.journalEntryId) {
          throw new Error(
            `ACCOUNTING_VIOLATION: Invoice has been posted (journal entry created). ` +
            `Posted invoices cannot be edited. Use reversal logic instead.`
          );
        }
        break;

      case 'payment':
        record = await prisma.payment.findUnique({
          where: { id: recordId },
          select: { id: true },
        });
        // Check if payment has ledger entries
        const ledgerEntries = await prisma.ledgerEntry.findMany({
          where: { paymentId: recordId },
          select: { id: true },
        });
        if (ledgerEntries.length > 0) {
          throw new Error(
            `ACCOUNTING_VIOLATION: Payment has been posted (ledger entries created). ` +
            `Posted payments cannot be edited. Use reversal logic instead.`
          );
        }
        break;

      case 'transaction':
        record = await prisma.transaction.findUnique({
          where: { id: recordId },
          select: { journalEntryId: true },
        });
        if (record?.journalEntryId) {
          throw new Error(
            `ACCOUNTING_VIOLATION: Transaction has been posted (journal entry created). ` +
            `Posted transactions cannot be edited. Use reversal logic instead.`
          );
        }
        break;
    }
  }

  /**
   * Validate duplicate invoice number
   */
  static async validateDuplicateInvoiceNumber(invoiceNumber: string, excludeId?: string): Promise<void> {
    const existing = await prisma.invoice.findFirst({
      where: {
        invoiceNumber,
        id: excludeId ? { not: excludeId } : undefined,
      },
    });

    if (existing) {
      throw new Error(
        `ACCOUNTING_VIOLATION: Duplicate invoice number. ` +
        `Invoice number "${invoiceNumber}" already exists. ` +
        'Each invoice must have a unique invoice number.'
      );
    }
  }

  /**
   * Validate duplicate reference (cheque, receipt, etc.)
   */
  static async validateDuplicateReference(
    referenceType: 'cheque' | 'receipt' | 'transaction',
    referenceNumber: string,
    context?: { paymentMode?: string; entityType?: string }
  ): Promise<void> {
    // This is a general validation - specific implementations should call this
    // The actual duplicate check depends on the reference type
    if (!referenceNumber) return;

    // For payments, duplicate cheque numbers are blocked
    if (referenceType === 'cheque' && context?.paymentMode === 'bank') {
      const existingPayment = await prisma.payment.findFirst({
        where: {
          referenceNumber,
          paymentMode: 'bank',
        },
      });

      if (existingPayment) {
        throw new Error(
          `ACCOUNTING_VIOLATION: Duplicate cheque number. ` +
          `Cheque number "${referenceNumber}" already exists. ` +
          'Each cheque reference must be unique.'
        );
      }
    }
  }
}
