"use strict";
/**
 * DealFinanceService - Financial logic for Deal revenue recognition and accounting
 * Handles commission calculation, profit computation, and ledger entry generation
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DealFinanceService = void 0;
const client_1 = __importDefault(require("../prisma/client"));
const ledger_service_1 = require("./ledger-service");
class DealFinanceService {
    /**
     * Calculate commission based on type and configuration
     */
    static calculateCommission(dealAmount, config) {
        let totalCommission = 0;
        switch (config.type) {
            case 'fixed':
                totalCommission = config.rate || 0;
                break;
            case 'percentage':
                totalCommission = (dealAmount * (config.rate || 0)) / 100;
                break;
            case 'none':
                totalCommission = 0;
                break;
        }
        // Calculate dealer and company shares
        const dealerShare = config.dealerShare || 100; // Default: 100% to dealer
        const companyShare = config.companyShare || 0;
        // Ensure shares don't exceed 100%
        const totalShare = Math.min(dealerShare + companyShare, 100);
        const normalizedDealerShare = (dealerShare / totalShare) * 100;
        const normalizedCompanyShare = (companyShare / totalShare) * 100;
        const dealerCommission = (totalCommission * normalizedDealerShare) / 100;
        const companyCommission = (totalCommission * normalizedCompanyShare) / 100;
        return {
            totalCommission: Math.round(totalCommission * 100) / 100,
            dealerCommission: Math.round(dealerCommission * 100) / 100,
            companyCommission: Math.round(companyCommission * 100) / 100,
        };
    }
    /**
     * Calculate profit from deal
     * Profit = Deal Value - Cost Price - Commission - Expenses
     */
    static calculateProfit(dealAmount, costPrice = 0, totalCommission = 0, expenses = 0) {
        const profit = dealAmount - costPrice - totalCommission - expenses;
        return Math.round(profit * 100) / 100;
    }
    /**
     * Get account IDs for financial operations
     */
    static async getFinancialAccounts() {
        const [cashAccount, bankAccount, arAccount, dealRevenueAccount, commissionExpenseAccount, dealerPayableAccount, costOfGoodsSoldAccount,] = await Promise.all([
            client_1.default.account.findFirst({
                where: {
                    OR: [{ code: '1000' }, { name: { contains: 'Cash', mode: 'insensitive' } }],
                    isActive: true,
                },
            }),
            client_1.default.account.findFirst({
                where: {
                    OR: [{ code: '1010' }, { name: { contains: 'Bank', mode: 'insensitive' } }],
                    isActive: true,
                },
            }),
            client_1.default.account.findFirst({
                where: {
                    OR: [{ code: '1100' }, { name: { contains: 'Accounts Receivable', mode: 'insensitive' } }],
                    isActive: true,
                },
            }),
            client_1.default.account.findFirst({
                where: {
                    OR: [{ code: '4000' }, { name: { contains: 'Deal Revenue', mode: 'insensitive' } }],
                    isActive: true,
                },
            }),
            client_1.default.account.findFirst({
                where: {
                    OR: [{ code: '5000' }, { name: { contains: 'Commission Expense', mode: 'insensitive' } }],
                    isActive: true,
                },
            }),
            client_1.default.account.findFirst({
                where: {
                    OR: [{ code: '2000' }, { name: { contains: 'Dealer Payable', mode: 'insensitive' } }],
                    isActive: true,
                },
            }),
            client_1.default.account.findFirst({
                where: {
                    OR: [{ code: '5100' }, { name: { contains: 'Cost of Goods Sold', mode: 'insensitive' } }],
                    isActive: true,
                },
            }),
        ]);
        if (!cashAccount || !bankAccount || !arAccount || !dealRevenueAccount || !commissionExpenseAccount || !dealerPayableAccount) {
            throw new Error('Required accounts not found in Chart of Accounts. Please seed accounts first.');
        }
        return {
            cashAccountId: cashAccount.id,
            bankAccountId: bankAccount.id,
            arAccountId: arAccount.id,
            dealRevenueAccountId: dealRevenueAccount.id,
            commissionExpenseAccountId: commissionExpenseAccount.id,
            dealerPayableAccountId: dealerPayableAccount.id,
            costOfGoodsSoldAccountId: costOfGoodsSoldAccount?.id,
        };
    }
    /**
     * Recognize revenue when deal is closed
     * Creates proper double-entry ledger entries for:
     * - Revenue recognition
     * - Commission expense
     * - Dealer payable
     * - Cost of goods sold (if applicable)
     */
    static async recognizeRevenue(dealId, financialData, paymentMode, tx) {
        const prismaClient = tx || client_1.default;
        // Get the deal to check if already recognized
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
        // Check if revenue already recognized (prevent double entry)
        const existingRevenueEntries = await prismaClient.ledgerEntry.findMany({
            where: {
                dealId,
                creditAccountId: (await this.getFinancialAccounts()).dealRevenueAccountId,
                deletedAt: null,
            },
        });
        if (existingRevenueEntries.length > 0) {
            // Revenue already recognized, skip
            return;
        }
        // Calculate commission
        const commission = this.calculateCommission(financialData.dealAmount, financialData.commissionConfig);
        // Calculate profit
        const profit = this.calculateProfit(financialData.dealAmount, financialData.costPrice || 0, commission.totalCommission, financialData.expenses || 0);
        // Get account IDs
        const accounts = await this.getFinancialAccounts();
        // Determine amounts paid (used for reporting only; revenue posts via receivable-first)
        const totalPaid = deal.payments.reduce((sum, p) => sum + p.amount, 0);
        const remainingAmount = Math.max(0, financialData.dealAmount - totalPaid);
        const entryDate = deal.actualClosingDate || new Date();
        // Use transaction if provided, otherwise create one
        const executeInTransaction = async (client) => {
            // 1. Revenue Recognition Entry (Receivable-first)
            // Validate journal lines prior to posting
            const { AccountValidationService } = await Promise.resolve().then(() => __importStar(require('./account-validation-service')));
            await AccountValidationService.validateJournalEntry([
                { accountId: accounts.arAccountId, debit: financialData.dealAmount, credit: 0 },
                { accountId: accounts.dealRevenueAccountId, debit: 0, credit: financialData.dealAmount },
            ]);
            // Debit: Accounts Receivable (full amount)
            await ledger_service_1.LedgerService.createLedgerEntry({
                dealId,
                debitAccountId: accounts.arAccountId,
                amount: financialData.dealAmount,
                remarks: `Deal revenue recognition (receivable-first) - ${deal.dealCode || dealId}`,
                date: entryDate,
            }, client);
            // Credit: Deal Revenue (full amount)
            await ledger_service_1.LedgerService.createLedgerEntry({
                dealId,
                creditAccountId: accounts.dealRevenueAccountId,
                amount: financialData.dealAmount,
                remarks: `Deal revenue recognition (receivable-first) - ${deal.dealCode || dealId}`,
                date: entryDate,
            }, client);
            // 2. Commission Expense Entry (if commission exists)
            if (commission.totalCommission > 0 && financialData.dealerId) {
                // Debit: Commission Expense
                await ledger_service_1.LedgerService.createLedgerEntry({
                    dealId,
                    debitAccountId: accounts.commissionExpenseAccountId,
                    amount: commission.totalCommission,
                    remarks: `Commission expense - ${deal.dealCode || dealId}`,
                    date: entryDate,
                }, client);
                // Credit: Dealer Payable
                await ledger_service_1.LedgerService.createLedgerEntry({
                    dealId,
                    creditAccountId: accounts.dealerPayableAccountId,
                    amount: commission.dealerCommission,
                    remarks: `Dealer commission payable - ${deal.dealCode || dealId}`,
                    date: entryDate,
                }, client);
                // Create dealer ledger entry
                const { DealerLedgerService } = await Promise.resolve().then(() => __importStar(require('./dealer-ledger-service')));
                await DealerLedgerService.recordCommission(financialData.dealerId, dealId, deal.clientId || '', commission.dealerCommission, `Commission from deal ${deal.dealCode || dealId}`, client);
            }
            // 3. Cost of Goods Sold Entry (mandatory when cost price is provided)
            if (financialData.costPrice && financialData.costPrice > 0) {
                if (!accounts.costOfGoodsSoldAccountId) {
                    throw new Error('Cost of Goods Sold account not found. Please create COGS account (e.g., 5100) in Chart of Accounts.');
                }
                // Attempt to locate an inventory/property asset account
                const inventoryAccount = await prismaClient.account.findFirst({
                    where: {
                        AND: [{ isActive: true }, { type: 'Asset' }],
                        OR: [
                            { name: { contains: 'Inventory', mode: 'insensitive' } },
                            { name: { contains: 'Property', mode: 'insensitive' } },
                            { name: { contains: 'Stock', mode: 'insensitive' } },
                            { code: { startsWith: '12' } },
                            { code: { startsWith: '13' } },
                            { code: { startsWith: '15' } },
                        ],
                    },
                    orderBy: { code: 'asc' },
                });
                if (!inventoryAccount) {
                    throw new Error('Inventory/Property asset account not found. Please configure an asset account for property cost.');
                }
                // Validate journal lines for COGS
                const { AccountValidationService: AVS2 } = await Promise.resolve().then(() => __importStar(require('./account-validation-service')));
                await AVS2.validateJournalEntry([
                    { accountId: accounts.costOfGoodsSoldAccountId, debit: financialData.costPrice, credit: 0 },
                    { accountId: inventoryAccount.id, debit: 0, credit: financialData.costPrice },
                ]);
                // Debit: Cost of Goods Sold
                await ledger_service_1.LedgerService.createLedgerEntry({
                    dealId,
                    debitAccountId: accounts.costOfGoodsSoldAccountId,
                    amount: financialData.costPrice,
                    remarks: `COGS for deal ${deal.dealCode || dealId}`,
                    date: entryDate,
                }, client);
                // Credit: Inventory/Property asset
                await ledger_service_1.LedgerService.createLedgerEntry({
                    dealId,
                    creditAccountId: inventoryAccount.id,
                    amount: financialData.costPrice,
                    remarks: `Inventory relief for deal ${deal.dealCode || dealId}`,
                    date: entryDate,
                }, client);
            }
        };
        if (tx) {
            await executeInTransaction(tx);
        }
        else {
            await client_1.default.$transaction(executeInTransaction);
        }
    }
    /**
     * Reverse revenue recognition (for deal cancellation or correction)
     */
    static async reverseRevenueRecognition(dealId, tx) {
        const prismaClient = tx || client_1.default;
        // Find all revenue recognition entries
        const accounts = await this.getFinancialAccounts();
        const revenueEntries = await prismaClient.ledgerEntry.findMany({
            where: {
                dealId,
                OR: [
                    { creditAccountId: accounts.dealRevenueAccountId },
                    { debitAccountId: accounts.commissionExpenseAccountId },
                    { creditAccountId: accounts.dealerPayableAccountId },
                ],
                deletedAt: null,
            },
        });
        // Soft delete all related entries
        await prismaClient.ledgerEntry.updateMany({
            where: {
                id: { in: revenueEntries.map((e) => e.id) },
            },
            data: {
                deletedAt: new Date(),
            },
        });
    }
    /**
     * Validate commission configuration
     */
    static validateCommissionConfig(config) {
        if (config.type === 'percentage') {
            if (config.rate === undefined || config.rate < 0 || config.rate > 100) {
                return { valid: false, error: 'Commission percentage must be between 0 and 100' };
            }
        }
        else if (config.type === 'fixed') {
            if (config.rate === undefined || config.rate < 0) {
                return { valid: false, error: 'Fixed commission amount must be greater than or equal to 0' };
            }
        }
        if (config.dealerShare !== undefined && (config.dealerShare < 0 || config.dealerShare > 100)) {
            return { valid: false, error: 'Dealer share must be between 0 and 100' };
        }
        if (config.companyShare !== undefined && (config.companyShare < 0 || config.companyShare > 100)) {
            return { valid: false, error: 'Company share must be between 0 and 100' };
        }
        return { valid: true };
    }
}
exports.DealFinanceService = DealFinanceService;
//# sourceMappingURL=deal-finance-service.js.map