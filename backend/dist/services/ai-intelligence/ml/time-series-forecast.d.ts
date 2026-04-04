/**
 * Time-Series Forecasting ML Model
 *
 * APPROVED USE CASE: Revenue time-series forecasting
 *
 * Rules:
 * - ML augments rule-based forecasting
 * - Must be explainable
 * - Must include confidence interval
 * - Falls back to rule-based if data quality poor
 */
export interface ForecastResult {
    prediction: number | null;
    confidence: number;
    confidence_interval: {
        lower: number;
        upper: number;
    };
    explanation: string;
    method: 'ml' | 'rule_based' | 'insufficient_data';
    data_quality_score: number;
}
/**
 * Simple time-series forecasting using exponential smoothing
 * This is a lightweight ML approach that's explainable
 *
 * @param values - Historical values (time-ordered)
 * @param periods - Number of periods to forecast ahead
 * @param minDataPoints - Minimum data points required (default: 6)
 * @param minConfidence - Minimum confidence threshold (default: 70)
 */
export declare function forecastTimeSeries(values: number[], periods?: number, minDataPoints?: number, minConfidence?: number): ForecastResult;
//# sourceMappingURL=time-series-forecast.d.ts.map