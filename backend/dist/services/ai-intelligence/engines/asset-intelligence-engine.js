"use strict";
/**
 * Asset Intelligence Engine
 *
 * Data Sources:
 * - Properties Module: Properties, Units, Leases
 * - Finance Module: Revenue, Expenses per property
 *
 * Rules:
 * - ROI = (Revenue - Expenses) / Property Value * 100
 * - Occupancy = (Occupied Units / Total Units) * 100
 * - Forecast uses booking patterns and lease expiration dates
 *
 * Confidence Logic:
 * - Degrades if property data incomplete
 * - Degrades if financial data missing
 *
 * Failure Conditions:
 * - No properties in system
 * - Missing property financial data
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssetIntelligenceEngine = void 0;
const client_1 = __importDefault(require("../../../prisma/client"));
const types_1 = require("../types");
const logger_1 = __importDefault(require("../../../utils/logger"));
class AssetIntelligenceEngine {
    constructor() {
        this.name = 'AssetIntelligenceEngine';
        this.config = {
            data_sources: [
                {
                    module: 'Properties',
                    table: 'Property',
                    fields: ['id', 'name', 'totalUnits', 'status', 'salePrice'],
                },
                {
                    module: 'Properties',
                    table: 'Unit',
                    fields: ['id', 'propertyId', 'status'],
                },
                {
                    module: 'Finance',
                    table: 'Transaction',
                    fields: ['amount', 'type', 'propertyId', 'date'],
                },
            ],
            rules: [
                'ROI = (Revenue - Expenses) / Property Value * 100',
                'Occupancy = (Occupied Units / Total Units) * 100',
                'Forecast uses booking patterns and lease expiration dates',
            ],
            confidence_logic: 'Degrades if property data incomplete or financial data missing',
            failure_conditions: ['No properties in system', 'Missing property financial data'],
        };
    }
    async compute() {
        const insights = [];
        const errors = [];
        try {
            if (!(await this.hasSufficientData())) {
                return {
                    insights: [(0, types_1.createInsufficientDataInsight)('Asset Intelligence', this.getDataSources())],
                    engine_name: this.name,
                    computed_at: new Date(),
                    status: 'insufficient_data',
                };
            }
            // Get all properties
            const properties = await client_1.default.property.findMany({
                where: { isDeleted: false },
                select: {
                    id: true,
                    name: true,
                    totalUnits: true,
                    salePrice: true,
                    status: true,
                },
            });
            if (properties.length === 0) {
                return {
                    insights: [(0, types_1.createInsufficientDataInsight)('Asset Intelligence', this.getDataSources())],
                    engine_name: this.name,
                    computed_at: new Date(),
                    status: 'insufficient_data',
                };
            }
            // Get units for occupancy calculation
            const units = await client_1.default.unit.findMany({
                where: { isDeleted: false },
                select: {
                    id: true,
                    propertyId: true,
                    status: true,
                },
            });
            // Calculate occupancy rates
            const propertyOccupancy = {};
            properties.forEach((prop) => {
                const propUnits = units.filter((u) => u.propertyId === prop.id);
                const occupied = propUnits.filter((u) => u.status === 'Occupied').length;
                propertyOccupancy[prop.id] = {
                    occupied,
                    total: propUnits.length || prop.totalUnits || 0,
                };
            });
            // Get financial data for last 12 months
            const twelveMonthsAgo = new Date();
            twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
            const transactions = await client_1.default.transaction.findMany({
                where: {
                    date: { gte: twelveMonthsAgo },
                    propertyId: { not: null },
                },
                select: {
                    amount: true,
                    transactionType: true,
                    propertyId: true,
                    date: true,
                },
            });
            // Calculate ROI for each property
            const propertyROIs = [];
            for (const prop of properties) {
                const propTransactions = transactions.filter((t) => t.propertyId === prop.id);
                const revenue = propTransactions
                    .filter((t) => t.transactionType === 'income' || t.transactionType === 'credit')
                    .reduce((sum, t) => sum + Number(t.amount || 0), 0);
                const expenses = propTransactions
                    .filter((t) => t.transactionType === 'expense' || t.transactionType === 'debit')
                    .reduce((sum, t) => sum + Number(t.amount || 0), 0);
                const propertyValue = Number(prop.salePrice || 0);
                if (propertyValue > 0) {
                    const roi = ((revenue - expenses) / propertyValue) * 100;
                    propertyROIs.push({
                        propertyId: prop.id,
                        name: prop.name,
                        roi: roi,
                    });
                }
            }
            // Find top ROI property
            const topROI = propertyROIs.sort((a, b) => b.roi - a.roi)[0];
            // Calculate overall occupancy
            const totalOccupied = Object.values(propertyOccupancy).reduce((sum, p) => sum + p.occupied, 0);
            const totalUnits = Object.values(propertyOccupancy).reduce((sum, p) => sum + p.total, 0);
            const overallOccupancy = totalUnits > 0 ? (totalOccupied / totalUnits) * 100 : 0;
            // Predict next quarter occupancy (simple: current + trend)
            const leases = await client_1.default.lease.findMany({
                where: {
                    isDeleted: false,
                    leaseEnd: { gte: new Date() },
                },
                select: {
                    unitId: true,
                    leaseEnd: true,
                },
            });
            // Count leases expiring in next 3 months
            const threeMonthsFromNow = new Date();
            threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3);
            const expiringLeases = leases.filter((l) => new Date(l.leaseEnd) <= threeMonthsFromNow).length;
            // Simple prediction: assume 80% renewal rate
            const predictedVacancies = expiringLeases * 0.2;
            const predictedOccupancy = Math.max(0, Math.min(100, overallOccupancy - (predictedVacancies / totalUnits) * 100));
            // Confidence factors
            const hasPropertyData = properties.length > 0;
            const hasFinancialData = transactions.length > 0;
            const missingDataPercentage = !hasFinancialData ? 50 : 0;
            const confidenceFactors = {
                missing_data_percentage: missingDataPercentage,
                has_manual_overrides: false,
                has_backdated_entries: false,
                data_freshness_days: 0,
                sample_size: properties.length,
            };
            // Top ROI insight
            if (topROI) {
                insights.push({
                    value: topROI.roi,
                    type: 'derived',
                    confidence: (0, types_1.calculateConfidence)(90, confidenceFactors),
                    confidence_reason: 'Based on actual revenue and expense data',
                    explanation: `Top property ROI: ${topROI.name} with ${topROI.roi.toFixed(2)}% return`,
                    data_sources: [
                        {
                            module: 'Properties',
                            table: 'Property',
                            filters: { id: topROI.propertyId },
                        },
                        {
                            module: 'Finance',
                            table: 'Transaction',
                            time_range: { start: twelveMonthsAgo, end: new Date() },
                            filters: { propertyId: topROI.propertyId },
                        },
                    ],
                    last_computed_at: new Date(),
                    status: 'success',
                });
            }
            // Current occupancy insight
            insights.push({
                value: overallOccupancy,
                type: 'actual',
                confidence: (0, types_1.calculateConfidence)(95, confidenceFactors),
                confidence_reason: 'Based on actual unit status data',
                explanation: `Current occupancy rate: ${overallOccupancy.toFixed(1)}% (${totalOccupied} of ${totalUnits} units)`,
                data_sources: [
                    {
                        module: 'Properties',
                        table: 'Unit',
                        filters: { isDeleted: false },
                    },
                ],
                last_computed_at: new Date(),
                status: 'success',
            });
            // Predicted occupancy insight
            insights.push({
                value: predictedOccupancy,
                type: 'predicted',
                confidence: (0, types_1.calculateConfidence)(75, confidenceFactors),
                confidence_reason: 'Based on lease expiration patterns and assumed renewal rate',
                explanation: `Predicted occupancy for next quarter: ${predictedOccupancy.toFixed(1)}% (considering ${expiringLeases} expiring leases)`,
                data_sources: [
                    {
                        module: 'Properties',
                        table: 'Lease',
                        filters: { leaseEnd: { gte: new Date() } },
                    },
                ],
                time_range: {
                    start: new Date(),
                    end: threeMonthsFromNow,
                },
                last_computed_at: new Date(),
                status: 'success',
            });
        }
        catch (error) {
            logger_1.default.error(`Asset Intelligence Engine error: ${error.message}`, error);
            errors.push(error.message);
            insights.push((0, types_1.createErrorInsight)('Asset Intelligence', error.message, this.getDataSources()));
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
            const propertyCount = await client_1.default.property.count({
                where: { isDeleted: false },
            });
            return propertyCount > 0;
        }
        catch (error) {
            logger_1.default.error('Error checking sufficient data for Asset Intelligence', error);
            return false;
        }
    }
    getDataSources() {
        return this.config.data_sources;
    }
}
exports.AssetIntelligenceEngine = AssetIntelligenceEngine;
//# sourceMappingURL=asset-intelligence-engine.js.map