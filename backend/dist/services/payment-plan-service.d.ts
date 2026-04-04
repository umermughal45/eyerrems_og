/**
 * PaymentPlanService - Business logic for Payment Plans and Installments
 * Handles installment creation, AR ledger entries, and payment tracking
 */
import { Prisma } from '../prisma/client';
export type InstallmentType = 'monthly' | 'quarterly' | 'bi-annual' | 'annual' | 'custom' | 'milestone';
export interface CreatePaymentPlanPayload {
    dealId: string;
    clientId: string;
    numberOfInstallments: number;
    totalAmount: number;
    startDate: Date;
    installmentType?: InstallmentType;
    downPayment?: number;
    installmentAmounts?: number[];
    dueDates?: Date[];
    paymentModes?: string[];
    notes?: string;
}
export interface UpdateInstallmentPayload {
    installmentId?: string;
    amount?: number;
    dueDate?: Date;
    paymentMode?: string;
    notes?: string;
}
export declare class PaymentPlanService {
    /**
     * Generate installments based on installment type
     */
    private static generateInstallments;
    /**
     * Get months per installment based on type
     */
    private static getMonthsPerInstallment;
    /**
     * Get account IDs for financial operations
     */
    private static getAccounts;
    /**
     * Create a payment plan with installments and AR ledger entries
     */
    static createPaymentPlan(payload: CreatePaymentPlanPayload): Promise<any>;
    /**
     * Update an installment (before payment is received)
     */
    static updateInstallment(installmentId: string, payload: UpdateInstallmentPayload): Promise<any>;
    /**
     * Record payment against an installment
     */
    static recordInstallmentPayment(installmentId: string, paymentAmount: number, paymentMode: string, paymentDate: Date, paymentId?: string, tx?: Prisma.TransactionClient): Promise<any>;
    /**
     * Internal method to record payment in transaction
     */
    private static recordInstallmentPaymentInTransaction;
    /**
     * Get payment plan for a deal
     */
    static getPaymentPlanByDealId(dealId: string): Promise<any>;
    /**
     * Get installment summary using utility functions
     */
    static getInstallmentSummary(dealId: string): Promise<any>;
    /**
     * Smart Payment Allocation
     * Automatically allocates payment across installments in order
     */
    static smartAllocatePayment(dealId: string, paymentAmount: number, paymentMode: string, paymentDate: Date, createdBy: string, tx?: Prisma.TransactionClient): Promise<{
        paymentApplied: number;
        excessIgnored: number;
        updatedInstallments: any[];
        summary: {
            totalAmount: number;
            paidAmount: number;
            remainingAmount: number;
            progress: number;
        };
        dealClosed: boolean;
    }>;
    /**
     * Sync payment plan after payment is recorded
     * Updates installments, recalculates totals, and checks completion
     */
    static syncPaymentPlanAfterPayment(dealId: string, paymentAmount: number, installmentId?: string, tx?: Prisma.TransactionClient): Promise<any>;
    /**
     * Recalculate payment plan totals (useful after installment updates)
     */
    static recalculatePaymentPlan(dealId: string, tx?: Prisma.TransactionClient): Promise<any>;
}
//# sourceMappingURL=payment-plan-service.d.ts.map