"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createNotificationQueue = createNotificationQueue;
const bullmq_1 = require("bullmq");
function createNotificationQueue() {
    const connection = {
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: Number(process.env.REDIS_PORT || 6379),
        password: process.env.REDIS_PASSWORD || undefined,
        username: process.env.REDIS_USERNAME || undefined,
        tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
    };
    return new bullmq_1.Queue('notification-delivery', {
        connection,
        defaultJobOptions: {
            removeOnComplete: 5000,
            removeOnFail: 20000,
            attempts: 5,
            backoff: { type: 'exponential', delay: 10000 },
        },
    });
}
//# sourceMappingURL=notification.queue.js.map