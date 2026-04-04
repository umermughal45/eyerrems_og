"use strict";
/**
 * Correctness Contracts for Production-Grade AI Intelligence
 *
 * Every AI insight MUST pass these contracts before being returned.
 * Failure to pass → status: "insufficient_data" with clear explanation.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateContract = validateContract;
exports.createRefusalInsight = createRefusalInsight;
/**
 * Validate data against a correctness contract
 */
function validateContract(data, contract, timeRange) {
    const context = {
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
            legitimateData = legitimateData.filter((record) => {
                const status = record.status || record.Status || record.state;
                return !rule.exclude.statuses.includes(status);
            });
        }
        if (rule.exclude.conditions) {
            legitimateData = legitimateData.filter((record) => {
                for (const [key, value] of Object.entries(rule.exclude.conditions)) {
                    if (record[key] === value) {
                        return false;
                    }
                }
                return true;
            });
        }
        if (rule.exclude.validator) {
            legitimateData = legitimateData.filter((record) => !rule.exclude.validator(record));
        }
        excludedCount += beforeCount - legitimateData.length;
    }
    context.legitimateRecords = legitimateData.length;
    context.excludedCount = excludedCount;
    // Check minimum threshold
    let thresholdMet = false;
    if (contract.minimumThreshold.type === 'record_count') {
        thresholdMet = legitimateData.length >= contract.minimumThreshold.value;
    }
    else if (contract.minimumThreshold.type === 'time_range' && timeRange) {
        const daysDiff = (timeRange.end.getTime() - timeRange.start.getTime()) / (1000 * 60 * 60 * 24);
        const monthsDiff = daysDiff / 30;
        thresholdMet = monthsDiff >= contract.minimumThreshold.value;
    }
    else if (contract.minimumThreshold.type === 'coverage_percentage') {
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
function createRefusalInsight(contractName, reason, dataSources) {
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
//# sourceMappingURL=correctness-contracts.js.map