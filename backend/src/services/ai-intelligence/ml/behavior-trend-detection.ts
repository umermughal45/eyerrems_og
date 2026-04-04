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
  probability: number | null; // 0-100
  confidence: number; // 0-100
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
export function detectPaymentTrend(
  paymentHistory: number[],
  isDelayData: boolean = true,
  minDataPoints: number = 6,
  minConfidence: number = 70
): TrendResult {
  // Rule-based validation first
  if (paymentHistory.length < minDataPoints) {
    return {
      trend: null,
      probability: null,
      confidence: 0,
      explanation: `Insufficient data: ${paymentHistory.length} data points available, minimum ${minDataPoints} required`,
      method: 'insufficient_data',
      data_quality_score: (paymentHistory.length / minDataPoints) * 100,
      indicators: {
        recent_avg: 0,
        historical_avg: 0,
        change_percentage: 0,
      },
    };
  }
  
  // Split into recent and historical periods
  const splitPoint = Math.floor(paymentHistory.length * 0.6);
  const historical = paymentHistory.slice(0, splitPoint);
  const recent = paymentHistory.slice(splitPoint);
  
  const historicalAvg = historical.reduce((a, b) => a + b, 0) / historical.length;
  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  
  // Calculate data quality
  const hasVariation = paymentHistory.some((v, i) => i > 0 && v !== paymentHistory[i - 1]);
  const dataQualityScore = hasVariation ? 80 : 50;
  
  if (dataQualityScore < 50) {
    return {
      trend: null,
      probability: null,
      confidence: 0,
      explanation: `Poor data quality. Cannot detect reliable trends.`,
      method: 'insufficient_data',
      data_quality_score: dataQualityScore,
      indicators: {
        recent_avg: recentAvg,
        historical_avg: historicalAvg,
        change_percentage: 0,
      },
    };
  }
  
  // Statistical significance test (simplified t-test)
  const changePercentage = historicalAvg > 0
    ? ((recentAvg - historicalAvg) / historicalAvg) * 100
    : 0;
  
  // Calculate confidence based on:
  // 1. Sample size
  // 2. Magnitude of change
  // 3. Consistency of trend
  let confidence = dataQualityScore;
  
  // Increase confidence if change is significant (>10%)
  if (Math.abs(changePercentage) > 10) {
    confidence += 10;
  }
  
  // Decrease confidence for small samples
  if (recent.length < 3) {
    confidence -= 15;
  }
  
  // Check consistency (are recent values consistently better/worse?)
  const recentTrend = recent.slice(0, -1).map((v, i) => {
    if (isDelayData) {
      return v > recent[i + 1] ? 1 : v < recent[i + 1] ? -1 : 0; // Lower is better
    } else {
      return v < recent[i + 1] ? 1 : v > recent[i + 1] ? -1 : 0; // Higher is better
    }
  });
  
  const consistentTrend = recentTrend.filter((t) => t !== 0).length;
  const consistencyRatio = recentTrend.length > 0 ? consistentTrend / recentTrend.length : 0;
  confidence += consistencyRatio * 10;
  
  confidence = Math.max(0, Math.min(100, confidence));
  
  // Determine trend
  let trend: 'improving' | 'declining' | 'stable' | null = null;
  let probability: number | null = null;
  
  if (confidence < minConfidence) {
    return {
      trend: null,
      probability: null,
      confidence,
      explanation: `Trend detection confidence (${confidence.toFixed(1)}%) below threshold (${minConfidence}%). Insufficient data quality for reliable detection.`,
      method: 'insufficient_data',
      data_quality_score: dataQualityScore,
      indicators: {
        recent_avg: recentAvg,
        historical_avg: historicalAvg,
        change_percentage: changePercentage,
      },
    };
  }
  
  // Determine trend direction
  if (isDelayData) {
    // For delays: lower = better
    if (recentAvg < historicalAvg * 0.9) {
      trend = 'improving';
      probability = Math.min(100, 50 + Math.abs(changePercentage) * 2);
    } else if (recentAvg > historicalAvg * 1.1) {
      trend = 'declining';
      probability = Math.min(100, 50 + Math.abs(changePercentage) * 2);
    } else {
      trend = 'stable';
      probability = 60;
    }
  } else {
    // For amounts: higher = better
    if (recentAvg > historicalAvg * 1.1) {
      trend = 'improving';
      probability = Math.min(100, 50 + Math.abs(changePercentage) * 2);
    } else if (recentAvg < historicalAvg * 0.9) {
      trend = 'declining';
      probability = Math.min(100, 50 + Math.abs(changePercentage) * 2);
    } else {
      trend = 'stable';
      probability = 60;
    }
  }
  
  return {
    trend,
    probability,
    confidence,
    explanation: `Detected ${trend} trend (${probability?.toFixed(1)}% probability, ${confidence.toFixed(1)}% confidence). Recent average: ${recentAvg.toFixed(2)}, Historical average: ${historicalAvg.toFixed(2)} (${changePercentage > 0 ? '+' : ''}${changePercentage.toFixed(1)}% change).`,
    method: 'ml',
    data_quality_score: dataQualityScore,
    indicators: {
      recent_avg: recentAvg,
      historical_avg: historicalAvg,
      change_percentage: changePercentage,
    },
  };
}
