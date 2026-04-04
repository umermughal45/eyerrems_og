/**
 * Auto-Sync Workflow Services
 * Handles all automatic synchronization between modules
 */
/**
 * Auto-generate monthly invoices for active tenancies
 */
export declare function generateMonthlyInvoices(): Promise<{
    status: string;
    id: string;
    createdAt: Date;
    updatedAt: Date;
    attachments: import("@prisma/client/runtime/library").JsonValue | null;
    tid: string | null;
    amount: number;
    journalEntryId: string | null;
    invoiceNumber: string;
    dueDate: Date;
    tenantId: string | null;
    propertyId: string | null;
    billingDate: Date;
    taxPercent: number;
    taxAmount: number;
    discountAmount: number;
    totalAmount: number;
    remainingAmount: number;
    lateFeeRule: string;
    termsAndConditions: string | null;
    tenantAccountId: string | null;
    incomeAccountId: string | null;
    createdByUserId: string | null;
}[]>;
/**
 * Sync invoice to Finance Ledger (Income)
 * Note: FinanceLedger now requires a dealId. Invoices don't have Deals, so this is disabled.
 * Finance entries for invoices should be created through Deal relationships if needed.
 */
export declare function syncInvoiceToFinanceLedger(invoiceId: string): Promise<{
    id: string;
    createdAt: Date;
    updatedAt: Date;
    createdBy: string | null;
    isDeleted: boolean;
    dealId: string | null;
    amount: number;
    date: Date;
    notes: string | null;
    tenantId: string | null;
    propertyId: string | null;
    description: string | null;
    paymentId: string | null;
    payrollId: string | null;
    category: string;
    invoiceId: string | null;
    referenceType: string;
    referenceId: string | null;
} | null>;
/**
 * Sync payment to Finance Ledger (Income - Received)
 * Note: FinanceLedger now requires a dealId. TenantPayments don't have Deals, so this is disabled.
 * Finance entries for payments should be created through Deal relationships if needed.
 */
export declare function syncPaymentToFinanceLedger(paymentId: string): Promise<{
    id: string;
    createdAt: Date;
    updatedAt: Date;
    createdBy: string | null;
    isDeleted: boolean;
    dealId: string | null;
    amount: number;
    date: Date;
    notes: string | null;
    tenantId: string | null;
    propertyId: string | null;
    description: string | null;
    paymentId: string | null;
    payrollId: string | null;
    category: string;
    invoiceId: string | null;
    referenceType: string;
    referenceId: string | null;
} | null>;
/**
 * Sync property expense to Finance Ledger (Expense)
 * Note: FinanceLedger now requires a dealId. PropertyExpenses don't have Deals, so this is disabled.
 * Finance entries for property expenses should be created through Deal relationships if needed.
 */
export declare function syncPropertyExpenseToFinanceLedger(expenseId: string): Promise<{
    id: string;
    createdAt: Date;
    updatedAt: Date;
    createdBy: string | null;
    isDeleted: boolean;
    dealId: string | null;
    amount: number;
    date: Date;
    notes: string | null;
    tenantId: string | null;
    propertyId: string | null;
    description: string | null;
    paymentId: string | null;
    payrollId: string | null;
    category: string;
    invoiceId: string | null;
    referenceType: string;
    referenceId: string | null;
} | null>;
/**
 * Sync maintenance request to Finance Ledger (Expense)
 * Note: FinanceLedger now requires a dealId. MaintenanceRequests don't have Deals, so this is disabled.
 * Finance entries for maintenance should be created through Deal relationships if needed.
 */
export declare function syncMaintenanceToFinanceLedger(maintenanceId: string): Promise<{
    id: string;
    createdAt: Date;
    updatedAt: Date;
    createdBy: string | null;
    isDeleted: boolean;
    dealId: string | null;
    amount: number;
    date: Date;
    notes: string | null;
    tenantId: string | null;
    propertyId: string | null;
    description: string | null;
    paymentId: string | null;
    payrollId: string | null;
    category: string;
    invoiceId: string | null;
    referenceType: string;
    referenceId: string | null;
} | null>;
/**
 * Sync commission payment to Finance Ledger (Expense)
 */
export declare function syncCommissionToFinanceLedger(commissionId: string): Promise<{
    id: string;
    createdAt: Date;
    updatedAt: Date;
    createdBy: string | null;
    isDeleted: boolean;
    dealId: string | null;
    amount: number;
    date: Date;
    notes: string | null;
    tenantId: string | null;
    propertyId: string | null;
    description: string | null;
    paymentId: string | null;
    payrollId: string | null;
    category: string;
    invoiceId: string | null;
    referenceType: string;
    referenceId: string | null;
} | null>;
/**
 * Sync deal payment to Finance Ledger (Income)
 */
export declare function syncDealToFinanceLedger(dealId: string): Promise<{
    id: string;
    createdAt: Date;
    updatedAt: Date;
    createdBy: string | null;
    isDeleted: boolean;
    dealId: string | null;
    amount: number;
    date: Date;
    notes: string | null;
    tenantId: string | null;
    propertyId: string | null;
    description: string | null;
    paymentId: string | null;
    payrollId: string | null;
    category: string;
    invoiceId: string | null;
    referenceType: string;
    referenceId: string | null;
} | null>;
/**
 * Sync payroll salary to Finance Ledger (Expense)
 * Note: FinanceLedger now requires a dealId. Payroll doesn't have Deals, so this is disabled.
 * Finance entries for payroll should be created through Deal relationships if needed.
 */
export declare function syncPayrollToFinanceLedger(payrollId: string): Promise<null>;
/**
 * Update tenant ledger entry
 */
export declare function updateTenantLedger(tenantId: string, entry: {
    entryType: 'debit' | 'credit';
    description: string;
    amount: number;
    referenceId?: string;
    referenceType?: string;
}): Promise<{
    id: string;
    createdAt: Date;
    updatedAt: Date;
    createdBy: string | null;
    isDeleted: boolean;
    amount: number;
    tenantId: string;
    description: string;
    referenceType: string | null;
    referenceId: string | null;
    entryType: string;
    balance: number;
    ledgerNumber: string | null;
    entryDate: Date;
}>;
/**
 * Auto-sync: Update dashboard KPIs when unit status changes
 */
export declare function updateDashboardKPIs(propertyId: string): Promise<{
    propertyId: string;
    totalUnits: number;
    occupiedUnits: number;
    occupancyRate: number;
    monthlyRevenue: number;
    floorMetrics: {
        floorId: string;
        floorName: string;
        floorNumber: number | null;
        totalUnits: number;
        occupiedUnits: number;
        revenue: number;
    }[];
} | null>;
/**
 * Auto-create tenancy when tenant is assigned to property
 */
export declare function createTenancyFromLease(leaseId: string): Promise<{
    status: string;
    id: string;
    createdAt: Date;
    updatedAt: Date;
    isDeleted: boolean;
    tenantId: string;
    propertyId: string;
    leaseStart: Date;
    leaseEnd: Date;
    monthlyRent: number;
    leaseId: string | null;
    nextInvoiceDate: Date | null;
} | null>;
/**
 * Update property status when maintenance is filed
 */
export declare function updatePropertyStatusOnMaintenance(maintenanceId: string): Promise<void>;
//# sourceMappingURL=workflows.d.ts.map