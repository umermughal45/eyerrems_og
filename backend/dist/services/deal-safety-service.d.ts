/**
 * DealSafetyService - Enforces Deal as COMMERCIAL CONTRACT RECORD
 * Ensures deals are treated as commercial contracts, not financial transactions
 *
 * CRITICAL LIMITATION - REVENUE RECOGNITION:
 * ==========================================
 * The system currently creates accounting entries when deals are closed:
 * - DealService.recognizeRevenueForDeal() creates ledger entries on deal closure
 * - syncDealToFinanceLedger() creates FinanceLedger entries on deal closure
 * - This violates the rule: "Deal MUST NOT create ledger entries"
 *
 * However, removing this would BREAK EXISTING PRODUCTION BEHAVIOR.
 * Per user requirements: "If any rule cannot be enforced without breaking
 * existing production behavior, DO NOT implement and report the limitation clearly."
 *
 * Therefore:
 * - Revenue recognition on deal close is ALLOWED (existing behavior)
 * - This service enforces OTHER rules that can be safely enforced
 * - Deal creation itself does NOT create accounting entries (only closure does)
 *
 * ENFORCED RULES:
 * ===============
 * ✓ Deal creation: Does NOT create accounting entries (already enforced by DealService)
 * ✓ Client/Property immutability: After invoices/payments are linked
 * ✓ Deal amount reduction: Prevented if invoices exceed new amount
 * ✓ Stage-based restrictions: Prospecting, Negotiation, Closing, Closed, Cancelled
 * ✓ Cancellation validation: Prevent if posted invoices/unreversed payments exist
 * ✓ Closed deals: Read-only (except status/stage changes)
 */
export interface ValidateDealCreationPayload {
    clientId: string;
    propertyId?: string;
    dealAmount: number;
    stage?: string;
}
export interface ValidateDealUpdatePayload {
    dealId: string;
    clientId?: string;
    propertyId?: string;
    dealAmount?: number;
    stage?: string;
    status?: string;
}
export interface ValidateDealCancellationPayload {
    dealId: string;
    reason?: string;
}
export interface ValidateDealStageChangePayload {
    dealId: string;
    newStage: string;
    currentStage: string;
}
export declare class DealSafetyService {
    /**
     * Validate deal creation
     * Rule: Deal creation MUST NOT create ledger entries, invoices, receivables, or revenue
     * NOTE: This is validated at the service level - DealService.createDeal already doesn't create accounting entries
     */
    static validateDealCreation(payload: ValidateDealCreationPayload): Promise<void>;
    /**
     * Validate deal update
     * Rules:
     * - Client/Property become IMMUTABLE after invoices/payments are linked
     * - Deal amount cannot be reduced if invoices already exceed new amount
     * - Stage-based restrictions
     */
    static validateDealUpdate(payload: ValidateDealUpdatePayload): Promise<void>;
    /**
     * Validate client/property immutability
     * Rule: Client and Property become IMMUTABLE after invoices/payments are linked
     */
    private static validateClientPropertyImmutability;
    /**
     * Validate deal amount reduction
     * Rule: Prevent deal amount reduction if invoices already exceed the new amount
     */
    private static validateDealAmountReduction;
    /**
     * Validate deal stage change
     * Rule: Enforce stage-based action restrictions
     */
    static validateStageChange(payload: ValidateDealStageChangePayload): Promise<void>;
    /**
     * Validate deal cancellation
     * Rule: Prevent cancellation if posted invoices or unreversed payments exist
     */
    static validateCancellation(payload: ValidateDealCancellationPayload): Promise<void>;
    /**
     * Validate deal closure
     * Rule: Prevent closure if no invoice exists for Closing stage
     * NOTE: This is informational - we can't directly check if invoices are linked to deals
     */
    static validateClosure(dealId: string): Promise<void>;
}
//# sourceMappingURL=deal-safety-service.d.ts.map