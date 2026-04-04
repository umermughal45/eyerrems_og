/**
 * Ledger Engine Service
 * Single source of truth for Balance = SUM(debit_amount) - SUM(credit_amount)
 * Additive only. Reads existing data, records new entries. No recalculation or backfill.
 */
export type SourceType = 'payment' | 'voucher' | 'refund' | 'transfer' | 'merge';
export type EntityType = 'client' | 'dealer' | 'property';
export interface WriteLedgerEntryInput {
    transactionUuid: string;
    entryDate: Date;
    accountId: string;
    entityType: EntityType;
    entityId: string;
    debitAmount: number;
    creditAmount: number;
    narration?: string;
    sourceType: SourceType;
    status?: 'posted' | 'reversed';
}
/**
 * Write one ledger entry (one side of double-entry).
 * Balance = SUM(debit_amount) - SUM(credit_amount) per entity.
 */
export declare function writeLedgerEntry(input: WriteLedgerEntryInput, tx?: any): Promise<string>;
/**
 * Get ledger entries for an entity.
 * Prefer ledger_entries when available. No fallback - caller merges with legacy.
 */
export declare function getLedgerEntries(entityType: EntityType, entityId: string, filters?: {
    startDate?: Date;
    endDate?: Date;
    status?: 'posted';
}): Promise<Array<{
    id: string;
    entryDate: Date;
    transactionUuid: string;
    debitAmount: number;
    creditAmount: number;
    narration: string | null;
    sourceType: string;
    status: string;
}>>;
/**
 * Get balance for an entity from Ledger Engine.
 * Balance = SUM(debit_amount) - SUM(credit_amount)
 */
export declare function getEntityBalance(entityType: EntityType, entityId: string, asOfDate?: Date, status?: 'posted'): Promise<number>;
//# sourceMappingURL=ledger-engine-service.d.ts.map