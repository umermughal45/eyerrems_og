"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.REMINDER_JOB_NAME = exports.REMINDER_QUEUE_NAME = void 0;
exports.isReminderQueueEnabled = isReminderQueueEnabled;
exports.getReminderQueue = getReminderQueue;
exports.enqueueReminderJob = enqueueReminderJob;
const bullmq_1 = require("bullmq");
const logger_1 = __importDefault(require("../../../utils/logger"));
exports.REMINDER_QUEUE_NAME = 'reminder-queue';
exports.REMINDER_JOB_NAME = 'send-reminder-notification';
let queueInstance = null;
function isReminderQueueEnabled() {
    return process.env.USE_REDIS_QUEUE === 'true' && !!process.env.REDIS_URL;
}
function getBullMqConnection() {
    const url = process.env.REDIS_URL;
    if (!url) {
        throw new Error('REDIS_URL is required for the Reminder Engine queue. Please configure Redis.');
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
        logger_1.default.error('Invalid REDIS_URL for Reminder Engine', { err, url });
        throw err;
    }
}
function getReminderQueue() {
    if (!isReminderQueueEnabled()) {
        throw new Error('Reminder queue is disabled (USE_REDIS_QUEUE is not "true").');
    }
    if (!queueInstance) {
        queueInstance = new bullmq_1.Queue(exports.REMINDER_QUEUE_NAME, { connection: getBullMqConnection() });
        queueInstance.on('error', (err) => {
            logger_1.default.error('Reminder queue error', { err });
        });
    }
    return queueInstance;
}
async function enqueueReminderJob(payload) {
    if (!isReminderQueueEnabled()) {
        logger_1.default.warn('Redis queue disabled — running in development mode; enqueueReminderJob is a no-op.');
        return;
    }
    const queue = getReminderQueue();
    await queue.add(exports.REMINDER_JOB_NAME, payload, {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 60000,
        },
        removeOnComplete: true,
        removeOnFail: false,
    });
}
//# sourceMappingURL=reminderQueue.js.map