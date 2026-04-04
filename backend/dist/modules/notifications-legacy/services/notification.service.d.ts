import { Pool } from 'pg';
import type { CreateNotificationInput, NotificationModel } from '../types/notification.types';
export declare class NotificationService {
    private readonly pool;
    private readonly queue;
    constructor(pool: Pool);
    createNotification(input: CreateNotificationInput, createdBy?: string): Promise<NotificationModel>;
    scheduleNotification(input: CreateNotificationInput, scheduledAt: string, createdBy?: string): Promise<NotificationModel>;
    sendNotification(notificationId: string, opts?: {
        attempt?: number;
    }): Promise<void>;
    retryFailedNotifications(limit?: number): Promise<{
        retried: number;
    }>;
    getUserNotifications(userId: string, opts?: {
        unreadOnly?: boolean;
        limit?: number;
    }): Promise<NotificationModel[]>;
    markNotificationsRead(userId: string, notificationIds: string[]): Promise<{
        marked: number;
    }>;
    recordFailure(notificationId: string, err: unknown, retryCount: number): Promise<void>;
    private getNotificationById;
    private setNotificationStatus;
    private setNotificationSent;
    private insertLog;
    private dispatchToChannel;
    private sendEmail;
    private sendSms;
    private sendWhatsapp;
    private mapNotificationRow;
}
//# sourceMappingURL=notification.service.d.ts.map