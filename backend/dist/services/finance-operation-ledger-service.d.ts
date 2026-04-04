/**
 * Finance Operation Ledger Service
 * Additive only. Writes ledger entries for Refund, Transfer, Merge operations.
 * Single source of truth for future finance operations. Does NOT touch existing LedgerEntry.
 */
export type SourceType = 'refund' | 'transfer' | 'merge';
export type EntrySide = 'debit' | 'credit';
export type EntityType = 'Client' | 'Dealer' | 'Property' | 'Deal';
export interface WriteLedgerEntryInput {
    entityType: EntityType;
    entityId: string;
    accountId: string;
    amount: number;
    side: EntrySide;
    sourceType: SourceType;
    operationId: string;
    voucherId?: string;
    paymentId?: string;
    description?: string;
    date?: Date;
}
/**
 * Write double-entry ledger rows for a finance operation.
 * One row per side. Balance = SUM(debit) - SUM(credit) per entity.
 */
export declare function writeFinanceOperationLedger(entries: WriteLedgerEntryInput[], tx?: any): Promise<void>;
/**
 * Get ledger entries for an entity. Balance = SUM(debit) - SUM(credit).
 */
export declare function getEntityLedgerEntries(entityType: EntityType, entityId: string, filters?: {
    startDate?: Date;
    endDate?: Date;
}): Promise<Array<{
    id: string;
    date: Date;
    description: string | null;
    debit: number;
    credit: number;
    sourceType: string;
    operationId: string;
    voucherId: string | null;
}>>;
/**
 * Get closing balance for an entity from finance operation ledger.
 * Balance = SUM(debit) - SUM(credit)
 */
export declare function getEntityBalance(entityType: EntityType, entityId: string, asOfDate?: Date): Promise<number>;
//# sourceMappingURL=finance-operation-ledger-service.d.ts.map