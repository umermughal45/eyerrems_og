/**
 * LedgerService - Business logic for Ledger Entry management
 * Handles double-entry bookkeeping and account lookups.
 *
 * AUDIT: General Ledger source of truth = JournalLine (table JournalLine via entry.status='posted').
 * - getCompanyLedger() reads from JournalEntry + JournalLine (posting date = JournalEntry.date).
 * - calculateAccountBalances() derives balances from JournalLine + legacy LedgerEntry.
 * - LedgerEntry is legacy (dealId required); vouchers do not create LedgerEntry rows.
 */
import { Prisma } from '../prisma/client';
export interface CreateLedgerEntryPayload {
    dealId: string;
    paymentId?: string;
    debitAccountId?: string;
    creditAccountId?: string;
    amount: number;
    remarks?: string;
    date: Date;
    userId?: string;
    userName?: string;
}
export declare class LedgerService {
    /**
     * Create a ledger entry (single side of double-entry)
     * For double-entry, call this twice: once for debit, once for credit
     */
    static createLedgerEntry(payload: CreateLedgerEntryPayload, tx?: Prisma.TransactionClient): Promise<any>;
    /**
     * Get account by alias (for migration compatibility)
     */
    static getAccountByAlias(alias: string): Promise<string | null>;
    /**
     * Get client ledger (all credit/debit entries with running balance)
     */
    static getClientLedger(clientId?: string, filters?: {
        propertyId?: string;
        startDate?: Date;
        endDate?: Date;
        period?: 'thisMonth' | 'all';
    }): Promise<any[]>;
    /**
     * Get property ledger (aggregated by property)
     */
    static getPropertyLedger(propertyId?: string): Promise<any[]>;
    /**
     * Get company ledger (all ledger entries with account details)
     * ARCHITECTURAL FIX: Reads from JournalLine (General Ledger) instead of LedgerEntry
     * JournalLine is the source of truth for all posted transactions (vouchers, receipts, invoices, etc.)
     * LedgerEntry is legacy and only contains deal-based entries
     */
    static getCompanyLedger(filters?: {
        startDate?: Date;
        endDate?: Date;
        accountId?: string;
    }): Promise<{
        entries: any[];
        summary: any;
    }>;
    /**
     * Calculate account balances from journal lines (General Ledger)
     * ARCHITECTURAL FIX: Uses JournalLine as source of truth instead of LedgerEntry
     * This ensures all posted transactions (vouchers, receipts, invoices) are included
     */
    static calculateAccountBalances(filters?: {
        startDate?: Date;
        endDate?: Date;
        accountId?: string;
    }): Promise<any>;
}
//# sourceMappingURL=ledger-service.d.ts.map