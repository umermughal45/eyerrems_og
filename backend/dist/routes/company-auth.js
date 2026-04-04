"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const zod_1 = require("zod");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const client_1 = __importDefault(require("../prisma/client"));
const logger_1 = __importDefault(require("../utils/logger"));
const csrf_1 = require("../middleware/csrf");
const company_auth_1 = require("../middleware/company-auth");
const crypto_1 = __importDefault(require("crypto"));
const deviceInfo_1 = require("../utils/deviceInfo");
const router = express_1.default.Router();
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email'),
    password: zod_1.z.string().min(1, 'Password is required'),
});
/**
 * POST /api/company-auth/login
 * Authenticates a CompanyUser and returns a signed JWT.
 * The JWT payload includes: companyUserId, companyId, role, isSuperAdmin
 */
router.post('/login', async (req, res) => {
    try {
        const { email, password } = loginSchema.parse(req.body);
        // Find user by email
        const companyUser = await client_1.default.companyUser.findUnique({
            where: { email },
            include: {
                company: {
                    select: { id: true, companyName: true, companyCode: true, status: true },
                },
            },
        });
        if (!companyUser) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        // Check active status
        if (!companyUser.isActive) {
            return res.status(403).json({ error: 'Your account has been deactivated.' });
        }
        // Check company status (suspended companies cannot log in)
        if (!companyUser.isSuperAdmin && companyUser.company.status !== 'active') {
            return res.status(403).json({
                error: 'Company account is suspended. Please contact support.',
            });
        }
        // Verify password
        const isValid = await bcryptjs_1.default.compare(password, companyUser.passwordHash);
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        // Sign JWT
        const jwtSecret = process.env.JWT_SECRET || 'CHANGE-THIS-IN-PRODUCTION-DEVELOPMENT-ONLY';
        const token = jsonwebtoken_1.default.sign({
            companyUserId: companyUser.id,
            companyId: companyUser.companyId,
            role: companyUser.role,
            isSuperAdmin: companyUser.isSuperAdmin,
        }, jwtSecret, { expiresIn: '24h' });
        // Update last login timestamp
        await client_1.default.companyUser.update({
            where: { id: companyUser.id },
            data: { lastLoginAt: new Date() },
        });
        logger_1.default.info(`Company user logged in: ${companyUser.email} (company: ${companyUser.company.companyCode})`);
        // Generate CSRF token
        const deviceInfo = (0, deviceInfo_1.extractDeviceInfo)(req);
        const sessionId = crypto_1.default.randomBytes(16).toString('hex');
        const csrfToken = await (0, csrf_1.generateCsrfToken)(sessionId, deviceInfo.deviceId, companyUser.id);
        return res.json({
            token,
            csrfToken,
            sessionId,
            user: {
                id: companyUser.id,
                name: companyUser.name,
                email: companyUser.email,
                role: companyUser.role,
                isSuperAdmin: companyUser.isSuperAdmin,
                companyId: companyUser.companyId,
                company: {
                    id: companyUser.company.id,
                    companyName: companyUser.company.companyName,
                    companyCode: companyUser.company.companyCode,
                    status: companyUser.company.status,
                },
            },
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Validation error', details: error.errors });
        }
        logger_1.default.error('Company login error:', error);
        return res.status(500).json({ error: 'Login failed. Please try again.' });
    }
});
/**
 * GET /api/company-auth/me
 * Returns the current logged-in company user's details.
 */
router.get('/me', company_auth_1.authenticateCompanyUser, async (req, res) => {
    try {
        const companyUser = await client_1.default.companyUser.findUnique({
            where: { id: req.companyUser.id },
            include: {
                company: {
                    include: { settings: true },
                },
            },
        });
        if (!companyUser) {
            return res.status(404).json({ error: 'User not found' });
        }
        return res.json({
            id: companyUser.id,
            name: companyUser.name,
            email: companyUser.email,
            role: companyUser.role,
            isSuperAdmin: companyUser.isSuperAdmin,
            companyId: companyUser.companyId,
            company: {
                id: companyUser.company.id,
                companyName: companyUser.company.companyName,
                companyCode: companyUser.company.companyCode,
                companyEmail: companyUser.company.companyEmail,
                companyPhone: companyUser.company.companyPhone,
                companyAddress: companyUser.company.companyAddress,
                status: companyUser.company.status,
                settings: companyUser.company.settings,
            },
        });
    }
    catch (error) {
        logger_1.default.error('Company /me error:', error);
        return res.status(500).json({ error: 'Failed to get user' });
    }
});
exports.default = router;
//# sourceMappingURL=company-auth.js.map