"use strict";
/**
 * Global Attachments Service
 * Handles file uploads and attachments across all entities
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAttachment = createAttachment;
exports.getAttachments = getAttachments;
exports.deleteAttachment = deleteAttachment;
exports.saveUploadedFile = saveUploadedFile;
exports.deletePhysicalFile = deletePhysicalFile;
exports.updateEntityDocuments = updateEntityDocuments;
const client_1 = __importDefault(require("../prisma/client"));
const path_1 = __importDefault(require("path"));
const promises_1 = __importDefault(require("fs/promises"));
const file_security_1 = require("../utils/file-security");
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * Create attachment record
 */
async function createAttachment(data) {
    const attachment = await client_1.default.attachment.create({
        data: {
            fileName: data.fileName,
            fileUrl: data.fileUrl,
            fileType: data.fileType || getFileType(data.fileName),
            fileSize: data.fileSize,
            entityType: data.entityType,
            entityId: data.entityId,
            propertyId: data.propertyId,
            tenantId: data.tenantId,
            uploadedBy: data.uploadedBy,
            description: data.description,
        },
    });
    return attachment;
}
/**
 * Get attachments for an entity
 */
async function getAttachments(entityType, entityId) {
    return await client_1.default.attachment.findMany({
        where: {
            entityType,
            entityId,
            isDeleted: false,
        },
        orderBy: {
            createdAt: 'desc',
        },
    });
}
/**
 * Delete attachment (soft delete)
 */
async function deleteAttachment(attachmentId) {
    const attachment = await client_1.default.attachment.update({
        where: { id: attachmentId },
        data: { isDeleted: true },
    });
    await deletePhysicalFile(attachment.fileUrl);
    return attachment;
}
/**
 * Get file type from filename
 */
function getFileType(fileName) {
    const ext = path_1.default.extname(fileName).toLowerCase();
    const typeMap = {
        '.pdf': 'pdf',
        '.doc': 'document',
        '.docx': 'document',
        '.xls': 'spreadsheet',
        '.xlsx': 'spreadsheet',
        '.jpg': 'image',
        '.jpeg': 'image',
        '.png': 'image',
        '.gif': 'image',
        '.txt': 'text',
        '.zip': 'archive',
        '.rar': 'archive',
    };
    return typeMap[ext] || 'other';
}
/**
 * Save uploaded file to disk
 */
async function saveUploadedFile(file, entityType, entityId) {
    const uploadDir = path_1.default.join(process.cwd(), 'public', 'uploads', entityType, entityId);
    // Create directory if it doesn't exist
    await promises_1.default.mkdir(uploadDir, { recursive: true });
    // Generate unique filename
    const timestamp = Date.now();
    const uniqueFileName = `${timestamp}-${file.originalname}`;
    const filePath = path_1.default.join(uploadDir, uniqueFileName);
    // Save file
    await promises_1.default.writeFile(filePath, file.buffer);
    // Return relative URL
    return `/uploads/${entityType}/${entityId}/${uniqueFileName}`;
}
/**
 * Delete physical file
 */
async function deletePhysicalFile(fileUrl) {
    try {
        const normalized = fileUrl.replace(/^\/api/, '').replace(/\\/g, '/');
        if (normalized.startsWith('/secure-files/')) {
            const parts = normalized.split('/').filter(Boolean);
            if (parts.length >= 4) {
                const [, entityType, entityId, ...filenameParts] = parts;
                const filename = filenameParts.join('/');
                const uploadDir = await (0, file_security_1.getSecureUploadDir)();
                const securePath = path_1.default.join(uploadDir, entityType, entityId, filename);
                await promises_1.default.unlink(securePath);
                return;
            }
        }
        const publicPath = path_1.default.join(process.cwd(), 'public', normalized);
        await promises_1.default.unlink(publicPath);
    }
    catch (error) {
        logger_1.default.error(`Error deleting file: ${error instanceof Error ? error.message : String(error)}`);
    }
}
/**
 * Update entity's documents array (for backward compatibility)
 */
async function updateEntityDocuments(entityType, entityId, documentUrl) {
    // This is a helper to maintain backward compatibility with JSON documents field
    // Different entities may store documents differently
    const attachment = await createAttachment({
        fileName: path_1.default.basename(documentUrl),
        fileUrl: documentUrl,
        entityType,
        entityId,
    });
    return attachment;
}
//# sourceMappingURL=attachments.js.map