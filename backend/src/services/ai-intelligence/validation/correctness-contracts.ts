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
    unit?: string; // 'months', 'days', 'records', 'percentage'
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
  timeRange?: { start: Date; end: Date };
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
export function validateContract(
  data: any[],
  contract: CorrectnessContract,
  timeRange?: { start: Date; end: Date }
): ContractResult {
  const context: ValidationContext = {
    totalRecords: data.length,
    legitimateRecords: 0,
    timeRange,
    statusCounts: {},
    missingDataPercentage: 0,
    anomalyPercentage: 0,
  };

  // Apply legitimacy rules
  let legitimateData = [...data];
  let excludedCount = 0;

  for (const rule of contract.legitimacyRules) {
    const beforeCount = legitimateData.length;
    
    if (rule.exclude.statuses) {
      legitimateData = legitimateData.filter((record: any) => {
        const status = record.status || record.Status || record.state;
        return !rule.exclude.statuses!.includes(status);
      });
    }
    
    if (rule.exclude.conditions) {
      legitimateData = legitimateData.filter((record: any) => {
        for (const [key, value] of Object.entries(rule.exclude.conditions!)) {
          if (record[key] === value) {
            return false;
          }
        }
        return true;
      });
    }
    
    if (rule.exclude.validator) {
      legitimateData = legitimateData.filter((record: any) => 
        !rule.exclude.validator!(record)
      );
    }
    
    excludedCount += beforeCount - legitimateData.length;
  }

  context.legitimateRecords = legitimateData.length;
  context.excludedCount = excludedCount;

  // Check minimum threshold
  let thresholdMet = false;
  if (contract.minimumThreshold.type === 'record_count') {
    thresholdMet = legitimateData.length >= contract.minimumThreshold.value;
  } else if (contract.minimumThreshold.type === 'time_range' && timeRange) {
    const daysDiff = (timeRange.end.getTime() - timeRange.start.getTime()) / (1000 * 60 * 60 * 24);
    const monthsDiff = daysDiff / 30;
    thresholdMet = monthsDiff >= contract.minimumThreshold.value;
  } else if (contract.minimumThreshold.type === 'coverage_percentage') {
    const coverage = (legitimateData.length / Math.max(1, data.length)) * 100;
    thresholdMet = coverage >= contract.minimumThreshold.value;
  }

  if (!thresholdMet) {
    return {
      passed: false,
      failureReason: `Minimum threshold not met: ${contract.minimumThreshold.type} ${contract.minimumThreshold.value}${contract.minimumThreshold.unit || ''} required, but found ${legitimateData.length} legitimate records`,
      context,
      legitimateCount: legitimateData.length,
      excludedCount,
    };
  }

  // Check business rules
  for (const rule of contract.businessRules) {
    if (!rule.validator(legitimateData, context)) {
      return {
        passed: false,
        failureReason: rule.errorMessage,
        context,
        legitimateCount: legitimateData.length,
        excludedCount,
      };
    }
  }

  // Check refusal conditions
  for (const condition of contract.refusalConditions) {
    if (condition.check(legitimateData, context)) {
      return {
        passed: false,
        failureReason: condition.reason,
        context,
        legitimateCount: legitimateData.length,
        excludedCount,
      };
    }
  }

  return {
    passed: true,
    context,
    legitimateCount: legitimateData.length,
    excludedCount,
  };
}

/**
 * Create a refusal insight (AI knows when to be silent)
 */
export function createRefusalInsight(
  contractName: string,
  reason: string,
  dataSources: DataSource[]
): AIInsight {
  return {
    value: null,
    type: 'predicted',
    confidence: 0,
    confidence_reason: 'Refused due to data quality or business rule violation',
    explanation: `${contractName} cannot be computed: ${reason}. No insight generated to maintain accuracy and auditability.`,
    data_sources: dataSources,
    last_computed_at: new Date(),
    status: 'insufficient_data',
    metadata: {
      method: 'insufficient_data',
      refusal_reason: reason,
    },
  };
}
