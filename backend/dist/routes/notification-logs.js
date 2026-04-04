"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const client_1 = __importDefault(require("../prisma/client"));
const rbac_1 = require("../middleware/rbac");
const router = express_1.default.Router();
const isDev = process.env.NODE_ENV === 'development';
const requireAuthOrDevBypass = isDev
    ? (req, _res, next) => next()
    : rbac_1.requireAuth;
const requirePermissionOrDevBypass = (permission) => isDev
    ? (req, _res, next) => next()
    : (0, rbac_1.requirePermission)(permission);
router.get('/', requireAuthOrDevBypass, requirePermissionOrDevBypass('notification.view'), async (req, res) => {
    const { limit = '100', offset = '0' } = req.query;
    const take = Math.min(500, Math.max(1, parseInt(String(limit), 10) || 100));
    const skip = Math.max(0, parseInt(String(offset), 10) || 0);
    const rows = await client_1.default.notificationLog.findMany({
        orderBy: { createdAt: 'desc' },
        take,
        skip,
    });
    res.json({ data: rows });
});
exports.default = router;
//# sourceMappingURL=notification-logs.js.map