"use strict";
/**
 * Export Job Service
 * Handles async export job creation, processing, and status tracking
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createExportJob = createExportJob;
exports.getExportJobStatus = getExportJobStatus;
exports.listExportJobs = listExportJobs;
const client_1 = __importDefault(require("../prisma/client"));
const logger_1 = __importDefault(require("../utils/logger"));
const unified_export_service_1 = require("./unified-export-service");
const audit_log_1 = require("./audit-log");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * Create export job
 */
async function createExportJob(data, req) {
    try {
        // Validate custom_limit if scope is custom_limit
        if (data.scope === 'custom_limit' && !data.customLimit) {
            throw new Error('custom_limit is required when scope is custom_limit');
        }
        const job = await client_1.default.exportJob.create({
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
        await (0, audit_log_1.createAuditLog)({
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
            req: req,
        });
        // Process job in background (non-blocking)
        processExportJob(job.id, data).catch(error => {
            logger_1.default.error(`Export job ${job.id} failed:`, error);
        });
        return {
            id: job.id,
            status: 'pending',
        };
    }
    catch (error) {
        logger_1.default.error('Failed to create export job:', error);
        throw error;
    }
}
/**
 * Process export job (background)
 */
async function processExportJob(jobId, data) {
    try {
        // Update status to running
        await client_1.default.exportJob.update({
            where: { id: jobId },
            data: {
                status: 'running',
                startedAt: new Date(),
            },
        });
        // Convert global filter to legacy format for unified export service
        const legacyFilters = {};
        // Map global filter to legacy format
        if (data.filter.status?.length)
            legacyFilters.status = data.filter.status;
        if (data.filter.priority?.length)
            legacyFilters.priority = data.filter.priority;
        if (data.filter.date?.field) {
            legacyFilters.dateField = data.filter.date.field.replace('_', '');
            if (data.filter.date.preset) {
                legacyFilters.datePreset = data.filter.date.preset;
            }
            else {
                if (data.filter.date.from)
                    legacyFilters.dateFrom = data.filter.date.from;
                if (data.filter.date.to)
                    legacyFilters.dateTo = data.filter.date.to;
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
        if (data.filter.search)
            legacyFilters.search = data.filter.search;
        // Determine export scope
        let exportScope = 'FILTERED';
        if (data.scope === 'current_page') {
            exportScope = 'VIEW';
        }
        else if (data.scope === 'all_filtered') {
            exportScope = 'FILTERED';
        }
        else {
            exportScope = 'FILTERED'; // custom_limit still uses FILTERED scope with limit
        }
        // Build pagination if needed
        const pagination = data.scope === 'current_page' ? {
            page: data.filter.pagination?.page || 1,
            pageSize: data.filter.pagination?.limit || 25,
        } : undefined;
        // Build export request
        const exportRequest = {
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
        const result = await (0, unified_export_service_1.exportData)(exportRequest, data.userId, data.permissionContext);
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
        let rowCount = null;
        if (data.format === 'csv') {
            const content = result.buffer.toString('utf-8');
            const lines = content.split('\n').filter(line => line.trim().length > 0);
            rowCount = Math.max(0, lines.length - 1); // Subtract header
        }
        // Update job as completed
        await client_1.default.exportJob.update({
            where: { id: jobId },
            data: {
                status: 'completed',
                completedAt: new Date(),
                fileUrl,
                fileName,
                rowCount,
            },
        });
        logger_1.default.info(`Export job ${jobId} completed successfully`);
    }
    catch (error) {
        logger_1.default.error(`Export job ${jobId} failed:`, error);
        // Update job as failed
        await client_1.default.exportJob.update({
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
async function getExportJobStatus(jobId, userId) {
    const job = await client_1.default.exportJob.findFirst({
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
        status: job.status,
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
async function listExportJobs(userId, module, limit = 50) {
    const jobs = await client_1.default.exportJob.findMany({
        where: {
            userId,
            ...(module ? { module } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
    });
    return jobs.map(job => ({
        id: job.id,
        status: job.status,
        rowCount: job.rowCount || undefined,
        error: job.error || undefined,
        fileUrl: job.fileUrl || undefined,
        fileName: job.fileName || undefined,
        createdAt: job.createdAt,
        startedAt: job.startedAt || undefined,
        completedAt: job.completedAt || undefined,
    }));
}
//# sourceMappingURL=export-job-service.js.map