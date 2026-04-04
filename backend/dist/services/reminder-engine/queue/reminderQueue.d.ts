import { Queue } from 'bullmq';
import { ReminderJobPayload } from '../types/reminderTypes';
export declare const REMINDER_QUEUE_NAME = "reminder-queue";
export declare const REMINDER_JOB_NAME: "send-reminder-notification";
export declare function isReminderQueueEnabled(): boolean;
export declare function getReminderQueue(): Queue<ReminderJobPayload, void, "send-reminder-notification", ReminderJobPayload, void, "send-reminder-notification">;
export declare function enqueueReminderJob(payload: ReminderJobPayload): Promise<void>;
//# sourceMappingURL=reminderQueue.d.ts.map