import express, { Response } from 'express';
import multer from 'multer';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../services/audit-log';
import { errorResponse } from '../utils/error-handler';
import { generateExcelExport } from '../services/excel-export';
import { importExcelFile } from '../services/excel-import';

const router = (express as any).Router();

// Configure multer for file upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (_req, file, cb) => {
    if (
      file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.mimetype === 'application/vnd.ms-excel' ||
      file.originalname.endsWith('.xlsx') ||
      file.originalname.endsWith('.xls')
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files (.xlsx, .xls) are allowed'), false);
    }
  },
});

// Export route - generates Excel file
router.get('/export', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const buffer = await generateExcelExport();

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="rems-bulk-export-${new Date().toISOString().split('T')[0]}.xlsx"`
    );

    // Log audit
    await createAuditLog({
      entityType: 'bulk_export',
      entityId: 'excel-export',
      action: 'export',
      userId: req.user?.id,
      userName: req.user?.username,
      description: 'Excel bulk export generated',
    });

    res.send(buffer);
  } catch (error) {
    return errorResponse(res, error);
  }
});

// Import route - processes Excel file
router.post(
  '/import',
  authenticate,
  requireAdmin,
  upload.single('file'),
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const result = await importExcelFile(req.file.buffer);

      // Log audit
      await createAuditLog({
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
    } catch (error) {
      return errorResponse(res, error);
    }
  }
);

export default router;

