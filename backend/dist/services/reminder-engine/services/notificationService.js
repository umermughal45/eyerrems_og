"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendNotificationForReminder = sendNotificationForReminder;
const client_1 = __importDefault(require("../../../prisma/client"));
const logger_1 = __importDefault(require("../../../utils/logger"));
async function sendSystemNotification(recipientId, message) {
    await client_1.default.notification.create({
        data: {
            userId: recipientId,
            title: 'Reminder',
            message,
            type: 'reminder',
            read: false,
        },
    });
}
async function sendEmailNotification(recipientId, message) {
    // TODO: integrate with real email provider
    logger_1.default.info('Simulated email notification', { recipientId, message });
}
async function sendSmsNotification(recipientId, message) {
    // TODO: integrate with real SMS provider
    logger_1.default.info('Simulated SMS notification', { recipientId, message });
}
async function sendNotificationForReminder(params) {
    const { reminderId, recipientId, channel, message, retryAttempt = 1 } = params;
    const notification = await client_1.default.reminderNotification.create({
        data: {
            reminderId,
            recipientId,
            channel,
            message,
            status: 'sending',
        },
    });
    let deliveryStatus = 'sent';
    let providerResponse = null;
    try {
        if (channel === 'system') {
            await sendSystemNotification(recipientId, message);
        }
        else if (channel === 'email') {
            await sendEmailNotification(recipientId, message);
        }
        else if (channel === 'sms') {
            await sendSmsNotification(recipientId, message);
        }
        else {
            throw new Error(`Unsupported notification channel: ${channel}`);
        }
    }
    catch (error) {
        deliveryStatus = 'failed';
        providerResponse = { error: error?.message || String(error) };
        logger_1.default.error('Notification provider error', providerResponse);
    }
    await client_1.default.reminderNotification.update({
        where: { id: notification.id },
        data: {
            status: deliveryStatus,
            sentAt: deliveryStatus === 'sent' ? new Date() : null,
        },
    });
    await client_1.default.notificationLog.create({
        data: {
            notificationId: notification.id,
            channel,
            deliveryStatus,
            retryCount: retryAttempt - 1,
            providerResponse,
        },
    });
    if (deliveryStatus !== 'sent') {
        throw new Error('Notification delivery failed');
    }
}
//# sourceMappingURL=notificationService.js.map