/**
 * Financial Intelligence Engine
 *
 * Data Sources:
 * - Finance Module: Transactions, Invoices, Payments, Ledger Entries
 *
 * Rules:
 * - Revenue = Sum of all income transactions
 * - Profit = Revenue - Expenses
 * - Forecast uses LSTM-like pattern (simplified moving average with trend)
 *
 * Confidence Logic:
 * - Degrades if < 6 months of data
 * - Degrades if manual overrides detected
 * - Degrades if backdated entries exist
 *
 * Failure Conditions:
 * - No transactions in last 12 months
 * - Missing account mappings
 */
import { AIEngine, EngineResult, DataSource } from '../types';
export declare class FinancialIntelligenceEngine implements AIEngine {
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
    private getConfidenceReason;
}
//# sourceMappingURL=financial-intelligence-engine.d.ts.map