"use strict";
/**
 * Export Jobs Routes
 * Async export job creation, status tracking, and download
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const zod_1 = require("zod");
const rbac_1 = require("../middleware/rbac");
const export_job_service_1 = require("../services/export-job-service");
const global_filter_schema_1 = require("../schemas/global-filter-schema");
const logger_1 = __importDefault(require("../utils/logger"));
const router = express_1.default.Router();
/**
 * POST /export-jobs
 * Create async export job
 */
router.post('/export-jobs', rbac_1.requireAuth, async (req, res) => {
    try {
        // Validate request payload
        const parsed = global_filter_schema_1.exportRequestSchema.parse(req.body);
        // Build permission context
        const permissionContext = {
            userId: req.user?.id || 'unknown',
            roleId: req.user?.roleId || '',
            roleName: req.user?.role?.name,
            permissions: req.user?.role?.permissions || [],
        };
        // Create export job
        const result = await (0, export_job_service_1.createExportJob)({
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
        }, req);
        return res.json({
            success: true,
            data: result,
            message: 'Export job created. Check status endpoint for progress.',
        });
    }
    catch (error) {
        logger_1.default.error('Export job creation error:', error);
        if (error instanceof zod_1.z.ZodError) {
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
router.get('/export-jobs/:id', rbac_1.requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id || 'unknown';
        const job = await (0, export_job_service_1.getExportJobStatus)(id, userId);
        if (!job) {
            return res.status(404).json({ error: 'Export job not found' });
        }
        return res.json({
            success: true,
            data: job,
        });
    }
    catch (error) {
        logger_1.default.error('Export job status error:', error);
        return res.status(500).json({
            error: error.message || 'Failed to get export job status',
        });
    }
});
/**
 * GET /export-jobs
 * List user's export jobs
 */
router.get('/export-jobs', rbac_1.requireAuth, async (req, res) => {
    try {
        const userId = req.user?.id || 'unknown';
        const module = req.query.module;
        const limit = req.query.limit ? parseInt(req.query.limit, 10) : 50;
        const jobs = await (0, export_job_service_1.listExportJobs)(userId, module, limit);
        return res.json({
            success: true,
            data: jobs,
        });
    }
    catch (error) {
        logger_1.default.error('Export jobs list error:', error);
        return res.status(500).json({
            error: error.message || 'Failed to list export jobs',
        });
    }
});
exports.default = router;
//# sourceMappingURL=export-jobs.js.map