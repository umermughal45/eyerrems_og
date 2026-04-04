import { Pool } from 'pg';
import type { CreateTemplateInput, NotificationTemplateModel, NotificationChannel } from '../types/notification.types';
export declare class TemplateService {
    private readonly pool;
    constructor(pool: Pool);
    createTemplate(input: CreateTemplateInput, createdBy?: string): Promise<NotificationTemplateModel>;
    getTemplateByName(name: string, channel: NotificationChannel, moduleName: string): Promise<NotificationTemplateModel | null>;
    render(templateText: string, variables: Record<string, unknown>): Promise<import("../types/notification.types").TemplateRenderResult>;
    private mapTemplateRow;
}
//# sourceMappingURL=template.service.d.ts.map