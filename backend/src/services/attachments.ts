/**
 * Global Attachments Service
 * Handles file uploads and attachments across all entities
 */

import prisma from '../prisma/client';
import { Request } from 'express';
import path from 'path';
import fs from 'fs/promises';
import { getSecureUploadDir } from '../utils/file-security';
import logger from '../utils/logger';

// Type definition for multer file
interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

export interface AttachmentData {
  fileName: string;
  fileUrl: string;
  fileType?: string;
  fileSize?: number;
  entityType: string;
  entityId: string;
  propertyId?: string;
  tenantId?: string;
  uploadedBy?: string;
  description?: string;
}

/**
 * Create attachment record
 */
export async function createAttachment(data: AttachmentData) {
  const attachment = await prisma.attachment.create({
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
export async function getAttachments(
  entityType: string,
  entityId: string
) {
  return await prisma.attachment.findMany({
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
export async function deleteAttachment(attachmentId: string) {
  const attachment = await prisma.attachment.update({
    where: { id: attachmentId },
    data: { isDeleted: true },
  });

  await deletePhysicalFile(attachment.fileUrl);

  return attachment;
}

/**
 * Get file type from filename
 */
function getFileType(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  const typeMap: { [key: string]: string } = {
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
export async function saveUploadedFile(
  file: MulterFile,
  entityType: string,
  entityId: string
): Promise<string> {
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', entityType, entityId);
  
  // Create directory if it doesn't exist
  await fs.mkdir(uploadDir, { recursive: true });

  // Generate unique filename
  const timestamp = Date.now();
  const uniqueFileName = `${timestamp}-${file.originalname}`;
  const filePath = path.join(uploadDir, uniqueFileName);

  // Save file
  await fs.writeFile(filePath, file.buffer);

  // Return relative URL
  return `/uploads/${entityType}/${entityId}/${uniqueFileName}`;
}

/**
 * Delete physical file
 */
export async function deletePhysicalFile(fileUrl: string) {
  try {
    const normalized = fileUrl.replace(/^\/api/, '').replace(/\\/g, '/');
    if (normalized.startsWith('/secure-files/')) {
      const parts = normalized.split('/').filter(Boolean);
      if (parts.length >= 4) {
        const [, entityType, entityId, ...filenameParts] = parts;
        const filename = filenameParts.join('/');
        const uploadDir = await getSecureUploadDir();
        const securePath = path.join(uploadDir, entityType, entityId, filename);
        await fs.unlink(securePath);
        return;
      }
    }
    const publicPath = path.join(process.cwd(), 'public', normalized);
    await fs.unlink(publicPath);
  } catch (error) {
    logger.error(`Error deleting file: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Update entity's documents array (for backward compatibility)
 */
export async function updateEntityDocuments(
  entityType: string,
  entityId: string,
  documentUrl: string
) {
  // This is a helper to maintain backward compatibility with JSON documents field
  // Different entities may store documents differently
  const attachment = await createAttachment({
    fileName: path.basename(documentUrl),
    fileUrl: documentUrl,
    entityType,
    entityId,
  });

  return attachment;
}

