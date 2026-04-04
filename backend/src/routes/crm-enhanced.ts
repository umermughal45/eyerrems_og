/**
 * Enhanced CRM Module Routes
 * Includes: assignments, CNIC uploads, deal stage workflows, commission auto-calc
 */

import express, { Response } from 'express';
import { z } from 'zod';
import prisma from '../prisma/client';
import { requireAuth, AuthenticatedRequest, requirePermission } from '../middleware/rbac';
import { createAuditLog } from '../services/audit-log';
import { syncDealToFinanceLedger } from '../services/workflows';
import { getFollowUpReminders, getOverdueFollowUps } from '../services/crm-alerts';
import { createAttachment, saveUploadedFile } from '../services/attachments';
import { generateSystemId, validateManualUniqueId, validateTID } from '../services/id-generation-service';
import { applyListFilters } from '../utils/filter-helper';
import { applyListFilters as applyGlobalListFilters } from '../utils/global-filter-helper';
import { MODULE_CONFIGS } from '../services/unified-export-service';
import { calculatePagination } from '../utils/pagination';
import { ModuleFilterConfig } from '../services/global-filter-engine';
import multer from 'multer';
import logger from '../utils/logger';
import { UnifiedSearchService } from '../services/unified-search-service';
import { IdService } from '../utils/id-service';

const router = (express as any).Router();
const upload = multer({ storage: multer.memoryStorage() });

// Validation schemas
const createLeadSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  source: z.string().optional(),
  leadSourceDetails: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  score: z.number().int().min(0).max(100).optional(),
  interest: z.string().optional(),
  interestType: z.string().optional(),
  budget: z.string().optional(),
  budgetMin: z.number().optional(),
  budgetMax: z.number().optional(),
  expectedCloseDate: z.string().datetime().optional(),
  followUpDate: z.string().datetime().optional(),
  assignedToUserId: z.string().uuid().optional(),
  assignedDealerId: z.string().uuid().optional(),
  cnic: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  tid: z.string().min(1).optional(),
});

const createClientSchema = z.object({
  tid: z.string().min(1).optional(), // Transaction ID - unique across Property, Deal, Client
  name: z.string().min(1),
  email: z.string().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  status: z.string().optional(),
  address: z.string().optional(),
  cnic: z.string().optional(),
  billingAddress: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  postalCode: z.string().optional(),
  clientType: z.enum(['individual', 'corporate', 'government']).optional(),
  clientCategory: z.enum(['vip', 'regular', 'corporate', 'premium']).optional(),
  propertyInterest: z.string().optional(),
  locationId: z.string().uuid().nullable().optional(),
  assignedDealerId: z.string().uuid().optional(),
  assignedAgentId: z.string().uuid().optional(),
  manualUniqueId: z.string().optional(),
  attachments: z.any().optional(), // JSON field for notes and file attachments
  tags: z.array(z.string()).optional(), // JSON field for tags
});

const DEAL_ROLE_OPTIONS = ['buyer', 'seller', 'tenant', 'landlord', 'investor', 'partner'] as const;
const DEAL_STATUS_OPTIONS = ['open', 'in_progress', 'won', 'lost', 'cancelled'] as const;

const createDealSchema = z.object({
  manualUniqueId: z.string().optional(),
  tid: z.string().optional(), // Transaction ID - unique across Property, Deal, Client
  title: z.string().min(1),
  clientId: z.string().uuid(),
  propertyId: z.string().uuid(),
  dealerId: z.string().uuid().optional(),
  role: z.enum(DEAL_ROLE_OPTIONS).default('buyer'),
  dealType: z.enum(['rental', 'sale', 'investment']).optional(),
  dealAmount: z.number().positive(),
  stage: z.enum(['prospecting', 'qualified', 'proposal', 'negotiation', 'closing', 'closed-won', 'closed-lost']).default('prospecting'),
  status: z.enum(DEAL_STATUS_OPTIONS).default('open'),
  probability: z.number().int().min(0).max(100).default(50),
  commissionRate: z.number().nonnegative().default(0),
  dealDate: z.string().datetime().optional(),
  expectedClosingDate: z.string().datetime().optional(),
  notes: z.string().optional(),
});

const createCommunicationSchema = z.object({
  leadId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
  dealId: z.string().uuid().optional(),
  channel: z.enum(['email', 'phone', 'meeting', 'whatsapp', 'sms', 'message']),
  activityType: z.enum(['call', 'email', 'meeting', 'note', 'whatsapp', 'sms']).default('note'),
  subject: z.string().optional(),
  content: z.string().min(1),
  activityDate: z.string().datetime().optional(),
  nextFollowUpDate: z.string().datetime().optional(),
  assignedAgentId: z.string().uuid().optional(),
});

// Helper: Generate codes (now using centralized service)
// These functions are kept for backward compatibility but delegate to the centralized service
async function generateLeadCode(): Promise<string> {
  return await generateSystemId('lead');
}

async function generateClientCode(): Promise<string> {
  return await generateSystemId('cli');
}

async function generateDealerCode(): Promise<string> {
  return await generateSystemId('deal');
}

async function generateDealCode(): Promise<string> {
  return await generateSystemId('dl');
}

// Debug endpoint to test auth/permissions (remove in production)
router.get('/debug/auth', requireAuth, requirePermission('crm.clients.create'), async (req: AuthenticatedRequest, res: Response) => {
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
router.get('/leads', requireAuth, requirePermission('crm.leads.view'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const config = MODULE_CONFIGS.leads;
    if (!config?.filterConfig) {
      // Fallback to legacy filtering if filterConfig not available
      const { status, priority, assignedTo, followUpDate, search } = req.query;
      const where: any = { isDeleted: false };

      if (status) where.status = status;
      if (priority) where.priority = priority;
      if (assignedTo) where.assignedToUserId = assignedTo;
      if (followUpDate) {
        where.followUpDate = { lte: new Date(followUpDate as string) };
      }
      if (search) {
        where.OR = [
          { name: { contains: search as string, mode: 'insensitive' } },
          { email: { contains: search as string, mode: 'insensitive' } },
          { phone: { contains: search as string, mode: 'insensitive' } },
          { leadCode: { contains: search as string, mode: 'insensitive' } },
          { manualUniqueId: { contains: search as string, mode: 'insensitive' } },
        ];
      }

      const leads = await prisma.lead.findMany({
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
    const { where, orderBy, pagination } = await applyListFilters(req, config.filterConfig);

    // Get total count
    const total = await prisma.lead.count({ where });

    // Get paginated data
    const leads = await prisma.lead.findMany({
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

    const paginationResult = calculatePagination(pagination.page, pagination.limit, total);

    res.json({
      data: leads,
      pagination: paginationResult,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST endpoint for global filter engine (list with filters)
router.post('/leads', requireAuth, requirePermission('crm.leads.view'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Global filter configuration for leads
    const filterConfig: ModuleFilterConfig = {
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
    const { where, orderBy, pagination } = await applyGlobalListFilters(req, filterConfig);

    // Ensure where clause is properly formatted (remove any undefined/null values)
    const cleanWhere = JSON.parse(JSON.stringify(where || {}));

    // Get total count
    const total = await prisma.lead.count({ where: cleanWhere });

    // Get paginated data
    const leads = await prisma.lead.findMany({
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

    const paginationResult = calculatePagination(pagination.page, pagination.limit, total);

    res.json({
      success: true,
      data: leads,
      pagination: paginationResult,
    });
  } catch (error: any) {
    console.error('Error fetching leads:', error);
    logger.error('Error fetching leads:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
    });
    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
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
router.post('/leads/create', requireAuth, requirePermission('crm.leads.create'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsedData = createLeadSchema.parse(req.body);
    const { manualUniqueId, tid, ...data } = parsedData as any;

    // Validate manual unique ID if provided
    if (manualUniqueId) {
      await validateManualUniqueId(manualUniqueId, 'lead');
    }

    const leadTid = tid || await IdService.generateTID();
    await validateTID(leadTid);

    // Generate system ID: lead-YY-####
    const leadCode = await generateLeadCode();

    const lead = await prisma.$transaction(async (tx) => {
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

    await createAuditLog({
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
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
});

// Assign lead to employee
router.post('/leads/:id/assign', requireAuth, requirePermission('crm.leads.update'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { assignedToUserId } = req.body;
    
    const lead = await prisma.lead.update({
      where: { id: req.params.id },
      data: { assignedToUserId },
      include: { assignedAgent: true },
    });

    await createAuditLog({
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
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Upload CNIC for lead
router.post('/leads/:id/upload-cnic', requireAuth, requirePermission('crm.leads.update'), upload.single('file'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileUrl = await saveUploadedFile(req.file, 'lead', req.params.id);
    const attachment = await createAttachment({
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
    await prisma.lead.update({
      where: { id: req.params.id },
      data: {
        attachments: {
          push: {
            url: fileUrl,
            name: req.file.originalname,
            type: 'cnic',
          },
        },
      } as any,
    });

    res.json({ attachment, fileUrl });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Convert lead to client
router.post('/leads/:id/convert', requireAuth, requirePermission('crm.leads.update'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const lead = await prisma.lead.findUnique({ where: { id: req.params.id } });
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    // Preserve immutable lineage TID from lead
    const tid = lead.tid || await IdService.generateTID();

    const clientCode = await generateClientCode();
    const lastClient = await prisma.client.findFirst({ orderBy: { createdAt: 'desc' } });
    const nextSrNo = (lastClient?.srNo || 0) + 1;

    // Create client from lead
    const client = await prisma.client.create({
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
    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        status: 'converted',
        convertedToClientId: client.id,
        convertedAt: new Date(),
      },
    });

    await createAuditLog({
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
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== CLIENTS ====================

// Get all clients
router.get('/clients', requireAuth, requirePermission('crm.clients.view'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status, clientType, assignedAgent, search } = req.query;
    const where: any = { isDeleted: false };

    if (status) where.status = status;
    if (clientType) where.clientType = clientType;
    if (assignedAgent) where.assignedAgentId = assignedAgent;
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } },
        { phone: { contains: search as string, mode: 'insensitive' } },
        { clientCode: { contains: search as string, mode: 'insensitive' } },
        { manualUniqueId: { contains: search as string, mode: 'insensitive' } },
        // Note: tid search will be enabled after migration is applied
        // { tid: { contains: search as string, mode: 'insensitive' } },
        { cnic: { contains: search as string, mode: 'insensitive' } },
      ];
    }
    
    // Search by TID (Transaction ID) - searches across Property, Deal, Client
    // Note: This will be enabled after migration is applied
    // const { tid } = req.query;
    // if (tid) {
    //   where.tid = tid as string;
    // }

    const clients = await prisma.client.findMany({
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
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create client
router.post('/clients', requireAuth, requirePermission('crm.clients.create'), async (req: AuthenticatedRequest, res: Response) => {
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
    const { manualUniqueId, attachments, tid, ...data } = parsedData as any;

    // Validate manual unique ID if provided
    if (manualUniqueId) {
      await validateManualUniqueId(manualUniqueId, 'cli');
    }

    const clientTid = tid || await IdService.generateTID();
    await validateTID(clientTid);

    // Generate system ID: cli-YY-####
    const clientCode = await generateClientCode();
    const lastClient = await prisma.client.findFirst({ orderBy: { createdAt: 'desc' } });
    const nextSrNo = (lastClient?.srNo || 0) + 1;

    const client = await prisma.$transaction(async (tx) => {
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

    await createAuditLog({
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
  } catch (error: any) {
    console.error('❌ Client creation failed:', {
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      userId: req.user?.id,
      payloadKeys: Object.keys(req.body || {})
    });

    // Handle Zod validation errors (400)
    if (error instanceof z.ZodError) {
      const validationErrors = error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
        code: err.code,
        received: (err as any).received
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
router.post('/clients/:id/upload-cnic', requireAuth, requirePermission('crm.clients.update'), upload.single('file'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileUrl = await saveUploadedFile(req.file, 'client', req.params.id);
    const attachment = await createAttachment({
      fileName: req.file.originalname,
      fileUrl,
      fileType: req.file.mimetype,
      fileSize: req.file.size,
      entityType: 'client',
      entityId: req.params.id,
      uploadedBy: req.user?.id,
      description: 'CNIC Document',
    });

    await prisma.client.update({
      where: { id: req.params.id },
      data: { cnicDocumentUrl: fileUrl },
    });

    res.json({ attachment, fileUrl });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== GLOBAL TID SEARCH ====================

// Search by TID (Transaction ID) - returns the entire journey
router.get('/search/tid/:tid', requireAuth, requirePermission('crm.deals.view'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { tid } = req.params;
    
    if (!tid || tid.trim() === '') {
      return res.status(400).json({ error: 'TID is required' });
    }

    const result = await UnifiedSearchService.searchByTID(tid.trim());

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
  } catch (error: any) {
    logger.error('TID search error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Unified Ledger retrieval for Client, Property, Dealer
router.get('/ledgers/:type/:id', requireAuth, requirePermission('crm.deals.view'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { type, id } = req.params;
    
    if (!['CLIENT', 'PROPERTY', 'DEALER'].includes(type.toUpperCase())) {
      return res.status(400).json({ error: 'Invalid ledger type' });
    }

    const entries = await UnifiedSearchService.getLedger(type.toUpperCase() as any, id);

    res.json({
      success: true,
      data: entries,
    });
  } catch (error: any) {
    logger.error('Ledger retrieval error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== DEALS ====================

// Get all deals
router.get('/deals', requireAuth, requirePermission('crm.deals.view'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { stage, clientId, dealerId, propertyId, status, search, tid } = req.query;
    const where: any = { isDeleted: false, deletedAt: null };

    if (stage) where.stage = stage;
    if (clientId) where.clientId = clientId;
    if (dealerId) where.dealerId = dealerId;
    if (propertyId) where.propertyId = propertyId;
    if (status) where.status = status;
    
    // Search by TID (Transaction ID) - searches across Property, Deal, Client
    // Note: This will be enabled after migration is applied
    // if (tid) {
    //   where.tid = tid as string;
    // }
    
    // General search
    if (search) {
      where.OR = [
        { title: { contains: search as string, mode: 'insensitive' } },
        { dealCode: { contains: search as string, mode: 'insensitive' } },
        { manualUniqueId: { contains: search as string, mode: 'insensitive' } },
        // Note: tid search will be enabled after migration is applied
        // { tid: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const deals = await prisma.deal.findMany({
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
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create deal (refactored to use DealService)
router.post('/deals', requireAuth, requirePermission('crm.deals.create'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsedData = createDealSchema.parse(req.body);
    const { manualUniqueId, tid, ...data } = parsedData as any;
    
    // Validate TID - must be unique across Property, Deal, and Client
    if (tid) {
      await validateTID(tid.trim());
    }

    // Validate manual unique ID if provided
    if (manualUniqueId) {
      await validateManualUniqueId(manualUniqueId, 'dl');
    }

    // STRICT DEAL SAFETY VALIDATION - Enforce commercial contract rules
    const { DealSafetyService } = await import('../services/deal-safety-service');
    await DealSafetyService.validateDealCreation({
      clientId: data.clientId,
      propertyId: data.propertyId,
      dealAmount: data.dealAmount,
      stage: data.stage,
    });

    const { DealService } = await import('../services/deal-service');
    
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
    const fullDeal = await prisma.deal.findUnique({
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

    await createAuditLog({
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
  } catch (error: any) {
    if (error instanceof z.ZodError) {
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
router.put('/deals/:id/stage', requireAuth, requirePermission('crm.deals.update'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { stage, probability, notes } = req.body;
    const { DealService } = await import('../services/deal-service');
    
    const oldDeal = await prisma.deal.findUnique({ where: { id: req.params.id } });
    if (!oldDeal) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    // STRICT DEAL SAFETY VALIDATION - Enforce stage-based restrictions
    const { DealSafetyService } = await import('../services/deal-safety-service');
    
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
    const deal = await DealService.updateDealStage(
      req.params.id,
      stage,
      req.user?.id || '',
      notes,
      probability
    );

    // Update actual closing date if closed-won
    if (stage === 'closed-won' && oldDeal.stage !== 'closed-won') {
      await prisma.deal.update({
        where: { id: req.params.id },
        data: { actualClosingDate: new Date() },
      });
      
      // Auto-sync to Finance Ledger
      const { syncDealToFinanceLedger } = await import('../services/workflows');
      await syncDealToFinanceLedger(deal.id);
    }

    // Fetch full deal with relations
    const fullDeal = await prisma.deal.findUnique({
      where: { id: deal.id },
      include: {
        client: true,
        dealer: true,
        property: true,
      },
    });

    await createAuditLog({
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
  } catch (error: any) {
    if (error.message?.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message || 'Failed to update deal stage' });
  }
});

// ==================== COMMUNICATIONS ====================

// Get communications
router.get('/communications', requireAuth, requirePermission('crm.communications.view'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { leadId, clientId, dealId, channel } = req.query;
    const where: any = { isDeleted: false };

    if (leadId) where.leadId = leadId;
    if (clientId) where.clientId = clientId;
    if (dealId) where.dealId = dealId;
    if (channel) where.channel = channel;

    const communications = await prisma.communication.findMany({
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
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create communication
router.post('/communications', requireAuth, requirePermission('crm.communications.create'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = createCommunicationSchema.parse(req.body);

    const communication = await prisma.communication.create({
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
        await prisma.lead.update({
          where: { id: data.leadId },
          data: { followUpDate: new Date(data.nextFollowUpDate) },
        });
      }
    }

    await createAuditLog({
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
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
});

// ==================== DEALERS ====================

// Create dealer
router.post('/dealers', requireAuth, requirePermission('crm.dealers.create'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { manualUniqueId, ...dealerData } = req.body;

    // Validate manual unique ID if provided
    if (manualUniqueId) {
      await validateManualUniqueId(manualUniqueId, 'deal');
    }

    // Generate system ID: deal-YY-####
    const dealerCode = await generateDealerCode();

    const dealer = await prisma.$transaction(async (tx) => {
      return await tx.dealer.create({
        data: {
          ...dealerData,
          dealerCode,
          manualUniqueId: manualUniqueId?.trim() || null,
          createdBy: req.user?.id,
        },
      });
    });

    await createAuditLog({
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
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Upload CNIC for dealer
router.post('/dealers/:id/upload-cnic', requireAuth, requirePermission('crm.dealers.update'), upload.single('file'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileUrl = await saveUploadedFile(req.file, 'dealer', req.params.id);
    
    await prisma.dealer.update({
      where: { id: req.params.id },
      data: { cnicImageUrl: fileUrl },
    });

    res.json({ fileUrl });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== FOLLOW-UP REMINDERS ====================

// Get follow-up reminders
router.get('/reminders', requireAuth, requirePermission('crm.view'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { agentId } = req.query;
    const reminders = await getFollowUpReminders(agentId as string | undefined);
    res.json(reminders);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get overdue follow-ups
router.get('/reminders/overdue', requireAuth, requirePermission('crm.view'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { agentId } = req.query;
    const overdue = await getOverdueFollowUps(agentId as string | undefined);
    res.json(overdue);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update deal (with auto-calculation)
router.put('/deals/:id', requireAuth, requirePermission('crm.deals.update'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updateData: any = { ...req.body };

    const oldDeal = await prisma.deal.findUnique({ where: { id } });
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
    const { DealSafetyService } = await import('../services/deal-safety-service');
    
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

    const deal = await prisma.deal.update({
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
      await syncDealToFinanceLedger(deal.id);
    }

    await createAuditLog({
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
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
});

// Client to Tenant conversion (enhanced)
router.post('/clients/:id/convert-to-tenant', requireAuth, requirePermission('crm.clients.update'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { unitId, leaseStart, leaseEnd, rent, securityDeposit } = req.body;

    if (!unitId) {
      return res.status(400).json({ error: 'Unit ID is required' });
    }

    const client = await prisma.client.findUnique({
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
    const existingTenant = await prisma.tenant.findFirst({
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
    const unit = await prisma.unit.findFirst({
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
    const tenant = await prisma.tenant.create({
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
    await prisma.unit.update({
      where: { id: unitId },
      data: { status: 'Occupied' },
    });

    // Create lease if lease details provided
    let lease = null;
    if (leaseStart && leaseEnd && rent) {
      const leaseNumber = `LEASE-${dateStr}-${random}`;
      lease = await prisma.lease.create({
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
    await prisma.client.update({
      where: { id },
      data: {
        status: 'converted',
      },
    });

    // Link related deals to tenant
    if (client.deals && client.deals.length > 0) {
      await prisma.deal.updateMany({
        where: {
          clientId: id,
          isDeleted: false,
        },
        data: {
          // Link deals to tenant if needed
        },
      });
    }

    await createAuditLog({
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
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

