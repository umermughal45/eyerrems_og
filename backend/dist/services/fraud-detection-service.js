"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FraudDetectionService = void 0;
const client_1 = __importDefault(require("../prisma/client"));
class FraudDetectionService {
    /**
     * Detect potential duplicate payments
     * Same amount, same client, within 24 hours
     */
    static async detectDuplicatePayments(startDate, endDate) {
        const where = {
            deletedAt: null,
        };
        if (startDate || endDate) {
            where.date = {};
            if (startDate)
                where.date.gte = startDate;
            if (endDate)
                where.date.lte = endDate;
        }
        const payments = await client_1.default.payment.findMany({
            where,
            orderBy: { date: 'asc' },
            include: {
                deal: {
                    include: {
                        client: true,
                    },
                },
            },
        });
        const redFlags = [];
        for (let i = 0; i < payments.length; i++) {
            const current = payments[i];
            // Look ahead for duplicates
            for (let j = i + 1; j < payments.length; j++) {
                const next = payments[j];
                // Stop if date difference is > 24 hours
                if (next.date.getTime() - current.date.getTime() > 24 * 60 * 60 * 1000) {
                    break;
                }
                if (current.amount === next.amount &&
                    current.dealId === next.dealId &&
                    current.paymentMode === next.paymentMode) {
                    redFlags.push({
                        type: 'Duplicate Payment',
                        severity: 'High',
                        description: `Potential duplicate payment of ${current.amount} for client ${current.deal?.client?.name}`,
                        transactionId: next.id,
                        date: next.date,
                        amount: next.amount,
                        details: {
                            originalPaymentId: current.id,
                            originalDate: current.date,
                        },
                    });
                }
            }
        }
        return redFlags;
    }
    /**
     * Detect round amount transactions (e.g., 1000.00, 5000.00)
     * Often used in fabricated transactions
     */
    static async detectRoundAmounts(startDate, endDate, threshold = 1000) {
        const where = {
            deletedAt: null,
            amount: { gte: threshold },
        };
        if (startDate || endDate) {
            where.date = {};
            if (startDate)
                where.date.gte = startDate;
            if (endDate)
                where.date.lte = endDate;
        }
        const entries = await client_1.default.ledgerEntry.findMany({
            where,
            include: {
                debitAccount: true,
                creditAccount: true,
            },
        });
        const redFlags = [];
        for (const entry of entries) {
            if (entry.amount % 100 === 0) { // Multiples of 100
                redFlags.push({
                    type: 'Round Amount',
                    severity: 'Medium',
                    description: `Round amount transaction detected: ${entry.amount}`,
                    transactionId: entry.id,
                    date: entry.date,
                    amount: entry.amount,
                    details: {
                        debitAccount: entry.debitAccount?.name,
                        creditAccount: entry.creditAccount?.name,
                    },
                });
            }
        }
        return redFlags;
    }
    /**
     * Detect transactions posted on weekends
     */
    static async detectWeekendPostings(startDate, endDate) {
        const where = {
            deletedAt: null,
        };
        if (startDate || endDate) {
            where.date = {};
            if (startDate)
                where.date.gte = startDate;
            if (endDate)
                where.date.lte = endDate;
        }
        const entries = await client_1.default.ledgerEntry.findMany({
            where,
            include: {
                debitAccount: true,
                creditAccount: true,
            },
        });
        const redFlags = [];
        for (const entry of entries) {
            const day = entry.date.getDay();
            if (day === 0 || day === 6) { // 0 = Sunday, 6 = Saturday
                redFlags.push({
                    type: 'Weekend Posting',
                    severity: 'Low',
                    description: `Transaction posted on a weekend (${entry.date.toDateString()})`,
                    transactionId: entry.id,
                    date: entry.date,
                    amount: entry.amount,
                    details: {
                        debitAccount: entry.debitAccount?.name,
                        creditAccount: entry.creditAccount?.name,
                    },
                });
            }
        }
        return redFlags;
    }
    /**
     * Generate comprehensive Red Flags Report
     */
    static async generateRedFlagsReport(startDate, endDate) {
        const [duplicates, roundAmounts, weekendPostings] = await Promise.all([
            this.detectDuplicatePayments(startDate, endDate),
            this.detectRoundAmounts(startDate, endDate),
            this.detectWeekendPostings(startDate, endDate),
        ]);
        return [
            ...duplicates,
            ...roundAmounts,
            ...weekendPostings,
        ].sort((a, b) => b.date.getTime() - a.date.getTime());
    }
}
exports.FraudDetectionService = FraudDetectionService;
//# sourceMappingURL=fraud-detection-service.js.map