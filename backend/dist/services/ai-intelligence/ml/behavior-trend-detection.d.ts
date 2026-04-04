/**
 * Behavior Trend Detection ML Model
 *
 * APPROVED USE CASE: Payment behavior trend detection
 *
 * Rules:
 * - ML augments rule-based detection
 * - Must be explainable
 * - Must include confidence interval
 * - Falls back to rule-based if data quality poor
 */
export interface TrendResult {
    trend: 'improving' | 'declining' | 'stable' | null;
    probability: number | null;
    confidence: number;
    explanation: string;
    method: 'ml' | 'rule_based' | 'insufficient_data';
    data_quality_score: number;
    indicators: {
        recent_avg: number;
        historical_avg: number;
        change_percentage: number;
    };
}
/**
 * Detect payment behavior trends using statistical analysis
 *
 * @param paymentHistory - Array of payment amounts/delays (time-ordered)
 * @param isDelayData - If true, lower values = better. If false, higher values = better
 * @param minDataPoints - Minimum data points required
 * @param minConfidence - Minimum confidence threshold
 */
export declare function detectPaymentTrend(paymentHistory: number[], isDelayData?: boolean, minDataPoints?: number, minConfidence?: number): TrendResult;
//# sourceMappingURL=behavior-trend-detection.d.ts.map