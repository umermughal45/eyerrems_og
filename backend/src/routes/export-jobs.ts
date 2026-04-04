/**
 * Export Jobs Routes
 * Async export job creation, status tracking, and download
 */

import express, { Response } from 'express';
import { z } from 'zod';
import { requireAuth, AuthenticatedRequest } from '../middleware/rbac';
import { createExportJob, getExportJobStatus, listExportJobs } from '../services/export-job-service';
import { exportRequestSchema, validateGlobalFilter } from '../schemas/global-filter-schema';
import { PermissionContext } from '../services/global-filter-engine';
import logger from '../utils/logger';

const router = (express as any).Router();

/**
 * POST /export-jobs
 * Create async export job
 */
router.post('/export-jobs', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Validate request payload
    const parsed = exportRequestSchema.parse(req.body);
    
    // Build permission context
    const permissionContext: PermissionContext = {
      userId: req.user?.id || 'unknown',
      roleId: req.user?.roleId || '',
      roleName: req.user?.role?.name,
      permissions: req.user?.role?.permissions || [],
    };

    // Create export job
    const result = await createExportJob(
      {
        module: parsed.module,
        tab: parsed.tab,
        format: parsed.format,
        scope: parsed.scope,
        customLimit: parsed.custom_limit,
        columns: parsed.columns,
        dataShape: parsed.data_shape,
        filter: parsed.filter,
        userId: permissionContext.userId,
        permissionContext,
      },
      req
    );

    return res.json({
      success: true,
      data: result,
      message: 'Export job created. Check status endpoint for progress.',
    });
  } catch (error: any) {
    logger.error('Export job creation error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid export request',
        details: error.errors,
      });
    }
    return res.status(500).json({
      error: error.message || 'Failed to create export job',
    });
  }
});

/**
 * GET /export-jobs/:id
 * Get export job status
 */
router.get('/export-jobs/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || 'unknown';

    const job = await getExportJobStatus(id, userId);

    if (!job) {
      return res.status(404).json({ error: 'Export job not found' });
    }

    return res.json({
      success: true,
      data: job,
    });
  } catch (error: any) {
    logger.error('Export job status error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to get export job status',
    });
  }
});

/**
 * GET /export-jobs
 * List user's export jobs
 */
router.get('/export-jobs', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id || 'unknown';
    const module = req.query.module as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;

    const jobs = await listExportJobs(userId, module, limit);

    return res.json({
      success: true,
      data: jobs,
    });
  } catch (error: any) {
    logger.error('Export jobs list error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to list export jobs',
    });
  }
});

export default router;
