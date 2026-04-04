"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireSuperAdmin = exports.authenticateCompanyUser = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const client_1 = __importDefault(require("../prisma/client"));
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * Middleware: Verify company JWT and populate req.companyUser
 * Used for company-specific protected routes.
 */
const authenticateCompanyUser = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        let token = authHeader?.replace('Bearer ', '') || authHeader?.replace('bearer ', '');
        // Allow token via query parameter (for file downloads)
        if (!token && req.query.token) {
            token = req.query.token;
        }
        if (!token) {
            res.status(401).json({
                error: 'Authentication required',
                message: 'No authorization token provided.',
            });
            return;
        }
        const jwtSecret = process.env.JWT_SECRET || 'CHANGE-THIS-IN-PRODUCTION-DEVELOPMENT-ONLY';
        let decoded;
        try {
            decoded = jsonwebtoken_1.default.verify(token, jwtSecret);
        }
        catch (jwtError) {
            logger_1.default.warn('Company JWT verification failed', {
                path: req.path,
                method: req.method,
                error: jwtError?.message,
            });
            res.status(401).json({ error: 'Invalid token' });
            return;
        }
        // Ensure this is a company-specific token (has companyId)
        if (!decoded.companyId) {
            res.status(401).json({ error: 'Invalid token type. Only company-associated accounts allowed.' });
            return;
        }
        // Verify user still exists and is active
        const companyUser = await client_1.default.companyUser.findUnique({
            where: { id: decoded.userId },
            select: {
                id: true,
                companyId: true,
                name: true,
                email: true,
                role: true,
                isSuperAdmin: true,
                isActive: true,
                company: { select: { status: true } },
            },
        });
        if (!companyUser) {
            res.status(401).json({ error: 'User not found' });
            return;
        }
        if (!companyUser.isActive) {
            res.status(403).json({ error: 'Your account has been deactivated.' });
            return;
        }
        if (companyUser.company.status !== 'active') {
            res.status(403).json({
                error: 'Company account is suspended. Please contact support.',
            });
            return;
        }
        req.companyUser = {
            id: companyUser.id,
            companyId: companyUser.companyId,
            role: companyUser.role,
            isSuperAdmin: companyUser.isSuperAdmin,
            name: companyUser.name,
            email: companyUser.email,
        };
        next();
    }
    catch (error) {
        logger_1.default.error('Company authentication error:', error?.message);
        res.status(401).json({ error: 'Authentication failed' });
    }
};
exports.authenticateCompanyUser = authenticateCompanyUser;
/**
 * Middleware: Require super admin access.
 * Must be used AFTER authenticateCompanyUser.
 */
const requireSuperAdmin = async (req, res, next) => {
    // First authenticate
    await (0, exports.authenticateCompanyUser)(req, res, async () => {
        if (!req.companyUser?.isSuperAdmin) {
            res.status(403).json({
                error: 'Super admin access required',
                message: 'This action is restricted to the software owner.',
            });
            return;
        }
        next();
    });
};
exports.requireSuperAdmin = requireSuperAdmin;
//# sourceMappingURL=company-auth.js.map