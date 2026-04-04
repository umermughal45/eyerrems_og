/**
 * AttendancePayrollIntegrationService - Integrates attendance data with payroll calculations
 * Automatically calculates deductions and allowances based on attendance records
 */

import prisma from '../prisma/client';

export interface AttendanceBasedDeductions {
  absentDays: number;
  lateArrivals: number;
  halfDays: number;
  absentDeduction: number;
  lateDeduction: number;
  halfDayDeduction: number;
  totalAttendanceDeduction: number;
  
  // Overtime calculations
  overtimeHours: number;
  overtimeAmount: number;
  
  // Working days
  presentDays: number;
  totalWorkingDays: number;
  workingDayRatio: number; // For prorated salary calculations
}

export interface AttendancePayrollIntegrationOptions {
  employeeId: string;
  month: string; // Format: YYYY-MM
  baseSalary: number;
  
  // Deduction rates (per day/hour)
  absentDeductionRate?: number; // If null, uses daily salary rate
  lateDeductionRate?: number; // Fixed amount per late arrival
  halfDayDeductionRate?: number; // If null, uses 50% of daily salary
  
  // Overtime rates
  overtimeHourlyRate?: number; // If null, calculates from baseSalary
  standardWorkingHours?: number; // Default: 8 hours per day
  standardWorkingDays?: number; // Default: calculated from month
  
  // Leave handling
  includeLeaveDays?: boolean; // Whether to include leave days in present days
}

export class AttendancePayrollIntegrationService {
  /**
   * Calculate attendance-based deductions and allowances for payroll
   */
  static async calculateAttendanceBasedPayroll(
    options: AttendancePayrollIntegrationOptions
  ): Promise<AttendanceBasedDeductions> {
    const {
      employeeId,
      month,
      baseSalary,
      absentDeductionRate,
      lateDeductionRate,
      halfDayDeductionRate,
      overtimeHourlyRate,
      standardWorkingHours = 8,
      standardWorkingDays,
      includeLeaveDays = false,
    } = options;
    
    // Parse month to get date range
    const [year, monthNum] = month.split('-').map(Number);
    const startDate = new Date(year, monthNum - 1, 1);
    const endDate = new Date(year, monthNum, 0, 23, 59, 59); // Last day of month
    
    // Get attendance records for the month
    const attendanceRecords = await prisma.attendance.findMany({
      where: {
        employeeId,
        date: {
          gte: startDate,
          lte: endDate,
        },
        isDeleted: false,
      },
      orderBy: { date: 'asc' },
    });
    
    // Calculate working days (excluding weekends, but you may want to customize this)
    const totalDaysInMonth = endDate.getDate();
    const calculatedWorkingDays = standardWorkingDays || this.calculateWorkingDaysInMonth(year, monthNum);
    
    // Analyze attendance records
    let absentDays = 0;
    let lateArrivals = 0;
    let halfDays = 0;
    let presentDays = 0;
    let totalOvertimeHours = 0;
    
    attendanceRecords.forEach(record => {
      const status = record.status.toLowerCase();
      
      if (status === 'absent') {
        absentDays++;
      } else if (status === 'late') {
        lateArrivals++;
        presentDays++;
      } else if (status === 'half-day' || status === 'half day') {
        halfDays++;
        presentDays++;
      } else if (status === 'present' || status === 'leave') {
        if (status === 'present' || includeLeaveDays) {
          presentDays++;
        }
      }
      
      // Calculate overtime
      if (record.hours && record.hours > standardWorkingHours) {
        totalOvertimeHours += record.hours - standardWorkingHours;
      }
      
      // Also check overtimeHours field if available
      if (record.overtimeHours) {
        totalOvertimeHours += record.overtimeHours;
      }
    });
    
    // Calculate daily salary rate
    const dailySalaryRate = baseSalary / calculatedWorkingDays;
    
    // Calculate deductions
    const absentDeduction = absentDeductionRate !== undefined
      ? absentDays * absentDeductionRate
      : absentDays * dailySalaryRate;
    
    const lateDeduction = lateDeductionRate !== undefined
      ? lateArrivals * lateDeductionRate
      : lateArrivals * (dailySalaryRate * 0.1); // Default: 10% of daily rate per late arrival
    
    const halfDayDeduction = halfDayDeductionRate !== undefined
      ? halfDays * halfDayDeductionRate
      : halfDays * (dailySalaryRate * 0.5); // Default: 50% of daily rate
    
    const totalAttendanceDeduction = absentDeduction + lateDeduction + halfDayDeduction;
    
    // Calculate overtime amount
    const calculatedOvertimeHourlyRate = overtimeHourlyRate || (baseSalary / (calculatedWorkingDays * standardWorkingHours)) * 1.5; // 1.5x for overtime
    const overtimeAmount = totalOvertimeHours * calculatedOvertimeHourlyRate;
    
    // Calculate working day ratio for prorated calculations
    const workingDayRatio = presentDays / calculatedWorkingDays;
    
    return {
      absentDays,
      lateArrivals,
      halfDays,
      absentDeduction,
      lateDeduction,
      halfDayDeduction,
      totalAttendanceDeduction,
      overtimeHours: totalOvertimeHours,
      overtimeAmount,
      presentDays,
      totalWorkingDays: calculatedWorkingDays,
      workingDayRatio,
    };
  }
  
  /**
   * Calculate working days in a month (excluding weekends)
   * You can customize this to exclude holidays, etc.
   */
  private static calculateWorkingDaysInMonth(year: number, month: number): number {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    
    let workingDays = 0;
    let currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const dayOfWeek = currentDate.getDay();
      // Count Monday (1) through Friday (5) as working days
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        workingDays++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return workingDays;
  }
  
  /**
   * Get attendance summary for a specific month
   */
  static async getAttendanceSummaryForMonth(
    employeeId: string,
    month: string
  ): Promise<{
    totalDays: number;
    presentDays: number;
    absentDays: number;
    lateDays: number;
    halfDays: number;
    leaveDays: number;
    totalHours: number;
    overtimeHours: number;
    averageHoursPerDay: number;
  }> {
    const [year, monthNum] = month.split('-').map(Number);
    const startDate = new Date(year, monthNum - 1, 1);
    const endDate = new Date(year, monthNum, 0, 23, 59, 59);
    
    const attendanceRecords = await prisma.attendance.findMany({
      where: {
        employeeId,
        date: {
          gte: startDate,
          lte: endDate,
        },
        isDeleted: false,
      },
    });
    
    let presentDays = 0;
    let absentDays = 0;
    let lateDays = 0;
    let halfDays = 0;
    let leaveDays = 0;
    let totalHours = 0;
    let overtimeHours = 0;
    
    attendanceRecords.forEach(record => {
      const status = record.status.toLowerCase();
      
      if (status === 'present') {
        presentDays++;
      } else if (status === 'absent') {
        absentDays++;
      } else if (status === 'late') {
        lateDays++;
        presentDays++;
      } else if (status === 'half-day' || status === 'half day') {
        halfDays++;
        presentDays++;
      } else if (status === 'leave') {
        leaveDays++;
      }
      
      if (record.hours) {
        totalHours += record.hours;
      }
      
      if (record.overtimeHours) {
        overtimeHours += record.overtimeHours;
      } else if (record.hours && record.hours > 8) {
        overtimeHours += record.hours - 8;
      }
    });
    
    const averageHoursPerDay = presentDays > 0 ? totalHours / presentDays : 0;
    
    return {
      totalDays: attendanceRecords.length,
      presentDays,
      absentDays,
      lateDays,
      halfDays,
      leaveDays,
      totalHours,
      overtimeHours,
      averageHoursPerDay,
    };
  }
}
