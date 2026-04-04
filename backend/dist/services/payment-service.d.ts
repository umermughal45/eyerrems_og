/**
 * PaymentService - Business logic for Payment processing
 * Implements atomic transactions, double-entry bookkeeping, and refunds
 */
export interface CreatePaymentPayload {
    dealId: string;
    amount: number;
    paymentType: 'token' | 'booking' | 'installment' | 'partial' | 'full' | 'refund';
    paymentMode: 'cash' | 'bank' | 'online_transfer' | 'card';
    transactionId?: string;
    referenceNumber?: string;
    date?: Date;
    remarks?: string;
    paymentId?: string;
    createdBy: string;
    installmentId?: string;
    bankName?: string;
    chequeNumber?: string;
    clearingStatus?: 'PENDING' | 'CLEARED' | 'BOUNCED';
}
export interface RefundPaymentPayload {
    originalPaymentId: string;
    amount: number;
    reason?: string;
    createdBy: string;
}
export declare class PaymentService {
    /**
     * Generate payment code (deprecated - use generateSystemId('pay') instead)
     * Kept for backward compatibility
     */
    static generatePaymentCode(): string;
    /**
     * Get account IDs for payment mode (for double-entry)
     */
    static getPaymentAccounts(paymentMode: string): Promise<{
        debitAccountId: string;
        creditAccountId: string;
    }>;
    /**
     * Get TRUST debit account for payment mode (token/booking/security deposit)
     * Prioritizes accounts with trustFlag=true or codes starting with 1121
     */
    static getTrustDebitAccount(paymentMode: string): Promise<string>;
    /**
     * Get liability account for client advances (trust/escrow payable)
     */
    static getClientAdvanceLiabilityAccount(): Promise<string>;
    /**
     * Create payment with atomic transaction and double-entry bookkeeping
     */
    static createPayment(payload: CreatePaymentPayload): Promise<any>;
    /**
     * Create refund payment (reverses original payment)
     */
    static refundPayment(payload: RefundPaymentPayload): Promise<any>;
    /**
     * Update payment and sync payment plan
     */
    static updatePayment(paymentId: string, updates: {
        amount?: number;
        paymentType?: string;
        paymentMode?: string;
        transactionId?: string;
        referenceNumber?: string;
        date?: Date;
        remarks?: string;
        installmentId?: string;
    }): Promise<any>;
    /**
     * Soft delete payment (creates reversal entries and moves to recycle bin)
     */
    static deletePayment(paymentId: string, userId: string, userName?: string): Promise<void>;
}
//# sourceMappingURL=payment-service.d.ts.map