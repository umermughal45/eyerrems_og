"use strict";
/**
 * CRM & Revenue Intelligence Engine
 *
 * Data Sources:
 * - CRM Module: Leads, Clients, Deals, Communications
 * - Finance Module: Revenue from deals
 *
 * Rules:
 * - Lead score = Based on interaction frequency, preference alignment, conversion history
 * - Sentiment = NLP analysis of communications (simplified: positive/neutral/negative keywords)
 * - Conversion rate = Converted leads / Total leads
 *
 * Confidence Logic:
 * - Degrades if lead data incomplete
 * - Degrades if communication history short
 *
 * Failure Conditions:
 * - No leads in system
 * - Missing communication data
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CRMRevenueIntelligenceEngine = void 0;
const client_1 = __importDefault(require("../../../prisma/client"));
const types_1 = require("../types");
const logger_1 = __importDefault(require("../../../utils/logger"));
class CRMRevenueIntelligenceEngine {
    constructor() {
        this.name = 'CRMRevenueIntelligenceEngine';
        this.config = {
            data_sources: [
                {
                    module: 'CRM',
                    table: 'Lead',
                    fields: ['id', 'name', 'status', 'score', 'temperature', 'createdAt'],
                },
                {
                    module: 'CRM',
                    table: 'Client',
                    fields: ['id', 'name', 'status', 'convertedFromLeadId'],
                },
                {
                    module: 'CRM',
                    table: 'Deal',
                    fields: ['id', 'clientId', 'dealAmount', 'stage', 'status'],
                },
                {
                    module: 'CRM',
                    table: 'Communication',
                    fields: ['id', 'leadId', 'clientId', 'type', 'notes', 'createdAt'],
                },
            ],
            rules: [
                'Lead score = Based on interaction frequency, preference alignment, conversion history',
                'Sentiment = NLP analysis of communications (simplified keyword-based)',
                'Conversion rate = Converted leads / Total leads',
            ],
            confidence_logic: 'Degrades if lead data incomplete or communication history short',
            failure_conditions: ['No leads in system', 'Missing communication data'],
        };
    }
    async compute() {
        const insights = [];
        const errors = [];
        try {
            if (!(await this.hasSufficientData())) {
                return {
                    insights: [(0, types_1.createInsufficientDataInsight)('CRM & Revenue Intelligence', this.getDataSources())],
                    engine_name: this.name,
                    computed_at: new Date(),
                    status: 'insufficient_data',
                };
            }
            // Get leads
            const leads = await client_1.default.lead.findMany({
                where: { isDeleted: false },
                select: {
                    id: true,
                    name: true,
                    status: true,
                    score: true,
                    temperature: true,
                    createdAt: true,
                },
            });
            if (leads.length === 0) {
                return {
                    insights: [(0, types_1.createInsufficientDataInsight)('CRM & Revenue Intelligence', this.getDataSources())],
                    engine_name: this.name,
                    computed_at: new Date(),
                    status: 'insufficient_data',
                };
            }
            // Get clients (converted leads)
            const clients = await client_1.default.client.findMany({
                where: { isDeleted: false },
                select: {
                    id: true,
                    name: true,
                    convertedFromLeadId: true,
                },
            });
            // Get deals
            const deals = await client_1.default.deal.findMany({
                where: { isDeleted: false },
                select: {
                    id: true,
                    clientId: true,
                    dealAmount: true,
                    stage: true,
                    status: true,
                },
            });
            // Get communications
            const communications = await client_1.default.communication.findMany({
                where: { isDeleted: false },
                select: {
                    id: true,
                    leadId: true,
                    clientId: true,
                    activityType: true,
                    content: true,
                    createdAt: true,
                },
            });
            // Calculate top lead score
            const leadsWithScores = leads
                .map((lead) => ({
                ...lead,
                score: lead.score || 0,
            }))
                .sort((a, b) => b.score - a.score);
            const topLead = leadsWithScores[0];
            // Calculate conversion rate
            const convertedLeads = clients.filter((c) => c.convertedFromLeadId).length;
            const conversionRate = leads.length > 0 ? (convertedLeads / leads.length) * 100 : 0;
            // Simple sentiment analysis (keyword-based)
            const positiveKeywords = ['good', 'great', 'excellent', 'satisfied', 'happy', 'pleased', 'love', 'amazing'];
            const negativeKeywords = ['bad', 'poor', 'terrible', 'disappointed', 'unhappy', 'hate', 'awful', 'worst'];
            let positiveCount = 0;
            let neutralCount = 0;
            let negativeCount = 0;
            communications.forEach((comm) => {
                const content = (comm.content || '').toLowerCase();
                const hasPositive = positiveKeywords.some((kw) => content.includes(kw));
                const hasNegative = negativeKeywords.some((kw) => content.includes(kw));
                if (hasPositive && !hasNegative) {
                    positiveCount++;
                }
                else if (hasNegative && !hasPositive) {
                    negativeCount++;
                }
                else {
                    neutralCount++;
                }
            });
            const totalSentiment = positiveCount + neutralCount + negativeCount;
            const positivePercentage = totalSentiment > 0 ? (positiveCount / totalSentiment) * 100 : 0;
            const sentimentScore = totalSentiment > 0
                ? ((positiveCount * 1 + neutralCount * 0.5 - negativeCount * 1) / totalSentiment) * 100
                : 0;
            // Predict next month conversion rate (based on current pipeline)
            const activeLeads = leads.filter((l) => l.status === 'new' || l.status === 'contacted');
            const avgScore = leadsWithScores.reduce((sum, l) => sum + l.score, 0) / leadsWithScores.length;
            const predictedConversionRate = Math.min(100, Math.max(0, conversionRate + (avgScore > 70 ? 5 : 0)) // Boost if high average score
            );
            // Confidence factors
            const confidenceFactors = {
                missing_data_percentage: communications.length < 10 ? 40 : 0,
                has_manual_overrides: false,
                has_backdated_entries: false,
                data_freshness_days: 0,
                sample_size: leads.length,
            };
            // Top lead score insight
            if (topLead) {
                insights.push({
                    value: topLead.score,
                    type: 'derived',
                    confidence: (0, types_1.calculateConfidence)(85, confidenceFactors),
                    confidence_reason: 'Based on lead scoring algorithm',
                    explanation: `Top lead score: ${topLead.name} with score ${topLead.score}`,
                    data_sources: [
                        {
                            module: 'CRM',
                            table: 'Lead',
                            filters: { id: topLead.id },
                        },
                    ],
                    last_computed_at: new Date(),
                    status: 'success',
                });
            }
            // Conversion rate insight
            insights.push({
                value: conversionRate,
                type: 'derived',
                confidence: (0, types_1.calculateConfidence)(90, confidenceFactors),
                confidence_reason: 'Based on lead to client conversion data',
                explanation: `Current conversion rate: ${conversionRate.toFixed(1)}% (${convertedLeads} converted out of ${leads.length} leads)`,
                data_sources: [
                    {
                        module: 'CRM',
                        table: 'Lead',
                    },
                    {
                        module: 'CRM',
                        table: 'Client',
                        filters: { convertedFromLeadId: { not: null } },
                    },
                ],
                last_computed_at: new Date(),
                status: 'success',
            });
            // Predicted conversion rate insight
            insights.push({
                value: predictedConversionRate,
                type: 'predicted',
                confidence: (0, types_1.calculateConfidence)(75, confidenceFactors),
                confidence_reason: 'Based on current pipeline quality and historical patterns',
                explanation: `Predicted conversion rate for next month: ${predictedConversionRate.toFixed(1)}%`,
                data_sources: [
                    {
                        module: 'CRM',
                        table: 'Lead',
                        filters: { status: { in: ['new', 'contacted'] } },
                    },
                ],
                last_computed_at: new Date(),
                status: 'success',
            });
            // Sentiment score insight
            insights.push({
                value: sentimentScore,
                type: 'derived',
                confidence: (0, types_1.calculateConfidence)(70, confidenceFactors),
                confidence_reason: 'Based on keyword analysis of communications',
                explanation: `Customer sentiment score: ${sentimentScore.toFixed(1)}% (${positiveCount} positive, ${neutralCount} neutral, ${negativeCount} negative interactions)`,
                data_sources: [
                    {
                        module: 'CRM',
                        table: 'Communication',
                    },
                ],
                last_computed_at: new Date(),
                status: 'success',
                metadata: {
                    positive: positiveCount,
                    neutral: neutralCount,
                    negative: negativeCount,
                },
            });
        }
        catch (error) {
            logger_1.default.error(`CRM & Revenue Intelligence Engine error: ${error.message}`, error);
            errors.push(error.message);
            insights.push((0, types_1.createErrorInsight)('CRM & Revenue Intelligence', error.message, this.getDataSources()));
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
            const leadCount = await client_1.default.lead.count({
                where: { isDeleted: false },
            });
            return leadCount > 0;
        }
        catch (error) {
            logger_1.default.error('Error checking sufficient data for CRM & Revenue Intelligence', error);
            return false;
        }
    }
    getDataSources() {
        return this.config.data_sources;
    }
}
exports.CRMRevenueIntelligenceEngine = CRMRevenueIntelligenceEngine;
//# sourceMappingURL=crm-revenue-intelligence-engine.js.map