"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationController = void 0;
const notification_service_1 = require("../services/notification.service");
function requireUserId(req) {
    const u = req.user;
    const id = u?.id || u?.userId;
    if (!id)
        throw new Error('Unauthorized');
    return String(id);
}
class NotificationController {
    constructor(pool) {
        this.list = async (req, res, next) => {
            try {
                const userId = requireUserId(req);
                const data = await this.service.getUserNotifications(userId, { unreadOnly: false, limit: 100 });
                res.json({ data });
            }
            catch (err) {
                next(err);
            }
        };
        this.unread = async (req, res, next) => {
            try {
                const userId = requireUserId(req);
                const data = await this.service.getUserNotifications(userId, { unreadOnly: true, limit: 100 });
                res.json({ data });
            }
            catch (err) {
                next(err);
            }
        };
        this.markRead = async (req, res, next) => {
            try {
                const userId = requireUserId(req);
                const ids = req.body?.ids;
                if (!Array.isArray(ids))
                    return res.status(400).json({ error: 'ids must be an array' });
                const result = await this.service.markNotificationsRead(userId, ids.map(String));
                res.json({ data: result });
            }
            catch (err) {
                next(err);
            }
        };
        this.service = new notification_service_1.NotificationService(pool);
    }
}
exports.NotificationController = NotificationController;
//# sourceMappingURL=notification.controller.js.map