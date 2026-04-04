"use strict";
/**
 * AI Intelligence Types and Contracts
 *
 * MANDATORY OUTPUT CONTRACT:
 * Every backend AI response MUST follow this structure.
 * If any field cannot be populated → return status: "insufficient_data"
 * No silent fallbacks.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateConfidence = calculateConfidence;
exports.createInsufficientDataInsight = createInsufficientDataInsight;
exports.createErrorInsight = createErrorInsight;
/**
 * Calculate confidence based on factors
 *
 * PRODUCTION RULES:
 * - Confidence MUST degrade if data missing, manual overrides, backdated entries
 * - Confidence MUST NEVER be hard-coded
 * - Confidence < 60% → suppress insight
 * - Confidence > 95% → flag as suspicious and cap
 * - Confidence must degrade with missing or noisy data
 */
function calculateConfidence(baseConfidence, factors) {
    let confidence = baseConfidence;
    // Degrade for missing data
    confidence -= factors.missing_data_percentage * 0.5;
    // Degrade for data completeness (if legitimate records < total)
    if (factors.data_completeness_ratio !== undefined) {
        const completenessPenalty = (1 - factors.data_completeness_ratio) * 20;
        confidence -= completenessPenalty;
    }
    // Degrade for manual overrides
    if (factors.has_manual_overrides) {
        confidence -= 15;
    }
    // Degrade for backdated entries
    if (factors.has_backdated_entries) {
        confidence -= 10;
    }
    // Degrade for stale data
    if (factors.data_freshness_days > 30) {
        confidence -= Math.min(20, factors.data_freshness_days / 30 * 10);
    }
    // Degrade for small sample size
    if (factors.sample_size < 10) {
        confidence -= (10 - factors.sample_size) * 2;
    }
    // Degrade for anomalies (outliers)
    if (factors.anomaly_percentage !== undefined) {
        if (factors.anomaly_percentage > 30) {
            // High anomaly dominance → significant penalty
            confidence -= 25;
        }
        else if (factors.anomaly_percentage > 15) {
            confidence -= 10;
        }
    }
    // Degrade for high variance (unstable data)
    if (factors.variance_stability !== undefined) {
        // Coefficient of variation > 1.0 indicates high variance
        if (factors.variance_stability > 1.0) {
            confidence -= 15;
        }
        else if (factors.variance_stability > 0.5) {
            confidence -= 8;
        }
    }
    // Degrade for insufficient historical coverage
    if (factors.historical_coverage !== undefined) {
        if (factors.historical_coverage < 3) {
            // Less than 3 months of data
            confidence -= 20;
        }
        else if (factors.historical_coverage < 6) {
            confidence -= 10;
        }
    }
    // Cap suspiciously high confidence (>95%)
    if (confidence > 95) {
        confidence = 95;
    }
    // Ensure confidence is within bounds
    confidence = Math.max(0, Math.min(95, Math.round(confidence)));
    return confidence;
}
/**
 * Create an insight with insufficient data status
 */
function createInsufficientDataInsight(label, dataSources) {
    return {
        value: null,
        type: 'predicted',
        confidence: 0,
        confidence_reason: 'Insufficient data available to compute insight',
        explanation: `Cannot compute ${label} due to missing or insufficient data`,
        data_sources: dataSources,
        last_computed_at: new Date(),
        status: 'insufficient_data',
    };
}
/**
 * Create an error insight
 */
function createErrorInsight(label, error, dataSources) {
    return {
        value: null,
        type: 'predicted',
        confidence: 0,
        confidence_reason: `Error: ${error}`,
        explanation: `Failed to compute ${label}: ${error}`,
        data_sources: dataSources,
        last_computed_at: new Date(),
        status: 'error',
    };
}
//# sourceMappingURL=types.js.map