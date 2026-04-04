/**
 * Construction Posting Service
 * Handles all financial postings from Construction module to Finance module
 * Enforces mandatory dimensions and posting rules
 */
export interface ConstructionPostingDimensions {
    projectId: string;
    costCodeId: string;
    sourceModule: 'Construction';
    referenceDocumentId: string;
    referenceDocumentType: string;
    approvalMetadata?: {
        approvedBy: string;
        approvedAt: Date;
        userId: string;
    };
}
export interface PostingRule {
    eventType: string;
    debitAccountCode?: string;
    creditAccountCode?: string;
    description?: string;
}
export declare class ConstructionPostingService {
    /**
     * Get posting rule for an event type
     */
    static getPostingRule(eventType: string): Promise<PostingRule | null>;
    /**
     * Validate mandatory dimensions
     */
    static validateDimensions(dimensions: ConstructionPostingDimensions): void;
    /**
     * Get account by code
     */
    static getAccountByCode(code: string): Promise<string>;
    /**
     * Post Material Issue to Finance
     * DR: WIP/Expense (based on project accounting mode)
     * CR: Inventory
     */
    static postMaterialIssue(issueId: string, dimensions: ConstructionPostingDimensions, amount: number, userId: string): Promise<string>;
    /**
     * Post Labor Approval to Finance
     * DR: WIP/Expense
     * CR: Payroll Accrual
     */
    static postLaborApproval(laborId: string, dimensions: ConstructionPostingDimensions, amount: number, userId: string): Promise<string>;
    /**
     * Post Equipment Usage to Finance
     * DR: WIP/Expense
     * CR: Equipment Recovery (Internal)
     */
    static postEquipmentUsage(usageId: string, dimensions: ConstructionPostingDimensions, amount: number, userId: string): Promise<string>;
    /**
     * Post Subcontractor Invoice to Finance
     * DR: WIP/Expense
     * CR: Accounts Payable
     */
    static postSubcontractorInvoice(invoiceId: string, dimensions: ConstructionPostingDimensions, amount: number, userId: string): Promise<string>;
    /**
     * Post Client Billing (Milestone) to Finance
     * DR: Accounts Receivable
     * CR: Revenue (+ Retention if applicable)
     */
    static postClientBilling(milestoneId: string, dimensions: ConstructionPostingDimensions, billingAmount: number, retentionAmount: number, userId: string): Promise<string>;
    /**
     * Post Project Close (WIP to COGS)
     * DR: Cost of Goods Sold
     * CR: WIP
     */
    static postProjectClose(projectId: string, wipAmount: number, userId: string): Promise<string>;
    /**
     * Generate journal entry number
     */
    private static generateEntryNumber;
    /**
     * Generate voucher number
     */
    private static generateVoucherNumber;
}
//# sourceMappingURL=construction-posting-service.d.ts.map