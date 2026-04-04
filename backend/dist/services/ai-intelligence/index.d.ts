/**
 * AI Intelligence Service - Main Orchestrator
 *
 * Coordinates all AI Intelligence engines
 * Handles caching and event-driven recalculation
 */
import { FinancialIntelligenceEngine } from './engines/financial-intelligence-engine';
import { AssetIntelligenceEngine } from './engines/asset-intelligence-engine';
import { TransactionRiskEngine } from './engines/transaction-risk-engine';
import { ConstructionIntelligenceEngine } from './engines/construction-intelligence-engine';
import { WorkforceIntelligenceEngine } from './engines/workforce-intelligence-engine';
import { CRMRevenueIntelligenceEngine } from './engines/crm-revenue-intelligence-engine';
import { TenantIntelligenceEngine } from './engines/tenant-intelligence-engine';
import { OperationalAnomalyEngine } from './engines/operational-anomaly-engine';
import { AIAssistantEngine } from './engines/ai-assistant-engine';
import { EngineResult, AIInsight } from './types';
export declare class AIIntelligenceService {
    private engines;
    /**
     * Get insights from a specific engine
     */
    getEngineInsights(engineName: string): Promise<EngineResult>;
    /**
     * Get insights from all engines
     */
    getAllInsights(): Promise<Record<string, EngineResult>>;
    /**
     * Get insights for overview (aggregated)
     */
    getOverviewInsights(): Promise<AIInsight[]>;
    /**
     * Process AI Assistant query
     */
    processAssistantQuery(query: string): Promise<EngineResult>;
    /**
     * Invalidate cache for a specific engine
     */
    invalidateEngineCache(engineName: string): void;
    /**
     * Invalidate all caches
     */
    invalidateAllCaches(): void;
}
export declare const aiIntelligenceService: AIIntelligenceService;
export { FinancialIntelligenceEngine, AssetIntelligenceEngine, TransactionRiskEngine, ConstructionIntelligenceEngine, WorkforceIntelligenceEngine, CRMRevenueIntelligenceEngine, TenantIntelligenceEngine, OperationalAnomalyEngine, AIAssistantEngine, };
//# sourceMappingURL=index.d.ts.map