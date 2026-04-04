
import express, { Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { authenticate, AuthRequest } from '../middleware/auth';
import { getSecureUploadDir } from '../utils/file-security';
import logger from '../utils/logger';

const router = (express as any).Router();

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
const handleFileRequest = async (
  req: AuthRequest, 
  res: Response, 
  disposition: 'inline' | 'attachment'
) => {
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
    const uploadDir = await getSecureUploadDir();
    // Construct path: root/entity/trackingId/filename
    const filePath = path.join(uploadDir, entity, trackingId, filename);

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      logger.warn(`File not found: ${filePath}`);
      return res.status(404).json({ error: 'File not found on server' });
    }

    // Get file stats
    const stats = await fs.stat(filePath);
    
    // Set appropriate headers
    res.setHeader('Content-Length', stats.size);
    res.setHeader('Content-Type', getContentType(filename));
    res.setHeader('Content-Disposition', `${disposition}; filename="${filename}"`);
    res.setHeader('Cache-Control', 'private, max-age=3600');

    // Stream file
    const fileContent = await fs.readFile(filePath);
    res.send(fileContent);
  } catch (error) {
    logger.error('File serving error:', error);
    res.status(500).json({ error: 'Failed to serve file' });
  }
};

/**
 * View file (inline)
 * GET /api/files/view/:entity/:trackingId/:filename
 */
router.get('/view/:entity/:trackingId/:filename', authenticate, async (req: AuthRequest, res: Response) => {
  await handleFileRequest(req, res, 'inline');
});

/**
 * Download file (attachment)
 * GET /api/files/download/:entity/:trackingId/:filename
 */
router.get('/download/:entity/:trackingId/:filename', authenticate, async (req: AuthRequest, res: Response) => {
  await handleFileRequest(req, res, 'attachment');
});

/**
 * Get content type from filename
 */
function getContentType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const contentTypes: Record<string, string> = {
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

export default router;
