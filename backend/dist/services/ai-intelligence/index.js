"use strict";
/**
 * AI Intelligence Service - Main Orchestrator
 *
 * Coordinates all AI Intelligence engines
 * Handles caching and event-driven recalculation
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIAssistantEngine = exports.OperationalAnomalyEngine = exports.TenantIntelligenceEngine = exports.CRMRevenueIntelligenceEngine = exports.WorkforceIntelligenceEngine = exports.ConstructionIntelligenceEngine = exports.TransactionRiskEngine = exports.AssetIntelligenceEngine = exports.FinancialIntelligenceEngine = exports.aiIntelligenceService = exports.AIIntelligenceService = void 0;
const cache_1 = require("./cache");
const financial_intelligence_engine_1 = require("./engines/financial-intelligence-engine");
Object.defineProperty(exports, "FinancialIntelligenceEngine", { enumerable: true, get: function () { return financial_intelligence_engine_1.FinancialIntelligenceEngine; } });
const asset_intelligence_engine_1 = require("./engines/asset-intelligence-engine");
Object.defineProperty(exports, "AssetIntelligenceEngine", { enumerable: true, get: function () { return asset_intelligence_engine_1.AssetIntelligenceEngine; } });
const transaction_risk_engine_1 = require("./engines/transaction-risk-engine");
Object.defineProperty(exports, "TransactionRiskEngine", { enumerable: true, get: function () { return transaction_risk_engine_1.TransactionRiskEngine; } });
const construction_intelligence_engine_1 = require("./engines/construction-intelligence-engine");
Object.defineProperty(exports, "ConstructionIntelligenceEngine", { enumerable: true, get: function () { return construction_intelligence_engine_1.ConstructionIntelligenceEngine; } });
const workforce_intelligence_engine_1 = require("./engines/workforce-intelligence-engine");
Object.defineProperty(exports, "WorkforceIntelligenceEngine", { enumerable: true, get: function () { return workforce_intelligence_engine_1.WorkforceIntelligenceEngine; } });
const crm_revenue_intelligence_engine_1 = require("./engines/crm-revenue-intelligence-engine");
Object.defineProperty(exports, "CRMRevenueIntelligenceEngine", { enumerable: true, get: function () { return crm_revenue_intelligence_engine_1.CRMRevenueIntelligenceEngine; } });
const tenant_intelligence_engine_1 = require("./engines/tenant-intelligence-engine");
Object.defineProperty(exports, "TenantIntelligenceEngine", { enumerable: true, get: function () { return tenant_intelligence_engine_1.TenantIntelligenceEngine; } });
const operational_anomaly_engine_1 = require("./engines/operational-anomaly-engine");
Object.defineProperty(exports, "OperationalAnomalyEngine", { enumerable: true, get: function () { return operational_anomaly_engine_1.OperationalAnomalyEngine; } });
const ai_assistant_engine_1 = require("./engines/ai-assistant-engine");
Object.defineProperty(exports, "AIAssistantEngine", { enumerable: true, get: function () { return ai_assistant_engine_1.AIAssistantEngine; } });
const logger_1 = __importDefault(require("../../utils/logger"));
class AIIntelligenceService {
    constructor() {
        this.engines = {
            financial: new financial_intelligence_engine_1.FinancialIntelligenceEngine(),
            asset: new asset_intelligence_engine_1.AssetIntelligenceEngine(),
            transactionRisk: new transaction_risk_engine_1.TransactionRiskEngine(),
            construction: new construction_intelligence_engine_1.ConstructionIntelligenceEngine(),
            workforce: new workforce_intelligence_engine_1.WorkforceIntelligenceEngine(),
            crmRevenue: new crm_revenue_intelligence_engine_1.CRMRevenueIntelligenceEngine(),
            tenant: new tenant_intelligence_engine_1.TenantIntelligenceEngine(),
            operationalAnomaly: new operational_anomaly_engine_1.OperationalAnomalyEngine(),
            aiAssistant: new ai_assistant_engine_1.AIAssistantEngine(),
        };
    }
    /**
     * Get insights from a specific engine
     */
    async getEngineInsights(engineName) {
        const cacheKey = `ai-intelligence:${engineName}`;
        // Check cache first
        const cached = cache_1.aiCache.get(cacheKey);
        if (cached) {
            logger_1.default.debug(`AI Intelligence: Cache hit for ${engineName}`);
            return cached;
        }
        // Compute insights
        const engine = this.engines[engineName];
        if (!engine) {
            throw new Error(`Unknown engine: ${engineName}`);
        }
        logger_1.default.info(`AI Intelligence: Computing insights for ${engineName}`);
        const result = await engine.compute();
        // Cache result (use first insight type for TTL determination)
        const insightType = result.insights[0]?.type || 'predicted';
        cache_1.aiCache.set(cacheKey, result, insightType);
        return result;
    }
    /**
     * Get insights from all engines
     */
    async getAllInsights() {
        const results = {};
        // Run all engines in parallel
        const engineNames = Object.keys(this.engines);
        await Promise.all(engineNames.map(async (engineName) => {
            try {
                results[engineName] = await this.getEngineInsights(engineName);
            }
            catch (error) {
                logger_1.default.error(`Error computing insights for ${engineName}: ${error.message}`, error);
                results[engineName] = {
                    insights: [],
                    engine_name: engineName,
                    computed_at: new Date(),
                    status: 'error',
                    errors: [error.message],
                };
            }
        }));
        return results;
    }
    /**
     * Get insights for overview (aggregated)
     */
    async getOverviewInsights() {
        const allResults = await this.getAllInsights();
        const overviewInsights = [];
        // Extract key insights from each engine
        Object.values(allResults).forEach((result) => {
            // Take first 2 insights from each engine for overview
            overviewInsights.push(...result.insights.slice(0, 2));
        });
        return overviewInsights;
    }
    /**
     * Process AI Assistant query
     */
    async processAssistantQuery(query) {
        return await this.engines.aiAssistant.processQuery(query);
    }
    /**
     * Invalidate cache for a specific engine
     */
    invalidateEngineCache(engineName) {
        const cacheKey = `ai-intelligence:${engineName}`;
        cache_1.aiCache.invalidate(cacheKey);
        logger_1.default.info(`AI Intelligence: Cache invalidated for ${engineName}`);
    }
    /**
     * Invalidate all caches
     */
    invalidateAllCaches() {
        cache_1.aiCache.clear();
        logger_1.default.info('AI Intelligence: All caches cleared');
    }
}
exports.AIIntelligenceService = AIIntelligenceService;
exports.aiIntelligenceService = new AIIntelligenceService();
//# sourceMappingURL=index.js.map