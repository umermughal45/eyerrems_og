/**
 * Data Legitimacy Validators
 * 
 * Production-grade filters to ensure only finalized, approved, non-draft records
 * are used in AI calculations.
 */

/**
 * Finance module legitimacy filters
 */
export const FinanceLegitimacy = {
  /**
   * Filter out draft invoices
   */
  excludeDraftInvoices: (invoice: any): boolean => {
    // Invoices with status 'draft' or without proper approval
    return invoice.status === 'draft' || !invoice.billingDate;
  },

  /**
   * Filter out reversed transactions
   */
  excludeReversedTransactions: (transaction: any): boolean => {
    // Transactions that are reversed (check for reversal flag or negative reversal amount)
    return transaction.isReversed === true || 
           transaction.reversalTransactionId !== null ||
           (transaction.transactionType === 'reversal');
  },

  /**
   * Filter out unapproved expenses (vouchers)
   */
  excludeUnapprovedExpenses: (voucher: any): boolean => {
    // Only posted vouchers are considered legitimate
    return voucher.status !== 'posted';
  },

  /**
   * Filter out unposted journal entries
   */
  excludeUnpostedJournals: (journal: any): boolean => {
    return !journal.postedAt || journal.isReversed === true;
  },
};

/**
 * HR module legitimacy filters
 */
export const HRLegitimacy = {
  /**
   * Filter out incomplete attendance days
   */
  excludeIncompleteAttendance: (attendance: any): boolean => {
    // Attendance must have both checkIn and checkOut, or be marked as absent/leave
    return !attendance.checkIn && !attendance.checkOut && 
           attendance.status !== 'absent' && 
           attendance.status !== 'leave';
  },

  /**
   * Filter out pending payroll periods
   */
  excludePendingPayroll: (payroll: any): boolean => {
    return payroll.status === 'draft' || payroll.status === 'pending';
  },
};

/**
 * Construction module legitimacy filters
 */
export const ConstructionLegitimacy = {
  /**
   * Filter out projects with missing daily logs
   */
  excludeMissingDailyLogs: (project: any, hasLogs: boolean): boolean => {
    // If project is active but has no logs in the time period, exclude
    return (project.status === 'in_progress' || project.status === 'active') && !hasLogs;
  },

  /**
   * Filter out unmapped cost codes
   */
  excludeUnmappedCostCodes: (expense: any): boolean => {
    return !expense.costCodeId || expense.costCodeId === null;
  },
};

/**
 * Properties module legitimacy filters
 */
export const PropertiesLegitimacy = {
  /**
   * Filter out draft leases
   */
  excludeDraftLeases: (lease: any): boolean => {
    return lease.status === 'draft' || !lease.leaseStart || !lease.leaseEnd;
  },

  /**
   * Filter out soft-deleted records
   */
  excludeDeletedRecords: (record: any): boolean => {
    return record.isDeleted === true;
  },
};

/**
 * Calculate anomaly percentage in dataset
 */
export function calculateAnomalyPercentage(data: number[]): number {
  if (data.length < 3) return 0;

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
export function isTimeRangeConsistent(
  records: any[],
  dateField: string,
  maxGapDays: number = 90
): { consistent: boolean; gaps: Array<{ start: Date; end: Date; days: number }> } {
  if (records.length < 2) {
    return { consistent: true, gaps: [] };
  }

  const sorted = [...records].sort((a, b) => {
    const dateA = new Date(a[dateField]);
    const dateB = new Date(b[dateField]);
    return dateA.getTime() - dateB.getTime();
  });

  const gaps: Array<{ start: Date; end: Date; days: number }> = [];
  
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
