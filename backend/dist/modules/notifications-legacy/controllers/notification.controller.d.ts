import type { Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
export declare class NotificationController {
    private readonly service;
    constructor(pool: Pool);
    list: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    unread: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    markRead: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
}
//# sourceMappingURL=notification.controller.d.ts.map