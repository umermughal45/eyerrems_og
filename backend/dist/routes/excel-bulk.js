"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const auth_1 = require("../middleware/auth");
const audit_log_1 = require("../services/audit-log");
const error_handler_1 = require("../utils/error-handler");
const excel_export_1 = require("../services/excel-export");
const excel_import_1 = require("../services/excel-import");
const router = express_1.default.Router();
// Configure multer for file upload
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit
    },
    fileFilter: (_req, file, cb) => {
        if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
            file.mimetype === 'application/vnd.ms-excel' ||
            file.originalname.endsWith('.xlsx') ||
            file.originalname.endsWith('.xls')) {
            cb(null, true);
        }
        else {
            cb(new Error('Only Excel files (.xlsx, .xls) are allowed'), false);
        }
    },
});
// Export route - generates Excel file
router.get('/export', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const buffer = await (0, excel_export_1.generateExcelExport)();
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="rems-bulk-export-${new Date().toISOString().split('T')[0]}.xlsx"`);
        // Log audit
        await (0, audit_log_1.createAuditLog)({
            entityType: 'bulk_export',
            entityId: 'excel-export',
            action: 'export',
            userId: req.user?.id,
            userName: req.user?.username,
            description: 'Excel bulk export generated',
        });
        res.send(buffer);
    }
    catch (error) {
        return (0, error_handler_1.errorResponse)(res, error);
    }
});
// Import route - processes Excel file
router.post('/import', auth_1.authenticate, auth_1.requireAdmin, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        const result = await (0, excel_import_1.importExcelFile)(req.file.buffer);
        // Log audit
        await (0, audit_log_1.createAuditLog)({
            entityType: 'bulk_import',
            entityId: 'excel-import',
            action: 'import',
            userId: req.user?.id,
            userName: req.user?.username,
            description: `Excel bulk import completed: ${result.inserted} inserted, ${result.updated} updated, ${result.deleted} deleted, ${result.failed} failed`,
            metadata: result,
        });
        res.json({
            success: true,
            summary: {
                inserted: result.inserted,
                updated: result.updated,
                deleted: result.deleted,
                failed: result.failed,
                errors: result.errors.slice(0, 100), // Limit to first 100 errors
                details: result.details,
            },
        });
    }
    catch (error) {
        return (0, error_handler_1.errorResponse)(res, error);
    }
});
exports.default = router;
//# sourceMappingURL=excel-bulk.js.map