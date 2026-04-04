"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildReminderRoutes = buildReminderRoutes;
const express_1 = require("express");
const reminder_controller_1 = require("../controllers/reminder.controller");
function requirePermission(permission) {
    return (req, res, next) => {
        const perms = req.user?.permissions;
        if (Array.isArray(perms) && perms.includes(permission))
            return next();
        return res.status(403).json({ error: 'Forbidden' });
    };
}
function buildReminderRoutes(pool) {
    const router = (0, express_1.Router)();
    const controller = new reminder_controller_1.ReminderController(pool);
    router.post('/api/reminders', requirePermission('reminder.create'), controller.create);
    router.get('/api/reminders', requirePermission('reminder.view'), controller.list);
    router.get('/api/reminders/:id', requirePermission('reminder.view'), controller.getById);
    router.put('/api/reminders/:id', requirePermission('reminder.update'), controller.update);
    router.delete('/api/reminders/:id', requirePermission('reminder.update'), controller.remove);
    return router;
}
//# sourceMappingURL=reminder.routes.js.map