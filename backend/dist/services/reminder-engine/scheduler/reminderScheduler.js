"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startReminderScheduler = startReminderScheduler;
const node_cron_1 = __importDefault(require("node-cron"));
const client_1 = __importDefault(require("../../../prisma/client"));
const logger_1 = __importDefault(require("../../../utils/logger"));
const reminderQueue_1 = require("../queue/reminderQueue");
const notificationService_1 = require("../services/notificationService");
let started = false;
function buildDefaultMessage(reminder) {
    return reminder.description
        ? `${reminder.title} - ${reminder.description}`
        : reminder.title;
}
async function processReminderSynchronously(reminder) {
    if (!reminder.assignedToUser)
        return;
    await client_1.default.reminder.update({
        where: { id: reminder.id },
        data: { status: 'processing' },
    });
    try {
        await (0, notificationService_1.sendNotificationForReminder)({
            reminderId: reminder.id,
            recipientId: reminder.assignedToUser,
            channel: 'system',
            message: buildDefaultMessage(reminder),
            retryAttempt: 1,
        });
        await client_1.default.reminder.update({
            where: { id: reminder.id },
            data: { status: 'completed' },
        });
    }
    catch (error) {
        logger_1.default.error('Failed to process reminder synchronously', {
            reminderId: reminder.id,
            error: error?.message || String(error),
        });
        await client_1.default.reminder.update({
            where: { id: reminder.id },
            data: { status: 'failed' },
        });
    }
}
function startReminderScheduler() {
    if (started)
        return;
    started = true;
    node_cron_1.default.schedule('* * * * *', async () => {
        try {
            const now = new Date();
            const dueReminders = await client_1.default.reminder.findMany({
                where: {
                    status: 'pending',
                    triggerTime: {
                        lte: now,
                    },
                },
                take: 200,
            });
            if (!dueReminders.length)
                return;
            const queueEnabled = (0, reminderQueue_1.isReminderQueueEnabled)();
            for (const reminder of dueReminders) {
                if (!reminder.assignedToUser)
                    continue;
                if (!queueEnabled) {
                    logger_1.default.warn('Redis queue disabled — processing reminder synchronously (development mode)', {
                        reminderId: reminder.id,
                    });
                    await processReminderSynchronously(reminder);
                    continue;
                }
                await (0, reminderQueue_1.enqueueReminderJob)({
                    reminderId: reminder.id,
                    recipientId: reminder.assignedToUser,
                    channel: 'system',
                    message: buildDefaultMessage(reminder),
                });
                await client_1.default.reminder.update({
                    where: { id: reminder.id },
                    data: { status: 'queued' },
                });
            }
        }
        catch (error) {
            logger_1.default.error('Error in Reminder Engine scheduler', {
                error: error?.message || String(error),
            });
        }
    });
}
//# sourceMappingURL=reminderScheduler.js.map