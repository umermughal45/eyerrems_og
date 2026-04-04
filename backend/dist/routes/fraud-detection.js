"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const fraud_detection_service_1 = require("../services/fraud-detection-service");
const error_handler_1 = require("../utils/error-handler");
const logger_1 = __importDefault(require("../utils/logger"));
const client_1 = __importDefault(require("../prisma/client"));
const router = express_1.default.Router();
/**
 * GET /api/fraud-detection/red-flags
 * Generate Red Flags Report
 */
router.get('/red-flags', auth_1.authenticate, async (req, res) => {
    try {
        // Check if user has permission (Admin or Finance Manager)
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const user = await client_1.default.user.findUnique({
            where: { id: req.user.id },
            include: {
                role: {
                    select: {
                        id: true,
                        name: true,
                        status: true,
                        permissions: true,
                        // Don't select category - may not exist yet
                    },
                },
            },
        });
        if (!user || !user.role || (user.role.name !== 'Admin' && user.role.name !== 'Finance Manager')) {
            // Allow if they have specific permission 'finance.reports.view'
            const hasPermission = user?.role?.permissions && Array.isArray(user.role.permissions)
                ? user.role.permissions.includes('finance.reports.view') || user.role.permissions.includes('*')
                : false;
            if (!hasPermission) {
                return res.status(403).json({ error: 'Unauthorized access to fraud detection reports' });
            }
        }
        const { startDate, endDate } = req.query;
        const start = startDate ? new Date(startDate) : undefined;
        const end = endDate ? new Date(endDate) : undefined;
        const report = await fraud_detection_service_1.FraudDetectionService.generateRedFlagsReport(start, end);
        return (0, error_handler_1.successResponse)(res, {
            count: report.length,
            entries: report,
            period: {
                startDate: start,
                endDate: end,
            },
        });
    }
    catch (error) {
        logger_1.default.error('Generate red flags report error:', error);
        res.status(500).json({
            error: 'Failed to generate red flags report',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
exports.default = router;
//# sourceMappingURL=fraud-detection.js.map