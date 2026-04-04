import type { Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
export declare class ReminderController {
    private readonly service;
    constructor(pool: Pool);
    create: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    list: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    getById: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
    update: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    remove: (req: Request, res: Response, next: NextFunction) => Promise<void>;
}
//# sourceMappingURL=reminder.controller.d.ts.map