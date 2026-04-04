/**
 * AI Intelligence Service - Main Orchestrator
 * 
 * Coordinates all AI Intelligence engines
 * Handles caching and event-driven recalculation
 */

import { aiCache } from './cache';
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
import logger from '../../utils/logger';

export class AIIntelligenceService {
  private engines = {
    financial: new FinancialIntelligenceEngine(),
    asset: new AssetIntelligenceEngine(),
    transactionRisk: new TransactionRiskEngine(),
    construction: new ConstructionIntelligenceEngine(),
    workforce: new WorkforceIntelligenceEngine(),
    crmRevenue: new CRMRevenueIntelligenceEngine(),
    tenant: new TenantIntelligenceEngine(),
    operationalAnomaly: new OperationalAnomalyEngine(),
    aiAssistant: new AIAssistantEngine(),
  };
  
  /**
   * Get insights from a specific engine
   */
  async getEngineInsights(engineName: string): Promise<EngineResult> {
    const cacheKey = `ai-intelligence:${engineName}`;
    
    // Check cache first
    const cached = aiCache.get<EngineResult>(cacheKey);
    if (cached) {
      logger.debug(`AI Intelligence: Cache hit for ${engineName}`);
      return cached;
    }
    
    // Compute insights
    const engine = this.engines[engineName as keyof typeof this.engines];
    if (!engine) {
      throw new Error(`Unknown engine: ${engineName}`);
    }
    
    logger.info(`AI Intelligence: Computing insights for ${engineName}`);
    const result = await engine.compute();
    
    // Cache result (use first insight type for TTL determination)
    const insightType = result.insights[0]?.type || 'predicted';
    aiCache.set(cacheKey, result, insightType);
    
    return result;
  }
  
  /**
   * Get insights from all engines
   */
  async getAllInsights(): Promise<Record<string, EngineResult>> {
    const results: Record<string, EngineResult> = {};
    
    // Run all engines in parallel
    const engineNames = Object.keys(this.engines) as Array<keyof typeof this.engines>;
    
    await Promise.all(
      engineNames.map(async (engineName) => {
        try {
          results[engineName] = await this.getEngineInsights(engineName);
        } catch (error: any) {
          logger.error(`Error computing insights for ${engineName}: ${error.message}`, error);
          results[engineName] = {
            insights: [],
            engine_name: engineName,
            computed_at: new Date(),
            status: 'error',
            errors: [error.message],
          };
        }
      })
    );
    
    return results;
  }
  
  /**
   * Get insights for overview (aggregated)
   */
  async getOverviewInsights(): Promise<AIInsight[]> {
    const allResults = await this.getAllInsights();
    const overviewInsights: AIInsight[] = [];
    
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
  async processAssistantQuery(query: string): Promise<EngineResult> {
    return await this.engines.aiAssistant.processQuery(query);
  }
  
  /**
   * Invalidate cache for a specific engine
   */
  invalidateEngineCache(engineName: string): void {
    const cacheKey = `ai-intelligence:${engineName}`;
    aiCache.invalidate(cacheKey);
    logger.info(`AI Intelligence: Cache invalidated for ${engineName}`);
  }
  
  /**
   * Invalidate all caches
   */
  invalidateAllCaches(): void {
    aiCache.clear();
    logger.info('AI Intelligence: All caches cleared');
  }
}

export const aiIntelligenceService = new AIIntelligenceService();

// Export engines for direct access if needed
export {
  FinancialIntelligenceEngine,
  AssetIntelligenceEngine,
  TransactionRiskEngine,
  ConstructionIntelligenceEngine,
  WorkforceIntelligenceEngine,
  CRMRevenueIntelligenceEngine,
  TenantIntelligenceEngine,
  OperationalAnomalyEngine,
  AIAssistantEngine,
};
