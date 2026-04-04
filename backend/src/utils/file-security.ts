/**
 * File Upload Security Utilities
 * Validates MIME type, file signature (magic bytes), file size
 * Sanitizes filenames and ensures files are stored outside web root
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import logger from './logger';
import { sanitizeFilename } from './xss-sanitize';
import { getEnv } from './env-validation';

/**
 * Allowed MIME types with their file signatures (magic bytes)
 */
const ALLOWED_MIME_TYPES: Record<string, { signatures: number[][]; extensions: string[] }> = {
  'image/jpeg': {
    signatures: [[0xFF, 0xD8, 0xFF]],
    extensions: ['jpg', 'jpeg'],
  },
  'image/png': {
    signatures: [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
    extensions: ['png'],
  },
  'image/gif': {
    signatures: [[0x47, 0x49, 0x46, 0x38]],
    extensions: ['gif'],
  },
  'image/webp': {
    signatures: [[0x52, 0x49, 0x46, 0x46], [0x57, 0x45, 0x42, 0x50]],
    extensions: ['webp'],
  },
  'application/pdf': {
    signatures: [[0x25, 0x50, 0x44, 0x46]],
    extensions: ['pdf'],
  },
  'application/msword': {
    signatures: [[0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]],
    extensions: ['doc'],
  },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
    signatures: [[0x50, 0x4B, 0x03, 0x04]],
    extensions: ['docx'],
  },
  'application/vnd.ms-excel': {
    signatures: [[0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]],
    extensions: ['xls'],
  },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
    signatures: [[0x50, 0x4B, 0x03, 0x04]],
    extensions: ['xlsx'],
  },
};

/**
 * Maximum file size (5MB default)
 */
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * Get file signature (magic bytes) from buffer
 */
function getFileSignature(buffer: Buffer, length: number = 8): number[] {
  return Array.from(buffer.slice(0, length));
}

/**
 * Validate file signature against MIME type
 */
function validateFileSignature(buffer: Buffer, mimeType: string): boolean {
  const mimeConfig = ALLOWED_MIME_TYPES[mimeType];
  if (!mimeConfig) {
    return false;
  }

  const signature = getFileSignature(buffer, 8);

  // Check if signature matches any of the expected signatures
  return mimeConfig.signatures.some((expectedSig) => {
    return expectedSig.every((byte, index) => signature[index] === byte);
  });
}

/**
 * Detect MIME type from file signature
 */
export function detectMimeType(buffer: Buffer): string | null {
  for (const [mimeType, config] of Object.entries(ALLOWED_MIME_TYPES)) {
    if (validateFileSignature(buffer, mimeType)) {
      return mimeType;
    }
  }
  return null;
}

/**
 * Validate file upload
 * Checks MIME type, file signature, and file size
 */
export async function validateFileUpload(
  buffer: Buffer,
  declaredMimeType: string,
  filename?: string
): Promise<{ valid: boolean; error?: string; detectedMimeType?: string }> {
  // Check file size
  if (buffer.length > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`,
    };
  }

  // Check if MIME type is allowed
  if (!ALLOWED_MIME_TYPES[declaredMimeType]) {
    return {
      valid: false,
      error: `MIME type ${declaredMimeType} is not allowed`,
    };
  }

  // Validate file signature
  const detectedMimeType = detectMimeType(buffer);
  if (!detectedMimeType) {
    return {
      valid: false,
      error: 'File signature does not match declared MIME type',
    };
  }

  // Ensure detected MIME type matches declared MIME type
  if (detectedMimeType !== declaredMimeType) {
    return {
      valid: false,
      error: `File signature indicates ${detectedMimeType}, but ${declaredMimeType} was declared`,
    };
  }

  // Validate extension if filename provided
  if (filename) {
    const extension = filename.split('.').pop()?.toLowerCase();
    const mimeConfig = ALLOWED_MIME_TYPES[declaredMimeType];
    if (extension && !mimeConfig.extensions.includes(extension)) {
      return {
        valid: false,
        error: `File extension .${extension} does not match MIME type ${declaredMimeType}`,
      };
    }
  }

  return {
    valid: true,
    detectedMimeType,
  };
}

/**
 * Get secure upload directory (outside web root)
 */
export async function getSecureUploadDir(): Promise<string> {
  try {
    const env = getEnv();
    const uploadDir = path.resolve(process.cwd(), env.UPLOAD_DIR || '../uploads');
    
    // Ensure directory exists
    await fs.mkdir(uploadDir, { recursive: true });
    
    return uploadDir;
  } catch (error) {
    logger.error('Failed to get secure upload directory:', error);
    throw new Error('Failed to initialize upload directory');
  }
}

/**
 * Save file securely outside web root
 */
export async function saveFileSecurely(
  buffer: Buffer,
  originalFilename: string,
  entityType: string,
  entityId: string
): Promise<{ filePath: string; relativePath: string; filename: string }> {
  try {
    // Sanitize filename
    const sanitizedFilename = sanitizeFilename(originalFilename);
    
    // Generate unique filename to prevent collisions
    const timestamp = Date.now();
    const randomString = crypto.randomBytes(8).toString('hex');
    const extension = path.extname(sanitizedFilename) || '';
    const baseName = path.basename(sanitizedFilename, extension);
    const uniqueFilename = `${timestamp}-${randomString}-${baseName}${extension}`;
    
    // Get secure upload directory
    const uploadDir = await getSecureUploadDir();
    const entityDir = path.join(uploadDir, entityType, entityId);
    
    // Create entity directory if it doesn't exist
    await fs.mkdir(entityDir, { recursive: true });
    
    // Save file
    const filePath = path.join(entityDir, uniqueFilename);
    await fs.writeFile(filePath, buffer);
    
    // Set restrictive permissions (owner read/write only)
    await fs.chmod(filePath, 0o600);
    
    // Return relative path (without /api prefix - frontend will add it)
    // Format: /secure-files/entityType/entityId/filename
    const relativePath = `/secure-files/${entityType}/${entityId}/${uniqueFilename}`;
    
    logger.info(`File saved securely: ${filePath} (relative: ${relativePath})`);
    
    return {
      filePath,
      relativePath,
      filename: uniqueFilename,
    };
  } catch (error) {
    logger.error('Failed to save file securely:', error);
    throw new Error('Failed to save file');
  }
}

/**
 * Scan file for viruses (placeholder - integrate with actual antivirus service)
 * In production, integrate with ClamAV or cloud antivirus service
 */
export async function scanFileForViruses(filePath: string): Promise<{ clean: boolean; threat?: string }> {
  // TODO: Integrate with actual antivirus service
  // For now, return clean (implement ClamAV or cloud service)
  logger.warn('Virus scanning not implemented - file marked as clean');
  return { clean: true };
}

/**
 * Delete file securely
 */
export async function deleteFileSecurely(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
    logger.info(`File deleted securely: ${filePath}`);
  } catch (error) {
    logger.error('Failed to delete file:', error);
    throw new Error('Failed to delete file');
  }
}

