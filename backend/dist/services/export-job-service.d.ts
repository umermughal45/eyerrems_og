/**
 * Export Job Service
 * Handles async export job creation, processing, and status tracking
 */
import { ExportFormat } from './unified-export-service';
import { PermissionContext } from './global-filter-engine';
import { Request } from 'express';
export interface ExportJobCreate {
    module: string;
    tab?: string;
    format: ExportFormat;
    scope: 'current_page' | 'all_filtered' | 'custom_limit';
    customLimit?: number;
    columns?: string[];
    dataShape?: 'raw' | 'grouped' | 'aggregated';
    filter: any;
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
export declare function createExportJob(data: ExportJobCreate, req?: Request): Promise<{
    id: string;
    status: string;
}>;
/**
 * Get export job status
 */
export declare function getExportJobStatus(jobId: string, userId: string): Promise<ExportJobStatus | null>;
/**
 * List user's export jobs
 */
export declare function listExportJobs(userId: string, module?: string, limit?: number): Promise<ExportJobStatus[]>;
//# sourceMappingURL=export-job-service.d.ts.map