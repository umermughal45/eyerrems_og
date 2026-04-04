/**
 * Probability Models for ML Predictions
 *
 * APPROVED USE CASES:
 * - Tenant churn probability
 * - Construction delay probability
 *
 * Rules:
 * - ML augments rule-based logic
 * - Must be explainable
 * - Must include confidence interval
 * - Falls back to rule-based if data quality poor
 */
export interface ProbabilityResult {
    probability: number | null;
    confidence: number;
    explanation: string;
    method: 'ml' | 'rule_based' | 'insufficient_data';
    data_quality_score: number;
    factors: Array<{
        factor: string;
        impact: number;
        weight: number;
    }>;
}
/**
 * Calculate tenant churn probability
 *
 * APPROVED USE CASE: Tenant churn probability
 *
 * Factors considered:
 * - Payment delays
 * - Lease expiration timing
 * - Payment history consistency
 * - Satisfaction indicators (if available)
 */
export declare function calculateChurnProbability(params: {
    paymentDelays: number;
    totalPayments: number;
    daysUntilLeaseExpiry: number | null;
    paymentConsistency: number;
    satisfactionScore?: number;
    minDataPoints?: number;
    minConfidence?: number;
}): ProbabilityResult;
/**
 * Calculate construction delay probability
 *
 * APPROVED USE CASE: Construction delay probability
 *
 * Factors considered:
 * - Current progress vs expected
 * - Historical delay patterns
 * - Resource availability indicators
 * - Budget utilization
 */
export declare function calculateDelayProbability(params: {
    expectedProgress: number;
    actualProgress: number;
    daysElapsed: number;
    totalDays: number;
    budgetUtilization: number;
    historicalDelays?: number;
    minConfidence?: number;
}): ProbabilityResult;
//# sourceMappingURL=probability-models.d.ts.map