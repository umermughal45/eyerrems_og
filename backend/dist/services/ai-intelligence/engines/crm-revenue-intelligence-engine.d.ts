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
import { AIEngine, EngineResult, DataSource } from '../types';
export declare class CRMRevenueIntelligenceEngine implements AIEngine {
    name: string;
    config: {
        data_sources: {
            module: string;
            table: string;
            fields: string[];
        }[];
        rules: string[];
        confidence_logic: string;
        failure_conditions: string[];
    };
    compute(): Promise<EngineResult>;
    hasSufficientData(): Promise<boolean>;
    getDataSources(): DataSource[];
}
//# sourceMappingURL=crm-revenue-intelligence-engine.d.ts.map