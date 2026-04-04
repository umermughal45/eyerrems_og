/**
 * DealFinanceService - Financial logic for Deal revenue recognition and accounting
 * Handles commission calculation, profit computation, and ledger entry generation
 */
import { Prisma } from '../prisma/client';
export type CommissionType = 'fixed' | 'percentage' | 'none';
export interface CommissionConfig {
    type: CommissionType;
    rate?: number;
    dealerShare?: number;
    companyShare?: number;
}
export interface DealFinancialData {
    dealAmount: number;
    costPrice?: number;
    expenses?: number;
    commissionConfig: CommissionConfig;
    dealerId?: string;
}
export declare class DealFinanceService {
    /**
     * Calculate commission based on type and configuration
     */
    static calculateCommission(dealAmount: number, config: CommissionConfig): {
        totalCommission: number;
        dealerCommission: number;
        companyCommission: number;
    };
    /**
     * Calculate profit from deal
     * Profit = Deal Value - Cost Price - Commission - Expenses
     */
    static calculateProfit(dealAmount: number, costPrice?: number, totalCommission?: number, expenses?: number): number;
    /**
     * Get account IDs for financial operations
     */
    static getFinancialAccounts(): Promise<{
        cashAccountId: string;
        bankAccountId: string;
        arAccountId: string;
        dealRevenueAccountId: string;
        commissionExpenseAccountId: string;
        dealerPayableAccountId: string;
        costOfGoodsSoldAccountId?: string;
    }>;
    /**
     * Recognize revenue when deal is closed
     * Creates proper double-entry ledger entries for:
     * - Revenue recognition
     * - Commission expense
     * - Dealer payable
     * - Cost of goods sold (if applicable)
     */
    static recognizeRevenue(dealId: string, financialData: DealFinancialData, paymentMode?: 'cash' | 'bank' | 'receivable', tx?: Prisma.TransactionClient): Promise<void>;
    /**
     * Reverse revenue recognition (for deal cancellation or correction)
     */
    static reverseRevenueRecognition(dealId: string, tx?: Prisma.TransactionClient): Promise<void>;
    /**
     * Validate commission configuration
     */
    static validateCommissionConfig(config: CommissionConfig): {
        valid: boolean;
        error?: string;
    };
}
//# sourceMappingURL=deal-finance-service.d.ts.map