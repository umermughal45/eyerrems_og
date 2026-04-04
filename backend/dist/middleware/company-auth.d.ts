import { Request, Response, NextFunction } from 'express';
export interface CompanyAuthRequest extends Request {
    companyUser?: {
        id: string;
        companyId: string;
        role: string;
        isSuperAdmin: boolean;
        name: string;
        email: string;
    };
    file?: Express.Multer.File;
    files?: Express.Multer.File[] | {
        [fieldname: string]: Express.Multer.File[];
    };
}
/**
 * Middleware: Verify company JWT and populate req.companyUser
 * Used for company-specific protected routes.
 */
export declare const authenticateCompanyUser: (req: CompanyAuthRequest, res: Response, next: NextFunction) => Promise<void>;
/**
 * Middleware: Require super admin access.
 * Must be used AFTER authenticateCompanyUser.
 */
export declare const requireSuperAdmin: (req: CompanyAuthRequest, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=company-auth.d.ts.map