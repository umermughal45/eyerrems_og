/**
 * Financial Reporting Service
 * Generates Trial Balance, Balance Sheet, P&L, Property Profitability, Escrow Report, and Aging Reports
 *
 * Fixed to properly respect COA hierarchy and aggregate parent account balances from children
 */
export interface TrialBalanceEntry {
    accountId: string;
    accountCode: string;
    accountName: string;
    accountType: string;
    normalBalance: string;
    debitTotal: number;
    creditTotal: number;
    balance: number;
    level?: number;
    isParent?: boolean;
}
export interface BalanceSheet {
    assets: {
        current: TrialBalanceEntry[];
        fixed: TrialBalanceEntry[];
        total: number;
    };
    liabilities: {
        current: TrialBalanceEntry[];
        total: number;
    };
    equity: {
        capital: TrialBalanceEntry[];
        retainedEarnings: TrialBalanceEntry[];
        currentYearProfit: TrialBalanceEntry[];
        total: number;
    };
    totalLiabilitiesAndEquity: number;
    isBalanced: boolean;
}
export interface ProfitAndLoss {
    revenue: {
        propertyRevenue: TrialBalanceEntry[];
        serviceIncome: TrialBalanceEntry[];
        total: number;
    };
    expenses: {
        selling: TrialBalanceEntry[];
        property: TrialBalanceEntry[];
        administrative: TrialBalanceEntry[];
        tax: TrialBalanceEntry[];
        total: number;
    };
    netProfit: number;
    period: {
        startDate: Date;
        endDate: Date;
    };
}
export interface PropertyProfitability {
    propertyId: string;
    propertyName: string;
    propertyCode?: string;
    revenue: number;
    expenses: number;
    netProfit: number;
    profitMargin: number;
    revenueBreakdown: Array<{
        accountCode: string;
        accountName: string;
        amount: number;
    }>;
    expenseBreakdown: Array<{
        accountCode: string;
        accountName: string;
        amount: number;
    }>;
}
export interface EscrowReport {
    trustAssets: {
        accountCode: string;
        accountName: string;
        balance: number;
    }[];
    clientLiabilities: {
        accountCode: string;
        accountName: string;
        balance: number;
    }[];
    totalTrustAssets: number;
    totalClientLiabilities: number;
    difference: number;
    isBalanced: boolean;
    violations: string[];
}
export interface AgingEntry {
    accountId: string;
    accountCode: string;
    accountName: string;
    current: number;
    days31_60: number;
    days61_90: number;
    days91_plus: number;
    total: number;
    oldestDate?: Date;
}
export declare class FinancialReportingService {
    /**
     * Calculate account balance from ledger entries
     */
    private static calculateAccountBalance;
    /**
     * Recursively calculate account balance including all child accounts
     * For parent accounts, this aggregates balances from all children
     */
    private static calculateAccountBalanceWithChildren;
    /**
     * Get all descendant accounts (children, grandchildren, etc.) for an account
     */
    private static getAllDescendantAccounts;
    /**
     * Generate Trial Balance
     * Shows all posting accounts with proper hierarchy aggregation
     */
    static generateTrialBalance(startDate?: Date, endDate?: Date): Promise<TrialBalanceEntry[]>;
    /**
     * Generate Balance Sheet
     * Assets = Liabilities + Equity
     * Fixed to use proper account categorization and hierarchy
     */
    static generateBalanceSheet(asOfDate?: Date): Promise<BalanceSheet>;
    /**
     * Generate Profit & Loss Statement
     * Income – Expenses
     * Fixed to use account hierarchy instead of hardcoded codes
     */
    static generateProfitAndLoss(startDate: Date, endDate: Date): Promise<ProfitAndLoss>;
    /**
     * Generate Property Profitability Report
     * Filtered by Property ID
     * Uses both LedgerEntry (via deals) and FinanceLedger (direct property mapping)
     */
    static generatePropertyProfitability(propertyId?: string, startDate?: Date, endDate?: Date): Promise<PropertyProfitability[]>;
    /**
     * Generate Escrow Report
     * Trust Assets = Client Liabilities
     * Fixed to use trustFlag instead of hardcoded account codes
     */
    static generateEscrowReport(): Promise<EscrowReport>;
    /**
     * Generate Aging Report for Receivables/Payables
     * Improved to properly calculate aging buckets and handle account filtering
     */
    static generateAgingReport(type: 'Receivable' | 'Payable', asOfDate?: Date): Promise<AgingEntry[]>;
}
//# sourceMappingURL=financial-reporting-service.d.ts.map