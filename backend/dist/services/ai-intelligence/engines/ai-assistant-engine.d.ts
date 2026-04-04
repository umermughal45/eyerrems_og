/**
 * AI Assistant Engine (Retrieval-Only)
 *
 * Data Sources:
 * - All Modules: Read-only data retrieval
 *
 * Rules:
 * - NO data modification
 * - NO transaction creation
 * - ONLY retrieval and analysis
 * - Answer questions based on available data
 *
 * Confidence Logic:
 * - Degrades if requested data not available
 * - Degrades if query unclear
 *
 * Failure Conditions:
 * - Invalid query
 * - Insufficient data for query
 */
import { AIEngine, EngineResult, DataSource } from '../types';
export declare class AIAssistantEngine implements AIEngine {
    name: string;
    config: {
        data_sources: {
            module: string;
            description: string;
        }[];
        rules: string[];
        confidence_logic: string;
        failure_conditions: string[];
    };
    /**
     * Process a query and return relevant insights
     * This is a retrieval-only engine - it never modifies data
     */
    processQuery(query: string): Promise<EngineResult>;
    compute(): Promise<EngineResult>;
    hasSufficientData(): Promise<boolean>;
    getDataSources(): DataSource[];
}
//# sourceMappingURL=ai-assistant-engine.d.ts.map