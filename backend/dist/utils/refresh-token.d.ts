/**
 * JWT Refresh Token Utilities
 * Implements secure refresh token mechanism with database storage
 */
import { TokenPayload } from './jwt';
/**
 * Generate refresh token
 */
export declare function generateRefreshToken(userId: string, deviceId?: string): Promise<string>;
/**
 * Verify refresh token
 */
export declare function verifyRefreshToken(token: string): Promise<{
    valid: boolean;
    userId?: string;
    deviceId?: string;
    error?: string;
}>;
/**
 * Revoke refresh token
 */
export declare function revokeRefreshToken(token: string): Promise<boolean>;
/**
 * Revoke all refresh tokens for a user
 */
export declare function revokeAllUserRefreshTokens(userId: string, deviceId?: string): Promise<number>;
/**
 * Clean up expired refresh tokens
 */
export declare function cleanupExpiredRefreshTokens(): Promise<number>;
/**
 * Generate new access and refresh token pair
 */
export declare function generateTokenPair(payload: TokenPayload): Promise<{
    accessToken: string;
    refreshToken: string;
}>;
//# sourceMappingURL=refresh-token.d.ts.map