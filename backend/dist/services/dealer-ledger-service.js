"use strict";
/**
 * DealerLedgerService - Business logic for Dealer Ledger
 * Tracks dealer commissions, payments, and outstanding balances
 * Uses Legacy Projection when DealerLedger is empty (read-only, additive)
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DealerLedgerService = void 0;
const client_1 = __importDefault(require("../prisma/client"));
const ledger_service_1 = require("./ledger-service");
const ledger_engine_service_1 = require("./ledger-engine-service");
const legacy_dealer_ledger_projection_service_1 = require("./legacy-dealer-ledger-projection-service");
class DealerLedgerService {
    /**
     * Get account IDs for dealer ledger operations
     */
    static async getAccounts() {
        const [dealerPayable, commissionExpense, cashAccount, bankAccount] = await Promise.all([
            client_1.default.account.findFirst({
                where: {
                    OR: [{ code: '2000' }, { name: { contains: 'Dealer Payable', mode: 'insensitive' } }],
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
        ]);
        if (!dealerPayable || !commissionExpense || !cashAccount || !bankAccount) {
            throw new Error('Required accounts not found in Chart of Accounts. Please seed accounts first.');
        }
        return {
            dealerPayableAccountId: dealerPayable.id,
            commissionExpenseAccountId: commissionExpense.id,
            cashAccountId: cashAccount.id,
            bankAccountId: bankAccount.id,
        };
    }
    /**
     * Get current balance for a dealer
     */
    static async getDealerBalance(dealerId) {
        const latestEntry = await client_1.default.dealerLedger.findFirst({
            where: { dealerId },
            orderBy: { date: 'desc' },
        });
        return latestEntry?.balance || 0;
    }
    /**
     * Create a dealer ledger entry
     */
    static async createDealerLedgerEntry(payload, tx) {
        const prismaClient = tx || client_1.default;
        // Get current balance
        const currentBalance = await this.getDealerBalance(payload.dealerId);
        // Calculate new balance
        let newBalance = currentBalance;
        if (payload.entryType === 'commission') {
            newBalance += payload.amount; // Commission increases payable (credit)
        }
        else if (payload.entryType === 'payment') {
            newBalance -= payload.amount; // Payment decreases payable (debit)
        }
        else if (payload.entryType === 'adjustment') {
            newBalance += payload.amount; // Adjustment can be positive or negative
        }
        const accounts = await this.getAccounts();
        const entryDate = payload.date || new Date();
        // If already in a transaction, use the client directly, otherwise start a new transaction
        if (tx) {
            return await this.recordCommissionPayableInTransaction(payload, prismaClient, {
                commissionExpenseAccountId: accounts.commissionExpenseAccountId,
                dealerPayableAccountId: accounts.dealerPayableAccountId,
                cashAccountId: accounts.cashAccountId,
                bankAccountId: accounts.bankAccountId,
            });
        }
        else {
            return await client_1.default.$transaction(async (client) => {
                return await this.recordCommissionPayableInTransaction(payload, client, {
                    commissionExpenseAccountId: accounts.commissionExpenseAccountId,
                    dealerPayableAccountId: accounts.dealerPayableAccountId,
                    cashAccountId: accounts.cashAccountId,
                    bankAccountId: accounts.bankAccountId,
                });
            });
        }
    }
    /**
     * Internal method to record commission in transaction
     */
    static async recordCommissionPayableInTransaction(payload, client, accounts) {
        const entryDate = payload.date || new Date();
        let ledgerEntryId = null;
        // Calculate new balance
        const previousEntries = await client.dealerLedger.findMany({
            where: { dealerId: payload.dealerId },
            orderBy: { date: 'desc' },
            take: 1,
        });
        const previousBalance = previousEntries.length > 0 ? previousEntries[0].balance : 0;
        let newBalance = previousBalance;
        if (payload.entryType === 'commission') {
            newBalance = previousBalance + payload.amount;
        }
        else if (payload.entryType === 'payment') {
            newBalance = previousBalance - payload.amount;
        }
        else if (payload.entryType === 'adjustment') {
            newBalance = previousBalance + payload.amount;
        }
        // Create ledger entries based on entry type
        if (payload.entryType === 'commission') {
            // Commission entry: Debit Commission Expense, Credit Dealer Payable
            const expenseEntry = await ledger_service_1.LedgerService.createLedgerEntry({
                dealId: payload.dealId || '',
                debitAccountId: accounts.commissionExpenseAccountId,
                amount: payload.amount,
                remarks: payload.description || `Commission for dealer`,
                date: entryDate,
            }, client);
            const payableEntry = await ledger_service_1.LedgerService.createLedgerEntry({
                dealId: payload.dealId || '',
                creditAccountId: accounts.dealerPayableAccountId,
                amount: payload.amount,
                remarks: payload.description || `Commission payable to dealer`,
                date: entryDate,
            }, client);
            ledgerEntryId = payableEntry.id; // Use payable entry as reference
            // Mirror into Ledger Engine for dealer entity (Commission Payable)
            await (0, ledger_engine_service_1.writeLedgerEntry)({
                transactionUuid: payableEntry.id,
                entryDate,
                accountId: accounts.dealerPayableAccountId,
                entityType: 'dealer',
                entityId: payload.dealerId,
                debitAmount: 0,
                creditAmount: payload.amount,
                narration: payload.description || 'Commission payable to dealer',
                sourceType: 'payment',
            }, client);
        }
        else if (payload.entryType === 'payment') {
            // Payment entry: Debit Dealer Payable, Credit Cash/Bank
            const paymentAccountId = payload.referenceType === 'cash' ? accounts.cashAccountId : accounts.bankAccountId;
            const payableEntry = await ledger_service_1.LedgerService.createLedgerEntry({
                dealId: payload.dealId || '',
                debitAccountId: accounts.dealerPayableAccountId,
                amount: payload.amount,
                remarks: payload.description || `Payment to dealer`,
                date: entryDate,
            }, client);
            const cashEntry = await ledger_service_1.LedgerService.createLedgerEntry({
                dealId: payload.dealId || '',
                creditAccountId: paymentAccountId,
                amount: payload.amount,
                remarks: payload.description || `Payment to dealer`,
                date: entryDate,
            }, client);
            ledgerEntryId = payableEntry.id;
            // Mirror into Ledger Engine for dealer entity (Payment made)
            await (0, ledger_engine_service_1.writeLedgerEntry)({
                transactionUuid: payableEntry.id,
                entryDate,
                accountId: accounts.dealerPayableAccountId,
                entityType: 'dealer',
                entityId: payload.dealerId,
                debitAmount: payload.amount,
                creditAmount: 0,
                narration: payload.description || 'Payment to dealer',
                sourceType: 'payment',
            }, client);
        }
        // Create dealer ledger entry
        const dealerLedgerEntry = await client.dealerLedger.create({
            data: {
                dealerId: payload.dealerId,
                dealId: payload.dealId || null,
                clientId: payload.clientId || null,
                entryType: payload.entryType,
                amount: payload.amount,
                balance: Math.round(newBalance * 100) / 100,
                description: payload.description,
                referenceId: payload.referenceId,
                referenceType: payload.referenceType,
                ledgerEntryId,
                date: entryDate,
            },
        });
        // Update dealer's total commission earned
        if (payload.entryType === 'commission') {
            await client.dealer.update({
                where: { id: payload.dealerId },
                data: {
                    totalCommissionEarned: {
                        increment: payload.amount,
                    },
                },
            });
        }
        return dealerLedgerEntry;
    }
    /**
     * Record commission for a dealer (when deal is closed)
     */
    static async recordCommission(dealerId, dealId, clientId, commissionAmount, description, tx) {
        return await this.createDealerLedgerEntry({
            dealerId,
            dealId,
            clientId,
            entryType: 'commission',
            amount: commissionAmount,
            description: description || `Commission from deal`,
            referenceId: dealId,
            referenceType: 'deal',
        }, tx);
    }
    /**
     * Record payment to dealer
     */
    static async recordPayment(dealerId, amount, paymentMode, description, referenceId, tx) {
        return await this.createDealerLedgerEntry({
            dealerId,
            entryType: 'payment',
            amount,
            description: description || `Payment to dealer`,
            referenceId,
            referenceType: paymentMode,
        }, tx);
    }
    /**
     * Get dealer ledger with summary.
     * Uses Legacy Projection (Commission, Sale, Voucher) when DealerLedger is empty.
     */
    static async getDealerLedger(dealerId, filters) {
        const where = { dealerId };
        if (filters?.startDate || filters?.endDate) {
            where.date = {};
            if (filters.startDate)
                where.date.gte = filters.startDate;
            if (filters.endDate)
                where.date.lte = filters.endDate;
        }
        if (filters?.dealId) {
            where.dealId = filters.dealId;
        }
        const dealerLedgerEntries = await client_1.default.dealerLedger.findMany({
            where,
            include: {
                deal: {
                    include: {
                        client: { select: { id: true, name: true, clientCode: true } },
                    },
                },
                client: { select: { id: true, name: true, clientCode: true } },
            },
            orderBy: { date: 'asc' },
        });
        if (dealerLedgerEntries.length === 0) {
            const projection = await (0, legacy_dealer_ledger_projection_service_1.getLegacyDealerLedgerProjection)(dealerId, filters);
            if (projection && projection.hasLegacyEntries && projection.rows.length > 0) {
                const totalCredit = projection.rows.reduce((s, r) => s + r.creditAmount, 0);
                const totalDebit = projection.rows.reduce((s, r) => s + r.debitAmount, 0);
                const lastRow = projection.rows[projection.rows.length - 1];
                const entries = projection.rows.map((r) => ({
                    id: r.id,
                    date: r.trandate,
                    entryType: r.creditAmount > 0 ? 'commission' : 'payment',
                    amount: r.creditAmount > 0 ? r.creditAmount : r.debitAmount,
                    balance: r.runningBalance,
                    description: r.memo,
                    referenceId: r.transactionNumber,
                    isLegacy: true,
                }));
                return {
                    entries,
                    summary: {
                        totalCommission: Number(totalCredit.toFixed(2)),
                        totalPayments: Number(totalDebit.toFixed(2)),
                        outstandingBalance: Number((lastRow?.runningBalance ?? projection.openingBalance).toFixed(2)),
                    },
                    hasLedgerEntries: false,
                    hasLegacyEntries: true,
                };
            }
            return {
                entries: [],
                summary: { totalCommission: 0, totalPayments: 0, outstandingBalance: 0 },
                hasLedgerEntries: false,
                hasLegacyEntries: false,
            };
        }
        const totalCommission = dealerLedgerEntries
            .filter((e) => e.entryType === 'commission')
            .reduce((sum, e) => sum + e.amount, 0);
        const totalPayments = dealerLedgerEntries
            .filter((e) => e.entryType === 'payment')
            .reduce((sum, e) => sum + e.amount, 0);
        const outstandingBalance = dealerLedgerEntries.length > 0
            ? dealerLedgerEntries[dealerLedgerEntries.length - 1].balance
            : 0;
        return {
            entries: dealerLedgerEntries,
            summary: {
                totalCommission: Math.round(totalCommission * 100) / 100,
                totalPayments: Math.round(totalPayments * 100) / 100,
                outstandingBalance: Math.round(outstandingBalance * 100) / 100,
            },
            hasLedgerEntries: true,
            hasLegacyEntries: false,
        };
    }
}
exports.DealerLedgerService = DealerLedgerService;
//# sourceMappingURL=dealer-ledger-service.js.map