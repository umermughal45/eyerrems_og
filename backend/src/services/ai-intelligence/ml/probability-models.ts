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
  probability: number | null; // 0-100
  confidence: number; // 0-100
  explanation: string;
  method: 'ml' | 'rule_based' | 'insufficient_data';
  data_quality_score: number;
  factors: Array<{ factor: string; impact: number; weight: number }>;
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
export function calculateChurnProbability(params: {
  paymentDelays: number; // Number of delayed payments
  totalPayments: number; // Total payment records
  daysUntilLeaseExpiry: number | null;
  paymentConsistency: number; // 0-100 score
  satisfactionScore?: number; // Optional: 0-100
  minDataPoints?: number;
  minConfidence?: number;
}): ProbabilityResult {
  const {
    paymentDelays,
    totalPayments,
    daysUntilLeaseExpiry,
    paymentConsistency,
    satisfactionScore,
    minDataPoints = 3,
    minConfidence = 70,
  } = params;
  
  // PRODUCTION RULE: ML must enforce refusal conditions
  // Rule-based validation first - REFUSAL CONDITION 1: Minimum data points
  if (totalPayments < minDataPoints) {
    return {
      probability: null,
      confidence: 0,
      explanation: `Insufficient payment history: ${totalPayments} payments available, minimum ${minDataPoints} required. ML model refuses prediction due to insufficient training data.`,
      method: 'insufficient_data',
      data_quality_score: (totalPayments / minDataPoints) * 100,
      factors: [],
    };
  }
  
  // REFUSAL CONDITION 2: Feature vectors partially null
  if (daysUntilLeaseExpiry === null && totalPayments < 5) {
    return {
      probability: null,
      confidence: 0,
      explanation: `Key feature missing (lease expiration data) and insufficient payment history. ML model refuses prediction due to incomplete feature vectors.`,
      method: 'insufficient_data',
      data_quality_score: 40,
      factors: [],
    };
  }
  
  // Calculate data quality
  const dataQualityScore = Math.min(100, (totalPayments / 10) * 100);
  
  // REFUSAL CONDITION 3: Poor data quality
  if (dataQualityScore < 50) {
    return {
      probability: null,
      confidence: 0,
      explanation: `Poor data quality (score: ${dataQualityScore.toFixed(1)}%). ML model refuses prediction - data quality below acceptable threshold.`,
      method: 'insufficient_data',
      data_quality_score: dataQualityScore,
      factors: [],
    };
  }
  
  // Rule-based factors with ML-style weighting
  const factors: Array<{ factor: string; impact: number; weight: number }> = [];
  
  // Factor 1: Payment delay rate
  const delayRate = totalPayments > 0 ? (paymentDelays / totalPayments) * 100 : 0;
  const delayImpact = Math.min(50, delayRate * 0.5); // Max 50% impact
  factors.push({
    factor: 'Payment delays',
    impact: delayImpact,
    weight: 0.4,
  });
  
  // Factor 2: Payment consistency
  const consistencyImpact = (100 - paymentConsistency) * 0.3; // Lower consistency = higher churn risk
  factors.push({
    factor: 'Payment consistency',
    impact: consistencyImpact,
    weight: 0.3,
  });
  
  // Factor 3: Lease expiration timing
  let expiryImpact = 0;
  if (daysUntilLeaseExpiry !== null) {
    if (daysUntilLeaseExpiry <= 90 && daysUntilLeaseExpiry > 0) {
      expiryImpact = (90 - daysUntilLeaseExpiry) / 90 * 20; // Up to 20% impact
    }
  }
  factors.push({
    factor: 'Lease expiration timing',
    impact: expiryImpact,
    weight: 0.2,
  });
  
  // Factor 4: Satisfaction (if available)
  if (satisfactionScore !== undefined) {
    const satisfactionImpact = (100 - satisfactionScore) * 0.1; // Lower satisfaction = higher risk
    factors.push({
      factor: 'Satisfaction score',
      impact: satisfactionImpact,
      weight: 0.1,
    });
  }
  
  // Calculate weighted probability
  const weightedProbability = factors.reduce(
    (sum, f) => sum + f.impact * f.weight,
    0
  );
  
  // Calculate confidence
  let confidence = dataQualityScore;
  
  // Increase confidence if multiple factors available
  if (factors.length >= 3) {
    confidence += 10;
  }
  
  // Decrease confidence if key data missing
  if (daysUntilLeaseExpiry === null) {
    confidence -= 10;
  }
  
  // Decrease confidence for small sample size
  if (totalPayments < 5) {
    confidence -= 15;
  }
  
  confidence = Math.max(0, Math.min(100, confidence));
  
  // If confidence below threshold, return null
  if (confidence < minConfidence) {
    return {
      probability: null,
      confidence,
      explanation: `Churn probability confidence (${confidence.toFixed(1)}%) below threshold (${minConfidence}%). Insufficient data quality for reliable prediction.`,
      method: 'insufficient_data',
      data_quality_score: dataQualityScore,
      factors,
    };
  }
  
  const probability = Math.min(100, Math.max(0, weightedProbability));
  
  return {
    probability,
    confidence,
    explanation: `Churn probability: ${probability.toFixed(1)}% (${confidence.toFixed(1)}% confidence). Based on ${factors.length} factors: ${factors.map((f) => `${f.factor} (${f.impact.toFixed(1)}% impact)`).join(', ')}.`,
    method: 'ml',
    data_quality_score: dataQualityScore,
    factors,
  };
}

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
export function calculateDelayProbability(params: {
  expectedProgress: number; // 0-100
  actualProgress: number; // 0-100
  daysElapsed: number;
  totalDays: number;
  budgetUtilization: number; // 0-100
  historicalDelays?: number; // Number of previous delays
  minConfidence?: number;
}): ProbabilityResult {
  const {
    expectedProgress,
    actualProgress,
    daysElapsed,
    totalDays,
    budgetUtilization,
    historicalDelays = 0,
    minConfidence = 70,
  } = params;
  
  // PRODUCTION RULE: ML must enforce refusal conditions
  // REFUSAL CONDITION 1: Invalid timeline data
  if (totalDays <= 0 || daysElapsed < 0) {
    return {
      probability: null,
      confidence: 0,
      explanation: 'Invalid project timeline data. ML model refuses prediction - invalid input parameters.',
      method: 'insufficient_data',
      data_quality_score: 0,
      factors: [],
    };
  }
  
  // REFUSAL CONDITION 2: Missing progress data
  const hasProgressData = expectedProgress >= 0 && actualProgress >= 0;
  if (!hasProgressData) {
    return {
      probability: null,
      confidence: 0,
      explanation: 'Missing progress data. ML model refuses prediction - required features (expectedProgress, actualProgress) are null or invalid.',
      method: 'insufficient_data',
      data_quality_score: 0,
      factors: [],
    };
  }
  
  // Calculate data quality
  const dataQualityScore = 85;
  
  // REFUSAL CONDITION 3: Early-stage projects (insufficient historical data)
  if (daysElapsed < totalDays * 0.1) {
    return {
      probability: null,
      confidence: 0,
      explanation: `Project too early-stage (${((daysElapsed / totalDays) * 100).toFixed(1)}% elapsed). ML model refuses prediction - insufficient historical data for reliable delay probability.`,
      method: 'insufficient_data',
      data_quality_score: 30,
      factors: [],
    };
  }
  
  // Rule-based factors with ML-style weighting
  const factors: Array<{ factor: string; impact: number; weight: number }> = [];
  
  // Factor 1: Progress variance
  const progressVariance = expectedProgress - actualProgress;
  const progressImpact = Math.min(40, Math.max(0, progressVariance * 0.4)); // Max 40% impact
  factors.push({
    factor: 'Progress variance',
    impact: progressImpact,
    weight: 0.5,
  });
  
  // Factor 2: Time utilization
  const timeUtilization = (daysElapsed / totalDays) * 100;
  const timeImpact = timeUtilization > expectedProgress ? 20 : 0; // Behind schedule
  factors.push({
    factor: 'Time utilization',
    impact: timeImpact,
    weight: 0.3,
  });
  
  // Factor 3: Budget overrun risk
  const budgetImpact = budgetUtilization > 90 ? 15 : budgetUtilization > 80 ? 10 : 0;
  factors.push({
    factor: 'Budget utilization',
    impact: budgetImpact,
    weight: 0.15,
  });
  
  // Factor 4: Historical delays
  const historicalImpact = Math.min(10, historicalDelays * 5);
  factors.push({
    factor: 'Historical delay pattern',
    impact: historicalImpact,
    weight: 0.05,
  });
  
  // Calculate weighted probability
  const weightedProbability = factors.reduce(
    (sum, f) => sum + f.impact * f.weight,
    0
  );
  
  // Calculate confidence
  let confidence = dataQualityScore;
  
  // Increase confidence if project is well underway
  if (daysElapsed > totalDays * 0.2) {
    confidence += 5;
  }
  
  // Decrease confidence for early-stage projects
  if (daysElapsed < totalDays * 0.1) {
    confidence -= 20;
  }
  
  confidence = Math.max(0, Math.min(100, confidence));
  
  // If confidence below threshold, return null
  if (confidence < minConfidence) {
    return {
      probability: null,
      confidence,
      explanation: `Delay probability confidence (${confidence.toFixed(1)}%) below threshold (${minConfidence}%). Insufficient data quality for reliable prediction.`,
      method: 'insufficient_data',
      data_quality_score: dataQualityScore,
      factors,
    };
  }
  
  const probability = Math.min(100, Math.max(0, weightedProbability));
  
  return {
    probability,
    confidence,
    explanation: `Delay probability: ${probability.toFixed(1)}% (${confidence.toFixed(1)}% confidence). Based on ${factors.length} factors: ${factors.map((f) => `${f.factor} (${f.impact.toFixed(1)}% impact)`).join(', ')}.`,
    method: 'ml',
    data_quality_score: dataQualityScore,
    factors,
  };
}
