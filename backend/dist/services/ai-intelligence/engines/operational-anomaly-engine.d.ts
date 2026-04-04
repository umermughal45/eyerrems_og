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
import { AIEngine, EngineResult, DataSource } from '../types';
export declare class OperationalAnomalyEngine implements AIEngine {
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
//# sourceMappingURL=operational-anomaly-engine.d.ts.map