import { Pool } from 'pg';
import type { CreateReminderInput, ReminderModel, UpdateReminderInput } from '../types/notification.types';
export declare class ReminderService {
    private readonly pool;
    private readonly notificationService;
    constructor(pool: Pool);
    createReminder(input: CreateReminderInput, createdBy: string): Promise<ReminderModel>;
    updateReminder(id: string, input: UpdateReminderInput, updatedBy: string): Promise<ReminderModel>;
    deleteReminder(id: string): Promise<void>;
    completeReminder(id: string, updatedBy: string): Promise<ReminderModel>;
    getUserReminders(userId: string, opts?: {
        status?: string;
        limit?: number;
    }): Promise<ReminderModel[]>;
    getRemindersByModule(moduleName: string, recordId?: string, opts?: {
        limit?: number;
    }): Promise<ReminderModel[]>;
    getReminderById(id: string): Promise<ReminderModel | null>;
    private mapReminderRow;
}
//# sourceMappingURL=reminder.service.d.ts.map