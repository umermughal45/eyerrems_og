/**
 * Role-Based Access Control (RBAC) Middleware
 */
import { Request, Response, NextFunction } from 'express';
export interface AuthenticatedRequest extends Request {
    user?: {
        id: string;
        username: string;
        email: string;
        roleId: string;
        role?: {
            id: string;
            name: string;
            permissions: string[];
        };
    };
    cookies: any;
    file?: Express.Multer.File;
    files?: Express.Multer.File[] | {
        [fieldname: string]: Express.Multer.File[];
    };
}
/**
 * Check if user has required permission (with backward compatibility)
 * Uses explicit permission system, falls back to legacy for compatibility
 */
export declare function hasPermission(roleId: string, roleName: string, userPermissions: string[], requiredPermission: string): Promise<boolean>;
export declare function hasPermissionSync(userPermissions: string[], requiredPermission: string): boolean;
/**
 * Middleware to require authentication
 */
export declare function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
/**
 * Middleware to require specific permission
 * Uses explicit permission system with backward compatibility
 */
export declare function requirePermission(permission: string): (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * Middleware to require one of multiple permissions
 */
export declare function requireAnyPermission(permissions: string[]): (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * Middleware to require admin role
 */
export declare function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): Response<any, Record<string, any>> | undefined;
//# sourceMappingURL=rbac.d.ts.map