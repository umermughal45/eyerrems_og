/**
 * Workforce Intelligence Engine
 *
 * Data Sources:
 * - HR Module: Employees, Attendance, Payroll, Performance
 *
 * Rules:
 * - Efficiency = Task completion rate / Expected rate
 * - Attrition risk = Based on engagement patterns, workload, performance trends
 * - Productivity = Output metrics / Time invested
 *
 * Confidence Logic:
 * - Degrades if employee data incomplete
 * - Degrades if performance history short
 *
 * Failure Conditions:
 * - No employees in system
 * - Missing attendance/performance data
 */
import { AIEngine, EngineResult, DataSource } from '../types';
export declare class WorkforceIntelligenceEngine implements AIEngine {
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
//# sourceMappingURL=workforce-intelligence-engine.d.ts.map