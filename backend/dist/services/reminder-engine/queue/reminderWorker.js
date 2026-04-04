"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startReminderWorker = startReminderWorker;
const bullmq_1 = require("bullmq");
const client_1 = __importDefault(require("../../../prisma/client"));
const logger_1 = __importDefault(require("../../../utils/logger"));
const reminderQueue_1 = require("./reminderQueue");
const notificationService_1 = require("../services/notificationService");
const reminderQueue_2 = require("./reminderQueue");
let worker = null;
function getBullMqConnection() {
    const url = process.env.REDIS_URL;
    if (!url) {
        throw new Error('REDIS_URL is required for the Reminder Engine worker. Please configure Redis.');
    }
    try {
        const parsed = new URL(url);
        return {
            host: parsed.hostname,
            port: parsed.port ? parseInt(parsed.port, 10) : 6379,
            username: parsed.username || undefined,
            password: parsed.password || undefined,
            tls: parsed.protocol === 'rediss:' ? {} : undefined,
        };
    }
    catch (err) {
        logger_1.default.error('Invalid REDIS_URL for Reminder Engine worker', { err, url });
        throw err;
    }
}
async function processJob(job) {
    const { reminderId, recipientId, channel, message } = job.data;
    const reminder = await client_1.default.reminder.findUnique({
        where: { id: reminderId },
    });
    if (!reminder) {
        logger_1.default.warn('Reminder not found for job', { reminderId });
        return;
    }
    await client_1.default.reminder.update({
        where: { id: reminderId },
        data: { status: 'processing' },
    });
    try {
        await (0, notificationService_1.sendNotificationForReminder)({
            reminderId,
            recipientId,
            channel,
            message,
            retryAttempt: job.attemptsMade + 1,
        });
        await client_1.default.reminder.update({
            where: { id: reminderId },
            data: { status: 'completed' },
        });
    }
    catch (error) {
        logger_1.default.error('Failed to process reminder notification', {
            reminderId,
            error: error?.message || String(error),
        });
        if (job.attemptsMade + 1 >= (job.opts.attempts || 1)) {
            await client_1.default.reminder.update({
                where: { id: reminderId },
                data: { status: 'failed' },
            });
        }
        throw error;
    }
}
function startReminderWorker() {
    if (worker)
        return worker;
    if (!(0, reminderQueue_2.isReminderQueueEnabled)()) {
        logger_1.default.warn('Worker disabled because Redis queue is OFF (USE_REDIS_QUEUE != "true" or REDIS_URL missing)');
        return null;
    }
    worker = new bullmq_1.Worker(reminderQueue_1.REMINDER_QUEUE_NAME, async (job) => {
        await processJob(job);
    }, {
        connection: getBullMqConnection(),
    });
    worker.on('completed', (job) => {
        logger_1.default.info('Reminder job completed', { jobId: job.id });
    });
    worker.on('failed', (job, err) => {
        logger_1.default.error('Reminder job failed', {
            jobId: job?.id,
            err: err?.message || String(err),
        });
    });
    return worker;
}
//# sourceMappingURL=reminderWorker.js.map