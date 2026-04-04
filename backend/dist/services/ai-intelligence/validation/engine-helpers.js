"use strict";
/**
 * Helper utilities for engines to apply production-grade correctness contracts
 *
 * Use these helpers to ensure consistent application of correctness contracts
 * across all AI Intelligence engines.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyLegitimacyFilters = applyLegitimacyFilters;
exports.validateAndCreateInsight = validateAndCreateInsight;
exports.buildAuditableExplanation = buildAuditableExplanation;
exports.calculateEnhancedConfidenceFactors = calculateEnhancedConfidenceFactors;
const types_1 = require("../types");
const correctness_contracts_1 = require("./correctness-contracts");
const decision_logger_1 = require("../audit/decision-logger");
const data_legitimacy_1 = require("./data-legitimacy");
/**
 * Apply legitimacy filters to data
 */
function applyLegitimacyFilters(data, filters) {
    let legitimate = [...data];
    const excluded = [];
    for (const filter of filters) {
        const beforeCount = legitimate.length;
        legitimate = legitimate.filter((item) => {
            const shouldExclude = filter(item);
            if (shouldExclude) {
                excluded.push(item);
            }
            return !shouldExclude;
        });
    }
    return { legitimate, excluded };
}
/**
 * Validate data against contract and create insight or refusal
 */
function validateAndCreateInsight(engineName, contract, data, timeRange, dataSources, baseConfidence, confidenceFactors, insightFactory) {
    // Validate contract
    const contractResult = (0, correctness_contracts_1.validateContract)(data, contract, timeRange);
    if (!contractResult.passed) {
        // Create refusal insight
        const refusalInsight = (0, correctness_contracts_1.createRefusalInsight)(contract.name, contractResult.failureReason || 'Contract validation failed', dataSources);
        // Log refusal
        (0, decision_logger_1.createDecisionLog)(engineName, { type: 'refusal', refusalReason: contractResult.failureReason }, {
            totalRecords: contractResult.context.totalRecords,
            legitimateRecords: contractResult.legitimateCount,
            excludedRecords: contractResult.excludedCount,
            timeRange,
        }, contractResult, {
            baseConfidence,
            factors: {
                missingDataPercentage: confidenceFactors.missing_data_percentage || 0,
                hasManualOverrides: confidenceFactors.has_manual_overrides || false,
                hasBackdatedEntries: confidenceFactors.has_backdated_entries || false,
                dataFreshnessDays: confidenceFactors.data_freshness_days || 0,
                sampleSize: contractResult.legitimateCount,
                anomalyPercentage: contractResult.context.anomalyPercentage,
            },
            finalConfidence: 0,
        }, contractResult.failureReason || 'Contract validation failed', {});
        return refusalInsight;
    }
    // Contract passed - create insight
    const legitimateData = data.slice(0, contractResult.legitimateCount);
    const insight = insightFactory(legitimateData, contractResult);
    if (!insight) {
        // Factory returned null - create refusal
        return (0, correctness_contracts_1.createRefusalInsight)(contract.name, 'Unable to generate insight from legitimate data', dataSources);
    }
    // Calculate final confidence
    const calculatedConfidence = (0, types_1.calculateConfidence)(baseConfidence, confidenceFactors);
    const finalConfidence = Math.min(insight.confidence || calculatedConfidence, calculatedConfidence);
    // PRODUCTION RULE: Confidence < 60% → suppress
    if (finalConfidence < 60) {
        const refusalInsight = (0, correctness_contracts_1.createRefusalInsight)(contract.name, `Confidence ${finalConfidence.toFixed(1)}% below minimum threshold (60%). Insufficient data quality for reliable insight.`, dataSources);
        (0, decision_logger_1.createDecisionLog)(engineName, { type: 'refusal', refusalReason: `Low confidence: ${finalConfidence.toFixed(1)}%` }, {
            totalRecords: contractResult.context.totalRecords,
            legitimateRecords: contractResult.legitimateCount,
            excludedRecords: contractResult.excludedCount,
            timeRange,
        }, contractResult, {
            baseConfidence,
            factors: {
                missingDataPercentage: confidenceFactors.missing_data_percentage || 0,
                hasManualOverrides: confidenceFactors.has_manual_overrides || false,
                hasBackdatedEntries: confidenceFactors.has_backdated_entries || false,
                dataFreshnessDays: confidenceFactors.data_freshness_days || 0,
                sampleSize: contractResult.legitimateCount,
                anomalyPercentage: contractResult.context.anomalyPercentage,
            },
            finalConfidence,
        }, `Confidence ${finalConfidence.toFixed(1)}% below threshold`, {});
        return refusalInsight;
    }
    // Update insight with final confidence
    insight.confidence = finalConfidence;
    insight.status = finalConfidence >= 70 ? 'success' : 'degraded';
    // Log decision
    (0, decision_logger_1.createDecisionLog)(engineName, { type: 'insight', insight }, {
        totalRecords: contractResult.context.totalRecords,
        legitimateRecords: contractResult.legitimateCount,
        excludedRecords: contractResult.excludedCount,
        timeRange,
    }, contractResult, {
        baseConfidence,
        factors: {
            missingDataPercentage: confidenceFactors.missing_data_percentage || 0,
            hasManualOverrides: confidenceFactors.has_manual_overrides || false,
            hasBackdatedEntries: confidenceFactors.has_backdated_entries || false,
            dataFreshnessDays: confidenceFactors.data_freshness_days || 0,
            sampleSize: contractResult.legitimateCount,
            anomalyPercentage: contractResult.context.anomalyPercentage,
        },
        finalConfidence,
    }, `Insight generated with ${finalConfidence.toFixed(1)}% confidence`, {});
    return insight;
}
/**
 * Build auditable explanation
 */
function buildAuditableExplanation(value, formula, recordCount, excludedCount, timeRange, tables, filters, limitations = []) {
    const parts = [];
    // Value
    parts.push(`Value: ${typeof value === 'number' ? value.toLocaleString() : value}.`);
    // Formula
    parts.push(`Formula: ${formula}.`);
    // Data source
    parts.push(`Based on ${recordCount} legitimate records${excludedCount > 0 ? ` (${excludedCount} excluded)` : ''}.`);
    // Tables
    parts.push(`Tables used: ${tables.join(', ')}.`);
    // Filters
    const filterStrings = Object.entries(filters).map(([key, val]) => {
        if (typeof val === 'object' && val !== null) {
            if (Array.isArray(val)) {
                return `${key} IN (${val.join(', ')})`;
            }
            else if (val.in) {
                return `${key} IN (${val.in.join(', ')})`;
            }
            else if (val.not) {
                return `${key} != ${val.not}`;
            }
            else if (val.gte && val.lte) {
                return `${key} BETWEEN ${val.gte} AND ${val.lte}`;
            }
        }
        return `${key} = ${val}`;
    });
    if (filterStrings.length > 0) {
        parts.push(`Filters applied: ${filterStrings.join(', ')}.`);
    }
    // Time range
    parts.push(`Time range: ${timeRange.start.toLocaleDateString()} to ${timeRange.end.toLocaleDateString()}.`);
    // Record count
    parts.push(`Record count: ${recordCount}.`);
    // Limitations
    if (limitations.length > 0) {
        parts.push(`Known limitations: ${limitations.join(' ')}`);
    }
    return parts.join(' ');
}
/**
 * Calculate enhanced confidence factors
 */
function calculateEnhancedConfidenceFactors(totalRecords, legitimateRecords, expectedRecords, hasManualOverrides, hasBackdatedEntries, dataFreshnessDays, revenueAmounts) {
    const missingDataPercentage = Math.max(0, (1 - legitimateRecords / expectedRecords) * 100);
    const dataCompletenessRatio = totalRecords > 0 ? legitimateRecords / totalRecords : 0;
    // Calculate variance stability if revenue amounts provided
    let varianceStability;
    if (revenueAmounts && revenueAmounts.length > 0) {
        const mean = revenueAmounts.reduce((a, b) => a + b, 0) / revenueAmounts.length;
        const variance = revenueAmounts.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / revenueAmounts.length;
        const stdDev = Math.sqrt(variance);
        varianceStability = mean > 0 ? stdDev / mean : 1.0;
    }
    // Calculate anomaly percentage
    const anomalyPercentage = revenueAmounts && revenueAmounts.length > 0
        ? (0, data_legitimacy_1.calculateAnomalyPercentage)(revenueAmounts)
        : undefined;
    return {
        missing_data_percentage: missingDataPercentage,
        has_manual_overrides: hasManualOverrides,
        has_backdated_entries: hasBackdatedEntries,
        data_freshness_days: dataFreshnessDays,
        sample_size: legitimateRecords,
        data_completeness_ratio: dataCompletenessRatio,
        variance_stability: varianceStability,
        anomaly_percentage: anomalyPercentage,
    };
}
//# sourceMappingURL=engine-helpers.js.map