/**
 * Client & Property Ledger Service
 * Accounting-correct, audit-ready, read-only.
 * Uses Ledger Engine as primary source; derives from deals+payments when empty.
 * No modification of historical data. All balances computed on-the-fly.
 */
export type LedgerSourceType = 'Deal' | 'Payment' | 'Refund' | 'Transfer' | 'Merge' | 'Journal' | 'Adjustment';
export type LedgerEntryStatus = 'Legacy' | 'Derived' | 'Payment' | 'Adjustment';
export interface LedgerEntryRow {
    id: string;
    date: string;
    reference_id: string;
    description: string;
    source_type: LedgerSourceType;
    debit: number;
    credit: number;
    running_balance: number;
    status: LedgerEntryStatus;
}
export interface LedgerSummary {
    dealValue: number;
    received: number;
    outstanding: number;
    aging?: {
        '0_30': number;
        '31_60': number;
        '61_90': number;
        '90_plus': number;
    };
}
export interface LedgerApiResponse {
    entityName: string;
    entityId: string;
    entries: LedgerEntryRow[];
    summary: LedgerSummary;
    openingBalanceRow?: LedgerEntryRow;
}
/**
 * Get Client Ledger - Ledger Engine first, then derive from deals+payments (read-only)
 */
export declare function getClientLedger(clientId: string, filters?: {
    startDate?: Date;
    endDate?: Date;
    sourceType?: string;
}): Promise<LedgerApiResponse>;
/**
 * Get Property Ledger - Ledger Engine first, then derive from deals+payments (read-only)
 */
export declare function getPropertyLedger(propertyId: string, filters?: {
    startDate?: Date;
    endDate?: Date;
    sourceType?: string;
}): Promise<LedgerApiResponse>;
//# sourceMappingURL=client-property-ledger-service.d.ts.map