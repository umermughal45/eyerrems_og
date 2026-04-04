import express, { Response } from 'express';
import prisma from '../prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = (express as any).Router();

// Get all payroll records
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { month, employeeId, status } = req.query;

    const where: any = { isDeleted: false };

    if (month) {
      where.month = month;
    }

    if (employeeId) {
      where.employeeId = employeeId;
    }

    if (status) {
      where.status = status;
    }

    const payroll = await prisma.payroll.findMany({
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
      orderBy: { month: 'desc' },
    });

    // Format payroll data for frontend with calculated payment info
    const formattedPayroll = await Promise.all(
      payroll.map(async (record) => {
        // Calculate paid amount from payments
        const payments = await prisma.payrollPayment.findMany({
          where: { payrollId: record.id },
        });
        const paidAmount = payments.reduce((sum, p) => sum + p.amount, 0);
        const remainingBalance = Math.max(0, record.netPay - paidAmount);
        
        // Determine status dynamically
        let status = 'created';
        if (paidAmount === 0) {
          status = 'created';
        } else if (paidAmount >= record.netPay) {
          status = 'fully_paid';
        } else {
          status = 'partially_paid';
        }

        // Update payroll record if values changed
        if (record.paidAmount !== paidAmount || record.paymentStatus !== status) {
          await prisma.payroll.update({
            where: { id: record.id },
            data: {
              paidAmount,
              remainingBalance,
              paymentStatus: status,
            },
          });
        }

        return {
          id: record.id,
          employee: record.employee.name,
          employeeId: record.employee.employeeId,
          tid: record.employee.tid, // Tracking ID
          department: record.employee.department,
          month: record.month,
          baseSalary: record.baseSalary,
          bonus: record.bonus,
          deductions: record.deductions,
          netPay: record.netPay,
          paidAmount,
          remainingBalance,
          status,
        };
      })
    );

    res.json({
      success: true,
      data: formattedPayroll,
    });
  } catch (error) {
    console.error('Get payroll error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch payroll',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get payroll by ID with full details
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    console.log('PAYROLL GET DETAIL REQUEST:', {
      method: req.method,
      url: req.url,
      path: req.path,
      params: req.params,
      headers: {
        'x-csrf-token': req.headers['x-csrf-token'] || req.headers['X-CSRF-Token'],
        'x-session-id': req.headers['x-session-id'] || req.headers['X-Session-Id'],
        'x-device-id': req.headers['x-device-id'] || req.headers['X-Device-Id'],
        authorization: req.headers.authorization ? 'present' : 'missing'
      },
      user: req.user ? { id: req.user.id, username: req.user.username } : 'no user'
    });

    const { id } = req.params;

    // Validate ID format (should be UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid payroll ID format',
      });
    }

    const payroll = await prisma.payroll.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            employeeId: true,
            tid: true,
            name: true,
            email: true,
            phone: true,
            department: true,
            position: true,
            salary: true,
          },
        },
        payrollAllowances: true,
        payrollDeductions: true,
        payments: {
          orderBy: { paymentDate: 'desc' },
          include: {
            createdBy: {
              select: {
                id: true,
                username: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!payroll || payroll.isDeleted) {
      return res.status(404).json({
        success: false,
        error: 'Payroll record not found',
      });
    }

    // Calculate paid amount and remaining balance dynamically
    const totalPaid = payroll.payments.reduce((sum, payment) => sum + payment.amount, 0);
    const remainingBalance = Math.max(0, payroll.netPay - totalPaid);
    
    // Determine payment status
    let paymentStatus = 'created';
    if (totalPaid === 0) {
      paymentStatus = 'created';
    } else if (totalPaid >= payroll.netPay) {
      paymentStatus = 'fully_paid';
    } else {
      paymentStatus = 'partially_paid';
    }

    // Update payroll if status changed
    if (payroll.paymentStatus !== paymentStatus || payroll.paidAmount !== totalPaid) {
      await prisma.payroll.update({
        where: { id },
        data: {
          paidAmount: totalPaid,
          remainingBalance,
          paymentStatus,
        },
      });
    }

    // Get attendance data for the month
    const [year, monthNum] = payroll.month.split('-').map(Number);
    const startDate = new Date(year, monthNum - 1, 1);
    const endDate = new Date(year, monthNum, 0, 23, 59, 59);

    const attendanceRecords = await prisma.attendance.findMany({
      where: {
        employeeId: payroll.employeeId,
        date: {
          gte: startDate,
          lte: endDate,
        },
        isDeleted: false,
      },
      orderBy: { date: 'asc' },
    });

    // Calculate attendance summary
    const attendanceSummary = {
      totalDays: attendanceRecords.length,
      presentDays: attendanceRecords.filter(a => a.status === 'present' || a.status === 'late').length,
      absentDays: attendanceRecords.filter(a => a.status === 'absent').length,
      leaveDays: attendanceRecords.filter(a => a.status === 'leave').length,
      totalHours: attendanceRecords.reduce((sum, a) => sum + (a.hours || 0), 0),
      overtimeHours: attendanceRecords.reduce((sum, a) => {
        const hours = a.hours || 0;
        return sum + Math.max(0, hours - 8); // Assuming 8 hours is standard
      }, 0),
    };

    // Get leave requests for the month
    const leaveRequests = await prisma.leaveRequest.findMany({
      where: {
        employeeId: payroll.employeeId,
        startDate: {
          lte: endDate,
        },
        endDate: {
          gte: startDate,
        },
        isDeleted: false,
      },
      orderBy: { startDate: 'asc' },
    });

    // Calculate leave summary
    const leaveSummary = {
      totalRequests: leaveRequests.length,
      approvedDays: leaveRequests
        .filter(l => l.status === 'approved')
        .reduce((sum, l) => sum + (l.days || 0), 0),
      pendingDays: leaveRequests
        .filter(l => l.status === 'pending')
        .reduce((sum, l) => sum + (l.days || 0), 0),
      leaveRequests: leaveRequests.map(l => ({
        id: l.id,
        type: l.type,
        startDate: l.startDate,
        endDate: l.endDate,
        days: l.days,
        status: l.status,
      })),
    };

    res.json({
      success: true,
      data: {
        ...payroll,
        paidAmount: totalPaid,
        remainingBalance,
        paymentStatus,
        attendanceSummary,
        leaveSummary,
      },
    });
  } catch (error) {
    console.error('Get payroll error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch payroll',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Create payroll record
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const {
      employeeId, month, baseSalary, basicSalary, bonus, overtimeAmount, overtimeHours,
      taxPercent, taxAmount, grossSalary, allowances, deductions, netPay,
      paymentMethod, paymentStatus, notes,
      allowancesList, deductionsList
    } = req.body;

    if (!employeeId || !month || !baseSalary) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: employeeId, month, and baseSalary are required',
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

    // Check if payroll already exists for this month
    const existingPayroll = await prisma.payroll.findFirst({
      where: {
        employeeId,
        month,
        isDeleted: false,
      },
    });

    if (existingPayroll) {
      return res.status(400).json({
        success: false,
        error: 'Payroll already exists for this month',
      });
    }

    // Calculate values if not provided
    const base = parseFloat(baseSalary);
    const basic = basicSalary ? parseFloat(basicSalary) : base;
    const bon = parseFloat(bonus) || 0;
    const overtime = parseFloat(overtimeAmount) || 0;
    const totalAllowances = parseFloat(allowances) || 0;
    const totalDeductions = parseFloat(deductions) || 0;
    const gross = grossSalary ? parseFloat(grossSalary) : (basic + totalAllowances + bon + overtime);
    const taxPct = parseFloat(taxPercent) || 0;
    const tax = taxAmount ? parseFloat(taxAmount) : (gross * taxPct / 100);
    const net = netPay ? parseFloat(netPay) : (gross - totalDeductions);

    // Create payroll record with initial payment tracking
    const payroll = await prisma.payroll.create({
      data: {
        employeeId,
        month,
        baseSalary: base,
        basicSalary: basic,
        grossSalary: gross,
        bonus: bon,
        overtimeAmount: overtime,
        allowances: totalAllowances,
        deductions: totalDeductions,
        taxAmount: tax,
        taxPercent: taxPct,
        netPay: net,
        paidAmount: 0,
        remainingBalance: net,
        paymentMethod: paymentMethod || null,
        paymentStatus: paymentStatus || 'created',
        notes: notes || null,
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

    // Create allowance records if provided
    if (Array.isArray(allowancesList) && allowancesList.length > 0) {
      await Promise.all(
        allowancesList.map((allowance: any) =>
          prisma.payrollAllowance.create({
            data: {
              payrollId: payroll.id,
              employeeId,
              type: allowance.type || 'other',
              amount: parseFloat(allowance.amount) || 0,
              description: allowance.description || null,
            },
          })
        )
      );
    }

    // Create deduction records if provided
    if (Array.isArray(deductionsList) && deductionsList.length > 0) {
      await Promise.all(
        deductionsList.map((deduction: any) =>
          prisma.payrollDeduction.create({
            data: {
              payrollId: payroll.id,
              employeeId,
              type: deduction.type || 'other',
              amount: parseFloat(deduction.amount) || 0,
              description: deduction.description || null,
            },
          })
        )
      );
    }

    // AUTO-POST TO LEDGER: Payroll Approval → Expense Recognition + Liability Creation
    // DR Salary Expense, CR Salary Payable
    // This happens automatically on payroll creation (creation = approval)
    // Only posts if account mappings are configured (backward compatible)
    try {
      const { PayrollAccountingService } = await import('../services/payroll-accounting-service');
      const validation = await PayrollAccountingService.validatePayrollPosting();
      
      if (validation.valid) {
        // Post payroll approval to ledger
        const journalEntryId = await PayrollAccountingService.postPayrollApproval({
          payrollId: payroll.id,
          employeeId,
          month,
          amount: net,
          userId: req.user?.id,
        });
        
        // Update payroll with journal entry ID (already done in service)
        // No need to update again
      } else {
        // Account mappings not configured - log warning but don't block payroll creation
        // This maintains backward compatibility
        console.warn('Payroll accounting not configured. Payroll created without ledger posting:', validation.error);
      }
    } catch (accountingError: any) {
      // Log accounting error but don't fail payroll creation (backward compatibility)
      // In strict mode, you might want to block creation if accounting fails
      console.error('Failed to post payroll to ledger (non-blocking):', accountingError);
      // Continue with payroll creation even if accounting fails
    }

    // Fetch payroll with allowances and deductions
    const payrollWithDetails = await prisma.payroll.findUnique({
      where: { id: payroll.id },
      include: {
        employee: {
          select: {
            id: true,
            employeeId: true,
            name: true,
            department: true,
          },
        },
        payrollAllowances: true,
        payrollDeductions: true,
      },
    });

    res.json({
      success: true,
      data: payrollWithDetails,
    });
  } catch (error: any) {
    console.error('Create payroll error:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({
        success: false,
        error: 'Payroll already exists for this month',
      });
    }
    res.status(500).json({
      success: false,
      error: 'Failed to create payroll',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Update payroll
router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { 
      baseSalary, basicSalary, bonus, overtimeAmount, allowances, deductions, 
      taxPercent, taxAmount, grossSalary, netPay, paymentStatus, paymentDate, 
      paymentMethod, status 
    } = req.body;

    const oldPayroll = await prisma.payroll.findUnique({
      where: { id },
    });

    if (!oldPayroll || oldPayroll.isDeleted) {
      return res.status(404).json({
        success: false,
        error: 'Payroll record not found',
      });
    }

    // Calculate values if not provided
    const base = baseSalary !== undefined ? parseFloat(baseSalary) : oldPayroll.baseSalary;
    const basic = basicSalary !== undefined ? parseFloat(basicSalary) : (oldPayroll.basicSalary || base);
    const bon = bonus !== undefined ? parseFloat(bonus) : oldPayroll.bonus;
    const overtime = overtimeAmount !== undefined ? parseFloat(overtimeAmount) : oldPayroll.overtimeAmount;
    const totalAllowances = allowances !== undefined ? parseFloat(allowances) : oldPayroll.allowances;
    const totalDeductions = deductions !== undefined ? parseFloat(deductions) : oldPayroll.deductions;
    
    const gross = grossSalary !== undefined ? parseFloat(grossSalary) : (basic + totalAllowances + bon + overtime);
    const taxPct = taxPercent !== undefined ? parseFloat(taxPercent) : oldPayroll.taxPercent;
    const tax = taxAmount !== undefined ? parseFloat(taxAmount) : (gross * taxPct / 100);
    const net = netPay !== undefined ? parseFloat(netPay) : (gross - totalDeductions - tax);

    const newPaymentStatus = paymentStatus || oldPayroll.paymentStatus;
    const wasPaid = oldPayroll.paymentStatus === 'paid';
    const isNowPaid = newPaymentStatus === 'paid';

    // ENFORCE: Protect posted payroll entries from editing
    // If payroll has been posted to ledger (has journalEntryId), block changes to financial amounts
    if (oldPayroll.journalEntryId) {
      // Check if user is trying to modify financial amounts
      const isModifyingFinancials = 
        baseSalary !== undefined || 
        bonus !== undefined ||
        allowances !== undefined ||
        deductions !== undefined ||
        grossSalary !== undefined ||
        netPay !== undefined ||
        taxAmount !== undefined ||
        taxPercent !== undefined;
      
      if (isModifyingFinancials) {
        return res.status(400).json({
          success: false,
          error: 'PAYROLL_ACCOUNTING_ERROR: Cannot modify payroll amounts after ledger posting. ' +
            'Payroll has been posted to Chart of Accounts. Corrections must use explicit reversal entries.',
        });
      }
    }

    const updatedPayroll = await prisma.payroll.update({
      where: { id },
      data: {
        ...(baseSalary !== undefined && { baseSalary: base }),
        ...(basicSalary !== undefined && { basicSalary: basic }),
        ...(bonus !== undefined && { bonus: bon }),
        ...(overtimeAmount !== undefined && { overtimeAmount: overtime }),
        ...(allowances !== undefined && { allowances: totalAllowances }),
        ...(deductions !== undefined && { deductions: totalDeductions }),
        ...(taxPercent !== undefined && { taxPercent: taxPct }),
        ...(taxAmount !== undefined && { taxAmount: tax }),
        ...(grossSalary !== undefined && { grossSalary: gross }),
        ...(netPay !== undefined && { netPay: net }),
        ...(paymentStatus && { paymentStatus: newPaymentStatus }),
        ...(paymentDate && { paymentDate: new Date(paymentDate) }),
        ...(paymentMethod && { paymentMethod }),
        ...(status && { status }),
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

    // NOTE: Finance Ledger sync is now handled by PayrollAccountingService
    // Auto-posting happens when payroll is created (approval) and when payments are recorded
    // Payment recording posts to ledger automatically in the payment endpoint

    res.json({
      success: true,
      data: updatedPayroll,
      message: 'Payroll updated successfully',
    });
  } catch (error) {
    console.error('Update payroll error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update payroll',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Delete payroll
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const payroll = await prisma.payroll.findUnique({
      where: { id },
      include: {
        payments: true,
      },
    });

    if (!payroll || payroll.isDeleted) {
      return res.status(404).json({
        success: false,
        error: 'Payroll record not found',
      });
    }

    // ENFORCE: Block deletion if payroll has been posted to ledger
    if (payroll.journalEntryId) {
      return res.status(400).json({
        success: false,
        error: 'PAYROLL_ACCOUNTING_ERROR: Cannot delete payroll that has been posted to Chart of Accounts. ' +
          'Payroll has been posted to ledger (journalEntryId exists). ' +
          'Corrections must use explicit reversal entries instead of deletion.',
      });
    }

    // ENFORCE: Block deletion if payments have been recorded
    if (payroll.payments && payroll.payments.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'PAYROLL_ACCOUNTING_ERROR: Cannot delete payroll with recorded payments. ' +
          'Payments have been recorded against this payroll. ' +
          'To correct, use explicit reversal entries instead of deletion.',
      });
    }

    await prisma.payroll.update({
      where: { id },
      data: { isDeleted: true },
    });

    res.json({
      success: true,
      message: 'Payroll record deleted successfully',
    });
  } catch (error) {
    console.error('Delete payroll error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete payroll',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get payroll reminders
router.get('/reminders', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { getPayrollReminders } = await import('../services/hr-alerts');
    const reminders = await getPayrollReminders();
    res.json({
      success: true,
      data: reminders,
    });
  } catch (error) {
    console.error('Get payroll reminders error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch payroll reminders',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Calculate overtime from attendance
router.post('/calculate-overtime', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { employeeId, month } = req.body;

    if (!employeeId || !month) {
      return res.status(400).json({
        success: false,
        error: 'employeeId and month are required',
      });
    }

    const { calculateMonthlyOvertime } = await import('../services/hr-alerts');
    const overtime = await calculateMonthlyOvertime(employeeId, month);

    res.json({
      success: true,
      data: overtime,
    });
  } catch (error) {
    console.error('Calculate overtime error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate overtime',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Calculate attendance-based payroll deductions and allowances
router.post('/calculate-attendance-based', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const {
      employeeId,
      month,
      baseSalary,
      absentDeductionRate,
      lateDeductionRate,
      halfDayDeductionRate,
      overtimeHourlyRate,
      standardWorkingHours,
      standardWorkingDays,
      includeLeaveDays,
    } = req.body;

    if (!employeeId || !month || !baseSalary) {
      return res.status(400).json({
        success: false,
        error: 'employeeId, month, and baseSalary are required',
      });
    }

    const { AttendancePayrollIntegrationService } = await import('../services/attendance-payroll-integration-service');
    
    const calculations = await AttendancePayrollIntegrationService.calculateAttendanceBasedPayroll({
      employeeId,
      month,
      baseSalary: parseFloat(baseSalary),
      absentDeductionRate: absentDeductionRate ? parseFloat(absentDeductionRate) : undefined,
      lateDeductionRate: lateDeductionRate ? parseFloat(lateDeductionRate) : undefined,
      halfDayDeductionRate: halfDayDeductionRate ? parseFloat(halfDayDeductionRate) : undefined,
      overtimeHourlyRate: overtimeHourlyRate ? parseFloat(overtimeHourlyRate) : undefined,
      standardWorkingHours: standardWorkingHours ? parseInt(standardWorkingHours) : undefined,
      standardWorkingDays: standardWorkingDays ? parseInt(standardWorkingDays) : undefined,
      includeLeaveDays: includeLeaveDays === true || includeLeaveDays === 'true',
    });

    res.json({
      success: true,
      data: calculations,
    });
  } catch (error) {
    console.error('Calculate attendance-based payroll error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate attendance-based payroll',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get attendance summary for payroll month
router.get('/attendance-summary/:employeeId/:month', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { employeeId, month } = req.params;

    if (!employeeId || !month) {
      return res.status(400).json({
        success: false,
        error: 'employeeId and month are required',
      });
    }

    const { AttendancePayrollIntegrationService } = await import('../services/attendance-payroll-integration-service');
    
    const summary = await AttendancePayrollIntegrationService.getAttendanceSummaryForMonth(employeeId, month);

    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error('Get attendance summary error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch attendance summary',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Record payment for payroll
router.post('/:id/payments', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { amount, paymentMethod, referenceNumber, transactionId, notes, paymentDate } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Payment amount is required and must be greater than 0',
      });
    }

    if (!paymentMethod) {
      return res.status(400).json({
        success: false,
        error: 'Payment method is required',
      });
    }

    // STRICT PAYROLL PAYMENT VALIDATION - Enforce liability settlement rules
    const { PayrollPaymentSafetyService } = await import('../services/payroll-payment-safety-service');
    
    const paymentAmount = parseFloat(amount);
    const paymentDateObj = paymentDate ? new Date(paymentDate) : new Date();
    
    // Validate payment creation (amount, remaining balance, method, date)
    const validation = await PayrollPaymentSafetyService.validatePaymentCreation({
      payrollId: id,
      amount: paymentAmount,
      paymentMethod,
      paymentDate: paymentDateObj,
      userId: req.user?.id,
    });

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: validation.error || 'Payment validation failed',
      });
    }

    // CRITICAL ACCOUNTING GUARDRAIL:
    // Validate Chart of Accounts mapping BEFORE creating payment record.
    // If CoA mappings are missing or invalid, we MUST REJECT the payment
    // instead of guessing or falling back to arbitrary accounts.
    const { PayrollAccountingService } = await import('../services/payroll-accounting-service');
    const coaValidation = await PayrollAccountingService.validatePaymentPosting(
      id,
      paymentAmount
    );

    if (!coaValidation.valid) {
      return res.status(400).json({
        success: false,
        error: coaValidation.error || 'PAYROLL_ACCOUNTING_ERROR: Payroll account mappings not configured. Payment cannot be recorded without proper Chart of Accounts configuration.',
      });
    }

    // Get payroll record (validation already checked it exists)
    const payroll = await prisma.payroll.findUnique({
      where: { id },
      include: {
        payments: true,
      },
    });

    if (!payroll || payroll.isDeleted) {
      return res.status(404).json({
        success: false,
        error: 'Payroll record not found',
      });
    }

    // Calculate remaining balance (already validated)
    const currentPaid = payroll.payments.reduce((sum, p) => sum + p.amount, 0);
    const newPaidAmount = currentPaid + paymentAmount;
    const remainingBalance = validation.remainingBalance !== undefined 
      ? validation.remainingBalance 
      : Math.max(0, payroll.netPay - newPaidAmount);

    // Determine new payment status
    let newPaymentStatus = 'created';
    if (newPaidAmount === 0) {
      newPaymentStatus = 'created';
    } else if (newPaidAmount >= payroll.netPay) {
      newPaymentStatus = 'fully_paid';
    } else {
      newPaymentStatus = 'partially_paid';
    }

    // Create payment record and update payroll in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create payment
      const payment = await tx.payrollPayment.create({
        data: {
          payrollId: id,
          amount: paymentAmount,
          paymentMethod,
          referenceNumber: referenceNumber || null,
          transactionId: transactionId || null,
          notes: notes || null,
          paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
          createdByUserId: req.user?.id || null,
        },
        include: {
          createdBy: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
        },
      });

      // Update payroll
      const updatedPayroll = await tx.payroll.update({
        where: { id },
        data: {
          paidAmount: newPaidAmount,
          remainingBalance,
          paymentStatus: newPaymentStatus,
          paymentDate: newPaymentStatus === 'fully_paid' ? new Date() : payroll.paymentDate,
          paymentMethod: newPaymentStatus === 'fully_paid' ? paymentMethod : payroll.paymentMethod,
        },
        include: {
          employee: {
            select: {
              id: true,
              employeeId: true,
              tid: true,
              name: true,
              department: true,
            },
          },
          payments: {
            orderBy: { paymentDate: 'desc' },
            include: {
              createdBy: {
                select: {
                  id: true,
                  username: true,
                  email: true,
                },
              },
            },
          },
        },
      });

      return { payment, payroll: updatedPayroll };
    });

    // AUTO-POST TO LINES: Payroll Payment → Liability Settlement
    // DR Salary Payable, CR Cash/Bank
    // At this point CoA mappings have already been validated above.
    let journalEntryId: string | null = null;
    try {
        journalEntryId = await PayrollAccountingService.postPayrollPayment({
          paymentId: result.payment.id,
          payrollId: id,
          employeeId: payroll.employeeId,
          amount: paymentAmount,
          paymentMethod,
          userId: req.user?.id,
        });
        console.log(`✅ Payroll payment posted to ledger. Journal Entry ID: ${journalEntryId}, Payment ID: ${result.payment.id}`);
    } catch (accountingError: any) {
      // Log accounting error but don't fail payment recording (backward compatible)
      console.error('❌ Failed to post payroll payment to ledger (non-blocking):', {
        error: accountingError?.message || accountingError,
        paymentId: result.payment.id,
        payrollId: id,
        amount: paymentAmount,
        stack: accountingError?.stack,
      });
    }

    res.json({
      success: true,
      data: result.payment,
      payroll: result.payroll,
    });
  } catch (error) {
    console.error('Record payment error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to record payment',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get payment analytics
router.get('/analytics/payments', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { startDate, endDate, department, employeeId } = req.query;
    
    const { PayrollPaymentAnalyticsService } = await import('../services/payroll-payment-analytics-service');
    
    const analytics = await PayrollPaymentAnalyticsService.getPaymentAnalytics({
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      department: department as string | undefined,
      employeeId: employeeId as string | undefined,
    });
    
    res.json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    console.error('Get payment analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch payment analytics',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get payment reconciliation
router.get('/reconciliation/payments', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { month, paymentMethod } = req.query;
    
    const { PayrollPaymentAnalyticsService } = await import('../services/payroll-payment-analytics-service');
    
    const reconciliation = await PayrollPaymentAnalyticsService.getPaymentReconciliation({
      month: month as string | undefined,
      paymentMethod: paymentMethod as string | undefined,
    });
    
    res.json({
      success: true,
      data: reconciliation,
    });
  } catch (error) {
    console.error('Get payment reconciliation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch payment reconciliation',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

