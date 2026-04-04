import { Worker } from 'bullmq';
import type { SendNotificationJobData } from './notification.queue';
export declare function startNotificationWorker(): Worker<SendNotificationJobData, void, "send-notification">;
//# sourceMappingURL=notification.worker.d.ts.map