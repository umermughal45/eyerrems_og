export interface UnifiedSearchResult {
    tid: string;
    lead?: any;
    client?: any;
    properties: any[];
    dealers: any[];
    deals: any[];
    payments: any[];
    ledgerEntries: any[];
}
export declare class UnifiedSearchService {
    /**
     * Deep search across the entire business lifecycle using a TID
     */
    static searchByTID(tid: string): Promise<UnifiedSearchResult | null>;
    /**
     * Get unified ledger for an entity (CLIENT, PROPERTY, or DEALER)
     */
    static getLedger(type: 'CLIENT' | 'PROPERTY' | 'DEALER', id: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        dealId: string;
        amount: number;
        date: Date;
        paymentId: string | null;
        remarks: string | null;
        deletedAt: Date | null;
        deletedBy: string | null;
        debitAccountId: string | null;
        creditAccountId: string | null;
        accountDebit: string;
        accountCredit: string;
    }[]>;
}
//# sourceMappingURL=unified-search-service.d.ts.map