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
import { AIEngine, EngineResult, DataSource } from '../types';
export declare class AssetIntelligenceEngine implements AIEngine {
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
//# sourceMappingURL=asset-intelligence-engine.d.ts.map