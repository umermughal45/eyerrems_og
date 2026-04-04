export type VoucherType = 'BPV' | 'BRV' | 'CPV' | 'CRV' | 'JV';
export type VoucherStatus = 'draft' | 'submitted' | 'approved' | 'posted' | 'reversed';
export type PayeeType = 'Vendor' | 'Owner' | 'Agent' | 'Contractor' | 'Tenant' | 'Client' | 'Dealer' | 'Employee';
export type PaymentMode = 'Cheque' | 'Transfer' | 'Online' | 'Cash';
export interface VoucherLineInput {
    accountId: string;
    debit: number;
    credit: number;
    description?: string;
    propertyId?: string;
    unitId?: string;
}
export interface InvoiceAllocation {
    invoiceId: string;
    amount: number;
}
export interface CreateVoucherPayload {
    type: VoucherType;
    date: Date;
    paymentMethod: PaymentMode;
    accountId: string;
    description?: string;
    referenceNumber?: string;
    propertyId?: string;
    unitId?: string;
    payeeType?: PayeeType;
    payeeId?: string;
    dealId?: string;
    lines: VoucherLineInput[];
    attachments?: Array<{
        url: string;
        name: string;
        mimeType?: string;
        size?: number;
    }>;
    invoiceAllocations?: InvoiceAllocation[];
    preparedByUserId?: string;
}
export interface UpdateVoucherPayload {
    date?: Date;
    paymentMethod?: PaymentMode;
    accountId?: string;
    description?: string;
    referenceNumber?: string;
    propertyId?: string;
    unitId?: string;
    payeeType?: PayeeType;
    payeeId?: string;
    dealId?: string;
    lines?: VoucherLineInput[];
    attachments?: Array<{
        url: string;
        name: string;
        mimeType?: string;
        size?: number;
    }>;
    invoiceAllocations?: InvoiceAllocation[];
}
export declare class VoucherService {
    /**
     * Check if an account is a bank account
     */
    private static isBankAccount;
    /**
     * Check if an account is a cash account
     */
    private static isCashAccount;
    /**
     * Voucher-type rules are enforced by VoucherValidationEngine (voucher-validation-engine.ts).
     * Do not add voucher-type validation here; use the engine.
     */
    /**
     * Validate reference number uniqueness for cheque/transfer payments
     */
    private static validateReferenceNumber;
    /**
     * Validate attachments are present for bank/cash vouchers
     */
    private static validateAttachments;
    /**
     * Validate property/unit linkage (hardened with mandatory enforcement)
     */
    private static validatePropertyUnitLinkage;
    /**
     * Validate payee entity exists
     */
    private static validatePayeeEntity;
    /**
     * Validate negative balance (prevent unless explicitly allowed)
     */
    private static validateAccountBalance;
    /**
     * Auto-generate system line for bank/cash vouchers
     */
    private static generateSystemLine;
    /**
     * Create a new voucher (draft status)
     * CRITICAL: Backend is source of truth. System lines are auto-generated.
     */
    static createVoucher(payload: CreateVoucherPayload): Promise<any>;
    /**
     * Update a draft voucher
     * CRITICAL: Applies same auto-generation logic as createVoucher
     */
    static updateVoucher(voucherId: string, payload: UpdateVoucherPayload, userId: string): Promise<any>;
    /**
     * Submit voucher (draft -> submitted)
     */
    static submitVoucher(voucherId: string, userId: string): Promise<any>;
    /**
     * Approve voucher (submitted -> approved)
     */
    static approveVoucher(voucherId: string, approvedByUserId: string): Promise<any>;
    /**
     * Post voucher (approved -> posted) - Creates journal entries
     */
    static postVoucher(voucherId: string, postedByUserId: string, postingDate?: Date): Promise<any>;
    /**
     * Reverse a posted voucher
     */
    static reverseVoucher(voucherId: string, reversedByUserId: string, reversalDate: Date): Promise<any>;
    /**
     * Get voucher by ID
     * TASK 4: Returns voucher header fields + all lines (including system lines)
     * Used for both viewing and editing
     */
    static getVoucherById(voucherId: string): Promise<any>;
    /**
     * List vouchers with filters
     */
    static listVouchers(filters: {
        type?: VoucherType;
        status?: VoucherStatus;
        propertyId?: string;
        dateFrom?: Date;
        dateTo?: Date;
        limit?: number;
        offset?: number;
    }): Promise<{
        vouchers: any[];
        total: number;
    }>;
}
//# sourceMappingURL=voucher-service.d.ts.map