/**
 * UnifiedLedgerService - Unified ledger service for Client, Dealer, and Property ledgers
 * Implements proper double-entry accounting with running balance calculation
 */
export type LedgerSourceType = 'deal' | 'payment' | 'voucher' | 'refund' | 'transfer' | 'merge' | 'commission' | 'expense' | 'adjustment';
export interface LedgerEntry {
    id: string;
    date: Date;
    referenceNo: string | null;
    description: string;
    debit: number;
    credit: number;
    runningBalance: number;
    sourceType?: LedgerSourceType;
    transactionUuid?: string;
    isLegacy?: boolean;
    status?: string;
}
export interface LedgerResponse {
    entityName: string;
    entityId: string;
    entries: LedgerEntry[];
    summary: {
        totalDebit: number;
        totalCredit: number;
        closingBalance: number;
        openingBalance?: number;
        openingBalanceSource?: 'Derived' | 'Legacy';
        hasLegacyEntries?: boolean;
        dealValue?: number;
        received?: number;
        outstanding?: number;
    };
}
export declare class UnifiedLedgerService {
    /**
     * Get unified ledger for any entity type
     */
    static getLedger(type: 'client' | 'dealer' | 'property', id: string, filters?: {
        startDate?: Date;
        endDate?: Date;
        sourceType?: string;
    }): Promise<LedgerResponse>;
    /**
     * Get Client Ledger - delegates to client-property-ledger-service (accounting-correct, read-only)
     */
    private static getClientLedger;
    /**
     * Get Dealer Ledger with proper double-entry format
     * Priority: LedgerEngineEntry > DealerLedger > Legacy Projection (Commission/Sale/Voucher)
     * Rules:
     * - Commission → Credit (amount owed to dealer)
     * - Payment → Debit (payment reduces payable)
     * - Adjustment → Credit/Debit based on amount sign
     */
    private static getDealerLedger;
    /**
     * Get Property Ledger - delegates to client-property-ledger-service (accounting-correct, read-only)
     */
    private static getPropertyLedger;
}
//# sourceMappingURL=unified-ledger-service.d.ts.map