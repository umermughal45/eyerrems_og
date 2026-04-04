/**
 * PayrollPaymentAnalyticsService - Professional payroll payment analytics and reporting
 * Provides comprehensive insights, trends, and KPIs for payroll payment management
 */
export interface PaymentAnalytics {
    totalPayroll: number;
    totalPaid: number;
    totalPending: number;
    totalEmployees: number;
    paidEmployees: number;
    pendingEmployees: number;
    averagePayment: number;
    largestPayment: number;
    smallestPayment: number;
    totalPayments: number;
    partialPayments: number;
    fullPayments: number;
    paymentMethods: {
        method: string;
        count: number;
        amount: number;
        percentage: number;
    }[];
    monthlyTrends: {
        month: string;
        totalPayroll: number;
        totalPaid: number;
        pendingAmount: number;
        paymentCount: number;
    }[];
    departmentBreakdown: {
        department: string;
        totalPayroll: number;
        totalPaid: number;
        pendingAmount: number;
        employeeCount: number;
    }[];
    statusDistribution: {
        status: string;
        count: number;
        amount: number;
        percentage: number;
    }[];
    recentPayments: Array<{
        id: string;
        payrollId: string;
        employeeName: string;
        employeeId: string;
        amount: number;
        paymentDate: Date;
        paymentMethod: string;
        status: string;
        createdBy: string | null;
    }>;
    paymentVelocity: {
        averageDaysToPayment: number;
        fastestPayment: number;
        slowestPayment: number;
    };
}
export declare class PayrollPaymentAnalyticsService {
    /**
     * Get comprehensive payment analytics for a date range
     */
    static getPaymentAnalytics(options?: {
        startDate?: Date;
        endDate?: Date;
        department?: string;
        employeeId?: string;
    }): Promise<PaymentAnalytics>;
    /**
     * Get payment reconciliation data for finance teams
     */
    static getPaymentReconciliation(options?: {
        month?: string;
        paymentMethod?: string;
    }): Promise<{
        totalRecorded: number;
        totalVerified: number;
        discrepancies: Array<{
            payrollId: string;
            employeeName: string;
            expectedAmount: number;
            recordedAmount: number;
            difference: number;
        }>;
        unreconciledPayments: Array<{
            paymentId: string;
            payrollId: string;
            employeeName: string;
            amount: number;
            paymentDate: Date;
            paymentMethod: string;
            referenceNumber: string | null;
            transactionId: string | null;
        }>;
    }>;
}
//# sourceMappingURL=payroll-payment-analytics-service.d.ts.map