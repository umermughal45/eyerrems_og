"use strict";
/**
 * Construction Intelligence Engine
 *
 * Data Sources:
 * - Construction Module: Projects, Expenses, Tasks
 * - Finance Module: Construction-related transactions
 *
 * Rules:
 * - Project completion rate = Completed tasks / Total tasks
 * - Delay risk = Days behind schedule / Total days
 * - Cost overrun risk = (Actual cost - Budget) / Budget * 100
 *
 * Confidence Logic:
 * - Degrades if project data incomplete
 * - Degrades if budget data missing
 *
 * Failure Conditions:
 * - No construction projects
 * - Missing project financial data
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConstructionIntelligenceEngine = void 0;
const client_1 = __importDefault(require("../../../prisma/client"));
const types_1 = require("../types");
const logger_1 = __importDefault(require("../../../utils/logger"));
const probability_models_1 = require("../ml/probability-models");
class ConstructionIntelligenceEngine {
    constructor() {
        this.name = 'ConstructionIntelligenceEngine';
        this.config = {
            data_sources: [
                {
                    module: 'Construction',
                    table: 'ConstructionProject',
                    fields: ['id', 'name', 'startDate', 'endDate', 'status', 'budgetAmount'],
                },
                {
                    module: 'Construction',
                    table: 'ConstructionLabor, ConstructionEquipmentUsage, ConstructionConsumption',
                    fields: ['projectId', 'amount'],
                },
                {
                    module: 'Finance',
                    table: 'Transaction',
                    fields: ['amount', 'type', 'date', 'description'],
                },
            ],
            rules: [
                'Completion rate = Completed tasks / Total tasks',
                'Delay risk = Days behind schedule / Total days',
                'Cost overrun risk = (Actual cost - Budget) / Budget * 100',
            ],
            confidence_logic: 'Degrades if project data incomplete or budget data missing',
            failure_conditions: ['No construction projects', 'Missing project financial data'],
        };
    }
    async compute() {
        const insights = [];
        const errors = [];
        try {
            if (!(await this.hasSufficientData())) {
                return {
                    insights: [(0, types_1.createInsufficientDataInsight)('Construction Intelligence', this.getDataSources())],
                    engine_name: this.name,
                    computed_at: new Date(),
                    status: 'insufficient_data',
                };
            }
            // Get construction projects
            const projects = await client_1.default.constructionProject.findMany({
                where: { isDeleted: false },
                select: {
                    id: true,
                    name: true,
                    startDate: true,
                    endDate: true,
                    status: true,
                    budgetAmount: true,
                },
            });
            if (projects.length === 0) {
                return {
                    insights: [(0, types_1.createInsufficientDataInsight)('Construction Intelligence', this.getDataSources())],
                    engine_name: this.name,
                    computed_at: new Date(),
                    status: 'insufficient_data',
                };
            }
            // Get construction costs from labor, equipment, and consumption
            const labor = await client_1.default.constructionLabor.findMany({
                where: { isDeleted: false },
                select: {
                    projectId: true,
                    amount: true,
                    workDate: true,
                },
            });
            const equipment = await client_1.default.constructionEquipmentUsage.findMany({
                where: { isDeleted: false },
                select: {
                    projectId: true,
                    amount: true,
                    usageDate: true,
                },
            });
            const consumption = await client_1.default.constructionConsumption.findMany({
                where: { isDeleted: false },
                select: {
                    projectId: true,
                    totalAmount: true,
                    consumptionDate: true,
                },
            });
            // Calculate project completion rates
            const projectStats = [];
            for (const project of projects) {
                const projectLabor = labor.filter((e) => e.projectId === project.id);
                const projectEquipment = equipment.filter((e) => e.projectId === project.id);
                const projectConsumption = consumption.filter((e) => e.projectId === project.id);
                const actualCost = projectLabor.reduce((sum, e) => sum + Number(e.amount || 0), 0) +
                    projectEquipment.reduce((sum, e) => sum + Number(e.amount || 0), 0) +
                    projectConsumption.reduce((sum, e) => sum + Number(e.totalAmount || 0), 0);
                const budget = Number(project.budgetAmount || 0);
                // ML-based delay probability (APPROVED USE CASE)
                const now = new Date();
                if (!project.endDate || !project.startDate) {
                    // Skip projects without dates
                    continue;
                }
                const endDate = new Date(project.endDate);
                const startDate = new Date(project.startDate);
                const totalDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
                const daysElapsed = (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
                const expectedProgress = totalDays > 0 ? (daysElapsed / totalDays) * 100 : 0;
                const actualProgress = project.status === 'completed' ? 100 : expectedProgress;
                // Calculate budget utilization
                const budgetUtilization = budget > 0 ? (actualCost / budget) * 100 : 0;
                // ML-based delay probability
                const delayResult = (0, probability_models_1.calculateDelayProbability)({
                    expectedProgress,
                    actualProgress,
                    daysElapsed,
                    totalDays,
                    budgetUtilization,
                    historicalDelays: 0, // Could be enhanced with historical data
                    minConfidence: 70,
                });
                // Use ML prediction if available, otherwise fallback to rule-based
                const delayRisk = delayResult.method === 'ml' && delayResult.probability !== null
                    ? delayResult.probability
                    : expectedProgress > 1 ? (expectedProgress - 1) * 100 : 0;
                // Calculate cost overrun risk
                const costOverrunRisk = budget > 0 ? ((actualCost - budget) / budget) * 100 : 0;
                // Simple completion rate based on status
                let completionRate = 0;
                if (project.status === 'completed') {
                    completionRate = 100;
                }
                else if (project.status === 'in_progress') {
                    completionRate = Math.min(90, Math.max(10, expectedProgress * 100));
                }
                projectStats.push({
                    id: project.id,
                    name: project.name,
                    completionRate,
                    delayRisk,
                    costOverrunRisk,
                });
            }
            // Overall completion rate
            const overallCompletion = projectStats.reduce((sum, p) => sum + p.completionRate, 0) / projectStats.length;
            // Average delay risk
            const avgDelayRisk = projectStats.reduce((sum, p) => sum + p.delayRisk, 0) / projectStats.length;
            // High-risk projects (delay > 20% or cost overrun > 15%)
            const highRiskProjects = projectStats.filter((p) => p.delayRisk > 20 || p.costOverrunRisk > 15);
            // Predict next month delay risk (ML-augmented)
            const activeProjects = projects.filter((p) => p.status === 'active' || p.status === 'in-progress' || p.status === 'in_progress');
            // Calculate ML-based predictions for active projects
            const mlDelayPredictions = [];
            activeProjects.forEach((project) => {
                if (!project.endDate || !project.startDate)
                    return;
                const endDate = new Date(project.endDate);
                const startDate = new Date(project.startDate);
                const totalDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
                const daysElapsed = (new Date().getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
                const expectedProgress = totalDays > 0 ? (daysElapsed / totalDays) * 100 : 0;
                const projectLabor = labor.filter((e) => e.projectId === project.id);
                const projectEquipment = equipment.filter((e) => e.projectId === project.id);
                const projectConsumption = consumption.filter((e) => e.projectId === project.id);
                const actualCost = projectLabor.reduce((sum, e) => sum + Number(e.amount || 0), 0) +
                    projectEquipment.reduce((sum, e) => sum + Number(e.amount || 0), 0) +
                    projectConsumption.reduce((sum, e) => sum + Number(e.totalAmount || 0), 0);
                const budget = Number(project.budgetAmount || 0);
                const budgetUtilization = budget > 0 ? (actualCost / budget) * 100 : 0;
                const delayResult = (0, probability_models_1.calculateDelayProbability)({
                    expectedProgress,
                    actualProgress: expectedProgress, // Use expected as proxy for actual
                    daysElapsed,
                    totalDays,
                    budgetUtilization,
                    minConfidence: 70,
                });
                if (delayResult.method === 'ml' && delayResult.probability !== null) {
                    mlDelayPredictions.push(delayResult.probability);
                }
            });
            // Use ML average if available, otherwise rule-based
            let predictedDelayRisk;
            let delayMethod;
            if (mlDelayPredictions.length > 0) {
                predictedDelayRisk = mlDelayPredictions.reduce((a, b) => a + b, 0) / mlDelayPredictions.length;
                delayMethod = 'ML (probability model)';
            }
            else if (activeProjects.length > 0) {
                predictedDelayRisk = Math.min(100, avgDelayRisk * 1.1); // Rule-based fallback
                delayMethod = 'Rule-based (trend projection)';
            }
            else {
                predictedDelayRisk = 0;
                delayMethod = 'Rule-based';
            }
            // Confidence factors
            const confidenceFactors = {
                missing_data_percentage: projects.some((p) => !p.budgetAmount) ? 20 : 0,
                has_manual_overrides: false,
                has_backdated_entries: false,
                data_freshness_days: 0,
                sample_size: projects.length,
            };
            // Overall completion rate insight
            insights.push({
                value: overallCompletion,
                type: 'derived',
                confidence: (0, types_1.calculateConfidence)(90, confidenceFactors),
                confidence_reason: 'Based on project status and timeline analysis',
                explanation: `Overall project completion rate: ${overallCompletion.toFixed(1)}% across ${projects.length} projects`,
                data_sources: [
                    {
                        module: 'Construction',
                        table: 'Project',
                        filters: { isDeleted: false },
                    },
                ],
                last_computed_at: new Date(),
                status: 'success',
            });
            // Delay risk insight
            insights.push({
                value: avgDelayRisk,
                type: 'derived',
                confidence: (0, types_1.calculateConfidence)(85, confidenceFactors),
                confidence_reason: 'Based on project timeline analysis',
                explanation: `Average delay risk: ${avgDelayRisk.toFixed(1)}% across active projects`,
                data_sources: [
                    {
                        module: 'Construction',
                        table: 'Project',
                        filters: { status: 'in_progress' },
                    },
                ],
                last_computed_at: new Date(),
                status: 'success',
            });
            // Predicted delay risk insight (ML-augmented)
            const delayConfidence = mlDelayPredictions.length > 0
                ? Math.min(85, 75 + mlDelayPredictions.length * 2) // Higher confidence with ML
                : (0, types_1.calculateConfidence)(75, confidenceFactors);
            const delayStatus = delayConfidence >= 70 ? 'success' : delayConfidence >= 50 ? 'degraded' : 'insufficient_data';
            // Only include if confidence sufficient
            if (delayStatus !== 'insufficient_data' && predictedDelayRisk !== null) {
                insights.push({
                    value: predictedDelayRisk,
                    type: 'predicted',
                    confidence: delayConfidence,
                    confidence_reason: `Based on ${delayMethod.toLowerCase()}${mlDelayPredictions.length > 0 ? ` (${mlDelayPredictions.length} projects analyzed)` : ''}`,
                    explanation: `Predicted delay risk for next month: ${predictedDelayRisk.toFixed(1)}% using ${delayMethod.toLowerCase()}${mlDelayPredictions.length > 0 ? `. Analyzed ${mlDelayPredictions.length} active projects` : ''}`,
                    data_sources: [
                        {
                            module: 'Construction',
                            table: 'ConstructionProject',
                            filters: { status: { in: ['active', 'in-progress', 'in_progress'] } },
                        },
                    ],
                    last_computed_at: new Date(),
                    status: delayStatus,
                    metadata: {
                        method: mlDelayPredictions.length > 0 ? 'ml' : 'rule_based',
                        method_label: delayMethod,
                        projects_analyzed: mlDelayPredictions.length,
                    },
                });
            }
            // High-risk projects count
            insights.push({
                value: highRiskProjects.length,
                type: 'derived',
                confidence: (0, types_1.calculateConfidence)(88, confidenceFactors),
                confidence_reason: 'Based on delay and cost overrun analysis',
                explanation: `${highRiskProjects.length} projects identified with high delay risk (>20%) or cost overrun risk (>15%)`,
                data_sources: [
                    {
                        module: 'Construction',
                        table: 'Project',
                    },
                    {
                        module: 'Construction',
                        table: 'ConstructionExpense',
                    },
                ],
                last_computed_at: new Date(),
                status: 'success',
            });
        }
        catch (error) {
            logger_1.default.error(`Construction Intelligence Engine error: ${error.message}`, error);
            errors.push(error.message);
            insights.push((0, types_1.createErrorInsight)('Construction Intelligence', error.message, this.getDataSources()));
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
            const projectCount = await client_1.default.constructionProject.count({
                where: { isDeleted: false },
            });
            return projectCount > 0;
        }
        catch (error) {
            logger_1.default.error('Error checking sufficient data for Construction Intelligence', error);
            return false;
        }
    }
    getDataSources() {
        return this.config.data_sources;
    }
}
exports.ConstructionIntelligenceEngine = ConstructionIntelligenceEngine;
//# sourceMappingURL=construction-intelligence-engine.js.map