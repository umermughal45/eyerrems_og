/**
 * Data Legitimacy Validators
 *
 * Production-grade filters to ensure only finalized, approved, non-draft records
 * are used in AI calculations.
 */
/**
 * Finance module legitimacy filters
 */
export declare const FinanceLegitimacy: {
    /**
     * Filter out draft invoices
     */
    excludeDraftInvoices: (invoice: any) => boolean;
    /**
     * Filter out reversed transactions
     */
    excludeReversedTransactions: (transaction: any) => boolean;
    /**
     * Filter out unapproved expenses (vouchers)
     */
    excludeUnapprovedExpenses: (voucher: any) => boolean;
    /**
     * Filter out unposted journal entries
     */
    excludeUnpostedJournals: (journal: any) => boolean;
};
/**
 * HR module legitimacy filters
 */
export declare const HRLegitimacy: {
    /**
     * Filter out incomplete attendance days
     */
    excludeIncompleteAttendance: (attendance: any) => boolean;
    /**
     * Filter out pending payroll periods
     */
    excludePendingPayroll: (payroll: any) => boolean;
};
/**
 * Construction module legitimacy filters
 */
export declare const ConstructionLegitimacy: {
    /**
     * Filter out projects with missing daily logs
     */
    excludeMissingDailyLogs: (project: any, hasLogs: boolean) => boolean;
    /**
     * Filter out unmapped cost codes
     */
    excludeUnmappedCostCodes: (expense: any) => boolean;
};
/**
 * Properties module legitimacy filters
 */
export declare const PropertiesLegitimacy: {
    /**
     * Filter out draft leases
     */
    excludeDraftLeases: (lease: any) => boolean;
    /**
     * Filter out soft-deleted records
     */
    excludeDeletedRecords: (record: any) => boolean;
};
/**
 * Calculate anomaly percentage in dataset
 */
export declare function calculateAnomalyPercentage(data: number[]): number;
/**
 * Check if time range is consistent (no large gaps)
 */
export declare function isTimeRangeConsistent(records: any[], dateField: string, maxGapDays?: number): {
    consistent: boolean;
    gaps: Array<{
        start: Date;
        end: Date;
        days: number;
    }>;
};
//# sourceMappingURL=data-legitimacy.d.ts.map