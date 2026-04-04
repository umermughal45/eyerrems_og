/**
 * Legacy Dealer Ledger Projection Service
 * READ-ONLY. Projects legacy commission/rebate/voucher data into ledger-shaped rows.
 * No mutation, no backfill, no recalculation of historical data.
 * Running balance computed at read-time only. Never stored.
 */
export interface LegacyDealerLedgerRow {
    id: string;
    trandate: Date;
    transactionNumber: string;
    memo: string;
    debitAmount: number;
    creditAmount: number;
    runningBalance: number;
    drCrStatus: 'DR' | 'CR';
    sourceType: 'LEGACY_COMMISSION';
    isLegacy: true;
}
export interface LegacyDealerLedgerProjectionResponse {
    hasLedgerEntries: false;
    hasLegacyEntries: boolean;
    openingBalance: number;
    openingBalanceSource: 'LEGACY';
    rows: LegacyDealerLedgerRow[];
}
/**
 * Get legacy dealer ledger projection.
 * READ-ONLY. No mutation. Running balance computed at read-time.
 */
export declare function getLegacyDealerLedgerProjection(dealerId: string, filters?: {
    startDate?: Date;
    endDate?: Date;
}): Promise<LegacyDealerLedgerProjectionResponse | null>;
//# sourceMappingURL=legacy-dealer-ledger-projection-service.d.ts.map