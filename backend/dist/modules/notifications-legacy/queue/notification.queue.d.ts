import { Queue } from 'bullmq';
import type { NotificationChannel } from '../types/notification.types';
export type NotificationJobName = 'send-notification';
export interface SendNotificationJobData {
    notificationId: string;
    channel: NotificationChannel;
    attempt: number;
}
export declare function createNotificationQueue(): Queue<SendNotificationJobData, unknown, "send-notification", SendNotificationJobData, unknown, "send-notification">;
//# sourceMappingURL=notification.queue.d.ts.map