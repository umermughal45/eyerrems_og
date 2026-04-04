/**
 * Correctness Contracts for Production-Grade AI Intelligence
 *
 * Every AI insight MUST pass these contracts before being returned.
 * Failure to pass → status: "insufficient_data" with clear explanation.
 */
import { AIInsight, DataSource } from '../types';
export interface CorrectnessContract {
    /** Unique identifier for this contract */
    id: string;
    /** Human-readable name */
    name: string;
    /** Minimum data threshold (e.g., 6 months, 5 records) */
    minimumThreshold: {
        type: 'time_range' | 'record_count' | 'coverage_percentage';
        value: number;
        unit?: string;
    };
    /** Data legitimacy rules */
    legitimacyRules: LegitimacyRule[];
    /** Business logic consistency checks */
    businessRules: BusinessRule[];
    /** Refusal conditions */
    refusalConditions: RefusalCondition[];
}
export interface LegitimacyRule {
    /** What data must be excluded */
    exclude: {
        /** Status values to exclude (e.g., ['draft', 'reversed']) */
        statuses?: string[];
        /** Field conditions (e.g., { isDeleted: true }) */
        conditions?: Record<string, any>;
        /** Custom validation function */
        validator?: (record: any) => boolean;
    };
    /** Reason for exclusion */
    reason: string;
}
export interface BusinessRule {
    /** Rule description */
    description: string;
    /** Validation function */
    validator: (data: any, context: ValidationContext) => boolean;
    /** Error message if validation fails */
    errorMessage: string;
}
export interface RefusalCondition {
    /** Condition description */
    description: string;
    /** Check function */
    check: (data: any, context: ValidationContext) => boolean;
    /** Reason for refusal */
    reason: string;
}
export interface ValidationContext {
    /** Total records found */
    totalRecords: number;
    /** Legitimate records after filtering */
    legitimateRecords: number;
    /** Excluded records count */
    excludedCount?: number;
    /** Time range of data */
    timeRange?: {
        start: Date;
        end: Date;
    };
    /** Record counts by status */
    statusCounts?: Record<string, number>;
    /** Missing data percentage */
    missingDataPercentage: number;
    /** Anomaly percentage */
    anomalyPercentage: number;
}
export interface ContractResult {
    /** Whether contract passed */
    passed: boolean;
    /** Reason for failure (if any) */
    failureReason?: string;
    /** Validation context */
    context: ValidationContext;
    /** Legitimate data count */
    legitimateCount: number;
    /** Excluded data count */
    excludedCount: number;
}
/**
 * Validate data against a correctness contract
 */
export declare function validateContract(data: any[], contract: CorrectnessContract, timeRange?: {
    start: Date;
    end: Date;
}): ContractResult;
/**
 * Create a refusal insight (AI knows when to be silent)
 */
export declare function createRefusalInsight(contractName: string, reason: string, dataSources: DataSource[]): AIInsight;
//# sourceMappingURL=correctness-contracts.d.ts.map