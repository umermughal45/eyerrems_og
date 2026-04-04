import express, { Response } from 'express';
import prisma from '../prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { getPendingLeaveAlerts } from '../services/hr-alerts';

const router = (express as any).Router();

// Get all leave requests
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { employeeId, status, startDate, endDate } = req.query;

    const where: any = { isDeleted: false };

    if (employeeId) {
      where.employeeId = employeeId;
    }

    if (status) {
      where.status = status;
    }

    if (startDate || endDate) {
      where.OR = [];
      if (startDate) {
        where.OR.push({
          startDate: { gte: new Date(startDate as string) },
        });
      }
      if (endDate) {
        where.OR.push({
          endDate: { lte: new Date(endDate as string) },
        });
      }
    }

    const leaveRequests = await prisma.leaveRequest.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            employeeId: true,
            name: true,
            department: true,
            email: true,
          },
        },
      },
      orderBy: { startDate: 'desc' },
    });

    // Format leave requests for frontend
    const formattedLeaves = leaveRequests.map((request) => ({
      id: request.id,
      employee: request.employee.name,
      employeeId: request.employee.employeeId,
      department: request.employee.department,
      type: request.type,
      startDate: request.startDate,
      endDate: request.endDate,
      days: request.days,
      reason: request.reason,
      status: request.status,
    }));

    res.json({
      success: true,
      data: formattedLeaves,
    });
  } catch (error) {
    console.error('Get leave requests error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch leave requests',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get leave request by ID
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id },
      include: {
        employee: true,
      },
    });

    if (!leaveRequest || leaveRequest.isDeleted) {
      return res.status(404).json({
        success: false,
        error: 'Leave request not found',
      });
    }

    res.json({
      success: true,
      data: leaveRequest,
    });
  } catch (error) {
    console.error('Get leave request error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch leave request',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Create leave request
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { employeeId, type, startDate, endDate, reason } = req.body;

    if (!employeeId || !type || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
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

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (end < start) {
      return res.status(400).json({
        success: false,
        error: 'End date must be after start date',
      });
    }

    // Calculate days
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const leaveRequest = await prisma.leaveRequest.create({
      data: {
        employeeId,
        type,
        startDate: start,
        endDate: end,
        days,
        reason: reason || null,
        status: 'pending',
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

    res.json({
      success: true,
      data: leaveRequest,
    });
  } catch (error) {
    console.error('Create leave request error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create leave request',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Update leave request
router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { type, startDate, endDate, reason, status } = req.body;

    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id },
    });

    if (!leaveRequest || leaveRequest.isDeleted) {
      return res.status(404).json({
        success: false,
        error: 'Leave request not found',
      });
    }

    let days = leaveRequest.days;
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    } else if (startDate) {
      const start = new Date(startDate);
      const end = new Date(leaveRequest.endDate);
      days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    } else if (endDate) {
      const start = new Date(leaveRequest.startDate);
      const end = new Date(endDate);
      days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    }

    const updatedLeaveRequest = await prisma.leaveRequest.update({
      where: { id },
      data: {
        ...(type && { type }),
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate && { endDate: new Date(endDate) }),
        ...(reason !== undefined && { reason }),
        ...(status && { status }),
        ...(days !== leaveRequest.days && { days }),
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

    res.json({
      success: true,
      data: updatedLeaveRequest,
    });
  } catch (error) {
    console.error('Update leave request error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update leave request',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Approve leave request
router.post('/:id/approve', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id },
    });

    if (!leaveRequest || leaveRequest.isDeleted) {
      return res.status(404).json({
        success: false,
        error: 'Leave request not found',
      });
    }

    if (leaveRequest.status === 'approved') {
      return res.status(400).json({
        success: false,
        error: 'Leave request already approved',
      });
    }

    const updatedLeaveRequest = await prisma.leaveRequest.update({
      where: { id },
      data: { 
        status: 'approved',
        approvedBy: req.user?.id || null,
        approvedAt: new Date(),
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

    // TODO: Send notification to employee about approval
    // await sendNotification(updatedLeaveRequest.employee.email, 'Leave Approved', ...);

    res.json({
      success: true,
      data: updatedLeaveRequest,
      message: 'Leave request approved successfully',
    });
  } catch (error) {
    console.error('Approve leave request error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to approve leave request',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Reject leave request
router.post('/:id/reject', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id },
    });

    if (!leaveRequest || leaveRequest.isDeleted) {
      return res.status(404).json({
        success: false,
        error: 'Leave request not found',
      });
    }

    if (leaveRequest.status === 'rejected') {
      return res.status(400).json({
        success: false,
        error: 'Leave request already rejected',
      });
    }

    const { rejectionReason } = req.body;

    const updatedLeaveRequest = await prisma.leaveRequest.update({
      where: { id },
      data: { 
        status: 'rejected',
        rejectedBy: req.user?.id || null,
        rejectedAt: new Date(),
        rejectionReason: rejectionReason || null,
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

    // TODO: Send notification to employee about rejection
    // await sendNotification(updatedLeaveRequest.employee.email, 'Leave Rejected', ...);

    res.json({
      success: true,
      data: updatedLeaveRequest,
      message: 'Leave request rejected',
    });
  } catch (error) {
    console.error('Reject leave request error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reject leave request',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Delete leave request
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id },
    });

    if (!leaveRequest || leaveRequest.isDeleted) {
      return res.status(404).json({
        success: false,
        error: 'Leave request not found',
      });
    }

    await prisma.leaveRequest.update({
      where: { id },
      data: { isDeleted: true },
    });

    res.json({
      success: true,
      message: 'Leave request deleted successfully',
    });
  } catch (error) {
    console.error('Delete leave request error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete leave request',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get pending leave alerts
router.get('/alerts/pending', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { managerId } = req.query;
    const alerts = await getPendingLeaveAlerts(managerId as string | undefined);
    res.json({
      success: true,
      data: alerts,
    });
  } catch (error) {
    console.error('Get pending leave alerts error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pending leave alerts',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

