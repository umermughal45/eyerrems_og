/**
 * HR Alerts Service
 * Handles alerts for pending leaves, attendance issues, and payroll reminders
 */
/**
 * Get pending leave requests that need approval
 */
export declare function getPendingLeaveAlerts(managerId?: string): Promise<{
    pending: ({
        employee: {
            name: string;
            id: string;
            email: string;
            department: string;
            employeeId: string;
            reportingManagerId: string | null;
        };
    } & {
        type: string;
        status: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        isDeleted: boolean;
        approvedAt: Date | null;
        reason: string | null;
        payrollDeduction: number | null;
        leaveBalance: number | null;
        approvedBy: string | null;
        rejectionReason: string | null;
        employeeId: string;
        startDate: Date;
        endDate: Date;
        days: number;
        approvalLevel: number;
        approvalReason: string | null;
        halfDayType: string | null;
        isHalfDay: boolean;
        proofDocumentUrl: string | null;
        rejectedAt: Date | null;
        rejectedBy: string | null;
    })[];
    urgent: ({
        employee: {
            name: string;
            id: string;
            email: string;
            department: string;
            employeeId: string;
            reportingManagerId: string | null;
        };
    } & {
        type: string;
        status: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        isDeleted: boolean;
        approvedAt: Date | null;
        reason: string | null;
        payrollDeduction: number | null;
        leaveBalance: number | null;
        approvedBy: string | null;
        rejectionReason: string | null;
        employeeId: string;
        startDate: Date;
        endDate: Date;
        days: number;
        approvalLevel: number;
        approvalReason: string | null;
        halfDayType: string | null;
        isHalfDay: boolean;
        proofDocumentUrl: string | null;
        rejectedAt: Date | null;
        rejectedBy: string | null;
    })[];
    upcoming: ({
        employee: {
            name: string;
            id: string;
            email: string;
            department: string;
            employeeId: string;
            reportingManagerId: string | null;
        };
    } & {
        type: string;
        status: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        isDeleted: boolean;
        approvedAt: Date | null;
        reason: string | null;
        payrollDeduction: number | null;
        leaveBalance: number | null;
        approvedBy: string | null;
        rejectionReason: string | null;
        employeeId: string;
        startDate: Date;
        endDate: Date;
        days: number;
        approvalLevel: number;
        approvalReason: string | null;
        halfDayType: string | null;
        isHalfDay: boolean;
        proofDocumentUrl: string | null;
        rejectedAt: Date | null;
        rejectedBy: string | null;
    })[];
    overdue: ({
        employee: {
            name: string;
            id: string;
            email: string;
            department: string;
            employeeId: string;
            reportingManagerId: string | null;
        };
    } & {
        type: string;
        status: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        isDeleted: boolean;
        approvedAt: Date | null;
        reason: string | null;
        payrollDeduction: number | null;
        leaveBalance: number | null;
        approvedBy: string | null;
        rejectionReason: string | null;
        employeeId: string;
        startDate: Date;
        endDate: Date;
        days: number;
        approvalLevel: number;
        approvalReason: string | null;
        halfDayType: string | null;
        isHalfDay: boolean;
        proofDocumentUrl: string | null;
        rejectedAt: Date | null;
        rejectedBy: string | null;
    })[];
    summary: {
        total: number;
        urgentCount: number;
        upcomingCount: number;
        overdueCount: number;
    };
}>;
/**
 * Get employees with attendance issues
 */
export declare function getAttendanceAlerts(days?: number): Promise<{
    absences: {
        employees: unknown[];
        total: number;
    };
    lateArrivals: {
        employees: unknown[];
        total: number;
    };
}>;
/**
 * Get payroll reminders (unpaid payrolls)
 */
export declare function getPayrollReminders(): Promise<{
    unpaid: ({
        employee: {
            name: string;
            id: string;
            email: string;
            department: string;
            employeeId: string;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        isDeleted: boolean;
        notes: string | null;
        journalEntryId: string | null;
        taxPercent: number;
        taxAmount: number;
        paymentDate: Date | null;
        paymentMethod: string | null;
        month: string;
        financeLedgerId: string | null;
        employeeId: string;
        basicSalary: number | null;
        allowances: number;
        deductions: number;
        paidAmount: number;
        baseSalary: number;
        bonus: number;
        netPay: number;
        remainingBalance: number;
        advanceDeduction: number;
        epfAmount: number;
        etfAmount: number;
        financeLinked: boolean;
        grossSalary: number | null;
        insuranceAmount: number;
        overtimeAmount: number;
        paymentStatus: string;
        payslipUrl: string | null;
    })[];
    overdue: ({
        employee: {
            name: string;
            id: string;
            email: string;
            department: string;
            employeeId: string;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        isDeleted: boolean;
        notes: string | null;
        journalEntryId: string | null;
        taxPercent: number;
        taxAmount: number;
        paymentDate: Date | null;
        paymentMethod: string | null;
        month: string;
        financeLedgerId: string | null;
        employeeId: string;
        basicSalary: number | null;
        allowances: number;
        deductions: number;
        paidAmount: number;
        baseSalary: number;
        bonus: number;
        netPay: number;
        remainingBalance: number;
        advanceDeduction: number;
        epfAmount: number;
        etfAmount: number;
        financeLinked: boolean;
        grossSalary: number | null;
        insuranceAmount: number;
        overtimeAmount: number;
        paymentStatus: string;
        payslipUrl: string | null;
    })[];
    current: ({
        employee: {
            name: string;
            id: string;
            email: string;
            department: string;
            employeeId: string;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        isDeleted: boolean;
        notes: string | null;
        journalEntryId: string | null;
        taxPercent: number;
        taxAmount: number;
        paymentDate: Date | null;
        paymentMethod: string | null;
        month: string;
        financeLedgerId: string | null;
        employeeId: string;
        basicSalary: number | null;
        allowances: number;
        deductions: number;
        paidAmount: number;
        baseSalary: number;
        bonus: number;
        netPay: number;
        remainingBalance: number;
        advanceDeduction: number;
        epfAmount: number;
        etfAmount: number;
        financeLinked: boolean;
        grossSalary: number | null;
        insuranceAmount: number;
        overtimeAmount: number;
        paymentStatus: string;
        payslipUrl: string | null;
    })[];
    summary: {
        total: number;
        overdueCount: number;
        currentCount: number;
        totalAmount: number;
    };
}>;
/**
 * Calculate overtime from attendance for a given month
 */
export declare function calculateMonthlyOvertime(employeeId: string, month: string): Promise<{
    employeeId: string;
    month: string;
    totalOvertimeHours: number;
    attendanceDays: number;
}>;
//# sourceMappingURL=hr-alerts.d.ts.map