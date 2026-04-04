/**
 * Helper utilities for engines to apply production-grade correctness contracts
 *
 * Use these helpers to ensure consistent application of correctness contracts
 * across all AI Intelligence engines.
 */
import { AIInsight, DataSource, ConfidenceFactors } from '../types';
import { ContractResult } from './correctness-contracts';
import { CorrectnessContract } from './correctness-contracts';
/**
 * Apply legitimacy filters to data
 */
export declare function applyLegitimacyFilters<T>(data: T[], filters: Array<(item: T) => boolean>): {
    legitimate: T[];
    excluded: T[];
};
/**
 * Validate data against contract and create insight or refusal
 */
export declare function validateAndCreateInsight(engineName: string, contract: CorrectnessContract, data: any[], timeRange: {
    start: Date;
    end: Date;
}, dataSources: DataSource[], baseConfidence: number, confidenceFactors: ConfidenceFactors, insightFactory: (legitimateData: any[], contractResult: ContractResult) => AIInsight | null): AIInsight;
/**
 * Build auditable explanation
 */
export declare function buildAuditableExplanation(value: string | number, formula: string, recordCount: number, excludedCount: number, timeRange: {
    start: Date;
    end: Date;
}, tables: string[], filters: Record<string, any>, limitations?: string[]): string;
/**
 * Calculate enhanced confidence factors
 */
export declare function calculateEnhancedConfidenceFactors(totalRecords: number, legitimateRecords: number, expectedRecords: number, hasManualOverrides: boolean, hasBackdatedEntries: boolean, dataFreshnessDays: number, revenueAmounts?: number[]): ConfidenceFactors;
//# sourceMappingURL=engine-helpers.d.ts.map