/**
 * Helper utilities for engines to apply production-grade correctness contracts
 * 
 * Use these helpers to ensure consistent application of correctness contracts
 * across all AI Intelligence engines.
 */

import { AIInsight, DataSource, ConfidenceFactors, calculateConfidence } from '../types';
import { validateContract, createRefusalInsight, ContractResult } from './correctness-contracts';
import { createDecisionLog } from '../audit/decision-logger';
import { calculateAnomalyPercentage, isTimeRangeConsistent } from './data-legitimacy';
import { CorrectnessContract } from './correctness-contracts';

/**
 * Apply legitimacy filters to data
 */
export function applyLegitimacyFilters<T>(
  data: T[],
  filters: Array<(item: T) => boolean>
): { legitimate: T[]; excluded: T[] } {
  let legitimate = [...data];
  const excluded: T[] = [];
  
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
export function validateAndCreateInsight(
  engineName: string,
  contract: CorrectnessContract,
  data: any[],
  timeRange: { start: Date; end: Date },
  dataSources: DataSource[],
  baseConfidence: number,
  confidenceFactors: ConfidenceFactors,
  insightFactory: (legitimateData: any[], contractResult: ContractResult) => AIInsight | null
): AIInsight {
  // Validate contract
  const contractResult = validateContract(data, contract, timeRange);
  
  if (!contractResult.passed) {
    // Create refusal insight
    const refusalInsight = createRefusalInsight(
      contract.name,
      contractResult.failureReason || 'Contract validation failed',
      dataSources
    );
    
    // Log refusal
    createDecisionLog(
      engineName,
      { type: 'refusal', refusalReason: contractResult.failureReason },
      {
        totalRecords: contractResult.context.totalRecords,
        legitimateRecords: contractResult.legitimateCount,
        excludedRecords: contractResult.excludedCount,
        timeRange,
      },
      contractResult,
      {
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
      },
      contractResult.failureReason || 'Contract validation failed',
      {}
    );
    
    return refusalInsight;
  }
  
  // Contract passed - create insight
  const legitimateData = data.slice(0, contractResult.legitimateCount);
  const insight = insightFactory(legitimateData, contractResult);
  
  if (!insight) {
    // Factory returned null - create refusal
    return createRefusalInsight(
      contract.name,
      'Unable to generate insight from legitimate data',
      dataSources
    );
  }
  
  // Calculate final confidence
  const calculatedConfidence = calculateConfidence(baseConfidence, confidenceFactors);
  const finalConfidence = Math.min(insight.confidence || calculatedConfidence, calculatedConfidence);
  
  // PRODUCTION RULE: Confidence < 60% → suppress
  if (finalConfidence < 60) {
    const refusalInsight = createRefusalInsight(
      contract.name,
      `Confidence ${finalConfidence.toFixed(1)}% below minimum threshold (60%). Insufficient data quality for reliable insight.`,
      dataSources
    );
    
    createDecisionLog(
      engineName,
      { type: 'refusal', refusalReason: `Low confidence: ${finalConfidence.toFixed(1)}%` },
      {
        totalRecords: contractResult.context.totalRecords,
        legitimateRecords: contractResult.legitimateCount,
        excludedRecords: contractResult.excludedCount,
        timeRange,
      },
      contractResult,
      {
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
      },
      `Confidence ${finalConfidence.toFixed(1)}% below threshold`,
      {}
    );
    
    return refusalInsight;
  }
  
  // Update insight with final confidence
  insight.confidence = finalConfidence;
  insight.status = finalConfidence >= 70 ? 'success' : 'degraded';
  
  // Log decision
  createDecisionLog(
    engineName,
    { type: 'insight', insight },
    {
      totalRecords: contractResult.context.totalRecords,
      legitimateRecords: contractResult.legitimateCount,
      excludedRecords: contractResult.excludedCount,
      timeRange,
    },
    contractResult,
    {
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
    },
    `Insight generated with ${finalConfidence.toFixed(1)}% confidence`,
    {}
  );
  
  return insight;
}

/**
 * Build auditable explanation
 */
export function buildAuditableExplanation(
  value: string | number,
  formula: string,
  recordCount: number,
  excludedCount: number,
  timeRange: { start: Date; end: Date },
  tables: string[],
  filters: Record<string, any>,
  limitations: string[] = []
): string {
  const parts: string[] = [];
  
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
      } else if (val.in) {
        return `${key} IN (${val.in.join(', ')})`;
      } else if (val.not) {
        return `${key} != ${val.not}`;
      } else if (val.gte && val.lte) {
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
export function calculateEnhancedConfidenceFactors(
  totalRecords: number,
  legitimateRecords: number,
  expectedRecords: number,
  hasManualOverrides: boolean,
  hasBackdatedEntries: boolean,
  dataFreshnessDays: number,
  revenueAmounts?: number[]
): ConfidenceFactors {
  const missingDataPercentage = Math.max(0, (1 - legitimateRecords / expectedRecords) * 100);
  const dataCompletenessRatio = totalRecords > 0 ? legitimateRecords / totalRecords : 0;
  
  // Calculate variance stability if revenue amounts provided
  let varianceStability: number | undefined;
  if (revenueAmounts && revenueAmounts.length > 0) {
    const mean = revenueAmounts.reduce((a, b) => a + b, 0) / revenueAmounts.length;
    const variance = revenueAmounts.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / revenueAmounts.length;
    const stdDev = Math.sqrt(variance);
    varianceStability = mean > 0 ? stdDev / mean : 1.0;
  }
  
  // Calculate anomaly percentage
  const anomalyPercentage = revenueAmounts && revenueAmounts.length > 0
    ? calculateAnomalyPercentage(revenueAmounts)
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
