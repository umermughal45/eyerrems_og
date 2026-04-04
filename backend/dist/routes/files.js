"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const auth_1 = require("../middleware/auth");
const file_security_1 = require("../utils/file-security");
const logger_1 = __importDefault(require("../utils/logger"));
const router = express_1.default.Router();
const ALLOWED_ENTITIES = [
    'properties',
    'clients',
    'employees',
    'dealers',
    'agents',
    'tenants',
    'users'
];
/**
 * Common file handler for view and download
 */
const handleFileRequest = async (req, res, disposition) => {
    try {
        const { entity, trackingId, filename } = req.params;
        // Validate parameters
        if (!entity || !trackingId || !filename) {
            return res.status(400).json({ error: 'Invalid file path parameters' });
        }
        // Validate entity type
        if (!ALLOWED_ENTITIES.includes(entity)) {
            return res.status(400).json({ error: 'Invalid entity type' });
        }
        // Sanitize filename to prevent path traversal
        if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
            return res.status(400).json({ error: 'Invalid filename security check failed' });
        }
        // Get secure upload directory
        const uploadDir = await (0, file_security_1.getSecureUploadDir)();
        // Construct path: root/entity/trackingId/filename
        const filePath = path_1.default.join(uploadDir, entity, trackingId, filename);
        // Check if file exists
        try {
            await promises_1.default.access(filePath);
        }
        catch {
            logger_1.default.warn(`File not found: ${filePath}`);
            return res.status(404).json({ error: 'File not found on server' });
        }
        // Get file stats
        const stats = await promises_1.default.stat(filePath);
        // Set appropriate headers
        res.setHeader('Content-Length', stats.size);
        res.setHeader('Content-Type', getContentType(filename));
        res.setHeader('Content-Disposition', `${disposition}; filename="${filename}"`);
        res.setHeader('Cache-Control', 'private, max-age=3600');
        // Stream file
        const fileContent = await promises_1.default.readFile(filePath);
        res.send(fileContent);
    }
    catch (error) {
        logger_1.default.error('File serving error:', error);
        res.status(500).json({ error: 'Failed to serve file' });
    }
};
/**
 * View file (inline)
 * GET /api/files/view/:entity/:trackingId/:filename
 */
router.get('/view/:entity/:trackingId/:filename', auth_1.authenticate, async (req, res) => {
    await handleFileRequest(req, res, 'inline');
});
/**
 * Download file (attachment)
 * GET /api/files/download/:entity/:trackingId/:filename
 */
router.get('/download/:entity/:trackingId/:filename', auth_1.authenticate, async (req, res) => {
    await handleFileRequest(req, res, 'attachment');
});
/**
 * Get content type from filename
 */
function getContentType(filename) {
    const ext = path_1.default.extname(filename).toLowerCase();
    const contentTypes = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml',
        '.pdf': 'application/pdf',
        '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.xls': 'application/vnd.ms-excel',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.txt': 'text/plain',
        '.csv': 'text/csv',
    };
    return contentTypes[ext] || 'application/octet-stream';
}
exports.default = router;
//# sourceMappingURL=files.js.map