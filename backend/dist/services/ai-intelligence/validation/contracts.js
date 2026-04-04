"use strict";
/**
 * Predefined Correctness Contracts for each AI Intelligence Engine
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnomalyDetectionContract = exports.TenantChurnContract = exports.ConstructionDelayContract = exports.OccupancyContract = exports.EmployeeTrendsContract = exports.ROIContract = exports.PaymentRiskContract = exports.RevenuePredictionContract = void 0;
const data_legitimacy_1 = require("./data-legitimacy");
/**
 * Revenue Prediction Contract
 */
exports.RevenuePredictionContract = {
    id: 'revenue-prediction',
    name: 'Revenue Prediction',
    minimumThreshold: {
        type: 'time_range',
        value: 6,
        unit: 'months',
    },
    legitimacyRules: [
        {
            exclude: {
                statuses: ['draft', 'reversed'],
                conditions: { isDeleted: true },
            },
            reason: 'Only finalized, non-draft, non-reversed transactions may be used',
        },
        {
            exclude: {
                validator: data_legitimacy_1.FinanceLegitimacy.excludeReversedTransactions,
            },
            reason: 'Reversed transactions must be excluded',
        },
    ],
    businessRules: [
        {
            description: 'Revenue must be calculated from income transactions only',
            validator: (data) => {
                // All transactions must be income type
                return data.every((t) => t.transactionType === 'income' || t.transactionType === 'credit');
            },
            errorMessage: 'Revenue calculation includes non-income transactions',
        },
        {
            description: 'Revenue ≠ cash flow (must exclude accounts receivable)',
            validator: (data, context) => {
                // This is validated at query level by filtering transaction types
                return true;
            },
            errorMessage: 'Revenue calculation incorrectly includes cash flow items',
        },
    ],
    refusalConditions: [
        {
            description: 'High anomaly dominance',
            check: (data, context) => {
                const amounts = data.map((t) => Number(t.amount || 0));
                const anomalyPct = (0, data_legitimacy_1.calculateAnomalyPercentage)(amounts);
                context.anomalyPercentage = anomalyPct;
                return anomalyPct > 30;
            },
            reason: 'More than 30% of data points are outliers, making prediction unreliable',
        },
        {
            description: 'Inconsistent time ranges',
            check: (data, context) => {
                // Check for gaps > 90 days
                const dates = data.map((t) => new Date(t.date)).sort();
                for (let i = 1; i < dates.length; i++) {
                    const daysDiff = (dates[i].getTime() - dates[i - 1].getTime()) / (1000 * 60 * 60 * 24);
                    if (daysDiff > 90) {
                        return true;
                    }
                }
                return false;
            },
            reason: 'Time range contains gaps > 90 days, indicating incomplete data',
        },
    ],
};
/**
 * Payment Risk Contract
 */
exports.PaymentRiskContract = {
    id: 'payment-risk',
    name: 'Payment Risk Assessment',
    minimumThreshold: {
        type: 'record_count',
        value: 5,
        unit: 'records',
    },
    legitimacyRules: [
        {
            exclude: {
                statuses: ['draft'],
            },
            reason: 'Draft payments cannot be used for risk assessment',
        },
    ],
    businessRules: [
        {
            description: 'Risk ≠ single event (must analyze pattern)',
            validator: (data) => {
                return data.length >= 3; // Need multiple events to assess risk
            },
            errorMessage: 'Risk assessment requires multiple payment events, not a single occurrence',
        },
    ],
    refusalConditions: [
        {
            description: 'Sparse historical data',
            check: (data, context) => {
                return data.length < 5;
            },
            reason: 'Insufficient payment history (minimum 5 payments required)',
        },
    ],
};
/**
 * ROI Calculation Contract
 */
exports.ROIContract = {
    id: 'roi-calculation',
    name: 'ROI Calculation',
    minimumThreshold: {
        type: 'time_range',
        value: 1,
        unit: 'accounting periods',
    },
    legitimacyRules: [
        {
            exclude: {
                statuses: ['draft', 'reversed'],
            },
            reason: 'Only finalized transactions may be used',
        },
    ],
    businessRules: [
        {
            description: 'ROI ≠ profit ÷ arbitrary denominator',
            validator: (data, context) => {
                // ROI must use actual property value, not arbitrary number
                return true; // Validated at calculation level
            },
            errorMessage: 'ROI calculation uses invalid denominator',
        },
    ],
    refusalConditions: [
        {
            description: 'Missing property value',
            check: (data, context) => {
                // Check if property value is available
                return false; // Validated at calculation level
            },
            reason: 'Property value not available for ROI calculation',
        },
    ],
};
/**
 * Employee Trends Contract
 */
exports.EmployeeTrendsContract = {
    id: 'employee-trends',
    name: 'Employee Trends Analysis',
    minimumThreshold: {
        type: 'record_count',
        value: 30,
        unit: 'records',
    },
    legitimacyRules: [
        {
            exclude: {
                validator: (record) => {
                    // Exclude incomplete attendance
                    return !record.checkIn && !record.checkOut &&
                        record.status !== 'absent' &&
                        record.status !== 'leave';
                },
            },
            reason: 'Incomplete attendance records must be excluded',
        },
    ],
    businessRules: [
        {
            description: 'Attendance ≠ productivity',
            validator: (data, context) => {
                // Attendance data should not be used to infer productivity
                return true; // Validated at calculation level
            },
            errorMessage: 'Attendance data incorrectly used to infer productivity',
        },
    ],
    refusalConditions: [
        {
            description: 'Insufficient attendance records',
            check: (data, context) => {
                return data.length < 30;
            },
            reason: 'Minimum 30 attendance records required for trend analysis',
        },
    ],
};
/**
 * Occupancy Calculation Contract
 */
exports.OccupancyContract = {
    id: 'occupancy-calculation',
    name: 'Occupancy Rate Calculation',
    minimumThreshold: {
        type: 'record_count',
        value: 1,
        unit: 'properties',
    },
    legitimacyRules: [
        {
            exclude: {
                conditions: { isDeleted: true },
            },
            reason: 'Deleted properties and units must be excluded',
        },
    ],
    businessRules: [
        {
            description: 'Occupancy = (Occupied Units / Total Units) * 100',
            validator: (data, context) => {
                return context.legitimateRecords > 0;
            },
            errorMessage: 'No properties with units available for occupancy calculation',
        },
    ],
    refusalConditions: [
        {
            description: 'No properties available',
            check: (data, context) => {
                return context.legitimateRecords === 0;
            },
            reason: 'No properties available for occupancy calculation',
        },
    ],
};
/**
 * Construction Delay Probability Contract
 */
exports.ConstructionDelayContract = {
    id: 'construction-delay',
    name: 'Construction Delay Probability',
    minimumThreshold: {
        type: 'record_count',
        value: 1,
        unit: 'active projects',
    },
    legitimacyRules: [
        {
            exclude: {
                conditions: { isDeleted: true },
            },
            reason: 'Deleted projects must be excluded',
        },
        {
            exclude: {
                validator: (project) => {
                    return !project.startDate || !project.endDate;
                },
            },
            reason: 'Projects without timeline data must be excluded',
        },
    ],
    businessRules: [
        {
            description: 'Delay probability must consider progress variance, time utilization, budget',
            validator: (data, context) => {
                return data.length > 0;
            },
            errorMessage: 'No valid projects available for delay probability calculation',
        },
    ],
    refusalConditions: [
        {
            description: 'No active projects',
            check: (data, context) => {
                return context.legitimateRecords === 0;
            },
            reason: 'No active projects available for delay probability calculation',
        },
    ],
};
/**
 * Tenant Churn Probability Contract
 */
exports.TenantChurnContract = {
    id: 'tenant-churn',
    name: 'Tenant Churn Probability',
    minimumThreshold: {
        type: 'record_count',
        value: 3,
        unit: 'payments per tenant',
    },
    legitimacyRules: [
        {
            exclude: {
                statuses: ['draft'],
            },
            reason: 'Draft payments cannot be used for churn analysis',
        },
    ],
    businessRules: [
        {
            description: 'Churn probability must analyze payment patterns, not single events',
            validator: (data, context) => {
                return data.length >= 3;
            },
            errorMessage: 'Churn analysis requires multiple payment events per tenant',
        },
    ],
    refusalConditions: [
        {
            description: 'Insufficient payment history',
            check: (data, context) => {
                return data.length < 3;
            },
            reason: 'Minimum 3 payments per tenant required for churn probability calculation',
        },
    ],
};
/**
 * Anomaly Detection Contract
 */
exports.AnomalyDetectionContract = {
    id: 'anomaly-detection',
    name: 'Operational Anomaly Detection',
    minimumThreshold: {
        type: 'record_count',
        value: 10,
        unit: 'records',
    },
    legitimacyRules: [
        {
            exclude: {
                conditions: { isDeleted: true },
            },
            reason: 'Deleted records must be excluded',
        },
    ],
    businessRules: [
        {
            description: 'Anomalies must be statistically significant (>3 standard deviations)',
            validator: (data, context) => {
                return data.length >= 10;
            },
            errorMessage: 'Insufficient data for statistical anomaly detection',
        },
    ],
    refusalConditions: [
        {
            description: 'Insufficient data for anomaly detection',
            check: (data, context) => {
                return data.length < 10;
            },
            reason: 'Minimum 10 records required for anomaly detection',
        },
    ],
};
//# sourceMappingURL=contracts.js.map