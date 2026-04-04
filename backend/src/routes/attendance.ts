import * as express from 'express';
import { Response } from 'express';
import prisma from '../prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = (express as any).Router();

// Get attendance stats for today
router.get('/stats', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    // Get today's date in UTC for timezone-safe date comparison
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    const endOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));

    const attendanceRecords = await prisma.attendance.findMany({
      where: {
        date: { gte: today, lte: endOfDay },
        isDeleted: false,
      },
      select: {
        status: true,
      },
    });

    const stats = {
      present: 0,
      late: 0,
      absent: 0, // This is tricky as absent records might not exist yet. We might need to count total employees - (present + late + on_leave)
      onLeave: 0,
    };

    attendanceRecords.forEach((record) => {
      const status = record.status.toLowerCase();
      if (status === 'present') stats.present++;
      else if (status === 'late') stats.late++;
      else if (status === 'on leave' || status === 'leave') stats.onLeave++;
      else if (status === 'absent') stats.absent++;
    });

    // To calculate 'Absent' correctly, we should check total active employees.
    // However, for now, let's just count explicitly marked 'absent' records 
    // OR we can fetch total employees count and subtract.
    // The requirement says "Automatically calculate... based on today's attendance records."
    // If 'Absent' is not a record, it won't be in 'attendanceRecords'.
    // But usually in HR systems, 'Absent' is either explicitly marked or implied.
    // Let's also fetch total active employees to infer absent if needed, 
    // but the user requirement "based on today’s attendance records" suggests we might just count what's there 
    // OR we should be smart.
    // Let's stick to counting records for now, but maybe add a query for total employees if we want to show "Not Marked".
    // For "Absent", if the system auto-creates absent records (cron job), then it's in the table.
    // If not, "Absent" might just be Total Employees - (Present + Late + On Leave).
    // Let's count explicitly.

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Get attendance stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch attendance stats',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get all attendance records
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { date, startDate, endDate, employeeId, status } = req.query;

    const where: any = { isDeleted: false };

    if (date) {
      const dayStart = new Date(date as string);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date as string);
      dayEnd.setHours(23, 59, 59, 999);
      where.date = { gte: dayStart, lte: dayEnd };
    } else if (startDate && endDate) {
      const start = new Date(startDate as string);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate as string);
      end.setHours(23, 59, 59, 999);
      where.date = { gte: start, lte: end };
    }

    if (employeeId) {
      where.employeeId = employeeId;
    }

    if (status) {
      where.status = status;
    }

    const attendance = await prisma.attendance.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            employeeId: true,
            tid: true,
            name: true,
            department: true,
            email: true,
          },
        },
      },
      orderBy: { date: 'desc' },
    });

    // AUTHORITATIVE STATE DERIVATION: Compute state from timestamps for all records
    const { AttendanceStateService } = await import('../services/attendance-state-service');
    
    // Format attendance data for frontend
    // Return full timestamps for backend-driven timing calculations
    const formattedAttendance = attendance.map((record) => {
      // Compute authoritative state from timestamps
      const state = AttendanceStateService.getAttendanceState({
        id: record.id,
        employeeId: record.employeeId,
        date: record.date,
        checkIn: record.checkIn,
        checkOut: record.checkOut,
        status: record.status,
        isManualOverride: record.isManualOverride || false,
      });
      
      return {
        id: record.id,
        employee: record.employee.name,
        employeeId: record.employee.id, // Database UUID for matching
        employeeIdString: record.employee.employeeId, // Employee ID string like "EMP0001"
        tid: record.employee.tid, // Tracking ID
        department: record.employee.department,
        date: record.date,
        // Return full ISO timestamp strings for accurate time calculations
        checkIn: record.checkIn ? record.checkIn.toISOString() : null,
        checkOut: record.checkOut ? record.checkOut.toISOString() : null,
        // Also include formatted times for display convenience
        checkInFormatted: record.checkIn ? new Date(record.checkIn).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : null,
        checkOutFormatted: record.checkOut ? new Date(record.checkOut).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : null,
        hours: record.hours || 0,
        status: record.status, // Keep for backward compatibility
        state: state, // AUTHORITATIVE STATE: Derived from timestamps
        isManualOverride: record.isManualOverride || false,
      };
    });

    res.json({
      success: true,
      data: formattedAttendance,
    });
  } catch (error) {
    console.error('Get attendance error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch attendance',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get today's attendance for specific employee
// NOTE: This route MUST be defined BEFORE /:id to prevent route collision
router.get('/today', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { employeeId } = req.query;

    if (!employeeId || typeof employeeId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Employee ID is required',
      });
    }

    // Check if employee exists and is not deleted
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee || employee.isDeleted) {
      return res.status(404).json({
        success: false,
        error: 'Employee not found',
      });
    }

    // Get today's date in server timezone (company timezone)
    // Using UTC midnight for consistency - dates are stored in UTC
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    const endOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));

    const attendance = await prisma.attendance.findFirst({
      where: {
        employeeId,
        date: { gte: today, lte: endOfDay },
        isDeleted: false,
      },
      include: {
        employee: {
          select: {
            id: true,
            employeeId: true,
            name: true,
            department: true,
          },
        },
      },
    });

    // AUTHORITATIVE STATE DERIVATION: Use AttendanceStateService to compute state from timestamps
    const { AttendanceStateService } = await import('../services/attendance-state-service');
    
    if (!attendance) {
      return res.json({
        success: true,
        data: null,
        state: 'NOT_STARTED', // Explicit state when no record exists
      });
    }

    // Compute state AFTER null check to ensure attendance exists
    const state = AttendanceStateService.getAttendanceState(attendance);

    // Return attendance with authoritative state computed from timestamps
    res.json({
      success: true,
      data: {
        ...attendance,
        checkIn: attendance.checkIn ? attendance.checkIn.toISOString() : null,
        checkOut: attendance.checkOut ? attendance.checkOut.toISOString() : null,
        date: attendance.date.toISOString(),
      },
      state: state, // AUTHORITATIVE STATE: Derived from timestamps, not status field
    });
  } catch (error) {
    console.error('Get today attendance error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch today\'s attendance',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get attendance by ID
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const attendance = await prisma.attendance.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            employeeId: true,
            tid: true,
            name: true,
            department: true,
            email: true,
          },
        },
      },
    });

    if (!attendance || attendance.isDeleted) {
      return res.status(404).json({
        success: false,
        error: 'Attendance record not found',
      });
    }

    // Return attendance with full ISO timestamp strings for backend-driven timing
    res.json({
      success: true,
      data: {
        ...attendance,
        checkIn: attendance.checkIn ? attendance.checkIn.toISOString() : null,
        checkOut: attendance.checkOut ? attendance.checkOut.toISOString() : null,
        date: attendance.date.toISOString(),
      },
    });
  } catch (error) {
    console.error('Get attendance error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch attendance',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Create attendance record
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { employeeId, date, checkIn, checkOut, status } = req.body;

    if (!employeeId || !date || !status) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
      });
    }

    // Determine checkIn time if not provided but status implies presence
    let finalCheckIn = checkIn ? new Date(checkIn) : null;
    if (!finalCheckIn && ['present', 'late', 'half-day'].includes(status)) {
        // Only default to now if the date is today
        const recordDate = new Date(date);
        const today = new Date();
        if (recordDate.toDateString() === today.toDateString()) {
            finalCheckIn = new Date();
        }
    }

    // Check if employee exists
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee || employee.isDeleted) {
      return res.status(404).json({
        success: false,
        error: 'Employee not found',
      });
    }

    // Check if attendance already exists for this date (timezone-safe UTC comparison)
    const dateObj = new Date(date);
    const attendanceDate = new Date(Date.UTC(dateObj.getUTCFullYear(), dateObj.getUTCMonth(), dateObj.getUTCDate(), 0, 0, 0, 0));
    const endDate = new Date(Date.UTC(dateObj.getUTCFullYear(), dateObj.getUTCMonth(), dateObj.getUTCDate(), 23, 59, 59, 999));

    const existingAttendance = await prisma.attendance.findFirst({
      where: {
        employeeId,
        date: { gte: attendanceDate, lte: endDate },
        isDeleted: false,
      },
    });

    if (existingAttendance) {
      return res.status(400).json({
        success: false,
        error: 'Attendance already exists for this date',
      });
    }

    // Calculate hours if checkIn and checkOut are provided
    let hours = null;
    if (checkIn && checkOut) {
      const checkInTime = new Date(checkIn);
      const checkOutTime = new Date(checkOut);
      hours = (checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60);
    }

    const attendance = await prisma.attendance.create({
      data: {
        employeeId,
        date: attendanceDate,
        checkIn: finalCheckIn,
        checkOut: checkOut ? new Date(checkOut) : null,
        status,
        hours,
      },
      include: {
        employee: {
          select: {
            id: true,
            employeeId: true,
            name: true,
            department: true,
          },
        },
      },
    });

    // Return attendance with full ISO timestamp strings for backend-driven timing
    res.json({
      success: true,
      data: {
        ...attendance,
        checkIn: attendance.checkIn ? attendance.checkIn.toISOString() : null,
        checkOut: attendance.checkOut ? attendance.checkOut.toISOString() : null,
        date: attendance.date.toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Create attendance error:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({
        success: false,
        error: 'Attendance already exists for this date',
      });
    }
    res.status(500).json({
      success: false,
      error: 'Failed to create attendance',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Check-in
router.post('/checkin', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { employeeId } = req.body;

    if (!employeeId) {
      return res.status(400).json({
        success: false,
        error: 'Employee ID is required',
      });
    }

    // Check if employee exists
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee || employee.isDeleted) {
      return res.status(404).json({
        success: false,
        error: 'Employee not found',
      });
    }

    // STRICT STATE-DRIVEN VALIDATION
    const { AttendanceStateService } = await import('../services/attendance-state-service');
    const now = new Date();
    let validation;
    try {
      validation = await AttendanceStateService.validateCheckIn({
      employeeId,
      checkInTime: now,
    });
    } catch (validationError: any) {
      console.error('Check-in validation error:', {
        employeeId,
        error: validationError?.message,
        stack: validationError?.stack,
      });
      return res.status(500).json({
        success: false,
        error: 'Validation service error',
        message: validationError?.message || 'Failed to validate check-in',
      });
    }

    if (!validation.valid) {
      console.warn('Check-in validation failed:', {
        employeeId,
        error: validation.error,
        state: validation.state,
      });
      return res.status(400).json({
        success: false,
        error: validation.error || 'Check-in validation failed',
        state: validation.state,
      });
    }

    // Get today's date in UTC for timezone-safe date comparison
    const nowForDate = new Date();
    const today = new Date(Date.UTC(nowForDate.getUTCFullYear(), nowForDate.getUTCMonth(), nowForDate.getUTCDate(), 0, 0, 0, 0));
    const endOfDay = new Date(Date.UTC(nowForDate.getUTCFullYear(), nowForDate.getUTCMonth(), nowForDate.getUTCDate(), 23, 59, 59, 999));

    // Check if attendance already exists for today
    let attendance = await prisma.attendance.findFirst({
      where: {
        employeeId,
        date: { gte: today, lte: endOfDay },
        isDeleted: false,
      },
    });

    // Company timing rule: Check-in before 9:00 AM is present, after is late
    const companyStartTime = new Date(now);
    companyStartTime.setHours(9, 0, 0, 0); // 9:00 AM
    const status = now <= companyStartTime ? 'present' : 'late';

    if (attendance) {
      // Update existing attendance (only if no checkIn, e.g., was marked absent)
      // State validation already ensures this is safe
      attendance = await prisma.attendance.update({
        where: { id: attendance.id },
        data: {
          checkIn: now,
          status: status, // Update status based on arrival time
        },
        include: {
          employee: {
            select: {
              id: true,
              employeeId: true,
              name: true,
              department: true,
            },
          },
        },
      });
    } else {
      try {
        // Create new attendance with exact timestamp
        attendance = await prisma.attendance.create({
          data: {
            employeeId,
            date: today,
            checkIn: now, // Store exact timestamp
            checkOut: null,
            status,
          },
          include: {
            employee: {
              select: {
                id: true,
                employeeId: true,
                name: true,
                department: true,
              },
            },
          },
        });
      } catch (error: any) {
        // Handle Race Condition (P2002: Unique constraint failed)
        if (error.code === 'P2002') {
          // Record was created by another request in the meantime
          attendance = await prisma.attendance.findFirst({
             where: {
                employeeId,
                date: { gte: today, lte: endOfDay },
             },
             include: {
                employee: {
                   select: { id: true, employeeId: true, name: true, department: true }
                }
             }
          });

          if (attendance) {
             // Re-validate state (race condition protection)
             const stateValidation = AttendanceStateService.getAttendanceState(attendance);
             if (stateValidation !== 'NOT_STARTED') {
                return res.status(400).json({
                   success: false,
                   error: 'Already checked in. Please check out before checking in again.',
                });
             }
             // If it exists but no checkIn, update it
             attendance = await prisma.attendance.update({
                where: { id: attendance.id },
                data: { checkIn: now, status },
                include: { employee: { select: { id: true, employeeId: true, name: true, department: true } } }
             });
          } else {
             throw error; // Should not happen if P2002 occurred
          }
        } else {
          throw error;
        }
      }
    }

    // Compute authoritative state after check-in (reuse imported service)
    const checkInState = AttendanceStateService.getAttendanceState({
      id: attendance.id,
      employeeId: attendance.employeeId,
      date: attendance.date,
      checkIn: attendance.checkIn,
      checkOut: attendance.checkOut,
      status: attendance.status,
      isManualOverride: attendance.isManualOverride || false,
    });

    // Return attendance with full ISO timestamp strings and authoritative state
    res.json({
      success: true,
      data: {
        ...attendance,
        checkIn: attendance.checkIn ? attendance.checkIn.toISOString() : null,
        checkOut: attendance.checkOut ? attendance.checkOut.toISOString() : null,
        date: attendance.date.toISOString(),
      },
      state: checkInState, // AUTHORITATIVE STATE: Derived from timestamps
    });
  } catch (error: any) {
    console.error('Check-in error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check in',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Check-out
router.post('/checkout', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { employeeId, earlyCheckoutReason, forceEarlyCheckout } = req.body;

    if (!employeeId) {
      return res.status(400).json({
        success: false,
        error: 'Employee ID is required',
      });
    }

    // STRICT STATE-DRIVEN VALIDATION
    const { AttendanceStateService } = await import('../services/attendance-state-service');
    const now = new Date();
    const validation = await AttendanceStateService.validateCheckOut({
      employeeId,
      checkOutTime: now,
    });

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: validation.error || 'Check-out validation failed',
      });
    }

    // Get today's date in UTC for timezone-safe date comparison
    const nowForDate = new Date();
    const today = new Date(Date.UTC(nowForDate.getUTCFullYear(), nowForDate.getUTCMonth(), nowForDate.getUTCDate(), 0, 0, 0, 0));
    const endOfDay = new Date(Date.UTC(nowForDate.getUTCFullYear(), nowForDate.getUTCMonth(), nowForDate.getUTCDate(), 23, 59, 59, 999));

    // Find today's attendance (validation already ensures it exists)
    const attendance = await prisma.attendance.findFirst({
      where: {
        employeeId,
        date: { gte: today, lte: endOfDay },
        isDeleted: false,
      },
    });

    if (!attendance) {
      return res.status(404).json({
        success: false,
        error: 'No attendance record found for today. Please check in first.',
      });
    }

    // Calculate hours worked
    let hours = null;
    let totalWorkDuration = null;
    let isEarlyCheckout = false;
    let earlyCheckoutMinutes = 0;
    const minimumDutyHours = 8; // Standard 8-hour work day

    if (attendance.checkIn) {
      const checkInTime = new Date(attendance.checkIn);
      const durationMs = now.getTime() - checkInTime.getTime();
      hours = durationMs / (1000 * 60 * 60);

      // Check if early checkout (less than minimum duty hours)
      if (hours < minimumDutyHours) {
        isEarlyCheckout = true;
        earlyCheckoutMinutes = Math.floor((minimumDutyHours - hours) * 60);
        
        // If forceEarlyCheckout is not true, return warning
        if (!forceEarlyCheckout) {
          return res.status(200).json({
            success: false,
            warning: true,
            isEarlyCheckout: true,
            message: `You are checking out ${earlyCheckoutMinutes} minutes early. Minimum duty time is ${minimumDutyHours} hours.`,
            workedHours: hours.toFixed(2),
            minimumHours: minimumDutyHours,
            earlyCheckoutMinutes,
            requiresReason: true,
          });
        }

        // If forceEarlyCheckout is true but no reason provided, require reason
        if (forceEarlyCheckout && !earlyCheckoutReason) {
          return res.status(400).json({
            success: false,
            error: 'Early checkout reason is required when checking out before minimum duty time.',
            requiresReason: true,
          });
        }
      }

      // Calculate HH:MM:SS format
      const totalSeconds = Math.floor(durationMs / 1000);
      const hours_part = Math.floor(totalSeconds / 3600);
      const minutes_part = Math.floor((totalSeconds % 3600) / 60);
      const seconds_part = totalSeconds % 60;
      totalWorkDuration = `${String(hours_part).padStart(2, '0')}:${String(minutes_part).padStart(2, '0')}:${String(seconds_part).padStart(2, '0')}`;
    }

    // Update attendance with checkout data
    const updateData: any = {
      checkOut: now,
      hours,
      totalWorkDuration,
    };

    // Mark as suspicious if early checkout
    if (isEarlyCheckout) {
      updateData.isSuspicious = true;
      updateData.suspiciousReason = `Early checkout: ${earlyCheckoutMinutes} minutes before minimum duty time. Reason: ${earlyCheckoutReason || 'Not provided'}`;
    }

    const updatedAttendance = await prisma.attendance.update({
      where: { id: attendance.id },
      data: updateData,
      include: {
        employee: {
          select: {
            id: true,
            employeeId: true,
            name: true,
            department: true,
          },
        },
      },
    });

    // Compute authoritative state after check-out
    const checkOutState = AttendanceStateService.getAttendanceState({
      id: updatedAttendance.id,
      employeeId: updatedAttendance.employeeId,
      date: updatedAttendance.date,
      checkIn: updatedAttendance.checkIn,
      checkOut: updatedAttendance.checkOut,
      status: updatedAttendance.status,
      isManualOverride: updatedAttendance.isManualOverride || false,
    });

    // Return with full ISO timestamp strings and authoritative state
    res.json({
      success: true,
      data: {
        ...updatedAttendance,
        checkIn: updatedAttendance.checkIn ? updatedAttendance.checkIn.toISOString() : null,
        checkOut: updatedAttendance.checkOut ? updatedAttendance.checkOut.toISOString() : null,
        date: updatedAttendance.date.toISOString(),
      },
      state: checkOutState, // AUTHORITATIVE STATE: Derived from timestamps
      isEarlyCheckout,
      earlyCheckoutMinutes,
    });
  } catch (error) {
    console.error('Check-out error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check out',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Update attendance
router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { checkIn, checkOut, status } = req.body;

    const attendance = await prisma.attendance.findUnique({
      where: { id },
    });

    if (!attendance || attendance.isDeleted) {
      return res.status(404).json({
        success: false,
        error: 'Attendance record not found',
      });
    }

    // Calculate hours if checkIn and checkOut are provided
    let hours = attendance.hours;
    if (checkIn && checkOut) {
      const checkInTime = new Date(checkIn);
      const checkOutTime = new Date(checkOut);
      hours = (checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60);
    } else if (attendance.checkIn && checkOut) {
      const checkInTime = new Date(attendance.checkIn);
      const checkOutTime = new Date(checkOut);
      hours = (checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60);
    } else if (checkIn && attendance.checkOut) {
      const checkInTime = new Date(checkIn);
      const checkOutTime = new Date(attendance.checkOut);
      hours = (checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60);
    }

    const updatedAttendance = await prisma.attendance.update({
      where: { id },
      data: {
        ...(checkIn && { checkIn: new Date(checkIn) }),
        ...(checkOut && { checkOut: new Date(checkOut) }),
        ...(status && { status }),
        ...(hours !== null && { hours }),
      },
      include: {
        employee: {
          select: {
            id: true,
            employeeId: true,
            name: true,
            department: true,
          },
        },
      },
    });

    // Return with full ISO timestamp strings for backend-driven timing
    res.json({
      success: true,
      data: {
        ...updatedAttendance,
        checkIn: updatedAttendance.checkIn ? updatedAttendance.checkIn.toISOString() : null,
        checkOut: updatedAttendance.checkOut ? updatedAttendance.checkOut.toISOString() : null,
        date: updatedAttendance.date.toISOString(),
      },
    });
  } catch (error) {
    console.error('Update attendance error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update attendance',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Delete attendance
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const attendance = await prisma.attendance.findUnique({
      where: { id },
    });

    if (!attendance || attendance.isDeleted) {
      return res.status(404).json({
        success: false,
        error: 'Attendance record not found',
      });
    }

    await prisma.attendance.update({
      where: { id },
      data: { isDeleted: true },
    });

    res.json({
      success: true,
      message: 'Attendance record deleted successfully',
    });
  } catch (error) {
    console.error('Delete attendance error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete attendance',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get attendance history for specific employee
router.get('/employee/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { startDate, endDate, limit = '30' } = req.query;

    // Check if employee exists
    const employee = await prisma.employee.findUnique({
      where: { id },
    });

    if (!employee) {
      return res.status(404).json({
        success: false,
        error: 'Employee not found',
      });
    }

    const where: any = {
      employeeId: id,
      isDeleted: false,
    };

    if (startDate && endDate) {
      where.date = {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string),
      };
    }

    const attendance = await prisma.attendance.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            employeeId: true,
            name: true,
            department: true,
          },
        },
      },
      orderBy: { date: 'desc' },
      take: parseInt(limit as string),
    });

    const formattedAttendance = attendance.map((record) => ({
      id: record.id,
      date: record.date.toISOString().split('T')[0],
      checkIn: record.checkIn ? record.checkIn.toISOString() : null,
      checkOut: record.checkOut ? record.checkOut.toISOString() : null,
      totalWorkDuration: record.totalWorkDuration,
      status: record.status,
      employee: record.employee,
    }));

    res.json({
      success: true,
      data: formattedAttendance,
    });
  } catch (error) {
    console.error('Get employee attendance error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch employee attendance',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

