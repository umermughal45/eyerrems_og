/**
 * PayrollPaymentSafetyService - Enforces payroll payments as LIABILITY SETTLEMENTS
 * Ensures payroll payments NEVER create salary expense, only clear Salary Payable
 *
 * FUNDAMENTAL RULE:
 * Payroll Payment = Debit Salary Payable, Credit Cash/Bank
 * Payroll Payment MUST NEVER create salary expense
 */
export interface ValidatePayrollPaymentPayload {
    payrollId: string;
    amount: number;
    paymentMethod: string;
    paymentDate: Date;
    userId?: string;
}
export declare class PayrollPaymentSafetyService {
    /**
     * Validate payroll payment creation
     * Enforces: Amount > 0, Amount ≤ Remaining Balance, Payment Method, Date rules
     */
    static validatePaymentCreation(payload: ValidatePayrollPaymentPayload): Promise<{
        valid: boolean;
        error?: string;
        remainingBalance?: number;
    }>;
    /**
     * Validate payment method maps to valid account
     * Cash → Cash Account, Bank/Transfer/Cheque → Bank Account
     */
    static validatePaymentMethodAccount(paymentMethod: string): Promise<{
        valid: boolean;
        error?: string;
        accountType?: 'cash' | 'bank';
    }>;
    /**
     * Validate ledger entry structure for payroll payment
     * MUST be: Debit Salary Payable, Credit Cash/Bank
     * MUST NOT: Debit Salary Expense, Credit arbitrary accounts
     */
    static validateLedgerEntryStructure(salaryPayableAccountId: string, paymentAccountId: string, amount: number): Promise<{
        valid: boolean;
        error?: string;
    }>;
    /**
     * Validate edit/delete protection
     * Posted payroll payments cannot be edited or deleted
     */
    static validatePaymentEdit(paymentId: string): Promise<{
        valid: boolean;
        error?: string;
        isPosted?: boolean;
    }>;
    /**
     * Validate payment deletion
     * Posted payments cannot be deleted
     */
    static validatePaymentDelete(paymentId: string): Promise<{
        valid: boolean;
        error?: string;
    }>;
    /**
     * Validate partial payment balance
     * Allow multiple payments until balance = 0
     * Block overpayments
     */
    static validatePartialPayment(payrollId: string, paymentAmount: number): Promise<{
        valid: boolean;
        error?: string;
        remainingBalance?: number;
    }>;
    /**
     * Calculate remaining balance for payroll
     * Remaining = Total Salary - SUM(posted payroll payments)
     */
    static calculateRemainingBalance(payrollId: string): Promise<number>;
}
//# sourceMappingURL=payroll-payment-safety-service.d.ts.map