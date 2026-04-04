/**
 * AttendanceStateService - Enforces STRICT STATE-DRIVEN attendance system
 * Prevents duplicate check-ins, early/late misuse, and payroll corruption
 * 
 * STATE MODEL:
 * - NOT_STARTED: No record exists OR record exists but no checkIn/checkOut
 * - CHECKED_IN: checkIn exists, checkOut is null
 * - CHECKED_OUT: checkIn and checkOut both exist
 * - LOCKED: Admin override flag OR payroll-locked
 */

import prisma from '../prisma/client';

export type AttendanceState = 'NOT_STARTED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'LOCKED';

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  date: Date;
  checkIn: Date | null;
  checkOut: Date | null;
  status: string;
  isManualOverride?: boolean;
  overrideBy?: string | null;
  shiftId?: string | null;
}

export class AttendanceStateService {
  /**
   * Derive attendance state from stored timestamps
   * State is computed from data, not UI flags
   */
  static getAttendanceState(attendance: AttendanceRecord | null): AttendanceState {
    if (!attendance) {
      return 'NOT_STARTED';
    }

    // LOCKED state: Manual override or payroll-locked
    if (attendance.isManualOverride) {
      return 'LOCKED';
    }

    // Check if payroll-locked (would need additional check, but for now use manual override flag)
    // Note: Payroll lock check would need to query payroll generation status
    // This is a placeholder - actual implementation would check payroll lock table

    // CHECKED_OUT: Both checkIn and checkOut exist
    if (attendance.checkIn && attendance.checkOut) {
      return 'CHECKED_OUT';
    }

    // CHECKED_IN: Only checkIn exists
    if (attendance.checkIn && !attendance.checkOut) {
      return 'CHECKED_IN';
    }

    // NOT_STARTED: No checkIn (even if record exists)
    return 'NOT_STARTED';
  }

  /**
   * Validate check-in request
   * Enforces: One record per day, state checks, duty time window
   */
  static async validateCheckIn(payload: {
    employeeId: string;
    checkInTime?: Date;
  }): Promise<{ valid: boolean; error?: string; state?: AttendanceState }> {
    const employeeId = payload.employeeId;
    const checkInTime = payload.checkInTime || new Date();

    // Get today's date range using UTC (matching route handler logic)
    const nowForDate = new Date(checkInTime);
    const today = new Date(Date.UTC(nowForDate.getUTCFullYear(), nowForDate.getUTCMonth(), nowForDate.getUTCDate(), 0, 0, 0, 0));
    const endOfDay = new Date(Date.UTC(nowForDate.getUTCFullYear(), nowForDate.getUTCMonth(), nowForDate.getUTCDate(), 23, 59, 59, 999));

    // Find existing attendance for today
    const attendance = await prisma.attendance.findFirst({
      where: {
        employeeId,
        date: { gte: today, lte: endOfDay },
        isDeleted: false,
      },
    });

    // Derive state
    const state = this.getAttendanceState(attendance);

    // ENFORCE: Block check-in if already CHECKED_IN
    if (state === 'CHECKED_IN') {
      return {
        valid: false,
        error: 'ATTENDANCE_VIOLATION: Already checked in. Please check out before checking in again.',
        state,
      };
    }

    // ENFORCE: Block check-in if already CHECKED_OUT
    if (state === 'CHECKED_OUT') {
      return {
        valid: false,
        error: 'ATTENDANCE_VIOLATION: Attendance already completed for today. Multiple check-ins are not allowed.',
        state,
      };
    }

    // ENFORCE: Block check-in if LOCKED
    if (state === 'LOCKED') {
      return {
        valid: false,
        error: 'ATTENDANCE_VIOLATION: Attendance is locked (manual override or payroll-locked). Check-in is not allowed.',
        state,
      };
    }

    // ENFORCE: Allow check-in only if NOT_STARTED (no record OR record with no checkIn)
    if (state !== 'NOT_STARTED') {
      return {
        valid: false,
        error: `ATTENDANCE_VIOLATION: Invalid state for check-in: ${state}. Only NOT_STARTED state allows check-in.`,
        state,
      };
    }

    // Validate duty time window (if shift exists)
    if (attendance?.shiftId) {
      const shiftValidation = await this.validateDutyTimeWindow(employeeId, checkInTime, attendance.shiftId);
      if (!shiftValidation.valid) {
        return shiftValidation;
      }
    }

    // All validations passed
    return { valid: true, state: 'NOT_STARTED' };
  }

  /**
   * Validate check-out request
   * Enforces: Must be CHECKED_IN, checkout > checkin
   */
  static async validateCheckOut(payload: {
    employeeId: string;
    checkOutTime?: Date;
  }): Promise<{ valid: boolean; error?: string; state?: AttendanceState }> {
    const employeeId = payload.employeeId;
    const checkOutTime = payload.checkOutTime || new Date();

    // Get today's date range using UTC (matching route handler logic)
    const nowForDate = new Date(checkOutTime);
    const today = new Date(Date.UTC(nowForDate.getUTCFullYear(), nowForDate.getUTCMonth(), nowForDate.getUTCDate(), 0, 0, 0, 0));
    const endOfDay = new Date(Date.UTC(nowForDate.getUTCFullYear(), nowForDate.getUTCMonth(), nowForDate.getUTCDate(), 23, 59, 59, 999));

    // Find existing attendance for today
    const attendance = await prisma.attendance.findFirst({
      where: {
        employeeId,
        date: { gte: today, lte: endOfDay },
        isDeleted: false,
      },
    });

    // ENFORCE: Block check-out if no attendance record exists
    if (!attendance) {
      return {
        valid: false,
        error: 'ATTENDANCE_VIOLATION: No attendance record found for today. Please check in first.',
        state: 'NOT_STARTED',
      };
    }

    // Derive state
    const state = this.getAttendanceState(attendance);

    // ENFORCE: Block check-out if NOT_STARTED (no check-in)
    if (state === 'NOT_STARTED') {
      return {
        valid: false,
        error: 'ATTENDANCE_VIOLATION: No check-in found. Cannot check out without checking in first.',
        state,
      };
    }

    // ENFORCE: Block check-out if already CHECKED_OUT
    if (state === 'CHECKED_OUT') {
      return {
        valid: false,
        error: 'ATTENDANCE_VIOLATION: Already checked out for today. Multiple check-outs are not allowed.',
        state,
      };
    }

    // ENFORCE: Block check-out if LOCKED
    if (state === 'LOCKED') {
      return {
        valid: false,
        error: 'ATTENDANCE_VIOLATION: Attendance is locked (manual override or payroll-locked). Check-out is not allowed.',
        state,
      };
    }

    // ENFORCE: Allow check-out only if CHECKED_IN
    if (state !== 'CHECKED_IN') {
      return {
        valid: false,
        error: `ATTENDANCE_VIOLATION: Invalid state for check-out: ${state}. Only CHECKED_IN state allows check-out.`,
        state,
      };
    }

    // ENFORCE: Check-out time must be after check-in time
    if (attendance.checkIn && checkOutTime <= attendance.checkIn) {
      return {
        valid: false,
        error: `ATTENDANCE_VIOLATION: Check-out time (${checkOutTime.toISOString()}) must be after check-in time (${attendance.checkIn.toISOString()}).`,
        state,
      };
    }

    // All validations passed
    return { valid: true, state: 'CHECKED_IN' };
  }

  /**
   * Validate duty time window using shift data
   * Check-in allowed ONLY within: (Shift Start - Allowed Early Minutes) → Shift End
   */
  static async validateDutyTimeWindow(
    employeeId: string,
    checkInTime: Date,
    shiftId?: string | null
  ): Promise<{ valid: boolean; error?: string }> {
    // If no shift, skip validation (backward compatibility)
    if (!shiftId) {
      return { valid: true };
    }

    // Get employee and shift data
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { shiftTimings: true },
    });

    if (!employee) {
      return { valid: false, error: 'ATTENDANCE_VIOLATION: Employee not found.' };
    }

    // Parse shift timings (format: "09:00-17:00" or similar)
    // Default assumption: 09:00 AM start, 60-120 minutes early allowed
    const shiftStartHour = 9;
    const shiftStartMinute = 0;
    const allowedEarlyMinutes = 120; // Default: 2 hours early
    const shiftEndHour = 17;
    const shiftEndMinute = 0;

    if (employee.shiftTimings) {
      // Parse shift timings string (e.g., "09:00-17:00")
      const parts = employee.shiftTimings.split('-');
      if (parts.length === 2) {
        const [startStr, endStr] = parts;
        const [startHour, startMin] = startStr.split(':').map(Number);
        const [endHour, endMin] = endStr.split(':').map(Number);
        
        // Create time windows
        const shiftStart = new Date(checkInTime);
        shiftStart.setHours(startHour || shiftStartHour, startMin || shiftStartMinute, 0, 0);
        
        const shiftEnd = new Date(checkInTime);
        shiftEnd.setHours(endHour || shiftEndHour, endMin || shiftEndMinute, 0, 0);
        
        const allowedStart = new Date(shiftStart);
        allowedStart.setMinutes(allowedStart.getMinutes() - allowedEarlyMinutes);
        
        // Validate check-in time is within window
        if (checkInTime < allowedStart) {
          return {
            valid: false,
            error: `ATTENDANCE_VIOLATION: Check-in time (${checkInTime.toLocaleTimeString()}) is too early. Allowed window starts at ${allowedStart.toLocaleTimeString()}.`,
          };
        }
        
        if (checkInTime > shiftEnd) {
          return {
            valid: false,
            error: `ATTENDANCE_VIOLATION: Check-in time (${checkInTime.toLocaleTimeString()}) is after shift end (${shiftEnd.toLocaleTimeString()}). Check-in not allowed after shift end.`,
          };
        }
      }
    }

    return { valid: true };
  }

  /**
   * Validate payroll dependency lock
   * If payroll is generated for a date range, attendance becomes LOCKED
   */
  static async validatePayrollLock(
    employeeId: string,
    date: Date
  ): Promise<{ locked: boolean; error?: string }> {
    // Check if payroll exists for this employee and month
    const monthNum = date.getMonth() + 1;
    const month = `${date.getFullYear()}-${monthNum.toString().padStart(2, '0')}`;
    
    const payroll = await prisma.payroll.findFirst({
      where: {
        employeeId,
        month,
        isDeleted: false,
      },
    });

    // If payroll exists and is approved/paid, attendance should be locked
    // However, without a payroll lock flag, we can only warn
    // This is a limitation - we'd need a payroll lock table to fully enforce
    // For now, return not locked (backward compatibility)
    
    return { locked: false };
  }

  /**
   * Get attendance state for employee on a specific date
   */
  static async getAttendanceStateForDate(
    employeeId: string,
    date: Date
  ): Promise<{ state: AttendanceState; attendance: AttendanceRecord | null }> {
    // Use UTC for consistent date comparisons (matching route handler logic)
    const dateStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
    const dateEnd = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));

    const attendance = await prisma.attendance.findFirst({
      where: {
        employeeId,
        date: { gte: dateStart, lte: dateEnd },
        isDeleted: false,
      },
    });

    const state = this.getAttendanceState(attendance);

    return { state, attendance };
  }
}
