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
export declare class AttendanceStateService {
    /**
     * Derive attendance state from stored timestamps
     * State is computed from data, not UI flags
     */
    static getAttendanceState(attendance: AttendanceRecord | null): AttendanceState;
    /**
     * Validate check-in request
     * Enforces: One record per day, state checks, duty time window
     */
    static validateCheckIn(payload: {
        employeeId: string;
        checkInTime?: Date;
    }): Promise<{
        valid: boolean;
        error?: string;
        state?: AttendanceState;
    }>;
    /**
     * Validate check-out request
     * Enforces: Must be CHECKED_IN, checkout > checkin
     */
    static validateCheckOut(payload: {
        employeeId: string;
        checkOutTime?: Date;
    }): Promise<{
        valid: boolean;
        error?: string;
        state?: AttendanceState;
    }>;
    /**
     * Validate duty time window using shift data
     * Check-in allowed ONLY within: (Shift Start - Allowed Early Minutes) → Shift End
     */
    static validateDutyTimeWindow(employeeId: string, checkInTime: Date, shiftId?: string | null): Promise<{
        valid: boolean;
        error?: string;
    }>;
    /**
     * Validate payroll dependency lock
     * If payroll is generated for a date range, attendance becomes LOCKED
     */
    static validatePayrollLock(employeeId: string, date: Date): Promise<{
        locked: boolean;
        error?: string;
    }>;
    /**
     * Get attendance state for employee on a specific date
     */
    static getAttendanceStateForDate(employeeId: string, date: Date): Promise<{
        state: AttendanceState;
        attendance: AttendanceRecord | null;
    }>;
}
//# sourceMappingURL=attendance-state-service.d.ts.map