"use strict";
/**
 * Transaction Risk Engine
 *
 * Data Sources:
 * - Finance Module: Transactions, Payments, Invoices
 *
 * Rules:
 * - Detect duplicate transactions
 * - Identify abnormal amounts (statistical outliers)
 * - Flag suspicious patterns (rapid transactions, unusual timing)
 *
 * Confidence Logic:
 * - Degrades if transaction history is short
 * - Degrades if patterns are unclear
 *
 * Failure Conditions:
 * - No transaction history
 * - Insufficient data for pattern analysis
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransactionRiskEngine = void 0;
const client_1 = __importDefault(require("../../../prisma/client"));
const types_1 = require("../types");
const logger_1 = __importDefault(require("../../../utils/logger"));
const behavior_trend_detection_1 = require("../ml/behavior-trend-detection");
class TransactionRiskEngine {
    constructor() {
        this.name = 'TransactionRiskEngine';
        this.config = {
            data_sources: [
                {
                    module: 'Finance',
                    table: 'Transaction',
                    fields: ['id', 'amount', 'date', 'type', 'description', 'createdAt'],
                },
                {
                    module: 'Finance',
                    table: 'Payment',
                    fields: ['id', 'amount', 'date', 'status', 'createdAt'],
                },
                {
                    module: 'Finance',
                    table: 'Invoice',
                    fields: ['id', 'amount', 'invoiceNumber', 'date', 'createdAt'],
                },
            ],
            rules: [
                'Duplicate detection: Same amount, same day, similar description',
                'Abnormal amount: > 3 standard deviations from mean',
                'Suspicious pattern: Multiple transactions in short time window',
            ],
            confidence_logic: 'Degrades with short history or unclear patterns',
            failure_conditions: ['No transaction history', 'Insufficient data for pattern analysis'],
        };
    }
    async compute() {
        const insights = [];
        const errors = [];
        try {
            if (!(await this.hasSufficientData())) {
                return {
                    insights: [(0, types_1.createInsufficientDataInsight)('Transaction Risk', this.getDataSources())],
                    engine_name: this.name,
                    computed_at: new Date(),
                    status: 'insufficient_data',
                };
            }
            const sixMonthsAgo = new Date();
            sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
            // Get transactions
            const transactions = await client_1.default.transaction.findMany({
                where: {
                    date: { gte: sixMonthsAgo },
                },
                select: {
                    id: true,
                    amount: true,
                    date: true,
                    transactionType: true,
                    description: true,
                    createdAt: true,
                },
                orderBy: { date: 'desc' },
            });
            // Get tenant payments
            const payments = await client_1.default.tenantPayment.findMany({
                where: {
                    date: { gte: sixMonthsAgo },
                },
                select: {
                    id: true,
                    amount: true,
                    date: true,
                    status: true,
                    createdAt: true,
                },
            });
            // Get invoices
            const invoices = await client_1.default.invoice.findMany({
                where: {
                    createdAt: { gte: sixMonthsAgo },
                },
                select: {
                    id: true,
                    amount: true,
                    invoiceNumber: true,
                    billingDate: true,
                    createdAt: true,
                },
            });
            // Detect duplicate transactions
            const duplicateTransactions = [];
            const transactionMap = new Map();
            transactions.forEach((t) => {
                const key = `${t.amount}-${t.date.toISOString().split('T')[0]}`;
                if (!transactionMap.has(key)) {
                    transactionMap.set(key, []);
                }
                transactionMap.get(key).push(Number(t.id));
            });
            transactionMap.forEach((ids, key) => {
                if (ids.length > 1) {
                    const [amount, dateStr] = key.split('-');
                    duplicateTransactions.push({
                        id: ids[0].toString(),
                        amount: Number(amount),
                        date: new Date(dateStr),
                    });
                }
            });
            // Detect abnormal amounts (statistical outliers)
            const amounts = transactions.map((t) => Number(t.amount || 0)).filter((a) => a > 0);
            if (amounts.length > 0) {
                const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
                const variance = amounts.reduce((sum, a) => sum + Math.pow(a - mean, 2), 0) / amounts.length;
                const stdDev = Math.sqrt(variance);
                const abnormalTransactions = transactions.filter((t) => {
                    const amount = Number(t.amount || 0);
                    return amount > 0 && Math.abs(amount - mean) > 3 * stdDev;
                });
                // Suspicious patterns: multiple transactions in same hour
                const suspiciousPatterns = [];
                const hourlyGroups = new Map();
                transactions.forEach((t) => {
                    const hourKey = `${t.date.toISOString().split('T')[0]}-${new Date(t.date).getHours()}`;
                    hourlyGroups.set(hourKey, (hourlyGroups.get(hourKey) || 0) + 1);
                });
                hourlyGroups.forEach((count, hourKey) => {
                    if (count >= 5) {
                        suspiciousPatterns.push({ count, timeWindow: hourKey });
                    }
                });
                // Calculate confidence factors
                const confidenceFactors = {
                    missing_data_percentage: transactions.length < 30 ? 30 : 0,
                    has_manual_overrides: false,
                    has_backdated_entries: transactions.some((t) => {
                        const created = new Date(t.createdAt);
                        const tDate = new Date(t.date);
                        return (created.getTime() - tDate.getTime()) / (1000 * 60 * 60 * 24) > 1;
                    }),
                    data_freshness_days: 0,
                    sample_size: transactions.length,
                };
                // Duplicate transactions insight
                insights.push({
                    value: duplicateTransactions.length,
                    type: 'derived',
                    confidence: (0, types_1.calculateConfidence)(90, confidenceFactors),
                    confidence_reason: 'Based on transaction pattern analysis',
                    explanation: `Detected ${duplicateTransactions.length} potential duplicate transactions (same amount, same date)`,
                    data_sources: [
                        {
                            module: 'Finance',
                            table: 'Transaction',
                            time_range: { start: sixMonthsAgo, end: new Date() },
                        },
                    ],
                    last_computed_at: new Date(),
                    status: 'success',
                    metadata: {
                        duplicates: duplicateTransactions.slice(0, 10), // Limit to first 10
                    },
                });
                // Abnormal amounts insight
                insights.push({
                    value: abnormalTransactions.length,
                    type: 'derived',
                    confidence: (0, types_1.calculateConfidence)(85, confidenceFactors),
                    confidence_reason: 'Statistical analysis of transaction amounts',
                    explanation: `Identified ${abnormalTransactions.length} transactions with amounts > 3 standard deviations from mean (${mean.toFixed(2)})`,
                    data_sources: [
                        {
                            module: 'Finance',
                            table: 'Transaction',
                            time_range: { start: sixMonthsAgo, end: new Date() },
                        },
                    ],
                    last_computed_at: new Date(),
                    status: 'success',
                    metadata: {
                        mean,
                        stdDev,
                        abnormal_count: abnormalTransactions.length,
                    },
                });
                // Suspicious patterns insight
                insights.push({
                    value: suspiciousPatterns.length,
                    type: 'derived',
                    confidence: (0, types_1.calculateConfidence)(80, confidenceFactors),
                    confidence_reason: 'Based on transaction frequency patterns',
                    explanation: `Detected ${suspiciousPatterns.length} time windows with 5+ transactions (potential suspicious activity)`,
                    data_sources: [
                        {
                            module: 'Finance',
                            table: 'Transaction',
                            time_range: { start: sixMonthsAgo, end: new Date() },
                        },
                    ],
                    last_computed_at: new Date(),
                    status: 'success',
                });
                // ML-based payment behavior trend detection (APPROVED USE CASE)
                // Analyze payment delays over time
                const paymentDelays = payments
                    .map((p) => {
                    const paymentDate = new Date(p.date);
                    const daysSince = (new Date().getTime() - paymentDate.getTime()) / (1000 * 60 * 60 * 24);
                    return p.status !== 'paid' ? daysSince : 0;
                })
                    .filter((d) => d > 0);
                if (paymentDelays.length >= 6) {
                    const trendResult = (0, behavior_trend_detection_1.detectPaymentTrend)(paymentDelays, true, 6, 70);
                    if (trendResult.method === 'ml' && trendResult.trend !== null && trendResult.probability !== null) {
                        insights.push({
                            value: trendResult.probability,
                            type: 'predicted',
                            confidence: trendResult.confidence,
                            confidence_reason: `ML-based trend detection (${trendResult.confidence.toFixed(1)}% confidence)`,
                            explanation: `Payment behavior trend: ${trendResult.trend} (${trendResult.probability.toFixed(1)}% probability). ${trendResult.explanation}`,
                            data_sources: [
                                {
                                    module: 'Finance',
                                    table: 'Payment',
                                    time_range: { start: sixMonthsAgo, end: new Date() },
                                },
                            ],
                            last_computed_at: new Date(),
                            status: trendResult.confidence >= 70 ? 'success' : 'degraded',
                            metadata: {
                                trend: trendResult.trend,
                                method: trendResult.method,
                                indicators: trendResult.indicators,
                            },
                        });
                    }
                }
            }
        }
        catch (error) {
            logger_1.default.error(`Transaction Risk Engine error: ${error.message}`, error);
            errors.push(error.message);
            insights.push((0, types_1.createErrorInsight)('Transaction Risk', error.message, this.getDataSources()));
        }
        return {
            insights,
            engine_name: this.name,
            computed_at: new Date(),
            status: errors.length > 0 ? 'error' : insights.some((i) => i.status === 'insufficient_data') ? 'insufficient_data' : 'success',
            errors: errors.length > 0 ? errors : undefined,
        };
    }
    async hasSufficientData() {
        try {
            const sixMonthsAgo = new Date();
            sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
            const transactionCount = await client_1.default.transaction.count({
                where: {
                    date: { gte: sixMonthsAgo },
                },
            });
            return transactionCount >= 10;
        }
        catch (error) {
            logger_1.default.error('Error checking sufficient data for Transaction Risk', error);
            return false;
        }
    }
    getDataSources() {
        return this.config.data_sources;
    }
}
exports.TransactionRiskEngine = TransactionRiskEngine;
//# sourceMappingURL=transaction-risk-engine.js.map