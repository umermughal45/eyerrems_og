/**
 * Payment Plan Utilities
 * Clean utility functions for payment plan calculations and validations
 * No inline logic - all calculations centralized here
 */
export interface PaymentPlanSummary {
    totalExpected: number;
    totalPaid: number;
    remaining: number;
    paidPercentage: number;
    status: 'Pending' | 'Partially Paid' | 'Fully Paid';
}
export interface InstallmentSummary {
    totalInstallments: number;
    paidInstallments: number;
    unpaidInstallments: number;
    overdueInstallments: number;
    totalAmount: number;
    paidAmount: number;
    remainingAmount: number;
}
/**
 * Calculate payment plan summary from installments
 */
export declare function calculatePaymentPlanSummary(installments: any[]): PaymentPlanSummary;
/**
 * Calculate installment summary
 */
export declare function calculateInstallmentSummary(installments: any[]): InstallmentSummary;
/**
 * Calculate deal completion status based on payments
 */
export declare function calculateDealCompletionStatus(dealAmount: number, totalPaid: number): {
    isCompleted: boolean;
    completionPercentage: number;
    remaining: number;
};
/**
 * Validate payment plan data
 */
export declare function validatePaymentPlan(data: {
    numberOfInstallments: number;
    totalAmount: number;
    installmentAmounts?: number[];
    dueDates?: Date[];
}): {
    valid: boolean;
    error?: string;
};
/**
 * Update installment status based on paid amount
 */
export declare function calculateInstallmentStatus(amount: number, paidAmount: number, dueDate: Date): 'unpaid' | 'paid' | 'overdue' | 'partial';
/**
 * Distribute payment across installments (for partial payments)
 */
export declare function distributePaymentAcrossInstallments(paymentAmount: number, installments: Array<{
    id: string;
    amount: number;
    paidAmount: number;
    status: string;
}>): Array<{
    installmentId: string;
    allocatedAmount: number;
}>;
/**
 * Format currency for display
 */
export declare function formatCurrency(amount: number): string;
/**
 * Format percentage for display
 */
export declare function formatPercentage(value: number): string;
//# sourceMappingURL=payment-plan-utils.d.ts.map