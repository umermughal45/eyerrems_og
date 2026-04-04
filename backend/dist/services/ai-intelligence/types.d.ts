/**
 * AI Intelligence Types and Contracts
 *
 * MANDATORY OUTPUT CONTRACT:
 * Every backend AI response MUST follow this structure.
 * If any field cannot be populated → return status: "insufficient_data"
 * No silent fallbacks.
 */
export type InsightType = 'actual' | 'derived' | 'predicted';
export type InsightStatus = 'success' | 'insufficient_data' | 'error' | 'degraded';
export interface DataSource {
    module: string;
    table?: string;
    fields?: string[];
    time_range?: {
        start: Date;
        end: Date;
    };
    filters?: Record<string, any>;
}
export interface AIInsight {
    value: string | number | boolean | null;
    type: InsightType;
    confidence: number;
    confidence_reason: string;
    explanation: string;
    data_sources: DataSource[];
    time_range?: {
        start: Date;
        end: Date;
    };
    last_computed_at: Date;
    status: InsightStatus;
    metadata?: {
        method?: 'ml' | 'rule_based' | 'insufficient_data';
        confidence_interval?: {
            lower: number;
            upper: number;
        };
        data_quality_score?: number;
        factors?: Array<{
            factor: string;
            impact: number;
            weight: number;
        }>;
        trend?: 'improving' | 'declining' | 'stable';
        indicators?: Record<string, number>;
        [key: string]: any;
    };
}
export interface EngineConfig {
    data_sources: DataSource[];
    rules?: string[];
    formulas?: string[];
    confidence_logic?: string;
    failure_conditions?: string[];
}
export interface EngineResult {
    insights: AIInsight[];
    engine_name: string;
    computed_at: Date;
    status: InsightStatus;
    errors?: string[];
}
/**
 * Base interface for all AI Intelligence Engines
 */
export interface AIEngine {
    name: string;
    config: EngineConfig;
    /**
     * Compute insights for this engine
     * Must return results following AIInsight contract
     */
    compute(): Promise<EngineResult>;
    /**
     * Check if engine has sufficient data to compute
     */
    hasSufficientData(): Promise<boolean>;
    /**
     * Get data sources this engine requires
     */
    getDataSources(): DataSource[];
}
/**
 * Confidence degradation factors
 */
export interface ConfidenceFactors {
    missing_data_percentage: number;
    has_manual_overrides: boolean;
    has_backdated_entries: boolean;
    data_freshness_days: number;
    sample_size: number;
    /** Anomaly percentage (outliers) */
    anomaly_percentage?: number;
    /** Data completeness ratio (legitimate records / total records) */
    data_completeness_ratio?: number;
    /** Historical coverage (months/days of data) */
    historical_coverage?: number;
    /** Variance stability (coefficient of variation) */
    variance_stability?: number;
}
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
export declare function calculateConfidence(baseConfidence: number, factors: ConfidenceFactors): number;
/**
 * Create an insight with insufficient data status
 */
export declare function createInsufficientDataInsight(label: string, dataSources: DataSource[]): AIInsight;
/**
 * Create an error insight
 */
export declare function createErrorInsight(label: string, error: string, dataSources: DataSource[]): AIInsight;
//# sourceMappingURL=types.d.ts.map