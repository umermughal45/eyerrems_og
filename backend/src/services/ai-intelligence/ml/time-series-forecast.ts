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
  confidence: number; // 0-100
  confidence_interval: {
    lower: number;
    upper: number;
  };
  explanation: string;
  method: 'ml' | 'rule_based' | 'insufficient_data';
  data_quality_score: number; // 0-100
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
export function forecastTimeSeries(
  values: number[],
  periods: number = 1,
  minDataPoints: number = 6,
  minConfidence: number = 70
): ForecastResult {
  // Rule-based validation first
  if (values.length < minDataPoints) {
    return {
      prediction: null,
      confidence: 0,
      confidence_interval: { lower: 0, upper: 0 },
      explanation: `Insufficient data: ${values.length} data points available, minimum ${minDataPoints} required`,
      method: 'insufficient_data',
      data_quality_score: (values.length / minDataPoints) * 100,
    };
  }
  
  // Check data quality
  const hasVariation = values.some((v, i) => i > 0 && v !== values[i - 1]);
  const hasOutliers = detectOutliers(values);
  const dataQualityScore = calculateDataQuality(values, hasVariation, hasOutliers);
  
  if (dataQualityScore < 50) {
    return {
      prediction: null,
      confidence: 0,
      confidence_interval: { lower: 0, upper: 0 },
      explanation: `Poor data quality (score: ${dataQualityScore.toFixed(1)}%). Cannot generate reliable forecast.`,
      method: 'insufficient_data',
      data_quality_score: dataQualityScore,
    };
  }
  
  // Exponential Smoothing (Holt-Winters simplified)
  // This is explainable ML - uses weighted averages with trend
  const alpha = 0.3; // Smoothing parameter
  const beta = 0.2; // Trend parameter
  
  let smoothed = values[0];
  let trend = values.length > 1 ? values[1] - values[0] : 0;
  
  // Calculate smoothed values and trend
  for (let i = 1; i < values.length; i++) {
    const prevSmoothed = smoothed;
    smoothed = alpha * values[i] + (1 - alpha) * (smoothed + trend);
    trend = beta * (smoothed - prevSmoothed) + (1 - beta) * trend;
  }
  
  // Forecast
  const forecast = smoothed + trend * periods;
  
  // Calculate confidence based on:
  // 1. Data quality score
  // 2. Forecast horizon (longer = lower confidence)
  // 3. Historical variance
  const variance = calculateVariance(values);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const coefficientOfVariation = mean > 0 ? Math.sqrt(variance) / mean : 1;
  
  let confidence = dataQualityScore;
  confidence -= periods * 5; // Degrade 5% per period
  confidence -= coefficientOfVariation * 20; // Degrade for high variance
  confidence = Math.max(0, Math.min(100, confidence));
  
  // Confidence interval (95% based on historical variance)
  const stdDev = Math.sqrt(variance);
  const margin = 1.96 * stdDev * Math.sqrt(periods); // 95% CI
  const confidenceInterval = {
    lower: Math.max(0, forecast - margin),
    upper: forecast + margin,
  };
  
  // If confidence below threshold, return null prediction
  if (confidence < minConfidence) {
    return {
      prediction: null,
      confidence,
      confidence_interval: confidenceInterval,
      explanation: `Forecast confidence (${confidence.toFixed(1)}%) below threshold (${minConfidence}%). Insufficient data quality for reliable prediction.`,
      method: 'insufficient_data',
      data_quality_score: dataQualityScore,
    };
  }
  
  return {
    prediction: forecast,
    confidence,
    confidence_interval: confidenceInterval,
    explanation: `Forecast using exponential smoothing: ${forecast.toFixed(2)} (${confidence.toFixed(1)}% confidence). Based on ${values.length} historical data points with ${dataQualityScore.toFixed(1)}% data quality.`,
    method: 'ml',
    data_quality_score: dataQualityScore,
  };
}

/**
 * Detect outliers using IQR method
 */
function detectOutliers(values: number[]): boolean {
  if (values.length < 4) return false;
  
  const sorted = [...values].sort((a, b) => a - b);
  const q1Index = Math.floor(sorted.length * 0.25);
  const q3Index = Math.floor(sorted.length * 0.75);
  const q1 = sorted[q1Index];
  const q3 = sorted[q3Index];
  const iqr = q3 - q1;
  
  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;
  
  return values.some((v) => v < lowerBound || v > upperBound);
}

/**
 * Calculate data quality score
 */
function calculateDataQuality(
  values: number[],
  hasVariation: boolean,
  hasOutliers: boolean
): number {
  let score = 100;
  
  // Penalize for no variation (all same values)
  if (!hasVariation) {
    score -= 30;
  }
  
  // Penalize for outliers
  if (hasOutliers) {
    score -= 20;
  }
  
  // Penalize for small sample size
  if (values.length < 12) {
    score -= (12 - values.length) * 5;
  }
  
  // Penalize for missing values (if any are 0 or negative unexpectedly)
  const negativeOrZero = values.filter((v) => v <= 0).length;
  if (negativeOrZero > values.length * 0.1) {
    score -= 15;
  }
  
  return Math.max(0, Math.min(100, score));
}

/**
 * Calculate variance
 */
function calculateVariance(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
  return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
}
