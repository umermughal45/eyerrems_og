import express, { Response } from 'express';
import fs from 'fs';
import path from 'path';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validateFileUpload, scanFileForViruses, saveFileSecurely } from '../utils/file-security';
import logger from '../utils/logger';

const router = (express as any).Router();

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Upload image endpoint (accepts base64 or file)
router.post('/image', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { image, filename } = req.body;

    if (!image) {
      return res.status(400).json({
        success: false,
        error: 'Image data is required',
      });
    }

    // Handle base64 image
    let imageBuffer: Buffer;
    let fileExtension = 'jpg';
    let fileName = filename || `property-${Date.now()}.jpg`;

    if (image.startsWith('data:image/')) {
      // Base64 image with data URL
      const matches = image.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/);
      if (!matches) {
        return res.status(400).json({
          success: false,
          error: 'Invalid image format',
        });
      }

      fileExtension = matches[1] || 'jpg';
      const base64Data = matches[2];
      imageBuffer = Buffer.from(base64Data, 'base64');
      fileName = filename || `property-${Date.now()}.${fileExtension}`;
    } else if (image.startsWith('/9j/') || image.startsWith('iVBORw0KGgo')) {
      // Raw base64 without data URL prefix
      imageBuffer = Buffer.from(image, 'base64');
      fileName = filename || `property-${Date.now()}.jpg`;
    } else {
      return res.status(400).json({
        success: false,
        error: 'Invalid image format. Please provide base64 encoded image.',
      });
    }

    // Validate file using security utilities
    const validation = await validateFileUpload(
      imageBuffer,
      `image/${fileExtension}`,
      fileName
    );

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: validation.error || 'File validation failed',
      });
    }

    // Scan for viruses
    const tempPath = path.join(uploadsDir, `temp-${Date.now()}-${fileName}`);
    fs.writeFileSync(tempPath, imageBuffer);
    const scanResult = await scanFileForViruses(tempPath);
    
    if (!scanResult.clean) {
      fs.unlinkSync(tempPath);
      return res.status(400).json({
        success: false,
        error: 'File failed virus scan',
        threat: scanResult.threat,
      });
    }

    // Save file securely outside web root
    const { relativePath, filename: secureFilename } = await saveFileSecurely(
      imageBuffer,
      fileName,
      'images',
      req.user!.id
    );

    // Clean up temp file
    try {
      fs.unlinkSync(tempPath);
    } catch {
      // Ignore cleanup errors
    }

    res.json({
      success: true,
      data: {
        url: relativePath, // Secure endpoint URL
        filename: secureFilename,
      },
    });
  } catch (error) {
    logger.error('Upload image error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload image',
      message: process.env.NODE_ENV === 'development' 
        ? (error instanceof Error ? error.message : 'Unknown error')
        : 'An error occurred while uploading the image',
    });
  }
});

router.post('/file', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { file, filename } = req.body;

    if (!file) {
      return res.status(400).json({
        success: false,
        error: 'File data is required',
      });
    }

    const dataUrlMatch = file.match(/^data:(.+);base64,(.+)$/);
    if (!dataUrlMatch) {
      return res.status(400).json({
        success: false,
        error: 'Invalid file format. Expected base64 data URL.',
      });
    }

    const mimeType = dataUrlMatch[1];
    const base64Data = dataUrlMatch[2];
    const buffer = Buffer.from(base64Data, 'base64');

    // Validate file using security utilities
    const validation = await validateFileUpload(
      buffer,
      mimeType,
      filename
    );

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: validation.error || 'File validation failed',
      });
    }

    // Scan for viruses
    const extension = mimeType.split('/')[1] || 'bin';
    const safeFilename = filename || `attachment-${Date.now()}.${extension}`;
    const tempPath = path.join(uploadsDir, `temp-${Date.now()}-${safeFilename}`);
    fs.writeFileSync(tempPath, buffer);
    const scanResult = await scanFileForViruses(tempPath);
    
    if (!scanResult.clean) {
      fs.unlinkSync(tempPath);
      return res.status(400).json({
        success: false,
        error: 'File failed virus scan',
        threat: scanResult.threat,
      });
    }

    // Save file securely outside web root
    const { relativePath, filename: secureFilename } = await saveFileSecurely(
      buffer,
      safeFilename,
      'files',
      req.user!.id
    );

    // Clean up temp file
    try {
      fs.unlinkSync(tempPath);
    } catch {
      // Ignore cleanup errors
    }

    res.json({
      success: true,
      data: {
        url: relativePath, // Secure endpoint URL
        filename: secureFilename,
        mimeType: validation.detectedMimeType || mimeType,
        size: buffer.length,
      },
    });
  } catch (error) {
    logger.error('Upload file error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload file',
      message: process.env.NODE_ENV === 'development'
        ? (error instanceof Error ? error.message : 'Unknown error')
        : 'An error occurred while uploading the file',
    });
  }
});

export default router;

