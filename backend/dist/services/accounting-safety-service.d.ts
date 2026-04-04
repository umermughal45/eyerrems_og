/**
 * Accounting Safety Service
 * Enforces strict accounting rules, lifecycle consistency, and fraud prevention
 * WITHOUT changing existing API contracts or database schemas
 */
export declare class AccountingSafetyService {
    /**
     * Validate invoice creation
     * Enforces: tenant/property, amount > 0, account types, lifecycle consistency
     */
    static validateInvoiceCreation(payload: {
        tenantId?: string | null;
        propertyId?: string | null;
        amount: number;
        totalAmount: number;
        tenantAccountId?: string | null;
        incomeAccountId?: string | null;
        dealId?: string | null;
    }): Promise<void>;
    /**
     * Validate account type for invoice usage
     */
    private static validateAccountTypeForInvoice;
    /**
     * Check if account is Accounts Receivable type
     */
    private static isAccountsReceivableAccount;
    /**
     * Validate payment recording
     * Enforces: deal selection, amount > 0, invoice linkage, account types
     */
    static validatePaymentCreation(payload: {
        dealId: string;
        amount: number;
        paymentMode: string;
        invoiceId?: string | null;
        referenceNumber?: string | null;
        paymentType?: string;
    }): Promise<void>;
    /**
     * Validate transaction creation
     * Enforces: resolves to invoice/payment/advance, blocks direct ledger posting
     */
    static validateTransactionCreation(payload: {
        transactionType: string;
        amount: number;
        debitAccountId?: string | null;
        creditAccountId?: string | null;
        invoiceId?: string | null;
        tenantId?: string | null;
        dealerId?: string | null;
        propertyId?: string | null;
    }): Promise<void>;
    /**
     * Validate account type for transaction usage
     */
    private static validateAccountTypeForTransaction;
    /**
     * Validate deal payment
     * Enforces: deal status, lifecycle consistency
     */
    static validateDealPayment(payload: {
        dealId: string;
        amount: number;
        paymentType?: string;
    }): Promise<void>;
    /**
     * Validate double-entry balance
     * Ensures Total Debit = Total Credit
     */
    static validateDoubleEntryBalance(lines: Array<{
        debit: number;
        credit: number;
    }>): void;
    /**
     * Validate posted record cannot be edited
     */
    static validateRecordNotPosted(recordType: 'invoice' | 'payment' | 'transaction', recordId: string): Promise<void>;
    /**
     * Validate duplicate invoice number
     */
    static validateDuplicateInvoiceNumber(invoiceNumber: string, excludeId?: string): Promise<void>;
    /**
     * Validate duplicate reference (cheque, receipt, etc.)
     */
    static validateDuplicateReference(referenceType: 'cheque' | 'receipt' | 'transaction', referenceNumber: string, context?: {
        paymentMode?: string;
        entityType?: string;
    }): Promise<void>;
}
//# sourceMappingURL=accounting-safety-service.d.ts.map