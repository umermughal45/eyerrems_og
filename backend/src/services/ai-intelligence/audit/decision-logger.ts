/**
 * AI Decision Logger
 * 
 * Production-grade audit logging for all AI outputs and refusals.
 * Every AI decision must be logged for:
 * - Full reproduction of past insights
 * - Regulatory and financial audits
 * - Debugging incorrect behavior
 */

import { AIInsight, EngineResult } from '../types';
import { ContractResult } from '../validation/correctness-contracts';
import logger from '../../../utils/logger';

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
    timeRange?: { start: Date; end: Date };
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
class AIDecisionLogger {
  private logs: AIDecisionLog[] = [];
  private maxLogs = 10000; // Keep last 10k decisions

  /**
   * Log an AI decision
   */
  logDecision(log: Omit<AIDecisionLog, 'id' | 'timestamp'>): void {
    const fullLog: AIDecisionLog = {
      ...log,
      id: `ai-log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    };

    this.logs.push(fullLog);
    
    // Keep only last maxLogs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Also log to Winston for production monitoring
    logger.info('AI Decision Logged', {
      engine: fullLog.engine,
      decisionType: fullLog.decision.type,
      confidence: fullLog.confidenceDetails.finalConfidence,
      status: fullLog.decision.insight?.status || 'refused',
      reason: fullLog.reason,
    });
  }

  /**
   * Get logs for a specific engine
   */
  getLogsForEngine(engine: string, limit: number = 100): AIDecisionLog[] {
    return this.logs
      .filter((log) => log.engine === engine)
      .slice(-limit)
      .reverse();
  }

  /**
   * Get logs for a time range
   */
  getLogsForTimeRange(start: Date, end: Date): AIDecisionLog[] {
    return this.logs.filter(
      (log) => log.timestamp >= start && log.timestamp <= end
    );
  }

  /**
   * Get all logs (for audit purposes)
   */
  getAllLogs(): AIDecisionLog[] {
    return [...this.logs];
  }

  /**
   * Clear logs (use with caution)
   */
  clearLogs(): void {
    this.logs = [];
  }
}

export const aiDecisionLogger = new AIDecisionLogger();

/**
 * Helper to create a decision log entry
 */
export function createDecisionLog(
  engine: string,
  decision: AIDecisionLog['decision'],
  dataSnapshot: AIDecisionLog['dataSnapshot'],
  contractResult: ContractResult | undefined,
  confidenceDetails: AIDecisionLog['confidenceDetails'],
  reason: string,
  scope: AIDecisionLog['scope'] = {}
): void {
  aiDecisionLogger.logDecision({
    engine,
    scope,
    decision,
    dataSnapshot,
    contractResult,
    version: {
      engineVersion: '1.0.0', // Should be read from package.json in production
    },
    confidenceDetails,
    reason,
  });
}
