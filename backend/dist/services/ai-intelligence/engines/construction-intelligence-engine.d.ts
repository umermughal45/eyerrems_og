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
import { AIEngine, EngineResult, DataSource } from '../types';
export declare class ConstructionIntelligenceEngine implements AIEngine {
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
//# sourceMappingURL=construction-intelligence-engine.d.ts.map