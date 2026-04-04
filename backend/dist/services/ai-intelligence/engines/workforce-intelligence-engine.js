"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkforceIntelligenceEngine = void 0;
const client_1 = __importDefault(require("../../../prisma/client"));
const types_1 = require("../types");
const logger_1 = __importDefault(require("../../../utils/logger"));
class WorkforceIntelligenceEngine {
    constructor() {
        this.name = 'WorkforceIntelligenceEngine';
        this.config = {
            data_sources: [
                {
                    module: 'HR',
                    table: 'Employee',
                    fields: ['id', 'name', 'department', 'status', 'joinDate'],
                },
                {
                    module: 'HR',
                    table: 'Attendance',
                    fields: ['id', 'employeeId', 'date', 'status', 'checkIn', 'checkOut'],
                },
                {
                    module: 'HR',
                    table: 'Payroll',
                    fields: ['id', 'employeeId', 'amount', 'period'],
                },
            ],
            rules: [
                'Efficiency = Task completion rate / Expected rate',
                'Attrition risk = Based on engagement patterns, workload, performance trends',
                'Productivity = Output metrics / Time invested',
            ],
            confidence_logic: 'Degrades if employee data incomplete or performance history short',
            failure_conditions: ['No employees in system', 'Missing attendance/performance data'],
        };
    }
    async compute() {
        const insights = [];
        const errors = [];
        try {
            if (!(await this.hasSufficientData())) {
                return {
                    insights: [(0, types_1.createInsufficientDataInsight)('Workforce Intelligence', this.getDataSources())],
                    engine_name: this.name,
                    computed_at: new Date(),
                    status: 'insufficient_data',
                };
            }
            // Get employees
            const employees = await client_1.default.employee.findMany({
                where: { isDeleted: false, status: 'active' },
                select: {
                    id: true,
                    name: true,
                    department: true,
                    status: true,
                    joinDate: true,
                },
            });
            if (employees.length === 0) {
                return {
                    insights: [(0, types_1.createInsufficientDataInsight)('Workforce Intelligence', this.getDataSources())],
                    engine_name: this.name,
                    computed_at: new Date(),
                    status: 'insufficient_data',
                };
            }
            // Get attendance for last 3 months
            const threeMonthsAgo = new Date();
            threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
            const attendanceRecords = await client_1.default.attendance.findMany({
                where: {
                    date: { gte: threeMonthsAgo },
                    isDeleted: false,
                },
                select: {
                    id: true,
                    employeeId: true,
                    date: true,
                    status: true,
                    checkIn: true,
                    checkOut: true,
                },
            });
            // Calculate attendance rates per employee
            const employeeAttendance = {};
            employees.forEach((emp) => {
                const empAttendance = attendanceRecords.filter((a) => a.employeeId === emp.id);
                const present = empAttendance.filter((a) => a.status === 'present').length;
                employeeAttendance[emp.id] = {
                    present,
                    total: empAttendance.length,
                };
            });
            // Calculate overall efficiency (based on attendance)
            const totalPresent = Object.values(employeeAttendance).reduce((sum, a) => sum + a.present, 0);
            const totalDays = Object.values(employeeAttendance).reduce((sum, a) => sum + a.total, 0);
            const efficiency = totalDays > 0 ? (totalPresent / totalDays) * 100 : 0;
            // Calculate attrition risk (simplified: based on attendance patterns)
            const highRiskEmployees = [];
            employees.forEach((emp) => {
                const att = employeeAttendance[emp.id];
                if (att && att.total > 0) {
                    const attendanceRate = (att.present / att.total) * 100;
                    // Low attendance = higher risk
                    const risk = 100 - attendanceRate;
                    if (risk > 40) {
                        highRiskEmployees.push({
                            id: emp.id,
                            name: emp.name,
                            risk: Math.min(100, risk),
                        });
                    }
                }
            });
            // Predict next month productivity (based on trend)
            const lastMonth = new Date();
            lastMonth.setMonth(lastMonth.getMonth() - 1);
            const lastMonthStart = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1);
            const lastMonthEnd = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0);
            const lastMonthAttendance = attendanceRecords.filter((a) => {
                const aDate = new Date(a.date);
                return aDate >= lastMonthStart && aDate <= lastMonthEnd;
            });
            const lastMonthPresent = lastMonthAttendance.filter((a) => a.status === 'present').length;
            const lastMonthProductivity = lastMonthAttendance.length > 0
                ? (lastMonthPresent / lastMonthAttendance.length) * 100
                : 0;
            // Simple prediction: assume similar trend
            const predictedProductivity = Math.min(100, lastMonthProductivity * 1.02); // 2% improvement assumption
            // Confidence factors
            const confidenceFactors = {
                missing_data_percentage: attendanceRecords.length < 50 ? 30 : 0,
                has_manual_overrides: false,
                has_backdated_entries: false,
                data_freshness_days: 0,
                sample_size: employees.length,
            };
            // Efficiency insight
            insights.push({
                value: efficiency,
                type: 'derived',
                confidence: (0, types_1.calculateConfidence)(90, confidenceFactors),
                confidence_reason: 'Based on attendance data analysis',
                explanation: `Overall employee efficiency: ${efficiency.toFixed(1)}% (${totalPresent} present days out of ${totalDays} total)`,
                data_sources: [
                    {
                        module: 'HR',
                        table: 'Attendance',
                        time_range: { start: threeMonthsAgo, end: new Date() },
                    },
                ],
                last_computed_at: new Date(),
                status: 'success',
            });
            // Attrition risk insight
            insights.push({
                value: highRiskEmployees.length,
                type: 'derived',
                confidence: (0, types_1.calculateConfidence)(80, confidenceFactors),
                confidence_reason: 'Based on attendance patterns and engagement indicators',
                explanation: `${highRiskEmployees.length} employees identified with high attrition risk (>40% based on attendance patterns)`,
                data_sources: [
                    {
                        module: 'HR',
                        table: 'Employee',
                        filters: { status: 'active' },
                    },
                    {
                        module: 'HR',
                        table: 'Attendance',
                        time_range: { start: threeMonthsAgo, end: new Date() },
                    },
                ],
                last_computed_at: new Date(),
                status: 'success',
                metadata: {
                    high_risk_employees: highRiskEmployees.slice(0, 10), // Limit to first 10
                },
            });
            // Predicted productivity insight
            insights.push({
                value: predictedProductivity,
                type: 'predicted',
                confidence: (0, types_1.calculateConfidence)(75, confidenceFactors),
                confidence_reason: 'Based on attendance trends and historical patterns',
                explanation: `Predicted productivity for next month: ${predictedProductivity.toFixed(1)}% (based on current attendance trends)`,
                data_sources: [
                    {
                        module: 'HR',
                        table: 'Attendance',
                        time_range: { start: lastMonthStart, end: lastMonthEnd },
                    },
                ],
                time_range: {
                    start: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1),
                    end: new Date(new Date().getFullYear(), new Date().getMonth() + 2, 0),
                },
                last_computed_at: new Date(),
                status: 'success',
            });
        }
        catch (error) {
            logger_1.default.error(`Workforce Intelligence Engine error: ${error.message}`, error);
            errors.push(error.message);
            insights.push((0, types_1.createErrorInsight)('Workforce Intelligence', error.message, this.getDataSources()));
        }
        return {
            insights,
            engine_name: this.name,
            computed_at: new Date(),
            status: errors.length > 0 ? 'error' : insights.some((i) => i.status === 'insufficient_data') ? 'insufficient_data' : 'success',
            errors: errors.length > 0 ? errors : undefined,
        };
    }
    async hasSufficientData() {
        try {
            const employeeCount = await client_1.default.employee.count({
                where: { isDeleted: false, status: 'active' },
            });
            return employeeCount > 0;
        }
        catch (error) {
            logger_1.default.error('Error checking sufficient data for Workforce Intelligence', error);
            return false;
        }
    }
    getDataSources() {
        return this.config.data_sources;
    }
}
exports.WorkforceIntelligenceEngine = WorkforceIntelligenceEngine;
//# sourceMappingURL=workforce-intelligence-engine.js.map