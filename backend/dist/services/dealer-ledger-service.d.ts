/**
 * DealerLedgerService - Business logic for Dealer Ledger
 * Tracks dealer commissions, payments, and outstanding balances
 * Uses Legacy Projection when DealerLedger is empty (read-only, additive)
 */
import { Prisma } from '../prisma/client';
export interface CreateDealerLedgerEntryPayload {
    dealerId: string;
    dealId?: string;
    clientId?: string;
    entryType: 'commission' | 'payment' | 'adjustment';
    amount: number;
    description?: string;
    referenceId?: string;
    referenceType?: string;
    date?: Date;
}
export declare class DealerLedgerService {
    /**
     * Get account IDs for dealer ledger operations
     */
    private static getAccounts;
    /**
     * Get current balance for a dealer
     */
    static getDealerBalance(dealerId: string): Promise<number>;
    /**
     * Create a dealer ledger entry
     */
    static createDealerLedgerEntry(payload: CreateDealerLedgerEntryPayload, tx?: Prisma.TransactionClient): Promise<any>;
    /**
     * Internal method to record commission in transaction
     */
    private static recordCommissionPayableInTransaction;
    /**
     * Record commission for a dealer (when deal is closed)
     */
    static recordCommission(dealerId: string, dealId: string, clientId: string, commissionAmount: number, description?: string, tx?: Prisma.TransactionClient): Promise<any>;
    /**
     * Record payment to dealer
     */
    static recordPayment(dealerId: string, amount: number, paymentMode: 'cash' | 'bank', description?: string, referenceId?: string, tx?: Prisma.TransactionClient): Promise<any>;
    /**
     * Get dealer ledger with summary.
     * Uses Legacy Projection (Commission, Sale, Voucher) when DealerLedger is empty.
     */
    static getDealerLedger(dealerId: string, filters?: {
        startDate?: Date;
        endDate?: Date;
        dealId?: string;
    }): Promise<{
        entries: any[];
        summary: {
            totalCommission: number;
            totalPayments: number;
            outstandingBalance: number;
        };
        hasLedgerEntries?: boolean;
        hasLegacyEntries?: boolean;
    }>;
}
//# sourceMappingURL=dealer-ledger-service.d.ts.map