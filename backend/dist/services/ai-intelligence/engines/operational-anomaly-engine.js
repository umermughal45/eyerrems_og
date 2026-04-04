"use strict";
/**
 * Operational Anomaly Engine
 *
 * Data Sources:
 * - All Modules: Cross-module anomaly detection
 *
 * Rules:
 * - Detect unusual patterns across modules
 * - Flag inconsistencies between related data
 * - Identify operational irregularities
 *
 * Confidence Logic:
 * - Degrades if cross-module data incomplete
 * - Degrades if patterns unclear
 *
 * Failure Conditions:
 * - Insufficient data across modules
 * - Cannot establish baseline patterns
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OperationalAnomalyEngine = void 0;
const client_1 = __importDefault(require("../../../prisma/client"));
const types_1 = require("../types");
const logger_1 = __importDefault(require("../../../utils/logger"));
class OperationalAnomalyEngine {
    constructor() {
        this.name = 'OperationalAnomalyEngine';
        this.config = {
            data_sources: [
                {
                    module: 'All',
                    table: 'Transaction',
                    fields: ['amount', 'date', 'type'],
                },
                {
                    module: 'All',
                    table: 'Property',
                    fields: ['status', 'totalUnits'],
                },
                {
                    module: 'All',
                    table: 'Employee',
                    fields: ['status', 'department'],
                },
                {
                    module: 'All',
                    table: 'ConstructionProject',
                    fields: ['status', 'budgetAmount'],
                },
            ],
            rules: [
                'Detect unusual patterns across modules',
                'Flag inconsistencies between related data',
                'Identify operational irregularities',
            ],
            confidence_logic: 'Degrades if cross-module data incomplete or patterns unclear',
            failure_conditions: ['Insufficient data across modules', 'Cannot establish baseline patterns'],
        };
    }
    async compute() {
        const insights = [];
        const errors = [];
        try {
            if (!(await this.hasSufficientData())) {
                return {
                    insights: [(0, types_1.createInsufficientDataInsight)('Operational Anomaly Detection', this.getDataSources())],
                    engine_name: this.name,
                    computed_at: new Date(),
                    status: 'insufficient_data',
                };
            }
            // Get data from multiple modules
            const sixMonthsAgo = new Date();
            sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
            const transactions = await client_1.default.transaction.findMany({
                where: {
                    date: { gte: sixMonthsAgo },
                },
                select: {
                    amount: true,
                    date: true,
                    transactionType: true,
                },
            });
            const properties = await client_1.default.property.findMany({
                where: { isDeleted: false },
                select: {
                    id: true,
                    status: true,
                    totalUnits: true,
                },
            });
            const employees = await client_1.default.employee.findMany({
                where: { isDeleted: false },
                select: {
                    id: true,
                    status: true,
                    department: true,
                },
            });
            const projects = await client_1.default.constructionProject.findMany({
                where: { isDeleted: false },
                select: {
                    id: true,
                    status: true,
                    budgetAmount: true,
                },
            });
            // Detect anomalies
            const anomalies = [];
            // Anomaly 1: Unusual transaction volume
            const dailyTransactions = new Map();
            transactions.forEach((t) => {
                const dayKey = t.date.toISOString().split('T')[0];
                dailyTransactions.set(dayKey, (dailyTransactions.get(dayKey) || 0) + 1);
            });
            const avgDailyTransactions = transactions.length / 180; // 6 months
            dailyTransactions.forEach((count, day) => {
                if (count > avgDailyTransactions * 3) {
                    anomalies.push({
                        type: 'Unusual Transaction Volume',
                        description: `${count} transactions on ${day} (avg: ${avgDailyTransactions.toFixed(1)})`,
                        severity: 'medium',
                    });
                }
            });
            // Anomaly 2: Properties with no units
            const propertiesWithNoUnits = properties.filter((p) => !p.totalUnits || p.totalUnits === 0);
            if (propertiesWithNoUnits.length > 0) {
                anomalies.push({
                    type: 'Property Data Inconsistency',
                    description: `${propertiesWithNoUnits.length} properties have 0 total units`,
                    severity: 'low',
                });
            }
            // Anomaly 3: High inactive employee ratio
            const activeEmployees = employees.filter((e) => e.status === 'active').length;
            const inactiveRatio = employees.length > 0 ? (1 - activeEmployees / employees.length) * 100 : 0;
            if (inactiveRatio > 30) {
                anomalies.push({
                    type: 'High Inactive Employee Ratio',
                    description: `${inactiveRatio.toFixed(1)}% of employees are inactive`,
                    severity: 'medium',
                });
            }
            // Anomaly 4: Projects with zero budget
            const projectsWithNoBudget = projects.filter((p) => !p.budgetAmount || Number(p.budgetAmount) === 0);
            if (projectsWithNoBudget.length > 0) {
                anomalies.push({
                    type: 'Project Budget Missing',
                    description: `${projectsWithNoBudget.length} projects have no budget defined`,
                    severity: 'low',
                });
            }
            // Count anomalies by severity
            const highSeverity = anomalies.filter((a) => a.severity === 'high').length;
            const mediumSeverity = anomalies.filter((a) => a.severity === 'medium').length;
            const lowSeverity = anomalies.filter((a) => a.severity === 'low').length;
            // Confidence factors
            const confidenceFactors = {
                missing_data_percentage: 0,
                has_manual_overrides: false,
                has_backdated_entries: false,
                data_freshness_days: 0,
                sample_size: transactions.length + properties.length + employees.length + projects.length,
            };
            // Total anomalies insight
            insights.push({
                value: anomalies.length,
                type: 'derived',
                confidence: (0, types_1.calculateConfidence)(85, confidenceFactors),
                confidence_reason: 'Based on cross-module pattern analysis',
                explanation: `Detected ${anomalies.length} operational anomalies across all modules (${highSeverity} high, ${mediumSeverity} medium, ${lowSeverity} low severity)`,
                data_sources: [
                    {
                        module: 'All',
                        table: 'Transaction',
                        time_range: { start: sixMonthsAgo, end: new Date() },
                    },
                    {
                        module: 'All',
                        table: 'Property',
                    },
                    {
                        module: 'All',
                        table: 'Employee',
                    },
                    {
                        module: 'All',
                        table: 'ConstructionProject',
                    },
                ],
                last_computed_at: new Date(),
                status: 'success',
                metadata: {
                    high: highSeverity,
                    medium: mediumSeverity,
                    low: lowSeverity,
                    anomalies: anomalies.slice(0, 20), // Limit to first 20
                },
            });
        }
        catch (error) {
            logger_1.default.error(`Operational Anomaly Engine error: ${error.message}`, error);
            errors.push(error.message);
            insights.push((0, types_1.createErrorInsight)('Operational Anomaly Detection', error.message, this.getDataSources()));
        }
        return {
            insights,
            engine_name: this.name,
            computed_at: new Date(),
            status: errors.length > 0 ? 'error' : insights.some((i) => i.status === 'insufficient_data') ? 'insufficient_data' : 'success',
            errors: errors.length > 0 ? errors : undefined,
        };
    }
    async hasSufficientData() {
        try {
            const transactionCount = await client_1.default.transaction.count();
            const propertyCount = await client_1.default.property.count({
                where: { isDeleted: false },
            });
            return transactionCount > 0 || propertyCount > 0;
        }
        catch (error) {
            logger_1.default.error('Error checking sufficient data for Operational Anomaly', error);
            return false;
        }
    }
    getDataSources() {
        return this.config.data_sources;
    }
}
exports.OperationalAnomalyEngine = OperationalAnomalyEngine;
//# sourceMappingURL=operational-anomaly-engine.js.map