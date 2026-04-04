/**
 * AI Decision Logger
 *
 * Production-grade audit logging for all AI outputs and refusals.
 * Every AI decision must be logged for:
 * - Full reproduction of past insights
 * - Regulatory and financial audits
 * - Debugging incorrect behavior
 */
import { AIInsight } from '../types';
import { ContractResult } from '../validation/correctness-contracts';
export interface AIDecisionLog {
    /** Unique log ID */
    id: string;
    /** Timestamp of decision */
    timestamp: Date;
    /** Engine name */
    engine: string;
    /** User/company scope */
    scope: {
        companyId?: string;
        propertyId?: string;
        role?: string;
    };
    /** Insight or refusal */
    decision: {
        type: 'insight' | 'refusal';
        insight?: AIInsight;
        refusalReason?: string;
    };
    /** Data snapshot reference */
    dataSnapshot: {
        totalRecords: number;
        legitimateRecords: number;
        excludedRecords: number;
        timeRange?: {
            start: Date;
            end: Date;
        };
        statusCounts?: Record<string, number>;
    };
    /** Contract validation result */
    contractResult?: ContractResult;
    /** Rule or model version */
    version: {
        ruleVersion?: string;
        modelVersion?: string;
        engineVersion: string;
    };
    /** Confidence calculation details */
    confidenceDetails: {
        baseConfidence: number;
        factors: {
            missingDataPercentage: number;
            hasManualOverrides: boolean;
            hasBackdatedEntries: boolean;
            dataFreshnessDays: number;
            sampleSize: number;
            anomalyPercentage?: number;
        };
        finalConfidence: number;
    };
    /** Output or refusal reason */
    reason: string;
}
/**
 * In-memory audit log (production should use persistent storage)
 */
declare class AIDecisionLogger {
    private logs;
    private maxLogs;
    /**
     * Log an AI decision
     */
    logDecision(log: Omit<AIDecisionLog, 'id' | 'timestamp'>): void;
    /**
     * Get logs for a specific engine
     */
    getLogsForEngine(engine: string, limit?: number): AIDecisionLog[];
    /**
     * Get logs for a time range
     */
    getLogsForTimeRange(start: Date, end: Date): AIDecisionLog[];
    /**
     * Get all logs (for audit purposes)
     */
    getAllLogs(): AIDecisionLog[];
    /**
     * Clear logs (use with caution)
     */
    clearLogs(): void;
}
export declare const aiDecisionLogger: AIDecisionLogger;
/**
 * Helper to create a decision log entry
 */
export declare function createDecisionLog(engine: string, decision: AIDecisionLog['decision'], dataSnapshot: AIDecisionLog['dataSnapshot'], contractResult: ContractResult | undefined, confidenceDetails: AIDecisionLog['confidenceDetails'], reason: string, scope?: AIDecisionLog['scope']): void;
export {};
//# sourceMappingURL=decision-logger.d.ts.map