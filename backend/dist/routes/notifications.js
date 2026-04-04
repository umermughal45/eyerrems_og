"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const client_1 = __importDefault(require("../prisma/client"));
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
const isDev = process.env.NODE_ENV === 'development';
const authOrDevBypass = isDev
    ? (req, _res, next) => next()
    : auth_1.authenticate;
// Get user's notifications
router.get('/', authOrDevBypass, async (req, res) => {
    try {
        const { read, limit } = req.query;
        const userId = req.user?.id;
        const notifications = await client_1.default.notification.findMany({
            where: {
                ...(userId ? { userId } : {}),
                ...(read !== undefined && { read: read === 'true' }),
            },
            orderBy: { createdAt: 'desc' },
            take: limit ? parseInt(limit) : undefined,
        });
        res.json(notifications);
    }
    catch (error) {
        console.error('Get notifications error:', error);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
});
// Get unread notifications (module bell + center)
router.get('/unread', authOrDevBypass, async (req, res) => {
    try {
        const userId = req.user?.id;
        const notifications = await client_1.default.notification.findMany({
            where: {
                ...(userId ? { userId } : {}),
                read: false,
            },
            orderBy: { createdAt: 'desc' },
            take: 100,
        });
        res.json({ data: notifications });
    }
    catch (error) {
        console.error('Get unread notifications error:', error);
        res.status(500).json({ error: 'Failed to fetch unread notifications' });
    }
});
// Mark notifications as read (bulk)
router.post('/read', authOrDevBypass, async (req, res) => {
    try {
        const ids = req.body?.ids;
        if (!Array.isArray(ids)) {
            return res.status(400).json({ error: 'ids must be an array' });
        }
        const idList = ids.map((x) => String(x));
        const userId = req.user?.id;
        const result = await client_1.default.notification.updateMany({
            where: userId ? { userId, id: { in: idList } } : { id: { in: idList } },
            data: { read: true },
        });
        res.json({ data: { marked: result.count } });
    }
    catch (error) {
        console.error('Mark notifications read error:', error);
        res.status(500).json({ error: 'Failed to mark notifications read' });
    }
});
// Mark notification as read
router.patch('/:id/read', authOrDevBypass, async (req, res) => {
    try {
        const notification = await client_1.default.notification.findUnique({
            where: { id: req.params.id },
        });
        if (!notification) {
            return res.status(404).json({ error: 'Notification not found' });
        }
        if (!isDev) {
            if (notification.userId !== req.user.id) {
                return res.status(403).json({ error: 'Unauthorized' });
            }
        }
        await client_1.default.notification.update({
            where: { id: req.params.id },
            data: { read: true },
        });
        res.json({ message: 'Notification marked as read' });
    }
    catch (error) {
        console.error('Mark notification as read error:', error);
        res.status(500).json({ error: 'Failed to update notification' });
    }
});
// Mark all notifications as read
router.patch('/read-all', authOrDevBypass, async (req, res) => {
    try {
        const userId = req.user?.id;
        await client_1.default.notification.updateMany({
            where: userId ? { userId, read: false } : { read: false },
            data: { read: true },
        });
        res.json({ message: 'All notifications marked as read' });
    }
    catch (error) {
        console.error('Mark all notifications as read error:', error);
        res.status(500).json({ error: 'Failed to update notifications' });
    }
});
// Get unread count
router.get('/unread-count', authOrDevBypass, async (req, res) => {
    try {
        const userId = req.user?.id;
        const count = await client_1.default.notification.count({
            where: {
                ...(userId ? { userId } : {}),
                read: false,
            },
        });
        res.json({ count });
    }
    catch (error) {
        console.error('Get unread count error:', error);
        res.status(500).json({ error: 'Failed to get unread count' });
    }
});
exports.default = router;
//# sourceMappingURL=notifications.js.map