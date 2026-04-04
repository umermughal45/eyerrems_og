/**
 * CSRF Protection Middleware
 * Implements CSRF token validation for all state-changing routes (POST, PUT, DELETE, PATCH)
 * Uses database storage for CSRF tokens (can be switched to Redis)
 */
import { Request, Response, NextFunction } from 'express';
interface CsrfRequest extends Request {
    csrfToken?: string;
}
/**
 * Generate a new CSRF token
 */
export declare function generateCsrfToken(sessionId: string, deviceId?: string, userId?: string): Promise<string>;
/**
 * Clean up expired CSRF tokens (run periodically)
 */
export declare function cleanupExpiredCsrfTokens(): Promise<void>;
/**
 * CSRF Protection Middleware
 * Validates CSRF token for state-changing requests
 */
export declare const csrfProtection: (req: CsrfRequest, res: Response, next: NextFunction) => Promise<void>;
/**
 * Middleware to generate and attach CSRF token to response
 * Should be used on routes that need to return a CSRF token to the client
 */
export declare const attachCsrfToken: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export {};
//# sourceMappingURL=csrf.d.ts.map