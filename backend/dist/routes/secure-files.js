"use strict";
/**
 * Secure File Serving Route
 * Serves files from outside web root with authentication
 * Prevents direct access to uploaded files
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const file_security_1 = require("../utils/file-security");
const logger_1 = __importDefault(require("../utils/logger"));
const router = express_1.default.Router();
/**
 * Serve secure file with conditional authentication
 * GET /api/secure-files/:entityType/:entityId/:filename
 *
 * This is the centralized file serving endpoint for all secure files.
 * Files are stored outside web root in: {UPLOAD_DIR}/{entityType}/{entityId}/{filename}
 * Images are served without authentication for proper browser caching
 */
router.get('/:entityType/:entityId/:filename', async (req, res) => {
    try {
        const { entityType, entityId, filename } = req.params;
        // Validate parameters
        if (!entityType || !entityId || !filename) {
            return res.status(400).json({ error: 'Invalid file path parameters' });
        }
        // Sanitize filename to prevent path traversal
        if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
            logger_1.default.warn(`Path traversal attempt detected: ${filename}`);
            return res.status(400).json({ error: 'Invalid filename' });
        }
        // Determine content type
        const contentType = getContentType(filename);
        const isImage = contentType.startsWith('image/');
        // Require authentication for non-image files
        if (!isImage) {
            const authHeader = req.headers.authorization;
            let token = authHeader?.replace('Bearer ', '') || authHeader?.replace('bearer ', '');
            if (!token && req.query.token) {
                token = req.query.token;
            }
            if (!token) {
                return res.status(401).json({
                    error: 'Authentication required',
                    message: 'No authorization token provided. Please log in again.',
                });
            }
            // Basic token validation (simplified for non-images)
            const jwtSecret = process.env.JWT_SECRET || 'CHANGE-THIS-IN-PRODUCTION-DEVELOPMENT-ONLY';
            try {
                const decoded = jsonwebtoken_1.default.verify(token, jwtSecret);
                if (!decoded) {
                    return res.status(401).json({ error: 'Invalid token' });
                }
            }
            catch (jwtError) {
                return res.status(401).json({ error: 'Invalid token' });
            }
        }
        // Get secure upload directory
        const uploadDir = await (0, file_security_1.getSecureUploadDir)();
        const filePath = path_1.default.join(uploadDir, entityType, entityId, filename);
        // Check if file exists
        try {
            await promises_1.default.access(filePath);
        }
        catch (error) {
            logger_1.default.warn(`File not found: ${filePath} (entityType: ${entityType}, entityId: ${entityId}, filename: ${filename})`);
            return res.status(404).json({ error: 'File not found on server' });
        }
        // Get file stats
        const stats = await promises_1.default.stat(filePath);
        // Set appropriate headers
        res.setHeader('Content-Length', stats.size);
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(filename)}"`);
        // Use public cache for images to enable proper browser caching
        res.setHeader('Cache-Control', isImage ? 'public, max-age=31536000' : 'private, max-age=3600');
        // Add CORS headers if needed
        res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        // Stream file
        const fileStream = await promises_1.default.readFile(filePath);
        res.send(fileStream);
    }
    catch (error) {
        logger_1.default.error('Secure file serving error:', error);
        res.status(500).json({ error: 'Failed to serve file' });
    }
});
/**
 * Get content type from filename
 * Returns appropriate MIME type for proper browser handling
 */
function getContentType(filename) {
    const ext = path_1.default.extname(filename).toLowerCase();
    const contentTypes = {
        // Images
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml',
        '.bmp': 'image/bmp',
        '.ico': 'image/x-icon',
        // Documents
        '.pdf': 'application/pdf',
        '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.xls': 'application/vnd.ms-excel',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.ppt': 'application/vnd.ms-powerpoint',
        '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        // Text
        '.txt': 'text/plain',
        '.csv': 'text/csv',
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'text/javascript',
        '.json': 'application/json',
        // Archives
        '.zip': 'application/zip',
        '.rar': 'application/x-rar-compressed',
        '.7z': 'application/x-7z-compressed',
    };
    return contentTypes[ext] || 'application/octet-stream';
}
exports.default = router;
//# sourceMappingURL=secure-files.js.map