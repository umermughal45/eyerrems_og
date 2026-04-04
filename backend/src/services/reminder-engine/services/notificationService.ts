import prisma from '../../../prisma/client';
import logger from '../../../utils/logger';
import { NotificationChannel } from '../types/reminderTypes';

export interface SendNotificationParams {
  reminderId: string;
  recipientId: string;
  channel: NotificationChannel;
  message: string;
  retryAttempt?: number;
}

async function sendSystemNotification(recipientId: string, message: string) {
  await prisma.notification.create({
    data: {
      userId: recipientId,
      title: 'Reminder',
      message,
      type: 'reminder',
      read: false,
    },
  });
}

async function sendEmailNotification(recipientId: string, message: string) {
  // TODO: integrate with real email provider
  logger.info('Simulated email notification', { recipientId, message });
}

async function sendSmsNotification(recipientId: string, message: string) {
  // TODO: integrate with real SMS provider
  logger.info('Simulated SMS notification', { recipientId, message });
}

export async function sendNotificationForReminder(params: SendNotificationParams) {
  const { reminderId, recipientId, channel, message, retryAttempt = 1 } = params;

  const notification = await prisma.reminderNotification.create({
    data: {
      reminderId,
      recipientId,
      channel,
      message,
      status: 'sending',
    },
  });

  let deliveryStatus = 'sent';
  let providerResponse: any = null;

  try {
    if (channel === 'system') {
      await sendSystemNotification(recipientId, message);
    } else if (channel === 'email') {
      await sendEmailNotification(recipientId, message);
    } else if (channel === 'sms') {
      await sendSmsNotification(recipientId, message);
    } else {
      throw new Error(`Unsupported notification channel: ${channel}`);
    }
  } catch (error: any) {
    deliveryStatus = 'failed';
    providerResponse = { error: error?.message || String(error) };
    logger.error('Notification provider error', providerResponse);
  }

  await prisma.reminderNotification.update({
    where: { id: notification.id },
    data: {
      status: deliveryStatus,
      sentAt: deliveryStatus === 'sent' ? new Date() : null,
    },
  });

  await prisma.notificationLog.create({
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

