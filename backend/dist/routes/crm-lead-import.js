"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const crypto_1 = __importDefault(require("crypto"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const client_1 = __importDefault(require("../prisma/client"));
const rbac_1 = require("../middleware/rbac");
const lead_import_service_1 = require("../services/lead-import-service");
const logger_1 = __importDefault(require("../utils/logger"));
const router = express_1.default.Router();
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
const MAX_LEAD_IMPORT_ROWS = 2000;
function ensureUploadDir() {
    const dir = path_1.default.join(process.cwd(), 'uploads', 'lead-imports');
    if (!fs_1.default.existsSync(dir)) {
        fs_1.default.mkdirSync(dir, { recursive: true });
    }
    return dir;
}
function buildLeadImportTemplateCsv() {
    const header = [...lead_import_service_1.LEAD_IMPORT_REQUIRED_HEADERS];
    const row1 = header.join(',');
    const row2 = ['Required', 'Required', 'Optional', 'Optional', 'Required', 'Optional', 'Provide one only', 'Provide one only', 'Optional'].join(',');
    const row3 = ['Ali Khan', '+923001234567', 'ali@email.com', '35202-1234567-1', 'Facebook', 'Campaign A', 'DLR-001', '', 'Interested buyer'].join(',');
    return [row1, row2, row3].join('\r\n');
}
// Download official Lead Import CSV template (no static file; dynamically generated)
router.get('/leads/import/template', rbac_1.requireAuth, (0, rbac_1.requirePermission)('crm.leads.create'), async (req, res) => {
    try {
        const userId = req.user.id;
        logger_1.default.info('Lead import template downloaded', { userId, timestamp: new Date().toISOString() });
        const csv = buildLeadImportTemplateCsv();
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="crm_lead_import_template.csv"');
        res.send(csv);
    }
    catch (error) {
        logger_1.default.error('Lead import template download error', { error: error.message, userId: req.user?.id });
        return res.status(500).json({ error: error.message || 'Failed to download template' });
    }
});
// Upload CSV/Excel and create staging batch
router.post('/leads/import/upload', rbac_1.requireAuth, (0, rbac_1.requirePermission)('crm.leads.create'), upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        const originalName = req.file.originalname;
        const ext = path_1.default.extname(originalName).toLowerCase();
        if (ext !== '.csv') {
            return res.status(400).json({ error: 'Only .csv files are supported in this version' });
        }
        const hash = crypto_1.default.createHash('sha256').update(req.file.buffer).digest('hex');
        const uploadDir = ensureUploadDir();
        const filePath = path_1.default.join(uploadDir, `${Date.now()}-${originalName}`);
        fs_1.default.writeFileSync(filePath, req.file.buffer);
        const batch = await (0, lead_import_service_1.createLeadImportBatch)({
            userId: req.user.id,
            fileName: originalName,
            filePath,
            fileHash: hash,
            buffer: req.file.buffer,
            assignmentMode: 'CSV_DEFINED',
            rowLimit: MAX_LEAD_IMPORT_ROWS,
        });
        return res.status(201).json({
            batchId: batch.id,
            rowCount: batch.rowCount,
            status: batch.status,
        });
    }
    catch (error) {
        console.error('Lead import upload error:', error);
        const message = error.message || 'Failed to upload lead import file';
        const isBadRequest = message.includes('Invalid CSV headers') ||
            message.includes('Missing header row') ||
            message.includes('Row limit exceeded') ||
            message.includes('Only .csv files are supported');
        return res.status(isBadRequest ? 400 : 500).json({ error: message });
    }
});
// Validate staged batch (row-level validation, dealer resolution, duplicate detection)
router.post('/leads/import/:batchId/validate', rbac_1.requireAuth, (0, rbac_1.requirePermission)('crm.leads.create'), async (req, res) => {
    try {
        const { batchId } = req.params;
        const result = await (0, lead_import_service_1.validateLeadImportBatch)(batchId, {
            id: req.user.id,
            username: req.user?.username,
            roleName: req.user?.role?.name,
        });
        return res.json({
            batchId: result.batchId,
            status: result.status,
            rowCount: result.rowCount,
            readyCount: result.readyCount,
            duplicateCount: result.duplicateCount,
            invalidCount: result.invalidCount,
        });
    }
    catch (error) {
        console.error('Lead import validate error:', error);
        const message = error.message || 'Failed to validate lead import batch';
        const status = message.includes('not found') ? 404 : message.includes('already been committed') ? 409 : 400;
        return res.status(status).json({ error: message });
    }
});
// Commit approved batch (creates leads for READY rows only)
router.post('/leads/import/:batchId/commit', rbac_1.requireAuth, (0, rbac_1.requirePermission)('crm.leads.create'), async (req, res) => {
    try {
        const { batchId } = req.params;
        const result = await (0, lead_import_service_1.commitLeadImportBatch)(batchId, {
            id: req.user.id,
            username: req.user?.username,
            roleName: req.user?.role?.name,
        }, req);
        const batch = await client_1.default.leadImportBatch.findUnique({ where: { id: batchId } });
        return res.json({
            batchId: result.batchId,
            status: result.status,
            rowCount: result.rowCount,
            committedLeads: result.committedLeads,
            readyCount: batch?.readyCount ?? 0,
            duplicateCount: batch?.duplicateCount ?? 0,
            invalidCount: batch?.invalidCount ?? 0,
        });
    }
    catch (error) {
        console.error('Lead import commit error:', error);
        const message = error.message || 'Failed to commit lead import batch';
        const status = message.includes('not found') ? 404 : message.includes('immutable') ? 409 : 400;
        return res.status(status).json({ error: message });
    }
});
exports.default = router;
//# sourceMappingURL=crm-lead-import.js.map