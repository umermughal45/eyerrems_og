"use strict";
/**
 * DealService - Business logic for Deal management
 * Implements deal lifecycle, stage transitions, and status computation
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DealService = void 0;
const client_1 = __importDefault(require("../prisma/client"));
const deal_finance_service_1 = require("./deal-finance-service");
const id_service_1 = require("../utils/id-service");
const transactionIdentity_service_1 = require("./transactionIdentity.service");
class DealService {
    /**
     * Generate deterministic deal code
     * Format: dl-YY-#### (uses centralized ID generation service)
     */
    static async generateDealCode() {
        return await id_service_1.IdService.generateEntityId('DEAL');
    }
    /**
     * Calculate expected revenue
     */
    static calculateExpectedRevenue(dealAmount, probability) {
        return (dealAmount * probability) / 100;
    }
    /**
     * Create a new deal with validation and business rules
     */
    static async createDeal(payload) {
        // Validate required fields
        if (!payload.title?.trim()) {
            throw new Error('Deal title is required');
        }
        if (!payload.clientId?.trim()) {
            throw new Error('Client ID is required');
        }
        if (!payload.dealAmount || payload.dealAmount <= 0) {
            throw new Error('Valid deal amount is required');
        }
        if (!payload.createdBy?.trim()) {
            throw new Error('Created by user ID is required');
        }
        // Validate client exists
        const client = await client_1.default.client.findFirst({
            where: { id: payload.clientId, isDeleted: false },
        });
        if (!client) {
            throw new Error('Client not found or inactive');
        }
        // Validate property(ies) exist and capture listing price snapshot
        let listingPriceSnapshot = null;
        if (payload.propertyId) {
            const property = await client_1.default.property.findFirst({
                where: { id: payload.propertyId, isDeleted: false },
            });
            if (!property) {
                throw new Error('Property not found or inactive');
            }
            // Capture listing price snapshot for variance calculation
            listingPriceSnapshot = property.salePrice || null;
        }
        // Validate unit exists (if unit-level deal)
        if (payload.unitId) {
            const unit = await client_1.default.unit.findFirst({
                where: { id: payload.unitId, isDeleted: false },
                include: { property: true },
            });
            if (!unit) {
                throw new Error('Unit not found or inactive');
            }
            // Ensure property matches if both are provided
            if (payload.propertyId && unit.propertyId !== payload.propertyId) {
                throw new Error('Unit does not belong to the specified property');
            }
            // Auto-set propertyId from unit if not provided
            if (!payload.propertyId) {
                payload.propertyId = unit.propertyId;
            }
        }
        if (payload.propertyIds && payload.propertyIds.length > 0) {
            const properties = await client_1.default.property.findMany({
                where: {
                    id: { in: payload.propertyIds },
                    isDeleted: false,
                },
            });
            if (properties.length !== payload.propertyIds.length) {
                throw new Error('One or more properties not found or inactive');
            }
            // Validate price shares sum equals deal amount
            if (payload.priceShares) {
                const totalShare = payload.priceShares.reduce((sum, share) => sum + share, 0);
                if (Math.abs(totalShare - payload.dealAmount) > 0.01) {
                    throw new Error('Sum of price shares must equal deal amount');
                }
            }
        }
        // Check for existing active deal for this property
        if (payload.propertyId) {
            const activeDeal = await client_1.default.deal.findFirst({
                where: {
                    propertyId: payload.propertyId,
                    status: {
                        notIn: ['closed', 'closed-won', 'closed-lost', 'cancelled']
                    },
                    isDeleted: false
                }
            });
            if (activeDeal) {
                throw new Error(`Property already has an active deal (ID: ${activeDeal.dealCode || activeDeal.id})`);
            }
        }
        // Generate deal code
        const dealCode = await this.generateDealCode();
        // TID is immutable and must be inherited from client/lead lineage.
        // Allow explicit payload only when it matches existing client TID.
        const clientTid = client.tid;
        if (!clientTid && !payload.tid) {
            throw new Error('Client TID is missing. Deal creation requires a source TID.');
        }
        if (payload.tid && clientTid && payload.tid !== clientTid) {
            throw new Error('Deal TID must match the linked client TID.');
        }
        const tid = clientTid || payload.tid;
        // Validate dealer is required if commission is specified
        if ((payload.commissionType && payload.commissionType !== 'none') && !payload.dealerId) {
            throw new Error('Dealer is required when commission is specified');
        }
        // Validate and calculate commission
        const commissionType = payload.commissionType || (payload.commissionRate && payload.commissionRate > 0 ? 'percentage' : 'none');
        const commissionConfig = {
            type: commissionType,
            rate: payload.commissionRate || 0,
            dealerShare: payload.dealerShare || 100,
            companyShare: payload.companyShare || 0,
        };
        const validation = deal_finance_service_1.DealFinanceService.validateCommissionConfig(commissionConfig);
        if (!validation.valid) {
            throw new Error(validation.error || 'Invalid commission configuration');
        }
        const commission = deal_finance_service_1.DealFinanceService.calculateCommission(payload.dealAmount, commissionConfig);
        // Calculate variance from listing price
        let varianceAmount = null;
        let varianceType = null;
        if (listingPriceSnapshot !== null && listingPriceSnapshot > 0) {
            varianceAmount = payload.dealAmount - listingPriceSnapshot;
            if (varianceAmount > 0) {
                varianceType = 'GAIN';
            }
            else if (varianceAmount < 0) {
                varianceType = 'LOSS';
            }
            else {
                varianceType = null; // Exact match
            }
        }
        else if (listingPriceSnapshot === null && payload.propertyId) {
            // Property exists but has no listing price - treat as discount if deal amount is positive
            varianceType = 'DISCOUNT';
            varianceAmount = payload.dealAmount; // Full amount is variance since no baseline
        }
        // Calculate profit
        const profit = deal_finance_service_1.DealFinanceService.calculateProfit(payload.dealAmount, payload.costPrice || 0, commission.totalCommission, payload.expenses || 0);
        // Calculate expected revenue
        const expectedRevenue = this.calculateExpectedRevenue(payload.dealAmount, payload.probability || 50);
        // Create deal in transaction
        return await client_1.default.$transaction(async (tx) => {
            // Store commission config in valueBreakdown JSON field for now
            // (We'll add proper fields via migration later)
            const valueBreakdown = {
                commissionType: commissionType,
                commissionRate: payload.commissionRate || 0,
                dealerShare: payload.dealerShare || 100,
                companyShare: payload.companyShare || 0,
                costPrice: payload.costPrice || 0,
                expenses: payload.expenses || 0,
                profit: profit,
                dealerCommission: commission.dealerCommission,
                companyCommission: commission.companyCommission,
            };
            const deal = await tx.deal.create({
                data: {
                    title: payload.title,
                    dealCode,
                    clientId: payload.clientId,
                    dealerId: payload.dealerId,
                    propertyId: payload.propertyId,
                    unitId: payload.unitId,
                    role: payload.role || 'buyer',
                    dealType: payload.dealType,
                    dealAmount: payload.dealAmount,
                    listingPriceSnapshot,
                    varianceAmount,
                    varianceType,
                    valueBreakdown: valueBreakdown,
                    stage: payload.stage || 'prospecting',
                    status: payload.status || 'open',
                    probability: payload.probability || 50,
                    commissionRate: payload.commissionRate || 0,
                    commissionAmount: commission.totalCommission,
                    expectedRevenue,
                    dealDate: payload.dealDate || new Date(),
                    expectedClosingDate: payload.expectedClosingDate,
                    notes: payload.notes,
                    createdBy: payload.createdBy,
                    tid,
                    manualUniqueId: payload.manualUniqueId,
                    isDeleted: false,
                },
            });
            // Create deal properties for multi-property deals
            if (payload.propertyIds && payload.propertyIds.length > 0 && payload.priceShares) {
                await tx.dealProperty.createMany({
                    data: payload.propertyIds.map((propertyId, index) => ({
                        dealId: deal.id,
                        propertyId,
                        priceShare: payload.priceShares[index] || 0,
                    })),
                });
            }
            // Create initial stage history
            await tx.stageHistory.create({
                data: {
                    dealId: deal.id,
                    toStage: deal.stage,
                    probability: deal.probability,
                    changedBy: payload.createdBy,
                },
            });
            // CREATE UNIFIED LEDGER ENTRY for Client and Property
            await tx.ledgerEntry.create({
                data: {
                    dealId: deal.id,
                    paymentId: null,
                    accountDebit: 'UNIFIED_CLIENT',
                    accountCredit: 'UNIFIED_DEAL_CREATED',
                    amount: deal.dealAmount,
                    remarks: `[TID:${tid}] [LEDGER:CLIENT] [TYPE:DEAL_CREATED] Deal created: ${deal.title}`,
                    date: deal.dealDate || new Date(),
                }
            });
            if (deal.propertyId) {
                await tx.ledgerEntry.create({
                    data: {
                        dealId: deal.id,
                        paymentId: null,
                        accountDebit: 'UNIFIED_PROPERTY',
                        accountCredit: 'UNIFIED_DEAL_CREATED',
                        amount: deal.dealAmount,
                        remarks: `[TID:${tid}] [LEDGER:PROPERTY] [TYPE:DEAL_CREATED] Deal created for property: ${deal.title}`,
                        date: deal.dealDate || new Date(),
                    }
                });
            }
            // Attach T-ID to Identity Engine Registry
            if (tid) {
                await transactionIdentity_service_1.TransactionIdentityEngine.attachTid(tid, 'deal', deal.id, 'Properties');
            }
            return deal;
        });
    }
    /**
     * Update deal stage and log history
     * Triggers revenue recognition if stage changes to 'closed-won'
     */
    static async updateDealStage(dealId, newStage, userId, notes, probability) {
        // Validate required parameters
        if (!dealId?.trim()) {
            throw new Error('Deal ID is required');
        }
        if (!newStage?.trim()) {
            throw new Error('New stage is required');
        }
        if (!userId?.trim()) {
            throw new Error('User ID is required');
        }
        // Validate probability if provided
        if (probability !== undefined && (probability < 0 || probability > 100)) {
            throw new Error('Probability must be between 0 and 100');
        }
        const deal = await client_1.default.deal.findUnique({
            where: { id: dealId },
            include: {
                payments: {
                    where: { deletedAt: null },
                },
            },
        });
        if (!deal) {
            throw new Error('Deal not found');
        }
        if (deal.isDeleted || deal.deletedAt) {
            throw new Error('Cannot update deleted deal');
        }
        // Check if stage is actually changing
        if (deal.stage === newStage && (probability === undefined || probability === deal.probability)) {
            throw new Error('Stage and probability are unchanged');
        }
        const wasClosed = deal.stage === 'closed-won';
        const willBeClosed = newStage === 'closed-won';
        return await client_1.default.$transaction(async (tx) => {
            // Update deal
            const updated = await tx.deal.update({
                where: { id: dealId },
                data: {
                    stage: newStage,
                    probability: probability !== undefined ? probability : deal.probability,
                    updatedBy: userId,
                    // Set actual closing date if closing
                    actualClosingDate: willBeClosed && !deal.actualClosingDate ? new Date() : deal.actualClosingDate,
                    // Update status to 'closed' if closing
                    status: willBeClosed ? 'closed' : deal.status,
                },
            });
            // Log stage history
            await tx.stageHistory.create({
                data: {
                    dealId,
                    fromStage: deal.stage,
                    toStage: newStage,
                    changedBy: userId,
                    notes,
                    probability: probability !== undefined ? probability : deal.probability,
                },
            });
            // Recompute status
            await this.recomputeDealStatus(dealId, tx);
            // Trigger revenue recognition if deal is being closed
            if (willBeClosed && !wasClosed) {
                await this.recognizeRevenueForDeal(dealId, tx);
                // Mark property/unit as Sold
                const dealWithRelations = await tx.deal.findUnique({
                    where: { id: dealId },
                    include: { property: true, unit: true },
                });
                if (dealWithRelations) {
                    await this.markPropertyOrUnitAsSold(dealWithRelations, tx);
                }
            }
            else if (wasClosed && !willBeClosed) {
                // Reverse revenue recognition if deal is being reopened
                await deal_finance_service_1.DealFinanceService.reverseRevenueRecognition(dealId, tx);
            }
            return updated;
        });
    }
    /**
     * Recompute deal status based on payments and stage
     */
    static async recomputeDealStatus(dealId, tx) {
        const prismaClient = tx || client_1.default;
        const deal = await prismaClient.deal.findUnique({
            where: { id: dealId },
            include: {
                payments: {
                    where: { deletedAt: null },
                },
            },
        });
        if (!deal) {
            throw new Error('Deal not found');
        }
        // Check if cancelled
        if (deal.stage === 'closed-lost') {
            const status = 'cancelled';
            await prismaClient.deal.update({
                where: { id: dealId },
                data: { status },
            });
            return status;
        }
        // Calculate total paid
        const totalPaid = deal.payments.reduce((sum, payment) => sum + payment.amount, 0);
        // Determine status and stage
        let status;
        let stage = deal.stage;
        let shouldCloseDeal = false;
        if (deal.stage === 'closed-won') {
            status = 'closed';
            stage = 'closed-won';
        }
        else if (totalPaid >= deal.dealAmount && deal.dealAmount > 0) {
            // Payment complete - automatically close the deal
            status = 'closed';
            stage = 'closed-won';
            shouldCloseDeal = true;
        }
        else if (totalPaid > 0) {
            status = 'in_progress';
        }
        else {
            // Default based on stage
            status = deal.stage === 'prospecting' ? 'open' : 'qualified';
        }
        // Update deal
        const updateData = {
            status,
        };
        // Auto-close deal when payment is complete
        if (shouldCloseDeal) {
            updateData.stage = 'closed-won';
            if (!deal.actualClosingDate) {
                updateData.actualClosingDate = new Date();
            }
        }
        const updatedDeal = await prismaClient.deal.update({
            where: { id: dealId },
            data: updateData,
            include: {
                property: true,
                unit: true,
            },
        });
        // Mark property/unit as Sold when deal is closed
        if (status === 'closed' && stage === 'closed-won') {
            await this.markPropertyOrUnitAsSold(updatedDeal, prismaClient);
        }
        // Trigger revenue recognition if deal is closed and not already recognized
        if (status === 'closed' || (stage === 'closed-won' && deal.stage !== 'closed-won')) {
            try {
                await this.recognizeRevenueForDeal(dealId, prismaClient);
            }
            catch (error) {
                // Log error but don't fail the status update
                console.error('Error recognizing revenue for deal:', error);
            }
        }
        return status;
    }
    /**
     * Update deal with financial calculations
     */
    static async updateDeal(dealId, payload) {
        if (!dealId?.trim()) {
            throw new Error('Deal ID is required');
        }
        if (!payload.updatedBy?.trim()) {
            throw new Error('Updated by user ID is required');
        }
        const deal = await client_1.default.deal.findUnique({
            where: { id: dealId },
            include: {
                payments: {
                    where: { deletedAt: null },
                },
            },
        });
        if (!deal) {
            throw new Error('Deal not found');
        }
        if (deal.isDeleted || deal.deletedAt) {
            throw new Error('Cannot update deleted deal');
        }
        // Validate deal amount if provided
        if (payload.dealAmount !== undefined && (payload.dealAmount <= 0 || !payload.dealAmount)) {
            throw new Error('Deal amount must be a positive number');
        }
        // Get current financial data from valueBreakdown or defaults
        const currentBreakdown = deal.valueBreakdown || {};
        const commissionType = payload.commissionType || currentBreakdown.commissionType || 'none';
        const commissionRate = payload.commissionRate !== undefined ? payload.commissionRate : (currentBreakdown.commissionRate || deal.commissionRate || 0);
        const dealerShare = payload.dealerShare !== undefined ? payload.dealerShare : (currentBreakdown.dealerShare || 100);
        const companyShare = payload.companyShare !== undefined ? payload.companyShare : (currentBreakdown.companyShare || 0);
        const costPrice = payload.costPrice !== undefined ? payload.costPrice : (currentBreakdown.costPrice || 0);
        const expenses = payload.expenses !== undefined ? payload.expenses : (currentBreakdown.expenses || 0);
        // Validate dealer if commission is specified
        const finalDealerId = payload.dealerId !== undefined ? payload.dealerId : deal.dealerId;
        if ((commissionType !== 'none') && !finalDealerId) {
            throw new Error('Dealer is required when commission is specified');
        }
        // Calculate commission
        const commissionConfig = {
            type: commissionType,
            rate: commissionRate,
            dealerShare,
            companyShare,
        };
        const validation = deal_finance_service_1.DealFinanceService.validateCommissionConfig(commissionConfig);
        if (!validation.valid) {
            throw new Error(validation.error || 'Invalid commission configuration');
        }
        const finalAmount = payload.dealAmount !== undefined ? payload.dealAmount : deal.dealAmount;
        const commission = deal_finance_service_1.DealFinanceService.calculateCommission(finalAmount, commissionConfig);
        // Calculate profit
        const profit = deal_finance_service_1.DealFinanceService.calculateProfit(finalAmount, costPrice, commission.totalCommission, expenses);
        // Recalculate expected revenue if amount or probability changed
        let expectedRevenue = deal.expectedRevenue;
        if (payload.dealAmount !== undefined || payload.probability !== undefined) {
            const finalProbability = payload.probability !== undefined ? payload.probability : deal.probability;
            expectedRevenue = this.calculateExpectedRevenue(finalAmount, finalProbability);
        }
        // Update valueBreakdown
        const valueBreakdown = {
            commissionType: commissionType,
            commissionRate: commissionRate,
            dealerShare: dealerShare,
            companyShare: companyShare,
            costPrice: costPrice,
            expenses: expenses,
            profit: profit,
            dealerCommission: commission.dealerCommission,
            companyCommission: commission.companyCommission,
        };
        const wasClosed = deal.status === 'closed' || deal.stage === 'closed-won';
        const willBeClosed = payload.status === 'closed' || payload.stage === 'closed-won';
        return await client_1.default.$transaction(async (tx) => {
            const updated = await tx.deal.update({
                where: { id: dealId },
                data: {
                    ...payload,
                    valueBreakdown: valueBreakdown,
                    commissionAmount: commission.totalCommission,
                    expectedRevenue,
                    updatedBy: payload.updatedBy,
                    // Set actual closing date if closing
                    actualClosingDate: willBeClosed && !deal.actualClosingDate ? new Date() : (payload.actualClosingDate || deal.actualClosingDate),
                },
            });
            // Recompute status if amount changed
            if (payload.dealAmount !== undefined) {
                await this.recomputeDealStatus(dealId, tx);
            }
            // Trigger revenue recognition if deal is being closed
            if (willBeClosed && !wasClosed) {
                await this.recognizeRevenueForDeal(dealId, tx);
            }
            else if (wasClosed && !willBeClosed) {
                // Reverse revenue recognition if deal is being reopened
                await deal_finance_service_1.DealFinanceService.reverseRevenueRecognition(dealId, tx);
            }
            return updated;
        });
    }
    /**
     * Recognize revenue for a closed deal
     * Internal helper method
     */
    static async recognizeRevenueForDeal(dealId, tx) {
        const prismaClient = tx || client_1.default;
        const deal = await prismaClient.deal.findUnique({
            where: { id: dealId },
            include: {
                payments: {
                    where: { deletedAt: null },
                },
            },
        });
        if (!deal) {
            throw new Error('Deal not found');
        }
        // Get financial data from valueBreakdown
        const breakdown = deal.valueBreakdown || {};
        const commissionConfig = {
            type: breakdown.commissionType || (deal.commissionRate > 0 ? 'percentage' : 'none'),
            rate: breakdown.commissionRate || deal.commissionRate || 0,
            dealerShare: breakdown.dealerShare || 100,
            companyShare: breakdown.companyShare || 0,
        };
        const financialData = {
            dealAmount: deal.dealAmount,
            costPrice: breakdown.costPrice || 0,
            expenses: breakdown.expenses || 0,
            commissionConfig,
            dealerId: deal.dealerId || undefined,
        };
        // Determine payment mode from payments
        const totalPaid = deal.payments.reduce((sum, p) => sum + p.amount, 0);
        let paymentMode = 'receivable';
        if (deal.payments.length > 0) {
            const lastPayment = deal.payments[deal.payments.length - 1];
            paymentMode = lastPayment.paymentMode === 'cash' ? 'cash' : lastPayment.paymentMode === 'bank' ? 'bank' : 'receivable';
        }
        // Recognize revenue
        await deal_finance_service_1.DealFinanceService.recognizeRevenue(dealId, financialData, paymentMode, tx);
    }
    /**
     * Mark property or unit as Sold when deal is closed
     */
    static async markPropertyOrUnitAsSold(deal, tx) {
        const prismaClient = tx || client_1.default;
        try {
            // If deal is for a unit, mark unit as Sold
            if (deal.unitId) {
                await prismaClient.unit.update({
                    where: { id: deal.unitId },
                    data: { status: 'Sold' },
                });
            }
            // If deal is for a whole property (and not a unit), mark property as Sold
            if (deal.propertyId && !deal.unitId) {
                await prismaClient.property.update({
                    where: { id: deal.propertyId },
                    data: { status: 'Sold' },
                });
            }
        }
        catch (error) {
            // Log error but don't fail the deal update
            console.error('Error marking property/unit as sold:', error);
        }
    }
    /**
     * Soft delete deal
     */
    static async deleteDeal(dealId, userId) {
        // Validate required parameters
        if (!dealId?.trim()) {
            throw new Error('Deal ID is required');
        }
        if (!userId?.trim()) {
            throw new Error('User ID is required');
        }
        const deal = await client_1.default.deal.findUnique({
            where: { id: dealId },
        });
        if (!deal) {
            throw new Error('Deal not found');
        }
        if (deal.isDeleted || deal.deletedAt) {
            throw new Error('Deal is already deleted');
        }
        await client_1.default.deal.update({
            where: { id: dealId },
            data: {
                isDeleted: true,
                deletedAt: new Date(),
                deletedBy: userId,
                updatedBy: userId,
            },
        });
    }
}
exports.DealService = DealService;
//# sourceMappingURL=deal-service.js.map