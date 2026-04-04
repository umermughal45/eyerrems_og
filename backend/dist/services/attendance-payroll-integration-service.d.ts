/**
 * AttendancePayrollIntegrationService - Integrates attendance data with payroll calculations
 * Automatically calculates deductions and allowances based on attendance records
 */
export interface AttendanceBasedDeductions {
    absentDays: number;
    lateArrivals: number;
    halfDays: number;
    absentDeduction: number;
    lateDeduction: number;
    halfDayDeduction: number;
    totalAttendanceDeduction: number;
    overtimeHours: number;
    overtimeAmount: number;
    presentDays: number;
    totalWorkingDays: number;
    workingDayRatio: number;
}
export interface AttendancePayrollIntegrationOptions {
    employeeId: string;
    month: string;
    baseSalary: number;
    absentDeductionRate?: number;
    lateDeductionRate?: number;
    halfDayDeductionRate?: number;
    overtimeHourlyRate?: number;
    standardWorkingHours?: number;
    standardWorkingDays?: number;
    includeLeaveDays?: boolean;
}
export declare class AttendancePayrollIntegrationService {
    /**
     * Calculate attendance-based deductions and allowances for payroll
     */
    static calculateAttendanceBasedPayroll(options: AttendancePayrollIntegrationOptions): Promise<AttendanceBasedDeductions>;
    /**
     * Calculate working days in a month (excluding weekends)
     * You can customize this to exclude holidays, etc.
     */
    private static calculateWorkingDaysInMonth;
    /**
     * Get attendance summary for a specific month
     */
    static getAttendanceSummaryForMonth(employeeId: string, month: string): Promise<{
        totalDays: number;
        presentDays: number;
        absentDays: number;
        lateDays: number;
        halfDays: number;
        leaveDays: number;
        totalHours: number;
        overtimeHours: number;
        averageHoursPerDay: number;
    }>;
}
//# sourceMappingURL=attendance-payroll-integration-service.d.ts.map