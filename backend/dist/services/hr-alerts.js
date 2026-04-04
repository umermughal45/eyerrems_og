"use strict";
/**
 * HR Alerts Service
 * Handles alerts for pending leaves, attendance issues, and payroll reminders
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPendingLeaveAlerts = getPendingLeaveAlerts;
exports.getAttendanceAlerts = getAttendanceAlerts;
exports.getPayrollReminders = getPayrollReminders;
exports.calculateMonthlyOvertime = calculateMonthlyOvertime;
const client_1 = __importDefault(require("../prisma/client"));
/**
 * Get pending leave requests that need approval
 */
async function getPendingLeaveAlerts(managerId) {
    const pendingLeaves = await client_1.default.leaveRequest.findMany({
        where: {
            status: 'pending',
            isDeleted: false,
        },
        include: {
            employee: {
                select: {
                    id: true,
                    employeeId: true,
                    name: true,
                    email: true,
                    department: true,
                    reportingManagerId: true,
                },
            },
        },
        orderBy: { createdAt: 'asc' },
    });
    // Filter by manager if provided
    const filtered = managerId
        ? pendingLeaves.filter((leave) => leave.employee.reportingManagerId === managerId)
        : pendingLeaves;
    // Categorize by urgency
    const today = new Date();
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(today.getDate() + 3);
    const urgent = filtered.filter((leave) => {
        const startDate = new Date(leave.startDate);
        return startDate <= threeDaysFromNow && startDate >= today;
    });
    const upcoming = filtered.filter((leave) => {
        const startDate = new Date(leave.startDate);
        return startDate > threeDaysFromNow;
    });
    const overdue = filtered.filter((leave) => {
        const startDate = new Date(leave.startDate);
        return startDate < today;
    });
    return {
        pending: filtered,
        urgent,
        upcoming,
        overdue,
        summary: {
            total: filtered.length,
            urgentCount: urgent.length,
            upcomingCount: upcoming.length,
            overdueCount: overdue.length,
        },
    };
}
/**
 * Get employees with attendance issues
 */
async function getAttendanceAlerts(days = 7) {
    const today = new Date();
    const startDate = new Date();
    startDate.setDate(today.getDate() - days);
    // Get employees with frequent absences
    const absences = await client_1.default.attendance.findMany({
        where: {
            status: 'absent',
            date: { gte: startDate },
            isDeleted: false,
        },
        include: {
            employee: {
                select: {
                    id: true,
                    employeeId: true,
                    name: true,
                    email: true,
                    department: true,
                },
            },
        },
    });
    // Group by employee
    const employeeAbsences = absences.reduce((acc, record) => {
        const empId = record.employeeId;
        if (!acc[empId]) {
            acc[empId] = {
                employee: record.employee,
                count: 0,
                dates: [],
            };
        }
        acc[empId].count++;
        acc[empId].dates.push(record.date);
        return acc;
    }, {});
    // Get employees with frequent late arrivals
    const lateArrivals = await client_1.default.attendance.findMany({
        where: {
            status: 'late',
            date: { gte: startDate },
            isDeleted: false,
        },
        include: {
            employee: {
                select: {
                    id: true,
                    employeeId: true,
                    name: true,
                    email: true,
                    department: true,
                },
            },
        },
    });
    const employeeLateArrivals = lateArrivals.reduce((acc, record) => {
        const empId = record.employeeId;
        if (!acc[empId]) {
            acc[empId] = {
                employee: record.employee,
                count: 0,
                dates: [],
            };
        }
        acc[empId].count++;
        acc[empId].dates.push(record.date);
        return acc;
    }, {});
    return {
        absences: {
            employees: Object.values(employeeAbsences),
            total: Object.keys(employeeAbsences).length,
        },
        lateArrivals: {
            employees: Object.values(employeeLateArrivals),
            total: Object.keys(employeeLateArrivals).length,
        },
    };
}
/**
 * Get payroll reminders (unpaid payrolls)
 */
async function getPayrollReminders() {
    const today = new Date();
    const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const unpaidPayrolls = await client_1.default.payroll.findMany({
        where: {
            paymentStatus: { in: ['pending', 'processed'] },
            isDeleted: false,
        },
        include: {
            employee: {
                select: {
                    id: true,
                    employeeId: true,
                    name: true,
                    email: true,
                    department: true,
                },
            },
        },
        orderBy: { month: 'desc' },
    });
    const overdue = unpaidPayrolls.filter((payroll) => {
        return payroll.month < currentMonth;
    });
    const current = unpaidPayrolls.filter((payroll) => {
        return payroll.month === currentMonth;
    });
    return {
        unpaid: unpaidPayrolls,
        overdue,
        current,
        summary: {
            total: unpaidPayrolls.length,
            overdueCount: overdue.length,
            currentCount: current.length,
            totalAmount: unpaidPayrolls.reduce((sum, p) => sum + p.netPay, 0),
        },
    };
}
/**
 * Calculate overtime from attendance for a given month
 */
async function calculateMonthlyOvertime(employeeId, month) {
    const [year, monthNum] = month.split('-').map(Number);
    const startDate = new Date(year, monthNum - 1, 1);
    const endDate = new Date(year, monthNum, 0, 23, 59, 59);
    const attendanceRecords = await client_1.default.attendance.findMany({
        where: {
            employeeId,
            date: {
                gte: startDate,
                lte: endDate,
            },
            hours: { not: null },
            isDeleted: false,
        },
    });
    let totalOvertimeHours = 0;
    const standardHoursPerDay = 8;
    attendanceRecords.forEach((record) => {
        if (record.hours && record.hours > standardHoursPerDay) {
            totalOvertimeHours += record.hours - standardHoursPerDay;
        }
    });
    return {
        employeeId,
        month,
        totalOvertimeHours: Math.round(totalOvertimeHours * 100) / 100,
        attendanceDays: attendanceRecords.length,
    };
}
//# sourceMappingURL=hr-alerts.js.map