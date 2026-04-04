"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const client_1 = __importDefault(require("../prisma/client"));
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
// Get device approval requests (Admin only)
router.get('/', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const approvals = await client_1.default.deviceApproval.findMany({
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
    }
    catch (error) {
        console.error('Get device approvals error:', error);
        res.status(500).json({ error: 'Failed to fetch device approvals' });
    }
});
// Get user's device approvals
router.get('/my-approvals', auth_1.authenticate, async (req, res) => {
    try {
        const approvals = await client_1.default.deviceApproval.findMany({
            where: { userId: req.user.id },
            orderBy: { requestedAt: 'desc' },
        });
        res.json(approvals);
    }
    catch (error) {
        console.error('Get my approvals error:', error);
        res.status(500).json({ error: 'Failed to fetch device approvals' });
    }
});
// Approve device (Admin only)
router.post('/:id/approve', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const approval = await client_1.default.deviceApproval.findUnique({
            where: { id: req.params.id },
            include: { user: true },
        });
        if (!approval) {
            return res.status(404).json({ error: 'Device approval not found' });
        }
        // Update approval status
        await client_1.default.deviceApproval.update({
            where: { id: req.params.id },
            data: {
                status: 'approved',
                approvedAt: new Date(),
            },
        });
        // Update user's device approval status
        await client_1.default.user.update({
            where: { id: approval.userId },
            data: {
                deviceApprovalStatus: 'approved',
            },
        });
        // Create notification for user
        await client_1.default.notification.create({
            data: {
                userId: approval.userId,
                title: 'Device Approved',
                message: 'Your device has been approved. You can now access the system.',
                type: 'success',
            },
        });
        res.json({ message: 'Device approved successfully' });
    }
    catch (error) {
        console.error('Approve device error:', error);
        res.status(500).json({ error: 'Failed to approve device' });
    }
});
// Reject device (Admin only)
router.post('/:id/reject', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const approval = await client_1.default.deviceApproval.findUnique({
            where: { id: req.params.id },
            include: { user: true },
        });
        if (!approval) {
            return res.status(404).json({ error: 'Device approval not found' });
        }
        // Update approval status
        await client_1.default.deviceApproval.update({
            where: { id: req.params.id },
            data: {
                status: 'rejected',
            },
        });
        // Create notification for user
        await client_1.default.notification.create({
            data: {
                userId: approval.userId,
                title: 'Device Rejected',
                message: 'Your device access request has been rejected. Please contact administrator.',
                type: 'error',
            },
        });
        res.json({ message: 'Device rejected successfully' });
    }
    catch (error) {
        console.error('Reject device error:', error);
        res.status(500).json({ error: 'Failed to reject device' });
    }
});
exports.default = router;
//# sourceMappingURL=deviceApproval.js.map