"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReminderController = void 0;
const reminder_service_1 = require("../services/reminder.service");
function requireUserId(req) {
    const u = req.user;
    const id = u?.id || u?.userId;
    if (!id)
        throw new Error('Unauthorized');
    return String(id);
}
class ReminderController {
    constructor(pool) {
        this.create = async (req, res, next) => {
            try {
                const userId = requireUserId(req);
                const reminder = await this.service.createReminder(req.body, userId);
                res.status(201).json({ data: reminder });
            }
            catch (err) {
                next(err);
            }
        };
        this.list = async (req, res, next) => {
            try {
                const userId = requireUserId(req);
                const moduleName = req.query.module_name ? String(req.query.module_name) : undefined;
                const recordId = req.query.record_id ? String(req.query.record_id) : undefined;
                if (moduleName) {
                    const data = await this.service.getRemindersByModule(moduleName, recordId);
                    res.json({ data });
                    return;
                }
                const data = await this.service.getUserReminders(userId);
                res.json({ data });
            }
            catch (err) {
                next(err);
            }
        };
        this.getById = async (req, res, next) => {
            try {
                requireUserId(req);
                const reminder = await this.service.getReminderById(String(req.params.id));
                if (!reminder)
                    return res.status(404).json({ error: 'Not found' });
                res.json({ data: reminder });
            }
            catch (err) {
                next(err);
            }
        };
        this.update = async (req, res, next) => {
            try {
                const userId = requireUserId(req);
                const reminder = await this.service.updateReminder(String(req.params.id), req.body, userId);
                res.json({ data: reminder });
            }
            catch (err) {
                next(err);
            }
        };
        this.remove = async (req, res, next) => {
            try {
                requireUserId(req);
                await this.service.deleteReminder(String(req.params.id));
                res.status(204).send();
            }
            catch (err) {
                next(err);
            }
        };
        this.service = new reminder_service_1.ReminderService(pool);
    }
}
exports.ReminderController = ReminderController;
//# sourceMappingURL=reminder.controller.js.map