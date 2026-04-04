import { Request, Response, NextFunction } from 'express';
export interface AuthRequest extends Request {
    user?: {
        id: string;
        username: string;
        email: string;
        roleId: string;
    };
    file?: Express.Multer.File;
    files?: Express.Multer.File[] | {
        [fieldname: string]: Express.Multer.File[];
    };
}
export declare const authenticate: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const requireAdmin: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
/**
 * Legacy checkPermission - DEPRECATED
 * Use requirePermission from rbac.ts instead
 * This is kept for backward compatibility but should be migrated
 */
export declare const checkPermission: (requiredPermission: string) => (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=auth.d.ts.map