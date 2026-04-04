/**
 * Export Job Service
 * Handles async export job creation, processing, and status tracking
 */

import prisma from '../prisma/client';
import logger from '../utils/logger';
import { ExportRequestPayload } from '../schemas/global-filter-schema';
import { exportData, ExportRequest, ExportFormat } from './unified-export-service';
import { PermissionContext } from './global-filter-engine';
import { createAuditLog } from './audit-log';
import { Request } from 'express';
import * as fs from 'fs';
import * as path from 'path';

export interface ExportJobCreate {
  module: string;
  tab?: string;
  format: ExportFormat;
  scope: 'current_page' | 'all_filtered' | 'custom_limit';
  customLimit?: number;
  columns?: string[];
  dataShape?: 'raw' | 'grouped' | 'aggregated';
  filter: any; // GlobalFilterPayload
  userId: string;
  permissionContext: PermissionContext;
}

export interface ExportJobStatus {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress?: number;
  rowCount?: number;
  error?: string;
  fileUrl?: string;
  fileName?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

/**
 * Create export job
 */
export async function createExportJob(
  data: ExportJobCreate,
  req?: Request
): Promise<{ id: string; status: string }> {
  try {
    // Validate custom_limit if scope is custom_limit
    if (data.scope === 'custom_limit' && !data.customLimit) {
      throw new Error('custom_limit is required when scope is custom_limit');
    }

    const job = await prisma.exportJob.create({
      data: {
        module: data.module,
        tab: data.tab,
        userId: data.userId,
        status: 'pending',
        format: data.format,
        scope: data.scope,
        customLimit: data.customLimit,
        columns: data.columns ? JSON.parse(JSON.stringify(data.columns)) : null,
        dataShape: data.dataShape || 'raw',
        filterJson: JSON.parse(JSON.stringify(data.filter)),
      },
    });

    // Audit log
    await createAuditLog({
      entityType: data.module,
      entityId: 'export-job',
      action: 'export',
      userId: data.userId,
      userName: data.permissionContext.roleName,
      userRole: data.permissionContext.roleName,
      description: `Created export job for ${data.module} module`,
      metadata: {
        jobId: job.id,
        format: data.format,
        scope: data.scope,
        filter: data.filter,
      },
      req: req as any,
    });

    // Process job in background (non-blocking)
    processExportJob(job.id, data).catch(error => {
      logger.error(`Export job ${job.id} failed:`, error);
    });

    return {
      id: job.id,
      status: 'pending',
    };
  } catch (error: any) {
    logger.error('Failed to create export job:', error);
    throw error;
  }
}

/**
 * Process export job (background)
 */
async function processExportJob(jobId: string, data: ExportJobCreate): Promise<void> {
  try {
    // Update status to running
    await prisma.exportJob.update({
      where: { id: jobId },
      data: {
        status: 'running',
        startedAt: new Date(),
      },
    });

    // Convert global filter to legacy format for unified export service
    const legacyFilters: any = {};
    
    // Map global filter to legacy format
    if (data.filter.status?.length) legacyFilters.status = data.filter.status;
    if (data.filter.priority?.length) legacyFilters.priority = data.filter.priority;
    if (data.filter.date?.field) {
      legacyFilters.dateField = data.filter.date.field.replace('_', '');
      if (data.filter.date.preset) {
        legacyFilters.datePreset = data.filter.date.preset;
      } else {
        if (data.filter.date.from) legacyFilters.dateFrom = data.filter.date.from;
        if (data.filter.date.to) legacyFilters.dateTo = data.filter.date.to;
      }
    }
    if (data.filter.ownership?.assigned_users?.length) {
      legacyFilters.assignedTo = data.filter.ownership.assigned_users[0];
    }
    if (data.filter.numeric_ranges?.amount_min !== undefined) {
      legacyFilters.amount = { min: data.filter.numeric_ranges.amount_min };
    }
    if (data.filter.numeric_ranges?.amount_max !== undefined) {
      legacyFilters.amount = { ...legacyFilters.amount, max: data.filter.numeric_ranges.amount_max };
    }
    if (data.filter.search) legacyFilters.search = data.filter.search;

    // Determine export scope
    let exportScope: 'VIEW' | 'FILTERED' | 'ALL' = 'FILTERED';
    if (data.scope === 'current_page') {
      exportScope = 'VIEW';
    } else if (data.scope === 'all_filtered') {
      exportScope = 'FILTERED';
    } else {
      exportScope = 'FILTERED'; // custom_limit still uses FILTERED scope with limit
    }

    // Build pagination if needed
    const pagination = data.scope === 'current_page' ? {
      page: data.filter.pagination?.page || 1,
      pageSize: data.filter.pagination?.limit || 25,
    } : undefined;

    // Build export request
    const exportRequest: ExportRequest = {
      module: data.module,
      format: data.format,
      scope: exportScope,
      filters: legacyFilters,
      search: data.filter.search,
      sort: {
        field: data.filter.sorting?.field?.replace(/_/g, '') || 'createdAt',
        direction: data.filter.sorting?.direction || 'desc',
      },
      pagination,
    };

    // Generate export
    const result = await exportData(
      exportRequest,
      data.userId,
      data.permissionContext
    );

    // Save file to storage (for now, save to public/exports)
    const uploadsDir = path.join(process.cwd(), 'public', 'exports');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const extension = data.format === 'excel' ? 'xlsx' : data.format === 'word' ? 'xlsx' : data.format;
    const fileName = `${data.module}-${new Date().toISOString().split('T')[0]}-${jobId}.${extension}`;
    const filePath = path.join(uploadsDir, fileName);
    fs.writeFileSync(filePath, result.buffer);

    const fileUrl = `/exports/${fileName}`;

    // Estimate row count from file size (rough approximation)
    // For CSV: lines - 1 (header)
    // For Excel/PDF: harder to estimate without parsing
    let rowCount: number | null = null;
    if (data.format === 'csv') {
      const content = result.buffer.toString('utf-8');
      const lines = content.split('\n').filter(line => line.trim().length > 0);
      rowCount = Math.max(0, lines.length - 1); // Subtract header
    }

    // Update job as completed
    await prisma.exportJob.update({
      where: { id: jobId },
      data: {
        status: 'completed',
        completedAt: new Date(),
        fileUrl,
        fileName,
        rowCount,
      },
    });

    logger.info(`Export job ${jobId} completed successfully`);
  } catch (error: any) {
    logger.error(`Export job ${jobId} failed:`, error);
    
    // Update job as failed
    await prisma.exportJob.update({
      where: { id: jobId },
      data: {
        status: 'failed',
        completedAt: new Date(),
        error: error.message || 'Export failed',
      },
    });
  }
}

/**
 * Get export job status
 */
export async function getExportJobStatus(jobId: string, userId: string): Promise<ExportJobStatus | null> {
  const job = await prisma.exportJob.findFirst({
    where: {
      id: jobId,
      userId, // Ensure user can only access their own jobs
    },
  });

  if (!job) {
    return null;
  }

  return {
    id: job.id,
    status: job.status as any,
    rowCount: job.rowCount || undefined,
    error: job.error || undefined,
    fileUrl: job.fileUrl || undefined,
    fileName: job.fileName || undefined,
    createdAt: job.createdAt,
    startedAt: job.startedAt || undefined,
    completedAt: job.completedAt || undefined,
  };
}

/**
 * List user's export jobs
 */
export async function listExportJobs(
  userId: string,
  module?: string,
  limit: number = 50
): Promise<ExportJobStatus[]> {
  const jobs = await prisma.exportJob.findMany({
    where: {
      userId,
      ...(module ? { module } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return jobs.map(job => ({
    id: job.id,
    status: job.status as any,
    rowCount: job.rowCount || undefined,
    error: job.error || undefined,
    fileUrl: job.fileUrl || undefined,
    fileName: job.fileName || undefined,
    createdAt: job.createdAt,
    startedAt: job.startedAt || undefined,
    completedAt: job.completedAt || undefined,
  }));
}
