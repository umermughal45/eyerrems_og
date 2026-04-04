/**
 * API Request/Response Logging Middleware
 * Logs all API requests and responses for audit and debugging
 */
import { Request, Response, NextFunction } from 'express';
interface LoggedRequest extends Request {
    startTime?: number;
    user?: {
        id: string;
        username?: string;
        role?: string;
    };
}
export declare function apiLoggingMiddleware(req: LoggedRequest, res: Response, next: NextFunction): void;
export {};
//# sourceMappingURL=api-logging.d.ts.map