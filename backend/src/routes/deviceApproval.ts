import express, { Response, Request } from 'express';
import prisma from '../prisma/client';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';
import { extractDeviceInfo } from '../utils/deviceInfo';

const router = (express as any).Router();

// Get device approval requests (Admin only)
router.get('/', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const approvals = await prisma.deviceApproval.findMany({
      where: { status: 'pending' },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            role: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: { requestedAt: 'desc' },
    });

    res.json(approvals);
  } catch (error) {
    console.error('Get device approvals error:', error);
    res.status(500).json({ error: 'Failed to fetch device approvals' });
  }
});

// Get user's device approvals
router.get('/my-approvals', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const approvals = await prisma.deviceApproval.findMany({
      where: { userId: req.user!.id },
      orderBy: { requestedAt: 'desc' },
    });

    res.json(approvals);
  } catch (error) {
    console.error('Get my approvals error:', error);
    res.status(500).json({ error: 'Failed to fetch device approvals' });
  }
});

// Approve device (Admin only)
router.post('/:id/approve', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const approval = await prisma.deviceApproval.findUnique({
      where: { id: req.params.id },
      include: { user: true },
    });

    if (!approval) {
      return res.status(404).json({ error: 'Device approval not found' });
    }

    // Update approval status
    await prisma.deviceApproval.update({
      where: { id: req.params.id },
      data: {
        status: 'approved',
        approvedAt: new Date(),
      },
    });

    // Update user's device approval status
    await prisma.user.update({
      where: { id: approval.userId },
      data: {
        deviceApprovalStatus: 'approved',
      },
    });

    // Create notification for user
    await prisma.notification.create({
      data: {
        userId: approval.userId,
        title: 'Device Approved',
        message: 'Your device has been approved. You can now access the system.',
        type: 'success',
      },
    });

    res.json({ message: 'Device approved successfully' });
  } catch (error) {
    console.error('Approve device error:', error);
    res.status(500).json({ error: 'Failed to approve device' });
  }
});

// Reject device (Admin only)
router.post('/:id/reject', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const approval = await prisma.deviceApproval.findUnique({
      where: { id: req.params.id },
      include: { user: true },
    });

    if (!approval) {
      return res.status(404).json({ error: 'Device approval not found' });
    }

    // Update approval status
    await prisma.deviceApproval.update({
      where: { id: req.params.id },
      data: {
        status: 'rejected',
      },
    });

    // Create notification for user
    await prisma.notification.create({
      data: {
        userId: approval.userId,
        title: 'Device Rejected',
        message: 'Your device access request has been rejected. Please contact administrator.',
        type: 'error',
      },
    });

    res.json({ message: 'Device rejected successfully' });
  } catch (error) {
    console.error('Reject device error:', error);
    res.status(500).json({ error: 'Failed to reject device' });
  }
});

export default router;

