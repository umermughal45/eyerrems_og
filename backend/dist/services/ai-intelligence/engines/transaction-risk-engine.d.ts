/**
 * Transaction Risk Engine
 *
 * Data Sources:
 * - Finance Module: Transactions, Payments, Invoices
 *
 * Rules:
 * - Detect duplicate transactions
 * - Identify abnormal amounts (statistical outliers)
 * - Flag suspicious patterns (rapid transactions, unusual timing)
 *
 * Confidence Logic:
 * - Degrades if transaction history is short
 * - Degrades if patterns are unclear
 *
 * Failure Conditions:
 * - No transaction history
 * - Insufficient data for pattern analysis
 */
import { AIEngine, EngineResult, DataSource } from '../types';
export declare class TransactionRiskEngine implements AIEngine {
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
//# sourceMappingURL=transaction-risk-engine.d.ts.map