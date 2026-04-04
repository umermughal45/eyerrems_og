export interface TokenPayload {
    userId: string;
    username: string;
    email: string;
    roleId: string;
    deviceId?: string;
    companyId?: string;
    isSuperAdmin?: boolean;
}
export declare const generateToken: (payload: TokenPayload) => string;
export declare const verifyToken: (token: string) => TokenPayload;
//# sourceMappingURL=jwt.d.ts.map