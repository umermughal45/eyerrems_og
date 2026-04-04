"use strict";
/**
 * Data Legitimacy Validators
 *
 * Production-grade filters to ensure only finalized, approved, non-draft records
 * are used in AI calculations.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PropertiesLegitimacy = exports.ConstructionLegitimacy = exports.HRLegitimacy = exports.FinanceLegitimacy = void 0;
exports.calculateAnomalyPercentage = calculateAnomalyPercentage;
exports.isTimeRangeConsistent = isTimeRangeConsistent;
/**
 * Finance module legitimacy filters
 */
exports.FinanceLegitimacy = {
    /**
     * Filter out draft invoices
     */
    excludeDraftInvoices: (invoice) => {
        // Invoices with status 'draft' or without proper approval
        return invoice.status === 'draft' || !invoice.billingDate;
    },
    /**
     * Filter out reversed transactions
     */
    excludeReversedTransactions: (transaction) => {
        // Transactions that are reversed (check for reversal flag or negative reversal amount)
        return transaction.isReversed === true ||
            transaction.reversalTransactionId !== null ||
            (transaction.transactionType === 'reversal');
    },
    /**
     * Filter out unapproved expenses (vouchers)
     */
    excludeUnapprovedExpenses: (voucher) => {
        // Only posted vouchers are considered legitimate
        return voucher.status !== 'posted';
    },
    /**
     * Filter out unposted journal entries
     */
    excludeUnpostedJournals: (journal) => {
        return !journal.postedAt || journal.isReversed === true;
    },
};
/**
 * HR module legitimacy filters
 */
exports.HRLegitimacy = {
    /**
     * Filter out incomplete attendance days
     */
    excludeIncompleteAttendance: (attendance) => {
        // Attendance must have both checkIn and checkOut, or be marked as absent/leave
        return !attendance.checkIn && !attendance.checkOut &&
            attendance.status !== 'absent' &&
            attendance.status !== 'leave';
    },
    /**
     * Filter out pending payroll periods
     */
    excludePendingPayroll: (payroll) => {
        return payroll.status === 'draft' || payroll.status === 'pending';
    },
};
/**
 * Construction module legitimacy filters
 */
exports.ConstructionLegitimacy = {
    /**
     * Filter out projects with missing daily logs
     */
    excludeMissingDailyLogs: (project, hasLogs) => {
        // If project is active but has no logs in the time period, exclude
        return (project.status === 'in_progress' || project.status === 'active') && !hasLogs;
    },
    /**
     * Filter out unmapped cost codes
     */
    excludeUnmappedCostCodes: (expense) => {
        return !expense.costCodeId || expense.costCodeId === null;
    },
};
/**
 * Properties module legitimacy filters
 */
exports.PropertiesLegitimacy = {
    /**
     * Filter out draft leases
     */
    excludeDraftLeases: (lease) => {
        return lease.status === 'draft' || !lease.leaseStart || !lease.leaseEnd;
    },
    /**
     * Filter out soft-deleted records
     */
    excludeDeletedRecords: (record) => {
        return record.isDeleted === true;
    },
};
/**
 * Calculate anomaly percentage in dataset
 */
function calculateAnomalyPercentage(data) {
    if (data.length < 3)
        return 0;
    // Use IQR method to detect outliers
    const sorted = [...data].sort((a, b) => a - b);
    const q1Index = Math.floor(sorted.length * 0.25);
    const q3Index = Math.floor(sorted.length * 0.75);
    const q1 = sorted[q1Index];
    const q3 = sorted[q3Index];
    const iqr = q3 - q1;
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;
    const outliers = data.filter((v) => v < lowerBound || v > upperBound);
    return (outliers.length / data.length) * 100;
}
/**
 * Check if time range is consistent (no large gaps)
 */
function isTimeRangeConsistent(records, dateField, maxGapDays = 90) {
    if (records.length < 2) {
        return { consistent: true, gaps: [] };
    }
    const sorted = [...records].sort((a, b) => {
        const dateA = new Date(a[dateField]);
        const dateB = new Date(b[dateField]);
        return dateA.getTime() - dateB.getTime();
    });
    const gaps = [];
    for (let i = 1; i < sorted.length; i++) {
        const prevDate = new Date(sorted[i - 1][dateField]);
        const currDate = new Date(sorted[i][dateField]);
        const daysDiff = (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);
        if (daysDiff > maxGapDays) {
            gaps.push({
                start: prevDate,
                end: currDate,
                days: daysDiff,
            });
        }
    }
    return {
        consistent: gaps.length === 0,
        gaps,
    };
}
//# sourceMappingURL=data-legitimacy.js.map