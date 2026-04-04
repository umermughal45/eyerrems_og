"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildNotificationRoutes = buildNotificationRoutes;
const express_1 = require("express");
const notification_controller_1 = require("../controllers/notification.controller");
function requirePermission(permission) {
    return (req, res, next) => {
        const perms = req.user?.permissions;
        if (Array.isArray(perms) && perms.includes(permission))
            return next();
        return res.status(403).json({ error: 'Forbidden' });
    };
}
function buildNotificationRoutes(pool) {
    const router = (0, express_1.Router)();
    const controller = new notification_controller_1.NotificationController(pool);
    router.get('/api/notifications', requirePermission('notification.view'), controller.list);
    router.get('/api/notifications/unread', requirePermission('notification.view'), controller.unread);
    router.post('/api/notifications/read', requirePermission('notification.manage'), controller.markRead);
    return router;
}
//# sourceMappingURL=notification.routes.js.map