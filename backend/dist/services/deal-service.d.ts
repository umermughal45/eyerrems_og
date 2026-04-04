/**
 * DealService - Business logic for Deal management
 * Implements deal lifecycle, stage transitions, and status computation
 */
import { Prisma } from '../prisma/client';
import { CommissionType } from './deal-finance-service';
export interface CreateDealPayload {
    title: string;
    clientId: string;
    propertyId?: string;
    unitId?: string;
    propertyIds?: string[];
    priceShares?: number[];
    dealerId?: string;
    role?: string;
    dealType?: 'rental' | 'sale' | 'investment';
    dealAmount: number;
    stage?: string;
    status?: string;
    probability?: number;
    commissionType?: CommissionType;
    commissionRate?: number;
    dealerShare?: number;
    companyShare?: number;
    costPrice?: number;
    expenses?: number;
    dealDate?: Date;
    expectedClosingDate?: Date;
    notes?: string;
    createdBy: string;
    tid?: string;
    manualUniqueId?: string;
}
export interface UpdateDealPayload {
    title?: string;
    clientId?: string;
    propertyId?: string;
    unitId?: string;
    dealerId?: string;
    dealAmount?: number;
    stage?: string;
    status?: string;
    probability?: number;
    commissionType?: CommissionType;
    commissionRate?: number;
    dealerShare?: number;
    companyShare?: number;
    costPrice?: number;
    expenses?: number;
    expectedClosingDate?: Date;
    actualClosingDate?: Date;
    notes?: string;
    updatedBy: string;
}
/**
 * Interface for Deal value breakdown structure
 * Contains financial details and commission information
 */
export interface DealValueBreakdown {
    commissionType: CommissionType;
    commissionRate: number;
    dealerShare: number;
    companyShare: number;
    costPrice: number;
    expenses: number;
    profit: number;
    dealerCommission: number;
    companyCommission: number;
}
export declare class DealService {
    /**
     * Generate deterministic deal code
     * Format: dl-YY-#### (uses centralized ID generation service)
     */
    static generateDealCode(): Promise<string>;
    /**
     * Calculate expected revenue
     */
    static calculateExpectedRevenue(dealAmount: number, probability: number): number;
    /**
     * Create a new deal with validation and business rules
     */
    static createDeal(payload: CreateDealPayload): Promise<any>;
    /**
     * Update deal stage and log history
     * Triggers revenue recognition if stage changes to 'closed-won'
     */
    static updateDealStage(dealId: string, newStage: string, userId: string, notes?: string, probability?: number): Promise<any>;
    /**
     * Recompute deal status based on payments and stage
     */
    static recomputeDealStatus(dealId: string, tx?: Prisma.TransactionClient): Promise<string>;
    /**
     * Update deal with financial calculations
     */
    static updateDeal(dealId: string, payload: UpdateDealPayload): Promise<any>;
    /**
     * Recognize revenue for a closed deal
     * Internal helper method
     */
    private static recognizeRevenueForDeal;
    /**
     * Mark property or unit as Sold when deal is closed
     */
    private static markPropertyOrUnitAsSold;
    /**
     * Soft delete deal
     */
    static deleteDeal(dealId: string, userId: string): Promise<void>;
}
//# sourceMappingURL=deal-service.d.ts.map