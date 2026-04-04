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
export interface PayrollAccountMappings {
    salaryExpenseAccountId: string;
    salaryPayableAccountId: string;
    cashAccountId?: string;
    bankAccountId?: string;
}
export interface PayrollAccountingContext {
    payrollId: string;
    employeeId: string;
    month: string;
    amount: number;
    userId?: string;
}
export interface PaymentAccountingContext {
    paymentId: string;
    payrollId: string;
    employeeId: string;
    amount: number;
    paymentMethod: string;
    userId?: string;
}
export declare class PayrollAccountingService {
    /**
     * Get system-level payroll account mappings
     * These are configured at system level (admin only)
     * Returns null if mappings not configured (blocks posting)
     */
    static getAccountMappings(): Promise<PayrollAccountMappings | null>;
    /**
     * Post payroll approval to ledger
     * Step 1: DR Salary Expense, CR Salary Payable
     * This creates the liability when payroll is approved/created
     */
    static postPayrollApproval(context: PayrollAccountingContext): Promise<string>;
    /**
     * Post payroll payment to ledger
     * Step 2: DR Salary Payable, CR Cash/Bank
     * This settles the liability when payment is made
     */
    static postPayrollPayment(context: PaymentAccountingContext): Promise<string>;
    /**
     * Validate that payroll can be posted (account mappings exist)
     */
    static validatePayrollPosting(): Promise<{
        valid: boolean;
        error?: string;
    }>;
    /**
     * Validate that payment can be posted
     */
    static validatePaymentPosting(payrollId: string, amount: number): Promise<{
        valid: boolean;
        error?: string;
        remainingBalance?: number;
    }>;
}
//# sourceMappingURL=payroll-accounting-service.d.ts.map