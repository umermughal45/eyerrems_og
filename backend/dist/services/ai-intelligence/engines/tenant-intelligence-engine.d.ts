/**
 * Tenant Intelligence Engine (Internal Only)
 *
 * Data Sources:
 * - Properties Module: Tenants, Leases, Units
 * - Finance Module: Tenant Payments, Invoices
 * - CRM Module: Tenant Communications
 *
 * Rules:
 * - Risk score = Based on payment history, lease violations, communication patterns
 * - Satisfaction = Based on feedback, maintenance requests, communication sentiment
 * - Churn risk = Based on lease expiration, payment delays, satisfaction trends
 *
 * Confidence Logic:
 * - Degrades if tenant data incomplete
 * - Degrades if payment history short
 *
 * Failure Conditions:
 * - No tenants in system
 * - Missing payment/lease data
 */
import { AIEngine, EngineResult, DataSource } from '../types';
export declare class TenantIntelligenceEngine implements AIEngine {
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
//# sourceMappingURL=tenant-intelligence-engine.d.ts.map