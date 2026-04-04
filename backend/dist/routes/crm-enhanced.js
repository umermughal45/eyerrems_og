"use strict";
/**
 * Enhanced CRM Module Routes
 * Includes: assignments, CNIC uploads, deal stage workflows, commission auto-calc
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
const express_1 = __importDefault(require("express"));
const zod_1 = require("zod");
const client_1 = __importDefault(require("../prisma/client"));
const rbac_1 = require("../middleware/rbac");
const audit_log_1 = require("../services/audit-log");
const workflows_1 = require("../services/workflows");
const crm_alerts_1 = require("../services/crm-alerts");
const attachments_1 = require("../services/attachments");
const id_generation_service_1 = require("../services/id-generation-service");
const filter_helper_1 = require("../utils/filter-helper");
const global_filter_helper_1 = require("../utils/global-filter-helper");
const unified_export_service_1 = require("../services/unified-export-service");
const pagination_1 = require("../utils/pagination");
const multer_1 = __importDefault(require("multer"));
const logger_1 = __importDefault(require("../utils/logger"));
const unified_search_service_1 = require("../services/unified-search-service");
const id_service_1 = require("../utils/id-service");
const router = express_1.default.Router();
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
// Validation schemas
const createLeadSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    email: zod_1.z.string().email().optional(),
    phone: zod_1.z.string().optional(),
    source: zod_1.z.string().optional(),
    leadSourceDetails: zod_1.z.string().optional(),
    priority: zod_1.z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
    score: zod_1.z.number().int().min(0).max(100).optional(),
    interest: zod_1.z.string().optional(),
    interestType: zod_1.z.string().optional(),
    budget: zod_1.z.string().optional(),
    budgetMin: zod_1.z.number().optional(),
    budgetMax: zod_1.z.number().optional(),
    expectedCloseDate: zod_1.z.string().datetime().optional(),
    followUpDate: zod_1.z.string().datetime().optional(),
    assignedToUserId: zod_1.z.string().uuid().optional(),
    assignedDealerId: zod_1.z.string().uuid().optional(),
    cnic: zod_1.z.string().optional(),
    address: zod_1.z.string().optional(),
    city: zod_1.z.string().optional(),
    tid: zod_1.z.string().min(1).optional(),
});
const createClientSchema = zod_1.z.object({
    tid: zod_1.z.string().min(1).optional(), // Transaction ID - unique across Property, Deal, Client
    name: zod_1.z.string().min(1),
    email: zod_1.z.string().optional(),
    phone: zod_1.z.string().optional(),
    company: zod_1.z.string().optional(),
    status: zod_1.z.string().optional(),
    address: zod_1.z.string().optional(),
    cnic: zod_1.z.string().optional(),
    billingAddress: zod_1.z.string().optional(),
    city: zod_1.z.string().optional(),
    country: zod_1.z.string().optional(),
    postalCode: zod_1.z.string().optional(),
    clientType: zod_1.z.enum(['individual', 'corporate', 'government']).optional(),
    clientCategory: zod_1.z.enum(['vip', 'regular', 'corporate', 'premium']).optional(),
    propertyInterest: zod_1.z.string().optional(),
    locationId: zod_1.z.string().uuid().nullable().optional(),
    assignedDealerId: zod_1.z.string().uuid().optional(),
    assignedAgentId: zod_1.z.string().uuid().optional(),
    manualUniqueId: zod_1.z.string().optional(),
    attachments: zod_1.z.any().optional(), // JSON field for notes and file attachments
    tags: zod_1.z.array(zod_1.z.string()).optional(), // JSON field for tags
});
const DEAL_ROLE_OPTIONS = ['buyer', 'seller', 'tenant', 'landlord', 'investor', 'partner'];
const DEAL_STATUS_OPTIONS = ['open', 'in_progress', 'won', 'lost', 'cancelled'];
const createDealSchema = zod_1.z.object({
    manualUniqueId: zod_1.z.string().optional(),
    tid: zod_1.z.string().optional(), // Transaction ID - unique across Property, Deal, Client
    title: zod_1.z.string().min(1),
    clientId: zod_1.z.string().uuid(),
    propertyId: zod_1.z.string().uuid(),
    dealerId: zod_1.z.string().uuid().optional(),
    role: zod_1.z.enum(DEAL_ROLE_OPTIONS).default('buyer'),
    dealType: zod_1.z.enum(['rental', 'sale', 'investment']).optional(),
    dealAmount: zod_1.z.number().positive(),
    stage: zod_1.z.enum(['prospecting', 'qualified', 'proposal', 'negotiation', 'closing', 'closed-won', 'closed-lost']).default('prospecting'),
    status: zod_1.z.enum(DEAL_STATUS_OPTIONS).default('open'),
    probability: zod_1.z.number().int().min(0).max(100).default(50),
    commissionRate: zod_1.z.number().nonnegative().default(0),
    dealDate: zod_1.z.string().datetime().optional(),
    expectedClosingDate: zod_1.z.string().datetime().optional(),
    notes: zod_1.z.string().optional(),
});
const createCommunicationSchema = zod_1.z.object({
    leadId: zod_1.z.string().uuid().optional(),
    clientId: zod_1.z.string().uuid().optional(),
    dealId: zod_1.z.string().uuid().optional(),
    channel: zod_1.z.enum(['email', 'phone', 'meeting', 'whatsapp', 'sms', 'message']),
    activityType: zod_1.z.enum(['call', 'email', 'meeting', 'note', 'whatsapp', 'sms']).default('note'),
    subject: zod_1.z.string().optional(),
    content: zod_1.z.string().min(1),
    activityDate: zod_1.z.string().datetime().optional(),
    nextFollowUpDate: zod_1.z.string().datetime().optional(),
    assignedAgentId: zod_1.z.string().uuid().optional(),
});
// Helper: Generate codes (now using centralized service)
// These functions are kept for backward compatibility but delegate to the centralized service
async function generateLeadCode() {
    return await (0, id_generation_service_1.generateSystemId)('lead');
}
async function generateClientCode() {
    return await (0, id_generation_service_1.generateSystemId)('cli');
}
async function generateDealerCode() {
    return await (0, id_generation_service_1.generateSystemId)('deal');
}
async function generateDealCode() {
    return await (0, id_generation_service_1.generateSystemId)('dl');
}
// Debug endpoint to test auth/permissions (remove in production)
router.get('/debug/auth', rbac_1.requireAuth, (0, rbac_1.requirePermission)('crm.clients.create'), async (req, res) => {
    res.json({
        success: true,
        message: 'Authentication and permissions working correctly',
        user: {
            id: req.user?.id,
            username: req.user?.username,
            role: req.user?.role?.name,
            permissions: req.user?.role?.permissions
        },
        timestamp: new Date().toISOString()
    });
});
// ==================== LEADS ====================
// Get all leads with filters (supports unified filter engine)
router.get('/leads', rbac_1.requireAuth, (0, rbac_1.requirePermission)('crm.leads.view'), async (req, res) => {
    try {
        const config = unified_export_service_1.MODULE_CONFIGS.leads;
        if (!config?.filterConfig) {
            // Fallback to legacy filtering if filterConfig not available
            const { status, priority, assignedTo, followUpDate, search } = req.query;
            const where = { isDeleted: false };
            if (status)
                where.status = status;
            if (priority)
                where.priority = priority;
            if (assignedTo)
                where.assignedToUserId = assignedTo;
            if (followUpDate) {
                where.followUpDate = { lte: new Date(followUpDate) };
            }
            if (search) {
                where.OR = [
                    { name: { contains: search, mode: 'insensitive' } },
                    { email: { contains: search, mode: 'insensitive' } },
                    { phone: { contains: search, mode: 'insensitive' } },
                    { leadCode: { contains: search, mode: 'insensitive' } },
                    { manualUniqueId: { contains: search, mode: 'insensitive' } },
                ];
            }
            const leads = await client_1.default.lead.findMany({
                where,
                include: {
                    assignedAgent: {
                        select: { id: true, username: true, email: true },
                    },
                    communications: {
                        orderBy: { activityDate: 'desc' },
                        take: 5,
                    },
                },
                orderBy: { createdAt: 'desc' },
            });
            return res.json(leads);
        }
        // Use unified filter engine
        const { where, orderBy, pagination } = await (0, filter_helper_1.applyListFilters)(req, config.filterConfig);
        // Get total count
        const total = await client_1.default.lead.count({ where });
        // Get paginated data
        const leads = await client_1.default.lead.findMany({
            where,
            include: {
                assignedAgent: {
                    select: { id: true, username: true, email: true },
                },
                communications: {
                    orderBy: { activityDate: 'desc' },
                    take: 5,
                },
            },
            orderBy,
            skip: pagination.skip,
            take: pagination.limit,
        });
        const paginationResult = (0, pagination_1.calculatePagination)(pagination.page, pagination.limit, total);
        res.json({
            data: leads,
            pagination: paginationResult,
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// POST endpoint for global filter engine (list with filters)
router.post('/leads', rbac_1.requireAuth, (0, rbac_1.requirePermission)('crm.leads.view'), async (req, res) => {
    try {
        // Global filter configuration for leads
        const filterConfig = {
            model: 'Lead',
            identityFields: ['leadCode', 'name', 'email', 'phone', 'tid', 'manualUniqueId'],
            statusField: 'status',
            priorityField: 'priority',
            dateFields: [
                { global: 'created_at', prisma: 'createdAt' },
                { global: 'updated_at', prisma: 'updatedAt' },
                { global: 'follow_up_date', prisma: 'followUpDate' },
                { global: 'expected_close_date', prisma: 'expectedCloseDate' },
            ],
            numericFields: [],
            relationalFields: {
                assignedTo: 'assignedToUserId',
                dealer: 'assignedDealerId',
            },
        };
        // Apply global filters
        const { where, orderBy, pagination } = await (0, global_filter_helper_1.applyListFilters)(req, filterConfig);
        // Ensure where clause is properly formatted (remove any undefined/null values)
        const cleanWhere = JSON.parse(JSON.stringify(where || {}));
        // Get total count
        const total = await client_1.default.lead.count({ where: cleanWhere });
        // Get paginated data
        const leads = await client_1.default.lead.findMany({
            where: cleanWhere,
            include: {
                assignedAgent: {
                    select: { id: true, username: true, email: true },
                },
                communications: {
                    orderBy: { activityDate: 'desc' },
                    take: 5,
                },
            },
            orderBy,
            skip: pagination.skip,
            take: pagination.limit,
        });
        const paginationResult = (0, pagination_1.calculatePagination)(pagination.page, pagination.limit, total);
        res.json({
            success: true,
            data: leads,
            pagination: paginationResult,
        });
    }
    catch (error) {
        console.error('Error fetching leads:', error);
        logger_1.default.error('Error fetching leads:', {
            message: error.message,
            stack: error.stack,
            name: error.name,
            code: error.code,
        });
        // Handle Zod validation errors
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({
                success: false,
                error: 'Validation error',
                message: 'Invalid filter parameters',
                details: error.errors
            });
        }
        // Handle Prisma errors
        if (error.code && error.code.startsWith('P')) {
            return res.status(400).json({
                success: false,
                error: 'Database error',
                message: error.message,
                code: error.code,
            });
        }
        // Handle other errors
        res.status(500).json({
            success: false,
            error: error.message || 'Internal server error',
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
            details: process.env.NODE_ENV === 'development' ? {
                name: error.name,
                code: error.code,
            } : undefined,
        });
    }
});
// Create lead
router.post('/leads/create', rbac_1.requireAuth, (0, rbac_1.requirePermission)('crm.leads.create'), async (req, res) => {
    try {
        const parsedData = createLeadSchema.parse(req.body);
        const { manualUniqueId, tid, ...data } = parsedData;
        // Validate manual unique ID if provided
        if (manualUniqueId) {
            await (0, id_generation_service_1.validateManualUniqueId)(manualUniqueId, 'lead');
        }
        const leadTid = tid || await id_service_1.IdService.generateTID();
        await (0, id_generation_service_1.validateTID)(leadTid);
        // Generate system ID: lead-YY-####
        const leadCode = await generateLeadCode();
        const lead = await client_1.default.$transaction(async (tx) => {
            return await tx.lead.create({
                data: {
                    ...data,
                    leadCode,
                    tid: leadTid,
                    manualUniqueId: manualUniqueId?.trim() || null,
                    followUpDate: data.followUpDate ? new Date(data.followUpDate) : undefined,
                    expectedCloseDate: data.expectedCloseDate ? new Date(data.expectedCloseDate) : undefined,
                    createdBy: req.user?.id,
                },
                include: {
                    assignedAgent: true,
                    assignedDealer: true,
                },
            });
        });
        await (0, audit_log_1.createAuditLog)({
            entityType: 'lead',
            entityId: lead.id,
            action: 'create',
            userId: req.user?.id,
            userName: req.user?.username,
            userRole: req.user?.role?.name,
            newValues: lead,
            description: `Lead created: ${lead.name}`,
            req,
        });
        res.status(201).json(lead);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: error.errors });
        }
        res.status(500).json({ error: error.message });
    }
});
// Assign lead to employee
router.post('/leads/:id/assign', rbac_1.requireAuth, (0, rbac_1.requirePermission)('crm.leads.update'), async (req, res) => {
    try {
        const { assignedToUserId } = req.body;
        const lead = await client_1.default.lead.update({
            where: { id: req.params.id },
            data: { assignedToUserId },
            include: { assignedAgent: true },
        });
        await (0, audit_log_1.createAuditLog)({
            entityType: 'lead',
            entityId: lead.id,
            action: 'update',
            userId: req.user?.id,
            userName: req.user?.username,
            userRole: req.user?.role?.name,
            description: `Lead assigned to employee`,
            metadata: { assignedToUserId },
            req,
        });
        res.json(lead);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Upload CNIC for lead
router.post('/leads/:id/upload-cnic', rbac_1.requireAuth, (0, rbac_1.requirePermission)('crm.leads.update'), upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        const fileUrl = await (0, attachments_1.saveUploadedFile)(req.file, 'lead', req.params.id);
        const attachment = await (0, attachments_1.createAttachment)({
            fileName: req.file.originalname,
            fileUrl,
            fileType: req.file.mimetype,
            fileSize: req.file.size,
            entityType: 'lead',
            entityId: req.params.id,
            uploadedBy: req.user?.id,
            description: 'CNIC Document',
        });
        // Update lead with CNIC document URL
        await client_1.default.lead.update({
            where: { id: req.params.id },
            data: {
                attachments: {
                    push: {
                        url: fileUrl,
                        name: req.file.originalname,
                        type: 'cnic',
                    },
                },
            },
        });
        res.json({ attachment, fileUrl });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Convert lead to client
router.post('/leads/:id/convert', rbac_1.requireAuth, (0, rbac_1.requirePermission)('crm.leads.update'), async (req, res) => {
    try {
        const lead = await client_1.default.lead.findUnique({ where: { id: req.params.id } });
        if (!lead) {
            return res.status(404).json({ error: 'Lead not found' });
        }
        // Preserve immutable lineage TID from lead
        const tid = lead.tid || await id_service_1.IdService.generateTID();
        const clientCode = await generateClientCode();
        const lastClient = await client_1.default.client.findFirst({ orderBy: { createdAt: 'desc' } });
        const nextSrNo = (lastClient?.srNo || 0) + 1;
        // Create client from lead
        const client = await client_1.default.client.create({
            data: {
                name: lead.name,
                tid,
                email: lead.email,
                phone: lead.phone,
                clientCode,
                srNo: nextSrNo,
                clientNo: `CL-${String(nextSrNo).padStart(4, '0')}`,
                address: lead.address,
                city: lead.city,
                cnic: lead.cnic,
                propertyInterest: lead.interest,
                assignedAgentId: lead.assignedToUserId,
                convertedFromLeadId: lead.id,
                clientType: 'individual',
                clientCategory: 'regular',
                status: 'active',
                createdBy: req.user?.id,
            },
        });
        // Update lead status
        await client_1.default.lead.update({
            where: { id: lead.id },
            data: {
                status: 'converted',
                convertedToClientId: client.id,
                convertedAt: new Date(),
            },
        });
        await (0, audit_log_1.createAuditLog)({
            entityType: 'lead',
            entityId: lead.id,
            action: 'update',
            userId: req.user?.id,
            userName: req.user?.username,
            userRole: req.user?.role?.name,
            description: `Lead converted to client: ${client.name}`,
            metadata: { clientId: client.id },
            req,
        });
        res.status(201).json(client);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// ==================== CLIENTS ====================
// Get all clients
router.get('/clients', rbac_1.requireAuth, (0, rbac_1.requirePermission)('crm.clients.view'), async (req, res) => {
    try {
        const { status, clientType, assignedAgent, search } = req.query;
        const where = { isDeleted: false };
        if (status)
            where.status = status;
        if (clientType)
            where.clientType = clientType;
        if (assignedAgent)
            where.assignedAgentId = assignedAgent;
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search, mode: 'insensitive' } },
                { clientCode: { contains: search, mode: 'insensitive' } },
                { manualUniqueId: { contains: search, mode: 'insensitive' } },
                // Note: tid search will be enabled after migration is applied
                // { tid: { contains: search as string, mode: 'insensitive' } },
                { cnic: { contains: search, mode: 'insensitive' } },
            ];
        }
        // Search by TID (Transaction ID) - searches across Property, Deal, Client
        // Note: This will be enabled after migration is applied
        // const { tid } = req.query;
        // if (tid) {
        //   where.tid = tid as string;
        // }
        const clients = await client_1.default.client.findMany({
            where,
            include: {
                assignedAgent: {
                    select: { id: true, username: true, email: true },
                },
                deals: {
                    orderBy: { createdAt: 'desc' },
                    take: 5,
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        res.json(clients);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Create client
router.post('/clients', rbac_1.requireAuth, (0, rbac_1.requirePermission)('crm.clients.create'), async (req, res) => {
    try {
        // Log request details for debugging
        console.log('Client Creation Request:', {
            userId: req.user?.id,
            username: req.user?.username,
            role: req.user?.role?.name,
            payloadKeys: Object.keys(req.body),
            hasName: !!req.body.name,
            hasTid: !!req.body.tid
        });
        const parsedData = createClientSchema.parse(req.body);
        const { manualUniqueId, attachments, tid, ...data } = parsedData;
        // Validate manual unique ID if provided
        if (manualUniqueId) {
            await (0, id_generation_service_1.validateManualUniqueId)(manualUniqueId, 'cli');
        }
        const clientTid = tid || await id_service_1.IdService.generateTID();
        await (0, id_generation_service_1.validateTID)(clientTid);
        // Generate system ID: cli-YY-####
        const clientCode = await generateClientCode();
        const lastClient = await client_1.default.client.findFirst({ orderBy: { createdAt: 'desc' } });
        const nextSrNo = (lastClient?.srNo || 0) + 1;
        const client = await client_1.default.$transaction(async (tx) => {
            return await tx.client.create({
                data: {
                    ...data,
                    clientCode,
                    tid: clientTid,
                    manualUniqueId: manualUniqueId?.trim() || null,
                    srNo: nextSrNo,
                    clientNo: `CL-${String(nextSrNo).padStart(4, '0')}`,
                    status: 'active',
                    createdBy: req.user?.id,
                },
                include: {
                    assignedAgent: true,
                    assignedDealer: true,
                },
            });
        });
        await (0, audit_log_1.createAuditLog)({
            entityType: 'client',
            entityId: client.id,
            action: 'create',
            userId: req.user?.id,
            userName: req.user?.username,
            userRole: req.user?.role?.name,
            newValues: client,
            description: `Client created: ${client.name}`,
            req,
        });
        console.log('✅ Client created successfully:', {
            clientId: client.id,
            clientCode: client.clientCode,
            name: client.name
        });
        res.status(201).json(client);
    }
    catch (error) {
        console.error('❌ Client creation failed:', {
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
            userId: req.user?.id,
            payloadKeys: Object.keys(req.body || {})
        });
        // Handle Zod validation errors (400)
        if (error instanceof zod_1.z.ZodError) {
            const validationErrors = error.errors.map(err => ({
                field: err.path.join('.'),
                message: err.message,
                code: err.code,
                received: err.received
            }));
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                message: 'The provided data does not meet the required format.',
                code: 'VALIDATION_ERROR',
                validationErrors
            });
        }
        // Handle TID validation errors specifically (400)
        if (error.message && error.message.includes('TID')) {
            return res.status(400).json({
                success: false,
                error: 'TID validation failed',
                message: error.message,
                code: 'TID_VALIDATION_ERROR'
            });
        }
        // Handle manual unique ID validation errors (400)
        if (error.message && error.message.includes('Manual unique ID')) {
            return res.status(400).json({
                success: false,
                error: 'Manual ID validation failed',
                message: error.message,
                code: 'MANUAL_ID_VALIDATION_ERROR'
            });
        }
        // Handle database constraint errors (400)
        if (error.code === 'P2002') {
            return res.status(400).json({
                success: false,
                error: 'Duplicate entry',
                message: 'A client with this information already exists.',
                code: 'DUPLICATE_ENTRY',
                constraint: error.meta?.target
            });
        }
        // Handle all other errors as 500 Internal Server Error
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: 'An unexpected error occurred while creating the client.',
            code: 'INTERNAL_ERROR',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});
// Upload CNIC for client
router.post('/clients/:id/upload-cnic', rbac_1.requireAuth, (0, rbac_1.requirePermission)('crm.clients.update'), upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        const fileUrl = await (0, attachments_1.saveUploadedFile)(req.file, 'client', req.params.id);
        const attachment = await (0, attachments_1.createAttachment)({
            fileName: req.file.originalname,
            fileUrl,
            fileType: req.file.mimetype,
            fileSize: req.file.size,
            entityType: 'client',
            entityId: req.params.id,
            uploadedBy: req.user?.id,
            description: 'CNIC Document',
        });
        await client_1.default.client.update({
            where: { id: req.params.id },
            data: { cnicDocumentUrl: fileUrl },
        });
        res.json({ attachment, fileUrl });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// ==================== GLOBAL TID SEARCH ====================
// Search by TID (Transaction ID) - returns the entire journey
router.get('/search/tid/:tid', rbac_1.requireAuth, (0, rbac_1.requirePermission)('crm.deals.view'), async (req, res) => {
    try {
        const { tid } = req.params;
        if (!tid || tid.trim() === '') {
            return res.status(400).json({ error: 'TID is required' });
        }
        const result = await unified_search_service_1.UnifiedSearchService.searchByTID(tid.trim());
        if (!result) {
            return res.status(404).json({
                error: 'No records found with this TID',
                message: `No business journey found with TID: ${tid}`,
            });
        }
        res.json({
            success: true,
            data: result,
            message: `Transaction journey found for TID: ${tid}`,
        });
    }
    catch (error) {
        logger_1.default.error('TID search error:', error);
        res.status(500).json({ error: error.message });
    }
});
// Unified Ledger retrieval for Client, Property, Dealer
router.get('/ledgers/:type/:id', rbac_1.requireAuth, (0, rbac_1.requirePermission)('crm.deals.view'), async (req, res) => {
    try {
        const { type, id } = req.params;
        if (!['CLIENT', 'PROPERTY', 'DEALER'].includes(type.toUpperCase())) {
            return res.status(400).json({ error: 'Invalid ledger type' });
        }
        const entries = await unified_search_service_1.UnifiedSearchService.getLedger(type.toUpperCase(), id);
        res.json({
            success: true,
            data: entries,
        });
    }
    catch (error) {
        logger_1.default.error('Ledger retrieval error:', error);
        res.status(500).json({ error: error.message });
    }
});
// ==================== DEALS ====================
// Get all deals
router.get('/deals', rbac_1.requireAuth, (0, rbac_1.requirePermission)('crm.deals.view'), async (req, res) => {
    try {
        const { stage, clientId, dealerId, propertyId, status, search, tid } = req.query;
        const where = { isDeleted: false, deletedAt: null };
        if (stage)
            where.stage = stage;
        if (clientId)
            where.clientId = clientId;
        if (dealerId)
            where.dealerId = dealerId;
        if (propertyId)
            where.propertyId = propertyId;
        if (status)
            where.status = status;
        // Search by TID (Transaction ID) - searches across Property, Deal, Client
        // Note: This will be enabled after migration is applied
        // if (tid) {
        //   where.tid = tid as string;
        // }
        // General search
        if (search) {
            where.OR = [
                { title: { contains: search, mode: 'insensitive' } },
                { dealCode: { contains: search, mode: 'insensitive' } },
                { manualUniqueId: { contains: search, mode: 'insensitive' } },
                // Note: tid search will be enabled after migration is applied
                // { tid: { contains: search as string, mode: 'insensitive' } },
            ];
        }
        const deals = await client_1.default.deal.findMany({
            where,
            include: {
                client: true,
                dealer: true,
                property: {
                    select: { id: true, name: true, propertyCode: true },
                },
                stageHistory: {
                    orderBy: { changedAt: 'desc' },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        res.json(deals);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Create deal (refactored to use DealService)
router.post('/deals', rbac_1.requireAuth, (0, rbac_1.requirePermission)('crm.deals.create'), async (req, res) => {
    try {
        const parsedData = createDealSchema.parse(req.body);
        const { manualUniqueId, tid, ...data } = parsedData;
        // Validate TID - must be unique across Property, Deal, and Client
        if (tid) {
            await (0, id_generation_service_1.validateTID)(tid.trim());
        }
        // Validate manual unique ID if provided
        if (manualUniqueId) {
            await (0, id_generation_service_1.validateManualUniqueId)(manualUniqueId, 'dl');
        }
        // STRICT DEAL SAFETY VALIDATION - Enforce commercial contract rules
        const { DealSafetyService } = await Promise.resolve().then(() => __importStar(require('../services/deal-safety-service')));
        await DealSafetyService.validateDealCreation({
            clientId: data.clientId,
            propertyId: data.propertyId,
            dealAmount: data.dealAmount,
            stage: data.stage,
        });
        const { DealService } = await Promise.resolve().then(() => __importStar(require('../services/deal-service')));
        const deal = await DealService.createDeal({
            tid: tid?.trim() || undefined,
            title: data.title,
            clientId: data.clientId,
            propertyId: data.propertyId,
            dealerId: data.dealerId,
            role: data.role,
            dealType: data.dealType,
            dealAmount: data.dealAmount,
            stage: data.stage,
            status: data.status,
            probability: data.probability,
            commissionRate: data.commissionRate,
            dealDate: data.dealDate ? new Date(data.dealDate) : undefined,
            expectedClosingDate: data.expectedClosingDate ? new Date(data.expectedClosingDate) : undefined,
            notes: data.notes,
            createdBy: req.user?.id || '',
            manualUniqueId: manualUniqueId?.trim() || undefined,
        });
        // Fetch full deal with relations
        const fullDeal = await client_1.default.deal.findUnique({
            where: { id: deal.id },
            include: {
                client: true,
                dealer: true,
                property: true,
                dealProperties: {
                    include: { property: true },
                },
            },
        });
        await (0, audit_log_1.createAuditLog)({
            entityType: 'deal',
            entityId: deal.id,
            action: 'create',
            userId: req.user?.id,
            userName: req.user?.username,
            userRole: req.user?.role?.name,
            newValues: fullDeal,
            description: `Deal created: ${deal.title}`,
            req,
        });
        res.status(201).json(fullDeal);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: error.errors });
        }
        // Handle business logic errors
        if (error.message.includes('not found') || error.message.includes('inactive')) {
            return res.status(404).json({ error: error.message });
        }
        res.status(500).json({ error: error.message || 'Failed to create deal' });
    }
});
// Update deal stage (refactored to use DealService)
router.put('/deals/:id/stage', rbac_1.requireAuth, (0, rbac_1.requirePermission)('crm.deals.update'), async (req, res) => {
    try {
        const { stage, probability, notes } = req.body;
        const { DealService } = await Promise.resolve().then(() => __importStar(require('../services/deal-service')));
        const oldDeal = await client_1.default.deal.findUnique({ where: { id: req.params.id } });
        if (!oldDeal) {
            return res.status(404).json({ error: 'Deal not found' });
        }
        // STRICT DEAL SAFETY VALIDATION - Enforce stage-based restrictions
        const { DealSafetyService } = await Promise.resolve().then(() => __importStar(require('../services/deal-safety-service')));
        // Validate cancellation if stage is being set to closed-lost
        if (stage === 'closed-lost') {
            await DealSafetyService.validateCancellation({
                dealId: req.params.id,
                reason: notes,
            });
        }
        await DealSafetyService.validateStageChange({
            dealId: req.params.id,
            newStage: stage,
            currentStage: oldDeal.stage,
        });
        // Update stage using service
        const deal = await DealService.updateDealStage(req.params.id, stage, req.user?.id || '', notes, probability);
        // Update actual closing date if closed-won
        if (stage === 'closed-won' && oldDeal.stage !== 'closed-won') {
            await client_1.default.deal.update({
                where: { id: req.params.id },
                data: { actualClosingDate: new Date() },
            });
            // Auto-sync to Finance Ledger
            const { syncDealToFinanceLedger } = await Promise.resolve().then(() => __importStar(require('../services/workflows')));
            await syncDealToFinanceLedger(deal.id);
        }
        // Fetch full deal with relations
        const fullDeal = await client_1.default.deal.findUnique({
            where: { id: deal.id },
            include: {
                client: true,
                dealer: true,
                property: true,
            },
        });
        await (0, audit_log_1.createAuditLog)({
            entityType: 'deal',
            entityId: deal.id,
            action: 'update',
            userId: req.user?.id,
            userName: req.user?.username,
            userRole: req.user?.role?.name,
            oldValues: { stage: oldDeal.stage, probability: oldDeal.probability },
            newValues: { stage: deal.stage, probability: deal.probability },
            description: `Deal stage updated: ${oldDeal.stage} → ${stage}`,
            req,
        });
        res.json(fullDeal);
    }
    catch (error) {
        if (error.message?.includes('not found')) {
            return res.status(404).json({ error: error.message });
        }
        res.status(500).json({ error: error.message || 'Failed to update deal stage' });
    }
});
// ==================== COMMUNICATIONS ====================
// Get communications
router.get('/communications', rbac_1.requireAuth, (0, rbac_1.requirePermission)('crm.communications.view'), async (req, res) => {
    try {
        const { leadId, clientId, dealId, channel } = req.query;
        const where = { isDeleted: false };
        if (leadId)
            where.leadId = leadId;
        if (clientId)
            where.clientId = clientId;
        if (dealId)
            where.dealId = dealId;
        if (channel)
            where.channel = channel;
        const communications = await client_1.default.communication.findMany({
            where,
            include: {
                lead: { select: { id: true, name: true, leadCode: true } },
                client: { select: { id: true, name: true, clientCode: true } },
                deal: { select: { id: true, title: true, dealCode: true } },
                assignedAgent: { select: { id: true, username: true, email: true } },
            },
            orderBy: { activityDate: 'desc' },
        });
        res.json(communications);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Create communication
router.post('/communications', rbac_1.requireAuth, (0, rbac_1.requirePermission)('crm.communications.create'), async (req, res) => {
    try {
        const data = createCommunicationSchema.parse(req.body);
        const communication = await client_1.default.communication.create({
            data: {
                ...data,
                activityDate: data.activityDate ? new Date(data.activityDate) : new Date(),
                nextFollowUpDate: data.nextFollowUpDate ? new Date(data.nextFollowUpDate) : undefined,
                createdBy: req.user?.id,
            },
            include: {
                lead: true,
                client: true,
                deal: true,
                assignedAgent: true,
            },
        });
        // Update lead/client follow-up date if provided
        if (data.nextFollowUpDate) {
            if (data.leadId) {
                await client_1.default.lead.update({
                    where: { id: data.leadId },
                    data: { followUpDate: new Date(data.nextFollowUpDate) },
                });
            }
        }
        await (0, audit_log_1.createAuditLog)({
            entityType: 'communication',
            entityId: communication.id,
            action: 'create',
            userId: req.user?.id,
            userName: req.user?.username,
            userRole: req.user?.role?.name,
            newValues: communication,
            description: `Communication logged: ${communication.channel}`,
            req,
        });
        res.status(201).json(communication);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: error.errors });
        }
        res.status(500).json({ error: error.message });
    }
});
// ==================== DEALERS ====================
// Create dealer
router.post('/dealers', rbac_1.requireAuth, (0, rbac_1.requirePermission)('crm.dealers.create'), async (req, res) => {
    try {
        const { manualUniqueId, ...dealerData } = req.body;
        // Validate manual unique ID if provided
        if (manualUniqueId) {
            await (0, id_generation_service_1.validateManualUniqueId)(manualUniqueId, 'deal');
        }
        // Generate system ID: deal-YY-####
        const dealerCode = await generateDealerCode();
        const dealer = await client_1.default.$transaction(async (tx) => {
            return await tx.dealer.create({
                data: {
                    ...dealerData,
                    dealerCode,
                    manualUniqueId: manualUniqueId?.trim() || null,
                    createdBy: req.user?.id,
                },
            });
        });
        await (0, audit_log_1.createAuditLog)({
            entityType: 'dealer',
            entityId: dealer.id,
            action: 'create',
            userId: req.user?.id,
            userName: req.user?.username,
            userRole: req.user?.role?.name,
            newValues: dealer,
            description: `Dealer created: ${dealer.name}`,
            req,
        });
        res.status(201).json(dealer);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Upload CNIC for dealer
router.post('/dealers/:id/upload-cnic', rbac_1.requireAuth, (0, rbac_1.requirePermission)('crm.dealers.update'), upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        const fileUrl = await (0, attachments_1.saveUploadedFile)(req.file, 'dealer', req.params.id);
        await client_1.default.dealer.update({
            where: { id: req.params.id },
            data: { cnicImageUrl: fileUrl },
        });
        res.json({ fileUrl });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// ==================== FOLLOW-UP REMINDERS ====================
// Get follow-up reminders
router.get('/reminders', rbac_1.requireAuth, (0, rbac_1.requirePermission)('crm.view'), async (req, res) => {
    try {
        const { agentId } = req.query;
        const reminders = await (0, crm_alerts_1.getFollowUpReminders)(agentId);
        res.json(reminders);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Get overdue follow-ups
router.get('/reminders/overdue', rbac_1.requireAuth, (0, rbac_1.requirePermission)('crm.view'), async (req, res) => {
    try {
        const { agentId } = req.query;
        const overdue = await (0, crm_alerts_1.getOverdueFollowUps)(agentId);
        res.json(overdue);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Update deal (with auto-calculation)
router.put('/deals/:id', rbac_1.requireAuth, (0, rbac_1.requirePermission)('crm.deals.update'), async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = { ...req.body };
        const oldDeal = await client_1.default.deal.findUnique({ where: { id } });
        if (!oldDeal) {
            return res.status(404).json({ error: 'Deal not found' });
        }
        // Auto-calculate commission if value or commissionRate changed
        if (updateData.dealAmount !== undefined || updateData.commissionRate !== undefined) {
            const dealAmount = updateData.dealAmount !== undefined ? updateData.dealAmount : oldDeal.dealAmount;
            const commissionRate = updateData.commissionRate !== undefined ? updateData.commissionRate : oldDeal.commissionRate;
            if (oldDeal.dealerId && commissionRate > 0 && dealAmount > 0) {
                updateData.commissionAmount = (dealAmount * commissionRate) / 100;
            }
        }
        // Auto-calculate expected revenue if value or probability changed
        if (updateData.dealAmount !== undefined || updateData.probability !== undefined) {
            const value = updateData.dealAmount !== undefined ? updateData.dealAmount : oldDeal.dealAmount;
            const probability = updateData.probability !== undefined ? updateData.probability : oldDeal.probability;
            updateData.expectedRevenue = (value * probability) / 100;
        }
        // TID cannot be changed after creation
        if (updateData.tid !== undefined && updateData.tid !== oldDeal.tid) {
            return res.status(400).json({ error: 'TID cannot be changed after deal creation' });
        }
        const { tid, ...dataWithoutTid } = updateData;
        // STRICT DEAL SAFETY VALIDATION - Enforce commercial contract rules
        const { DealSafetyService } = await Promise.resolve().then(() => __importStar(require('../services/deal-safety-service')));
        // Validate cancellation if status/stage is being set to cancelled
        if (dataWithoutTid.status === 'cancelled' || dataWithoutTid.stage === 'closed-lost') {
            await DealSafetyService.validateCancellation({
                dealId: id,
                reason: dataWithoutTid.notes || dataWithoutTid.cancellationReason,
            });
        }
        await DealSafetyService.validateDealUpdate({
            dealId: id,
            clientId: dataWithoutTid.clientId,
            propertyId: dataWithoutTid.propertyId,
            dealAmount: dataWithoutTid.dealAmount,
            stage: dataWithoutTid.stage,
            status: dataWithoutTid.status,
        });
        // Handle date conversions
        if (dataWithoutTid.dealDate) {
            dataWithoutTid.dealDate = new Date(dataWithoutTid.dealDate);
        }
        if (dataWithoutTid.expectedClosingDate) {
            dataWithoutTid.expectedClosingDate = new Date(dataWithoutTid.expectedClosingDate);
        }
        if (dataWithoutTid.actualClosingDate) {
            dataWithoutTid.actualClosingDate = new Date(dataWithoutTid.actualClosingDate);
        }
        const deal = await client_1.default.deal.update({
            where: { id },
            data: {
                ...dataWithoutTid,
                updatedBy: req.user?.id,
            },
            include: {
                client: true,
                dealer: true,
                property: true,
                stageHistory: {
                    orderBy: { changedAt: 'desc' },
                    take: 5,
                },
            },
        });
        // Auto-sync to Finance Ledger if closed-won
        if (deal.stage === 'closed-won' && oldDeal.stage !== 'closed-won') {
            await (0, workflows_1.syncDealToFinanceLedger)(deal.id);
        }
        await (0, audit_log_1.createAuditLog)({
            entityType: 'deal',
            entityId: deal.id,
            action: 'update',
            userId: req.user?.id,
            userName: req.user?.username,
            userRole: req.user?.role?.name,
            newValues: deal,
            description: `Deal updated: ${deal.title}`,
            req,
        });
        res.json(deal);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: error.errors });
        }
        res.status(500).json({ error: error.message });
    }
});
// Client to Tenant conversion (enhanced)
router.post('/clients/:id/convert-to-tenant', rbac_1.requireAuth, (0, rbac_1.requirePermission)('crm.clients.update'), async (req, res) => {
    try {
        const { id } = req.params;
        const { unitId, leaseStart, leaseEnd, rent, securityDeposit } = req.body;
        if (!unitId) {
            return res.status(400).json({ error: 'Unit ID is required' });
        }
        const client = await client_1.default.client.findUnique({
            where: { id },
            include: {
                deals: {
                    where: { isDeleted: false, stage: { notIn: ['closed-lost'] } },
                },
            },
        });
        if (!client) {
            return res.status(404).json({ error: 'Client not found' });
        }
        // Check if already converted
        const existingTenant = await client_1.default.tenant.findFirst({
            where: {
                email: client.email,
                isDeleted: false,
            },
        });
        if (existingTenant) {
            return res.status(400).json({
                error: 'Client already converted to tenant',
                tenantId: existingTenant.id,
            });
        }
        // Verify unit
        const unit = await client_1.default.unit.findFirst({
            where: { id: unitId, isDeleted: false },
            include: {
                tenant: { where: { isDeleted: false } },
                property: true,
            },
        });
        if (!unit) {
            return res.status(404).json({ error: 'Unit not found' });
        }
        if (unit.tenant && Array.isArray(unit.tenant) && unit.tenant.length > 0) {
            return res.status(400).json({ error: 'Unit is already occupied' });
        }
        if (unit.tenant && !Array.isArray(unit.tenant)) {
            return res.status(400).json({ error: 'Unit is already occupied' });
        }
        // Generate tenant code
        const date = new Date();
        const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
        const random = Math.floor(1000 + Math.random() * 9000);
        const tenantCode = `TENANT-${dateStr}-${random}`;
        // Create tenant
        const tenant = await client_1.default.tenant.create({
            data: {
                name: client.name,
                email: client.email || undefined,
                phone: client.phone || undefined,
                address: client.address || undefined,
                cnic: client.cnic || undefined,
                cnicDocumentUrl: client.cnicDocumentUrl || undefined,
                tenantCode,
                unitId,
                outstandingBalance: 0,
                advanceBalance: 0,
                isActive: true,
            },
            include: {
                unit: {
                    include: {
                        property: true,
                        block: true,
                    },
                },
            },
        });
        // Update unit status
        await client_1.default.unit.update({
            where: { id: unitId },
            data: { status: 'Occupied' },
        });
        // Create lease if lease details provided
        let lease = null;
        if (leaseStart && leaseEnd && rent) {
            const leaseNumber = `LEASE-${dateStr}-${random}`;
            lease = await client_1.default.lease.create({
                data: {
                    leaseNumber,
                    tenantId: tenant.id,
                    unitId,
                    leaseStart: new Date(leaseStart),
                    leaseEnd: new Date(leaseEnd),
                    rent: Number(rent),
                    securityDeposit: securityDeposit ? Number(securityDeposit) : 0,
                    status: 'Active',
                },
            });
        }
        // Update client status
        await client_1.default.client.update({
            where: { id },
            data: {
                status: 'converted',
            },
        });
        // Link related deals to tenant
        if (client.deals && client.deals.length > 0) {
            await client_1.default.deal.updateMany({
                where: {
                    clientId: id,
                    isDeleted: false,
                },
                data: {
                // Link deals to tenant if needed
                },
            });
        }
        await (0, audit_log_1.createAuditLog)({
            entityType: 'client',
            entityId: client.id,
            action: 'update',
            userId: req.user?.id,
            userName: req.user?.username,
            userRole: req.user?.role?.name,
            description: `Client converted to tenant: ${tenant.name}`,
            metadata: { tenantId: tenant.id, leaseId: lease?.id },
            req,
        });
        res.status(201).json({
            success: true,
            message: 'Client converted to tenant successfully',
            data: {
                tenant,
                lease,
            },
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
//# sourceMappingURL=crm-enhanced.js.map