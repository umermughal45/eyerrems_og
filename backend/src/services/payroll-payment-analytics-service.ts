/**
 * PayrollPaymentAnalyticsService - Professional payroll payment analytics and reporting
 * Provides comprehensive insights, trends, and KPIs for payroll payment management
 */

import prisma from '../prisma/client';

export interface PaymentAnalytics {
  // Summary Statistics
  totalPayroll: number;
  totalPaid: number;
  totalPending: number;
  totalEmployees: number;
  paidEmployees: number;
  pendingEmployees: number;
  
  // Payment Metrics
  averagePayment: number;
  largestPayment: number;
  smallestPayment: number;
  totalPayments: number;
  partialPayments: number;
  fullPayments: number;
  
  // Payment Methods Distribution
  paymentMethods: {
    method: string;
    count: number;
    amount: number;
    percentage: number;
  }[];
  
  // Monthly Trends
  monthlyTrends: {
    month: string;
    totalPayroll: number;
    totalPaid: number;
    pendingAmount: number;
    paymentCount: number;
  }[];
  
  // Department Breakdown
  departmentBreakdown: {
    department: string;
    totalPayroll: number;
    totalPaid: number;
    pendingAmount: number;
    employeeCount: number;
  }[];
  
  // Payment Status Distribution
  statusDistribution: {
    status: string;
    count: number;
    amount: number;
    percentage: number;
  }[];
  
  // Recent Payments
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
  
  // Payment Velocity
  paymentVelocity: {
    averageDaysToPayment: number;
    fastestPayment: number;
    slowestPayment: number;
  };
}

export class PayrollPaymentAnalyticsService {
  /**
   * Get comprehensive payment analytics for a date range
   */
  static async getPaymentAnalytics(options?: {
    startDate?: Date;
    endDate?: Date;
    department?: string;
    employeeId?: string;
  }): Promise<PaymentAnalytics> {
    const { startDate, endDate, department, employeeId } = options || {};
    
    // Build date filter for payroll month
    const dateFilter: any = {};
    if (startDate || endDate) {
      // Convert to YYYY-MM format for month comparison
      if (startDate) {
        const startMonth = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`;
        dateFilter.month = { gte: startMonth };
      }
      if (endDate) {
        const endMonth = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}`;
        if (dateFilter.month) {
          dateFilter.month = { ...dateFilter.month, lte: endMonth };
        } else {
          dateFilter.month = { lte: endMonth };
        }
      }
    }
    
    // Build where clause
    const payrollWhere: any = {
      isDeleted: false,
      ...dateFilter,
    };
    
    if (employeeId) {
      payrollWhere.employeeId = employeeId;
    }
    
    if (department) {
      payrollWhere.employee = { department };
    }
    
    // Fetch all payroll records with payments
    const payrollRecords = await prisma.payroll.findMany({
      where: payrollWhere,
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            employeeId: true,
            department: true,
          },
        },
        payments: {
          orderBy: { paymentDate: 'desc' },
          include: {
            createdBy: {
              select: {
                username: true,
              },
            },
          },
        },
      },
    });
    
    // Calculate summary statistics
    const totalPayroll = payrollRecords.reduce((sum, p) => sum + p.netPay, 0);
    const totalPaid = payrollRecords.reduce((sum, p) => {
      const paid = p.payments.reduce((pSum, pay) => pSum + pay.amount, 0);
      return sum + paid;
    }, 0);
    const totalPending = totalPayroll - totalPaid;
    const totalEmployees = payrollRecords.length;
    const paidEmployees = payrollRecords.filter(p => {
      const paid = p.payments.reduce((sum, pay) => sum + pay.amount, 0);
      return paid >= p.netPay;
    }).length;
    const pendingEmployees = totalEmployees - paidEmployees;
    
    // Payment metrics
    const allPayments = payrollRecords.flatMap(p => p.payments);
    const totalPayments = allPayments.length;
    const paymentAmounts = allPayments.map(p => p.amount);
    const averagePayment = paymentAmounts.length > 0
      ? paymentAmounts.reduce((sum, a) => sum + a, 0) / paymentAmounts.length
      : 0;
    const largestPayment = paymentAmounts.length > 0 ? Math.max(...paymentAmounts) : 0;
    const smallestPayment = paymentAmounts.length > 0 ? Math.min(...paymentAmounts) : 0;
    
    // Count partial vs full payments
    const partialPayments = payrollRecords.filter(p => {
      const paid = p.payments.reduce((sum, pay) => sum + pay.amount, 0);
      return paid > 0 && paid < p.netPay;
    }).length;
    const fullPayments = paidEmployees;
    
    // Payment methods distribution
    const methodMap = new Map<string, { count: number; amount: number }>();
    allPayments.forEach(payment => {
      const method = payment.paymentMethod.toLowerCase();
      const existing = methodMap.get(method) || { count: 0, amount: 0 };
      methodMap.set(method, {
        count: existing.count + 1,
        amount: existing.amount + payment.amount,
      });
    });
    
    const totalMethodAmount = Array.from(methodMap.values()).reduce((sum, m) => sum + m.amount, 0);
    const paymentMethods = Array.from(methodMap.entries()).map(([method, data]) => ({
      method: method.charAt(0).toUpperCase() + method.slice(1),
      count: data.count,
      amount: data.amount,
      percentage: totalMethodAmount > 0 ? (data.amount / totalMethodAmount) * 100 : 0,
    })).sort((a, b) => b.amount - a.amount);
    
    // Monthly trends (last 12 months)
    const monthlyMap = new Map<string, {
      totalPayroll: number;
      totalPaid: number;
      paymentCount: number;
    }>();
    
    payrollRecords.forEach(payroll => {
      const month = payroll.month;
      const existing = monthlyMap.get(month) || {
        totalPayroll: 0,
        totalPaid: 0,
        paymentCount: 0,
      };
      
      const paid = payroll.payments.reduce((sum, p) => sum + p.amount, 0);
      monthlyMap.set(month, {
        totalPayroll: existing.totalPayroll + payroll.netPay,
        totalPaid: existing.totalPaid + paid,
        paymentCount: existing.paymentCount + payroll.payments.length,
      });
    });
    
    const monthlyTrends = Array.from(monthlyMap.entries())
      .map(([month, data]) => ({
        month,
        totalPayroll: data.totalPayroll,
        totalPaid: data.totalPaid,
        pendingAmount: data.totalPayroll - data.totalPaid,
        paymentCount: data.paymentCount,
      }))
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-12); // Last 12 months
    
    // Department breakdown
    const departmentMap = new Map<string, {
      totalPayroll: number;
      totalPaid: number;
      employeeCount: number;
    }>();
    
    payrollRecords.forEach(payroll => {
      const dept = payroll.employee.department || 'Unassigned';
      const existing = departmentMap.get(dept) || {
        totalPayroll: 0,
        totalPaid: 0,
        employeeCount: 0,
      };
      
      const paid = payroll.payments.reduce((sum, p) => sum + p.amount, 0);
      departmentMap.set(dept, {
        totalPayroll: existing.totalPayroll + payroll.netPay,
        totalPaid: existing.totalPaid + paid,
        employeeCount: existing.employeeCount + 1,
      });
    });
    
    const departmentBreakdown = Array.from(departmentMap.entries()).map(([department, data]) => ({
      department,
      totalPayroll: data.totalPayroll,
      totalPaid: data.totalPaid,
      pendingAmount: data.totalPayroll - data.totalPaid,
      employeeCount: data.employeeCount,
    })).sort((a, b) => b.totalPayroll - a.totalPayroll);
    
    // Status distribution
    const statusMap = new Map<string, { count: number; amount: number }>();
    payrollRecords.forEach(payroll => {
      const paid = payroll.payments.reduce((sum, p) => sum + p.amount, 0);
      let status = 'created';
      if (paid >= payroll.netPay) {
        status = 'fully_paid';
      } else if (paid > 0) {
        status = 'partially_paid';
      }
      
      const existing = statusMap.get(status) || { count: 0, amount: 0 };
      statusMap.set(status, {
        count: existing.count + 1,
        amount: existing.amount + payroll.netPay,
      });
    });
    
    const totalStatusAmount = Array.from(statusMap.values()).reduce((sum, s) => sum + s.amount, 0);
    const statusDistribution = Array.from(statusMap.entries()).map(([status, data]) => ({
      status: status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
      count: data.count,
      amount: data.amount,
      percentage: totalStatusAmount > 0 ? (data.amount / totalStatusAmount) * 100 : 0,
    }));
    
    // Recent payments (last 20)
    const recentPayments = allPayments
      .sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime())
      .slice(0, 20)
      .map(payment => {
        const payroll = payrollRecords.find(p => p.id === payment.payrollId);
        const paid = payroll?.payments.reduce((sum, p) => sum + p.amount, 0) || 0;
        let status = 'created';
        if (payroll) {
          if (paid >= payroll.netPay) {
            status = 'fully_paid';
          } else if (paid > 0) {
            status = 'partially_paid';
          }
        }
        
        return {
          id: payment.id,
          payrollId: payment.payrollId,
          employeeName: payroll?.employee.name || 'Unknown',
          employeeId: payroll?.employee.employeeId || 'Unknown',
          amount: payment.amount,
          paymentDate: payment.paymentDate,
          paymentMethod: payment.paymentMethod,
          status,
          createdBy: payment.createdBy?.username || null,
        };
      });
    
    // Payment velocity (average days from payroll creation to payment)
    const paymentVelocities: number[] = [];
    payrollRecords.forEach(payroll => {
      if (payroll.payments.length > 0) {
        const firstPayment = payroll.payments.reduce((earliest, p) => {
          return new Date(p.paymentDate) < new Date(earliest.paymentDate) ? p : earliest;
        }, payroll.payments[0]);
        
        const daysDiff = Math.floor(
          (new Date(firstPayment.paymentDate).getTime() - new Date(payroll.createdAt).getTime()) /
          (1000 * 60 * 60 * 24)
        );
        if (daysDiff >= 0) {
          paymentVelocities.push(daysDiff);
        }
      }
    });
    
    const averageDaysToPayment = paymentVelocities.length > 0
      ? paymentVelocities.reduce((sum, d) => sum + d, 0) / paymentVelocities.length
      : 0;
    const fastestPayment = paymentVelocities.length > 0 ? Math.min(...paymentVelocities) : 0;
    const slowestPayment = paymentVelocities.length > 0 ? Math.max(...paymentVelocities) : 0;
    
    return {
      totalPayroll,
      totalPaid,
      totalPending,
      totalEmployees,
      paidEmployees,
      pendingEmployees,
      averagePayment,
      largestPayment,
      smallestPayment,
      totalPayments,
      partialPayments,
      fullPayments,
      paymentMethods,
      monthlyTrends,
      departmentBreakdown,
      statusDistribution,
      recentPayments,
      paymentVelocity: {
        averageDaysToPayment,
        fastestPayment,
        slowestPayment,
      },
    };
  }
  
  /**
   * Get payment reconciliation data for finance teams
   */
  static async getPaymentReconciliation(options?: {
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
  }> {
    const { month, paymentMethod } = options || {};
    
    const where: any = { isDeleted: false };
    if (month) {
      where.month = month;
    }
    
    const payrollRecords = await prisma.payroll.findMany({
      where,
      include: {
        employee: {
          select: {
            name: true,
            employeeId: true,
          },
        },
        payments: {
          where: paymentMethod ? { paymentMethod } : undefined,
          orderBy: { paymentDate: 'desc' },
        },
      },
    });
    
    const totalRecorded = payrollRecords.reduce((sum, p) => {
      return sum + p.payments.reduce((pSum, pay) => pSum + pay.amount, 0);
    }, 0);
    
    const totalVerified = payrollRecords
      .filter(p => p.paymentStatus === 'fully_paid')
      .reduce((sum, p) => sum + p.netPay, 0);
    
    // Find discrepancies (payments that don't match expected amounts)
    const discrepancies: Array<{
      payrollId: string;
      employeeName: string;
      expectedAmount: number;
      recordedAmount: number;
      difference: number;
    }> = [];
    
    payrollRecords.forEach(payroll => {
      const recorded = payroll.payments.reduce((sum, p) => sum + p.amount, 0);
      const expected = payroll.netPay;
      const difference = Math.abs(recorded - expected);
      
      // Consider it a discrepancy if difference is more than 0.01 (rounding tolerance)
      if (difference > 0.01) {
        discrepancies.push({
          payrollId: payroll.id,
          employeeName: payroll.employee.name,
          expectedAmount: expected,
          recordedAmount: recorded,
          difference,
        });
      }
    });
    
    // Find unreconciled payments (payments without proper references)
    const unreconciledPayments = payrollRecords
      .flatMap(p => p.payments.map(pay => ({
        ...pay,
        payrollId: p.id,
        employeeName: p.employee.name,
      })))
      .filter(pay => !pay.referenceNumber && !pay.transactionId)
      .map(pay => ({
        paymentId: pay.id,
        payrollId: pay.payrollId,
        employeeName: pay.employeeName,
        amount: pay.amount,
        paymentDate: pay.paymentDate,
        paymentMethod: pay.paymentMethod,
        referenceNumber: pay.referenceNumber,
        transactionId: pay.transactionId,
      }));
    
    return {
      totalRecorded,
      totalVerified,
      discrepancies,
      unreconciledPayments,
    };
  }
}
