import { NotificationChannel } from '../types/reminderTypes';
export interface SendNotificationParams {
    reminderId: string;
    recipientId: string;
    channel: NotificationChannel;
    message: string;
    retryAttempt?: number;
}
export declare function sendNotificationForReminder(params: SendNotificationParams): Promise<void>;
//# sourceMappingURL=notificationService.d.ts.map