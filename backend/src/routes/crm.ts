import express, { Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import prisma from '../prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { createActivity } from '../utils/activity';
import logger from '../utils/logger';
import { generateSystemId, validateManualUniqueId, validateTID, generatePrefixedId } from '../services/id-generation-service';
import { generateSequenceNumber } from '../services/id-generation-service';
import { parsePaginationQuery, calculatePagination } from '../utils/pagination';
import { successResponse, errorResponse } from '../utils/error-handler';
import { IdService } from '../utils/id-service';
import { UnifiedSearchService } from '../services/unified-search-service';
import { TransactionIdentityEngine } from '../services/transactionIdentity.service';

const router = (express as any).Router();

const upload = multer({ storage: multer.memoryStorage() });

// Validation Schemas
const emptyToNull = (val: unknown) => (val === '' || val === 'null' || val === 'undefined' ? null : val);
const stringToNumber = (val: unknown) => (val === '' || val === null || val === undefined ? undefined : Number(val));
const stringToBoolean = (val: unknown) => (val === 'true' || val === true);

const createClientSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email().optional().nullable().or(z.literal('')),
  phone: z.string().optional().nullable(),
  company: z.string().optional().nullable(),
  status: z.string().default('active'),
  address: z.string().optional().nullable(),
  cnic: z.string().optional().nullable(),
  assignedAgentId: z.preprocess(emptyToNull, z.string().uuid().nullable().optional()),
  assignedDealerId: z.preprocess(emptyToNull, z.string().uuid().nullable().optional()),
  billingAddress: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  clientCategory: z.string().optional().nullable(),
  clientType: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  postalCode: z.string().optional().nullable(),
  propertyInterest: z.string().optional().nullable(),
  manualUniqueId: z.string().optional().nullable(),
  propertySubsidiary: z.string().optional().nullable(),
  tid: z.string().min(1).optional(),
});

const createDealerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email().optional().nullable().or(z.literal('')),
  phone: z.string().optional().nullable(),
  company: z.string().optional().nullable(),
  commissionRate: z.preprocess(stringToNumber, z.number().optional().default(0)),
  address: z.string().optional().nullable(),
  cnic: z.string().optional().nullable(),
  assignedRegion: z.string().optional().nullable(),
  bankAccountNumber: z.string().optional().nullable(),
  bankBranch: z.string().optional().nullable(),
  bankName: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  experienceYears: z.preprocess(stringToNumber, z.number().int().optional().default(0)),
  iban: z.string().optional().nullable(),
  isActive: z.preprocess(stringToBoolean, z.boolean().default(true)),
  notes: z.string().optional().nullable(),
  postalCode: z.string().optional().nullable(),
  qualifications: z.string().optional().nullable(),
  manualUniqueId: z.string().optional().nullable(),
  tid: z.string().min(1).optional(),
});

const createLeadSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email().optional().nullable().or(z.literal('')),
  phone: z.string().optional().nullable(),
  source: z.string().optional().nullable(),
  leadSourceDetails: z.string().optional().nullable(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  score: z.preprocess(stringToNumber, z.number().int().min(0).max(100).optional()),
  interest: z.string().optional().nullable(),
  interestType: z.string().optional().nullable(),
  budget: z.string().optional().nullable(),
  budgetMin: z.preprocess(stringToNumber, z.number().optional()),
  budgetMax: z.preprocess(stringToNumber, z.number().optional()),
  expectedCloseDate: z.string().datetime().optional().nullable(),
  followUpDate: z.string().datetime().optional().nullable(),
  assignedToUserId: z.preprocess(emptyToNull, z.string().uuid().nullable().optional()),
  assignedDealerId: z.preprocess(emptyToNull, z.string().uuid().nullable().optional()),
  cnic: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  manualUniqueId: z.string().optional().nullable(),
  tid: z.string().optional().nullable(),
  status: z.string().optional().default('new'),
  notes: z.string().optional().nullable(),
  temperature: z.enum(['cold', 'warm', 'hot']).optional().default('cold'),
});

// Leads
router.get('/leads', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit } = parsePaginationQuery(req.query);
    const skip = (page - 1) * limit;

    // Filter out soft-deleted records
    const where: any = { isDeleted: false };
    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.lead.count({ where }),
    ]);

    logger.info(`Fetching leads: total=${total}, returned=${leads.length}, page=${page}, limit=${limit}, where=${JSON.stringify(where)}`);

    const pagination = calculatePagination(page, limit, total);
    return successResponse(res, leads, 200, pagination);
  } catch (error) {
    return errorResponse(res, error);
  }
});

router.post('/leads', authenticate, upload.any(), async (req: AuthRequest, res: Response) => {
  try {
    logger.debug('Create lead request body:', JSON.stringify(req.body, null, 2));
    const parsedData = createLeadSchema.parse(req.body);
    const { manualUniqueId, tid: requestedTid, ...leadData } = parsedData;

    // Validate manual unique ID if provided
    if (manualUniqueId) {
      await validateManualUniqueId(manualUniqueId, 'lead');
    }

    // Handle TID - generate if missing
    let finalTid = requestedTid;
    if (!finalTid) {
      // Use TransactionIdentityEngine for global TID
      finalTid = await TransactionIdentityEngine.generateTransactionID();
    }

    // Validate TID (ensures uniqueness)
    await validateTID(finalTid);

    // Generate system ID: LDxxxx
    const leadCode = await IdService.generateEntityId('LD');

    const lead = await prisma.$transaction(async (tx) => {
      return await tx.lead.create({
        data: {
          ...leadData,
          leadCode,
          tid: finalTid,
          manualUniqueId: manualUniqueId?.trim() || null,
          createdBy: req.user?.id,
        }
      });
    });

    // Attach T-ID to Identity Engine Registry
    if (finalTid) {
      await TransactionIdentityEngine.attachTid(finalTid, 'lead', lead.id, 'CRM');
    }

    logger.info(`Lead created: ${lead.id}, name: ${lead.name}, isDeleted: ${lead.isDeleted}`);

    await createActivity({
      type: 'lead',
      action: 'created',
      entityId: lead.id,
      entityName: lead.name,
      message: `Lead "${lead.name}" was created`,
      userId: req.user?.id,
      metadata: {
        email: lead.email,
        phone: lead.phone,
        status: lead.status,
        source: lead.source,
      },
    });

    res.status(201).json(lead);
  } catch (error) {
    logger.error('Create lead error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    return errorResponse(res, error);
  }
});

// Convert lead to client (must be before any /leads/:id routes to avoid route conflict)
router.post('/leads/:id/convert', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const lead = await prisma.lead.findUnique({ where: { id: req.params.id } });

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    if (lead.convertedToClientId) {
      return res.status(400).json({ error: 'Lead has already been converted to a client' });
    }

    // Inherit TID from Lead (Do NOT generate a new T-ID)
    let tid = lead.tid;
    
    // If for some reason the lead has no tid (backward compatibility), generate one
    if (!tid) {
      tid = await TransactionIdentityEngine.generateTransactionID();
    }

    // Generate system ID: CLxxxx
    const clientCode = await IdService.generateEntityId('CL');

    // Get next srNo and clientNo using sequence (keeping legacy fields for now)
    const srNo = await generateSequenceNumber('CLI_SR');
    const nextClientNo = `CL-${String(srNo).padStart(4, '0')}`;

    // Create client from lead
    const client = await prisma.$transaction(async (tx) => {
      return await tx.client.create({
        data: {
          name: lead.name,
          email: lead.email,
          phone: lead.phone,
          clientCode,
          tid,
          srNo,
          clientNo: nextClientNo,
          address: lead.address,
          city: lead.city,
          country: lead.country,
          cnic: lead.cnic,
          propertyInterest: lead.interest,
          clientType: 'individual',
          clientCategory: 'regular',
          status: 'active',
          convertedFromLeadId: lead.id,
        },
      });
    });

    // Attach T-ID to Identity Engine Registry
    if (tid) {
      await TransactionIdentityEngine.attachTid(tid, 'client', client.id, 'CRM');
    }

    // Update lead status
    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        status: 'converted',
        convertedToClientId: client.id,
        convertedAt: new Date(),
      },
    });

    await createActivity({
      type: 'lead',
      action: 'updated',
      entityId: lead.id,
      entityName: lead.name,
      message: `Lead "${lead.name}" was converted to client`,
      userId: req.user?.id,
      metadata: {
        clientId: client.id,
        clientName: client.name,
        status: 'converted',
      },
    });

    await createActivity({
      type: 'client',
      action: 'created',
      entityId: client.id,
      entityName: client.name,
      message: `Client "${client.name}" was created from lead`,
      userId: req.user?.id,
      metadata: {
        leadId: lead.id,
        convertedFromLead: true,
        status: client.status,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Lead converted to client successfully',
      data: client,
    });
  } catch (error: any) {
    logger.error('Convert lead to client error:', error);
    return errorResponse(res, error, 500, {
      error: 'Failed to convert lead to client',
    });
  }
});

router.put('/leads/:id', authenticate, upload.any(), async (req: AuthRequest, res: Response) => {
  try {
    logger.debug(`Update lead ${req.params.id} request body:`, JSON.stringify(req.body, null, 2));
    const parsedData = createLeadSchema.partial().parse(req.body);
    const { manualUniqueId, ...updateData } = parsedData;

    // Validate manual unique ID if provided and changed
    if (manualUniqueId) {
      const currentLead = await prisma.lead.findUnique({ where: { id: req.params.id } });
      if (currentLead && currentLead.manualUniqueId !== manualUniqueId) {
        await validateManualUniqueId(manualUniqueId, 'lead');
      }
    }

    const lead = await prisma.lead.update({
      where: { id: req.params.id },
      data: {
        ...updateData,
        manualUniqueId: manualUniqueId === undefined ? undefined : (manualUniqueId?.trim() || null),
      },
    });

    await createActivity({
      type: 'lead',
      action: 'updated',
      entityId: lead.id,
      entityName: lead.name,
      message: `Lead "${lead.name}" was updated`,
      userId: req.user?.id,
      metadata: {
        status: lead.status,
        email: lead.email,
        phone: lead.phone,
        source: lead.source,
      },
    });

    res.json(lead);
  } catch (error) {
    logger.error('Update lead error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    return errorResponse(res, error);
  }
});

router.get('/leads/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const lead = await prisma.lead.findUnique({ where: { id: req.params.id } });
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    res.json(lead);
  } catch (error) {
    return errorResponse(res, error);
  }
});

router.delete('/leads/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    // Soft delete - move to recycle bin instead of permanent deletion
    const lead = await prisma.lead.findUnique({ where: { id: req.params.id } });
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const { softDeleteRecord } = await import('../services/soft-delete-service');
    await softDeleteRecord({
      entityType: 'lead',
      entityId: lead.id,
      entityName: lead.name,
      deletedBy: req.user?.id,
      deletedByName: req.user?.username,
    });

    await createActivity({
      type: 'lead',
      action: 'deleted',
      entityId: lead.id,
      entityName: lead.name,
      message: `Lead "${lead.name}" was moved to recycle bin`,
      userId: req.user?.id,
      metadata: {
        status: lead.status,
        email: lead.email,
        phone: lead.phone,
        source: lead.source,
      },
    });

    res.status(204).end();
  } catch (error: any) {
    logger.error('Failed to delete lead:', error);
    return errorResponse(res, error);
  }
});

// Clients
router.get('/clients', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { search, status, clientType } = req.query;
    const { page, limit } = parsePaginationQuery(req.query);
    const skip = (page - 1) * limit;

    // Filter out soft-deleted records
    const where: any = { isDeleted: false };

    if (status) {
      const statuses = Array.isArray(status) ? status : [status];
      where.status = statuses.length === 1 ? statuses[0] : { in: statuses };
    }
    if (clientType) {
      const types = Array.isArray(clientType) ? clientType : [clientType];
      where.clientType = types.length === 1 ? types[0] : { in: types };
    }

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } },
        { phone: { contains: search as string, mode: 'insensitive' } },
        { clientCode: { contains: search as string, mode: 'insensitive' } },
        { clientNo: { contains: search as string, mode: 'insensitive' } },
        { cnic: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.client.count({ where }),
    ]);

    const pagination = calculatePagination(page, limit, total);
    return successResponse(res, clients, 200, pagination);
  } catch (error: any) {
    logger.error('Failed to fetch clients:', {
      error: error?.message || error,
      code: error?.code,
      meta: error?.meta,
      stack: error?.stack,
      query: req.query,
    });
    return errorResponse(res, error);
  }
});

router.get('/clients/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const client = await prisma.client.findUnique({
      where: { id: req.params.id },
      include: {
        deals: {
          orderBy: { createdAt: 'desc' },
          include: {
            dealer: true,
          },
        },
        communications: {
          orderBy: { createdAt: 'desc' },
          include: {
            lead: true,
          },
        },
      },
    });

    if (!client) return res.status(404).json({ error: 'Client not found' });
    res.json(client);
  } catch (error) {
    logger.error('Failed to fetch client by id:', error);
    return errorResponse(res, error);
  }
});

router.post('/clients', authenticate, upload.any(), async (req: AuthRequest, res: Response) => {
  try {
    logger.debug('Create client request body:', JSON.stringify(req.body, null, 2));
    const parsedData = createClientSchema.parse(req.body);
    const { manualUniqueId, tid, ...clientData } = parsedData;

    // Validate manual unique ID if provided (optional, consistent with other routes)
    if (manualUniqueId) {
      await validateManualUniqueId(manualUniqueId, 'cli');
    }

    // Generate TID if not provided
    const clientTid = tid || await IdService.generateTID();

    // Generate system ID: CLxxxx
    const clientCode = await IdService.generateEntityId('CL');

    // Get next srNo and clientNo (legacy)
    const lastClient = await prisma.client.findFirst({
      orderBy: { createdAt: 'desc' },
    });
    const nextSrNo = lastClient?.srNo ? (lastClient.srNo + 1) : 1;
    const nextClientNo = `CL-${String(nextSrNo).padStart(4, '0')}`;

    const client = await prisma.$transaction(async (tx) => {
      return await tx.client.create({
        data: {
          ...clientData,
          manualUniqueId: manualUniqueId?.trim() || null,
          clientCode,
          tid: clientTid,
          srNo: nextSrNo,
          clientNo: nextClientNo,
          status: clientData.status || 'active',
          isDeleted: false,
          createdBy: req.user?.id,
        }
      });
    });

    await createActivity({
      type: 'client',
      action: 'created',
      entityId: client.id,
      entityName: client.name,
      message: `Client "${client.name}" was added`,
      userId: req.user?.id,
      metadata: {
        status: client.status,
        email: client.email,
        phone: client.phone,
        company: client.company,
      },
    });

    res.status(201).json(client);
  } catch (error) {
    logger.error('Create client error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    return errorResponse(res, error);
  }
});

router.put('/clients/:id', authenticate, upload.any(), async (req: AuthRequest, res: Response) => {
  try {
    logger.debug('Update client request body:', JSON.stringify(req.body, null, 2));
    const oldClient = await prisma.client.findUnique({
      where: { id: req.params.id },
    });

    if (!oldClient) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const { attachments, ...bodyData } = req.body;
    const parsedData = createClientSchema.partial().parse(bodyData);

    // TID cannot be changed after creation
    if (parsedData.tid !== undefined && parsedData.tid !== oldClient.tid) {
      return res.status(400).json({ error: 'TID cannot be changed after client creation' });
    }

    const { tid, manualUniqueId, ...updateData } = parsedData;

    // Validate manual unique ID if changed
    if (manualUniqueId !== undefined && manualUniqueId !== oldClient.manualUniqueId) {
      if (manualUniqueId) {
        await validateManualUniqueId(manualUniqueId, 'cli');
      }
    }

    const client = await prisma.client.update({
      where: { id: req.params.id },
      data: {
        ...updateData,
        manualUniqueId: manualUniqueId === undefined ? undefined : (manualUniqueId?.trim() || null),
        attachments: attachments || undefined,
      },
    });

    await createActivity({
      type: 'client',
      action: 'updated',
      entityId: client.id,
      entityName: client.name,
      message: `Client "${client.name}" was updated`,
      userId: req.user?.id,
      metadata: {
        status: client.status,
        email: client.email,
        phone: client.phone,
        company: client.company,
      },
    });

    res.json(client);
  } catch (error) {
    logger.error('Update client error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    return errorResponse(res, error);
  }
});

router.delete('/clients/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    // Soft delete - move to recycle bin instead of permanent deletion
    const client = await prisma.client.findUnique({ where: { id: req.params.id } });
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const { softDeleteRecord } = await import('../services/soft-delete-service');
    await softDeleteRecord({
      entityType: 'client',
      entityId: client.id,
      entityName: client.name,
      deletedBy: req.user?.id,
      deletedByName: req.user?.username,
    });

    await createActivity({
      type: 'client',
      action: 'deleted',
      entityId: client.id,
      entityName: client.name,
      message: `Client "${client.name}" was moved to recycle bin`,
      userId: req.user?.id,
      metadata: {
        status: client.status,
        email: client.email,
        phone: client.phone,
        company: client.company,
      },
    });

    res.status(204).end();
  } catch (error: any) {
    logger.error('Failed to delete client:', error);
    return errorResponse(res, error);
  }
});

// Dealers
router.get('/dealers', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { search, isActive } = req.query;
    const { page, limit } = parsePaginationQuery(req.query);
    const skip = (page - 1) * limit;

    const where: any = { isDeleted: false };

    if (isActive !== undefined && isActive !== '') {
      const val = Array.isArray(isActive) ? isActive[0] : isActive;
      where.isActive = String(val).toLowerCase() === 'true';
    }

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } },
        { phone: { contains: search as string, mode: 'insensitive' } },
        { dealerCode: { contains: search as string, mode: 'insensitive' } },
        { manualUniqueId: { contains: search as string, mode: 'insensitive' } },
        { cnic: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const [dealers, total] = await Promise.all([
      prisma.dealer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.dealer.count({ where }),
    ]);

    logger.info(`Fetching dealers: total=${total}, returned=${dealers.length}, page=${page}, limit=${limit}, where=${JSON.stringify(where)}`);

    const pagination = calculatePagination(page, limit, total);
    return successResponse(res, dealers, 200, pagination);
  } catch (error: any) {
    logger.error('Failed to fetch dealers:', error);
    return errorResponse(res, error);
  }
});

router.get('/dealers/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const dealer = await prisma.dealer.findUnique({ where: { id: req.params.id } });
    if (!dealer) return res.status(404).json({ error: 'Dealer not found' });
    res.json(dealer);
  } catch (error) {
    return errorResponse(res, error);
  }
});

router.post('/dealers', authenticate, upload.any(), async (req: AuthRequest, res: Response) => {
  try {
    logger.debug('Create dealer request body:', JSON.stringify(req.body, null, 2));
    const parsedData = createDealerSchema.parse(req.body);
    const { manualUniqueId, tid, ...dealerData } = parsedData;

    // Validate manual unique ID if provided
    if (manualUniqueId) {
      await validateManualUniqueId(manualUniqueId, 'deal');
    }

    const dealerTid = tid || await IdService.generateTID();
    await validateTID(dealerTid);

    // Generate system ID: deal-YY-####
    const dealerCode = await IdService.generateEntityId('DL');

    const dealer = await prisma.$transaction(async (tx) => {
      return await tx.dealer.create({
        data: {
          ...dealerData,
          dealerCode,
          tid: dealerTid,
          manualUniqueId: manualUniqueId?.trim() || null,
          createdBy: req.user?.id,
        }
      });
    });

    logger.info(`Dealer created: ${dealer.id}, name: ${dealer.name}, isDeleted: ${dealer.isDeleted}`);

    await createActivity({
      type: 'dealer',
      action: 'created',
      entityId: dealer.id,
      entityName: dealer.name,
      message: `Dealer "${dealer.name}" was added`,
      userId: req.user?.id,
      metadata: {
        email: dealer.email,
        phone: dealer.phone,
        company: dealer.company,
        commissionRate: (dealer as any).commissionRate,
      },
    });

    res.status(201).json(dealer);
  } catch (error) {
    logger.error('Create dealer error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    return errorResponse(res, error);
  }
});

router.put('/dealers/:id', authenticate, upload.any(), async (req: AuthRequest, res: Response) => {
  try {
    logger.debug('Update dealer request body:', JSON.stringify(req.body, null, 2));
    const parsedData = createDealerSchema.partial().parse(req.body);
    const { manualUniqueId, ...updateData } = parsedData;

    // Validate manual unique ID if provided and changed
    if (manualUniqueId) {
      const currentDealer = await prisma.dealer.findUnique({ where: { id: req.params.id } });
      if (currentDealer && currentDealer.manualUniqueId !== manualUniqueId) {
        await validateManualUniqueId(manualUniqueId, 'deal');
      }
    }

    const dealer = await prisma.dealer.update({
      where: { id: req.params.id },
      data: {
        ...updateData,
        manualUniqueId: manualUniqueId === undefined ? undefined : (manualUniqueId?.trim() || null),
      },
    });

    await createActivity({
      type: 'dealer',
      action: 'updated',
      entityId: dealer.id,
      entityName: dealer.name,
      message: `Dealer "${dealer.name}" was updated`,
      userId: req.user?.id,
      metadata: {
        email: dealer.email,
        phone: dealer.phone,
        company: dealer.company,
        commissionRate: (dealer as any).commissionRate,
      },
    });

    res.json(dealer);
  } catch (error) {
    logger.error('Update dealer error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    return errorResponse(res, error);
  }
});

router.delete('/dealers/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    // Soft delete - move to recycle bin instead of permanent deletion
    const dealer = await prisma.dealer.findUnique({ where: { id: req.params.id } });
    if (!dealer) {
      return res.status(404).json({ error: 'Dealer not found' });
    }

    const { softDeleteRecord } = await import('../services/soft-delete-service');
    await softDeleteRecord({
      entityType: 'dealer',
      entityId: dealer.id,
      entityName: dealer.name,
      deletedBy: req.user?.id,
      deletedByName: req.user?.username,
    });

    await createActivity({
      type: 'dealer',
      action: 'deleted',
      entityId: dealer.id,
      entityName: dealer.name,
      message: `Dealer "${dealer.name}" was moved to recycle bin`,
      userId: req.user?.id,
      metadata: {
        email: dealer.email,
        phone: dealer.phone,
        company: dealer.company,
        commissionRate: (dealer as any).commissionRate,
      },
    });

    res.status(204).end();
  } catch (error: any) {
    logger.error('Failed to delete dealer:', error);
    return errorResponse(res, error);
  }
});

// Deals
router.get('/deals', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit } = parsePaginationQuery(req.query);
    const skip = (page - 1) * limit;
    const { includeDeleted, search, stage, status, dealType } = req.query;

    // Show all deals by default, filter deleted only if explicitly requested
    const where: any = includeDeleted === 'true' ? {} : { isDeleted: false };

    if (stage) {
      const stages = Array.isArray(stage) ? stage : [stage];
      where.stage = stages.length === 1 ? stages[0] : { in: stages };
    }
    if (status) {
      const statuses = Array.isArray(status) ? status : [status];
      where.status = statuses.length === 1 ? statuses[0] : { in: statuses };
    }
    if (dealType) {
      const types = Array.isArray(dealType) ? dealType : [dealType];
      where.dealType = types.length === 1 ? types[0] : { in: types };
    }

    // Add search filter if provided
    if (search && typeof search === 'string' && search.trim()) {
      const searchTerm = search.trim();
      where.OR = [
        { title: { contains: searchTerm, mode: 'insensitive' } },
        { tid: { contains: searchTerm, mode: 'insensitive' } },
        { dealCode: { contains: searchTerm, mode: 'insensitive' } },
        { client: { name: { contains: searchTerm, mode: 'insensitive' } } },
      ];
    }

    const [deals, total] = await Promise.all([
      prisma.deal.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          client: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              clientCode: true,
              status: true,
            },
          },
          dealer: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              dealerCode: true,
              isActive: true,
            },
          },
          property: {
            select: {
              id: true,
              name: true,
              tid: true,
              propertyCode: true,
            },
          },
        },
      }),
      prisma.deal.count({ where }),
    ]);

    const pagination = calculatePagination(page, limit, total);
    return successResponse(res, deals, 200, pagination);
  } catch (error: any) {
    logger.error('Error fetching deals:', error);
    logger.error('Error details:', {
      message: error?.message,
      code: error?.code,
      meta: error?.meta,
      stack: error?.stack,
    });
    return errorResponse(res, error);
  }
});

/**
 * Get ledger entries for a specific deal
 * @route GET /api/crm/deals/:id/ledger
 * @access Private
 */
router.get('/deals/:id/ledger', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const deal = await prisma.deal.findUnique({
      where: { id },
      select: { id: true, dealCode: true, title: true, clientId: true, propertyId: true },
    });

    if (!deal) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    // Get all ledger entries for this deal
    const ledgerEntries = await prisma.ledgerEntry.findMany({
      where: {
        dealId: id,
        deletedAt: null,
      },
      include: {
        payment: {
          select: {
            id: true,
            paymentId: true,
            amount: true,
            paymentType: true,
            paymentMode: true,
            referenceNumber: true,
            date: true,
            remarks: true,
          },
        },
        debitAccount: {
          select: { id: true, name: true, code: true },
        },
        creditAccount: {
          select: { id: true, name: true, code: true },
        },
        deal: {
          select: {
            id: true,
            dealCode: true,
            title: true,
            client: { select: { id: true, name: true, clientCode: true } },
            property: { select: { id: true, name: true, propertyCode: true } },
          },
        },
      },
      orderBy: { date: 'desc' },
    });

    // Format entries for response
    const formattedEntries = ledgerEntries.map((entry) => ({
      id: entry.id,
      date: entry.date,
      amount: entry.amount,
      remarks: entry.remarks,
      debitAccount: entry.debitAccount ? {
        id: entry.debitAccount.id,
        name: entry.debitAccount.name,
        code: entry.debitAccount.code,
      } : null,
      creditAccount: entry.creditAccount ? {
        id: entry.creditAccount.id,
        name: entry.creditAccount.name,
        code: entry.creditAccount.code,
      } : null,
      payment: entry.payment ? {
        id: entry.payment.id,
        paymentId: entry.payment.paymentId,
        amount: entry.payment.amount,
        paymentType: entry.payment.paymentType,
        paymentMode: entry.payment.paymentMode,
        referenceNumber: entry.payment.referenceNumber,
        date: entry.payment.date,
        remarks: entry.payment.remarks,
      } : null,
      deal: {
        id: entry.deal.id,
        dealCode: entry.deal.dealCode,
        title: entry.deal.title,
        client: entry.deal.client,
        property: entry.deal.property,
      },
    }));

    res.json({
      success: true,
      data: {
        deal,
        entries: formattedEntries,
        summary: {
          totalEntries: formattedEntries.length,
          totalDebit: formattedEntries
            .filter((e) => e.debitAccount)
            .reduce((sum, e) => sum + e.amount, 0),
          totalCredit: formattedEntries
            .filter((e) => e.creditAccount)
            .reduce((sum, e) => sum + e.amount, 0),
        },
      },
    });
  } catch (error: any) {
    logger.error('Get deal ledger error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get deal ledger',
    });
  }
});

router.get('/deals/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const deal = await prisma.deal.findUnique({
      where: { id: req.params.id },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            clientCode: true,
            status: true,
            tid: true,
          },
        },
        dealer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            company: true,
            tid: true,
          },
        },
        property: {
          select: {
            id: true,
            name: true,
            tid: true,
            address: true,
            city: true,
          },
        },
        paymentPlan: {
          include: {
            installments: {
              where: { isDeleted: false },
              orderBy: { installmentNumber: 'asc' },
            },
          },
        },
        payments: {
          where: { deletedAt: null },
          orderBy: { date: 'desc' },
          include: {
            createdBy: {
              select: {
                id: true,
                username: true,
                email: true,
              },
            },
          },
        },
        ledgerEntries: {
          where: { deletedAt: null },
          orderBy: { date: 'desc' },
          take: 20,
        },
      },
    });
    
    if (!deal) {
      return res.status(404).json({ 
        success: false,
        error: 'Deal not found' 
      });
    }

    // Get attachments from Attachment table
    const attachments = await prisma.attachment.findMany({
      where: {
        entityType: 'deal',
        entityId: deal.id,
        isDeleted: false,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        property: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Calculate financial summary
    const payments = deal.payments || [];
    const totalPaid = payments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
    const dealAmount = deal.dealAmount || 0;
    const remainingBalance = Math.max(0, dealAmount - totalPaid);
    const completionPercentage = dealAmount > 0 ? (totalPaid / dealAmount) * 100 : 0;

    // Payment plan summary
    let paymentPlanSummary = null;
    if (deal.paymentPlan) {
      const plan = deal.paymentPlan;
      const totalExpected = plan.totalExpected || plan.totalAmount || 0;
      const totalPaidPlan = plan.totalPaid || 0;
      const remainingPlan = plan.remaining || (totalExpected - totalPaidPlan);
      const installments = plan.installments || [];
      const paidInstallments = installments.filter((i: any) => i.status === 'paid' || i.status === 'Paid').length;
      const pendingInstallments = installments.filter((i: any) => i.status === 'pending' || i.status === 'Pending' || i.status === 'unpaid').length;
      const overdueInstallments = installments.filter((i: any) => {
        if (i.status === 'overdue' || i.status === 'Overdue') return true;
        if (i.status === 'pending' || i.status === 'Pending' || i.status === 'unpaid') {
          return new Date(i.dueDate) < new Date();
        }
        return false;
      }).length;

      paymentPlanSummary = {
        id: plan.id,
        totalExpected,
        totalPaid: totalPaidPlan,
        remaining: remainingPlan,
        status: plan.status || 'Pending',
        numberOfInstallments: plan.numberOfInstallments || installments.length,
        paidInstallments,
        pendingInstallments,
        overdueInstallments,
        downPayment: plan.downPayment || 0,
        startDate: plan.startDate,
        installments: installments.map((i: any) => ({
          id: i.id,
          installmentNumber: i.installmentNumber,
          amount: i.amount,
          dueDate: i.dueDate,
          paidDate: i.paidDate,
          status: i.status,
          paidAmount: i.paidAmount || 0,
          remaining: i.remaining || 0,
          paymentMode: i.paymentMode,
          notes: i.notes,
        })),
      };
    }

    // Financial summary
    const financialSummary = {
      dealAmount,
      totalPaid,
      remainingBalance,
      completionPercentage: Math.min(100, Math.max(0, completionPercentage)),
      isCompleted: remainingBalance <= 0.01,
      commissionRate: deal.commissionRate || 0,
      commissionAmount: deal.commissionAmount || 0,
      totalPayments: payments.length,
      lastPaymentDate: payments.length > 0 ? payments[0].date : null,
    };

    res.json({
      success: true,
      data: {
        ...deal,
        attachments,
        financialSummary,
        paymentPlanSummary,
      },
    });
  } catch (error: any) {
    logger.error('Get deal error:', error);
    return errorResponse(res, error);
  }
});

// Global TID search across lead -> client -> deal -> payment -> ledger journey
router.get('/search/tid/:tid', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { tid } = req.params;
    if (!tid || !tid.trim()) {
      return res.status(400).json({ error: 'TID is required' });
    }

    const result = await UnifiedSearchService.searchByTID(tid.trim());
    if (!result) {
      return res.status(404).json({
        error: 'No records found with this TID',
        message: `No business journey found with TID: ${tid}`,
      });
    }

    return res.json({
      success: true,
      data: result,
      message: `Transaction journey found for TID: ${tid}`,
    });
  } catch (error: any) {
    logger.error('TID search error:', error);
    return errorResponse(res, error);
  }
});

// ==================== DEAL PAYMENT PLAN ROUTES ====================

// GET /api/crm/deals/:id/payment-plan
router.get('/deals/:id/payment-plan', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const dealId = req.params.id;

    // Load deal with all necessary data
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            clientCode: true,
            status: true,
          },
        },
        dealer: true,
        property: {
          select: { id: true, name: true, propertyCode: true },
        },
      },
    });

    if (!deal) {
      return res.status(404).json({ success: false, error: 'Deal not found' });
    }

    // Get payment plan if exists
    const { PaymentPlanService } = await import('../services/payment-plan-service');
    const plan = await PaymentPlanService.getPaymentPlanByDealId(dealId);

    const dealAmount = deal.dealAmount || 0;

    // Calculate summary from installments (not from Payment table)
    // Downpayment is NOT auto-paid - only count if finance entry exists
    let paidAmount = 0;
    let remainingAmount = dealAmount;
    let progress = 0;
    let downPayment = 0;
    let downPaymentPaid = 0;

    if (plan && plan.installments && plan.installments.length > 0) {
      // Get down payment amount from payment plan
      const paymentPlan = await prisma.paymentPlan.findUnique({
        where: { id: plan.id },
        select: { downPayment: true },
      });
      downPayment = paymentPlan?.downPayment || 0;

      // Calculate paid amount from installments only (exclude down payment installment)
      const installmentPaidAmount = plan.installments
        .filter((inst: any) => inst.type !== 'down_payment')
        .reduce((sum: number, inst: any) => sum + (inst.paidAmount || 0), 0);

      // Check if down payment has been paid via finance entry (receipt or payment record)
      if (downPayment > 0) {
        // Check for receipts linked to this deal with allocations to down payment installment
        const downPaymentInstallment = plan.installments.find((inst: any) => inst.type === 'down_payment');
        if (downPaymentInstallment) {
          const receipts = await prisma.dealReceipt.findMany({
            where: {
              dealId: dealId,
            },
            include: {
              allocations: {
                where: {
                  installmentId: downPaymentInstallment.id,
                },
              },
            },
          });

          // Calculate down payment paid from receipt allocations
          const receiptDownPaymentPaid = receipts.reduce((sum: number, receipt) => {
            const allocatedToDownPayment = receipt.allocations.reduce(
              (allocSum: number, alloc) => allocSum + (alloc.amountAllocated || 0),
              0
            );
            return sum + allocatedToDownPayment;
          }, 0);

          // Also check payment records for down payment
          const payments = await prisma.payment.findMany({
            where: {
              dealId: dealId,
              deletedAt: null,
            },
          });

          const paymentDownPaymentPaid = payments.reduce((sum: number, payment) => {
            // Check if payment is allocated to down payment installment
            if (payment.installmentId === downPaymentInstallment.id) {
              return sum + (payment.amount || 0);
            }
            // Also check remarks for down payment
            const remarks = (payment.remarks || '').toLowerCase();
            if (remarks.includes('down payment') || remarks.includes('downpayment')) {
              return sum + (payment.amount || 0);
            }
            return sum;
          }, 0);

          downPaymentPaid = receiptDownPaymentPaid + paymentDownPaymentPaid;
        }
      }

      // Total paid = installments paid + down payment paid (only if finance entry exists)
      paidAmount = installmentPaidAmount + downPaymentPaid;

      remainingAmount = Math.max(0, dealAmount - paidAmount);
      progress = dealAmount > 0 ? (paidAmount / dealAmount) * 100 : 0;
    }

    // Calculate installment summary if plan exists
    let installmentSummary = null;
    if (plan) {
      const installments = plan.installments || [];
      const installmentTotal = installments.reduce((sum: number, inst: any) => sum + (inst.amount || 0), 0);
      const installmentPaid = installments.reduce((sum: number, inst: any) => sum + (inst.paidAmount || 0), 0);

      installmentSummary = {
        totalInstallments: installments.length,
        paidInstallments: installments.filter((inst: any) => inst.status === 'paid').length,
        unpaidInstallments: installments.length - installments.filter((inst: any) => inst.status === 'paid').length,
        overdueInstallments: installments.filter(
          (inst: any) => (inst.status === 'unpaid' || inst.status === 'overdue') && new Date(inst.dueDate) < new Date()
        ).length,
        installmentTotal,
        installmentPaid,
      };
    }

    // Build response with correct summary calculated from installments
    const response = {
      dealId: deal.id,
      totalAmount: dealAmount,
      paidAmount: Math.round(paidAmount * 100) / 100,
      remainingAmount: Math.round(remainingAmount * 100) / 100,
      progress: Math.round(progress * 100) / 100,
      deal: {
        id: deal.id,
        dealCode: deal.dealCode,
        title: deal.title,
        dealAmount: dealAmount,
        client: deal.client,
        dealer: deal.dealer,
        property: deal.property,
      },
      paymentPlan: plan || null,
      summary: {
        totalAmount: dealAmount,
        paidAmount: Math.round(paidAmount * 100) / 100,
        remainingAmount: Math.round(remainingAmount * 100) / 100,
        progress: Math.round(progress * 100) / 100,
        status: remainingAmount <= 0.01 ? 'Fully Paid' : paidAmount > 0 ? 'Partially Paid' : 'Pending',
        downPayment: downPayment,
        downPaymentPaid: downPaymentPaid,
      },
      installments: plan?.installments || [],
      installmentSummary: installmentSummary,
    };

    res.json({ success: true, data: response });
  } catch (error: any) {
    logger.error('Get payment plan error:', error);
    return errorResponse(res, error, 500, {
      success: false,
      error: error.message || 'Failed to get payment plan',
    });
  }
});

// GET /api/crm/deals/:id/payment-plan/pdf - Generate PDF report
router.get('/deals/:id/payment-plan/pdf', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const dealId = req.params.id;
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/7293d0cd-bbb9-40ce-87ee-9763b81d9a43', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'crm.ts:1022', message: 'PDF endpoint entry', data: { dealId }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'A' }) }).catch(() => { });
    // #endregion

    // Load deal with all necessary data
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            clientCode: true,
            status: true,
          },
        },
        dealer: true,
        property: {
          select: { id: true, name: true, propertyCode: true },
        },
      },
    });
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/7293d0cd-bbb9-40ce-87ee-9763b81d9a43', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'crm.ts:1044', message: 'After deal query', data: { dealFound: !!deal, dealId: deal?.id, dealTitle: deal?.title, hasClient: !!deal?.client, hasDealer: !!deal?.dealer, hasProperty: !!deal?.property }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'A' }) }).catch(() => { });
    // #endregion

    if (!deal) {
      return res.status(404).json({ success: false, error: 'Deal not found' });
    }

    // Get payment plan if exists
    const { PaymentPlanService } = await import('../services/payment-plan-service');
    const plan = await PaymentPlanService.getPaymentPlanByDealId(dealId);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/7293d0cd-bbb9-40ce-87ee-9763b81d9a43', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'crm.ts:1051', message: 'After payment plan query', data: { planFound: !!plan, planId: plan?.id, installmentsCount: plan?.installments?.length || 0, installmentsType: typeof plan?.installments }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'B' }) }).catch(() => { });
    // #endregion

    // Calculate paid amount from installments only (down payment is NOT auto-paid)
    const dealAmount = deal.dealAmount || 0;
    let totalPaid = 0;
    let downPayment = 0;
    let downPaymentPaid = 0;

    if (plan) {
      // Get down payment from payment plan
      const paymentPlan = await prisma.paymentPlan.findUnique({
        where: { id: plan.id },
        select: { downPayment: true },
      });
      downPayment = paymentPlan?.downPayment || 0;
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/7293d0cd-bbb9-40ce-87ee-9763b81d9a43', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'crm.ts:1065', message: 'After paymentPlan query', data: { planId: plan.id, downPayment, paymentPlanFound: !!paymentPlan }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'C' }) }).catch(() => { });
      // #endregion

      // Calculate paid amount from installments only (exclude down payment installment)
      const installmentPaidAmount = (plan.installments || [])
        .filter((inst: any) => inst.type !== 'down_payment') // Exclude down payment installment
        .reduce((sum: number, inst: any) => sum + (inst.paidAmount || 0), 0);

      // Check if down payment has been paid via finance entry (receipt or payment record)
      // Down payment is only considered paid if there's an actual finance entry
      if (downPayment > 0) {
        // Get down payment installment IDs
        const downPaymentInstallmentIds = (plan.installments || [])
          .filter((inst: any) => inst.type === 'down_payment')
          .map((inst: any) => inst.id);

        // Check for receipts linked to this deal
        const receipts = await prisma.dealReceipt.findMany({
          where: {
            dealId: dealId,
          },
          include: {
            allocations: downPaymentInstallmentIds.length > 0 ? {
              where: {
                installmentId: {
                  in: downPaymentInstallmentIds,
                },
              },
            } : false,
          },
        });
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/7293d0cd-bbb9-40ce-87ee-9763b81d9a43', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'crm.ts:1091', message: 'After receipts query', data: { receiptsCount: receipts.length }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'C' }) }).catch(() => { });
        // #endregion

        // Check for payment records linked to this deal
        const payments = await prisma.payment.findMany({
          where: {
            dealId: dealId,
            deletedAt: null,
          },
        });
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/7293d0cd-bbb9-40ce-87ee-9763b81d9a43', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'crm.ts:1099', message: 'After payments query', data: { paymentsCount: payments.length }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'C' }) }).catch(() => { });
        // #endregion

        // Calculate down payment paid amount from actual finance entries
        const receiptDownPaymentPaid = receipts.reduce((sum: number, receipt) => {
          const allocatedToDownPayment = receipt.allocations.reduce(
            (allocSum: number, alloc) => allocSum + (alloc.amountAllocated || 0),
            0
          );
          return sum + allocatedToDownPayment;
        }, 0);

        // Also check if any payment record is specifically for down payment
        const paymentDownPaymentPaid = payments.reduce((sum: number, payment) => {
          // If payment remarks or description mentions down payment, include it
          const remarks = (payment.remarks || '').toLowerCase();
          if (remarks.includes('down payment') || remarks.includes('downpayment')) {
            return sum + (payment.amount || 0);
          }
          return sum;
        }, 0);

        downPaymentPaid = receiptDownPaymentPaid + paymentDownPaymentPaid;
      }

      // Total paid = installments paid + down payment paid (only if finance entry exists)
      totalPaid = installmentPaidAmount + downPaymentPaid;
    } else {
      // If no payment plan, calculate from Payment table as fallback
      const payments = await prisma.payment.findMany({
        where: {
          dealId: dealId,
          deletedAt: null,
        },
        select: {
          amount: true,
        },
      });
      totalPaid = payments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
    }
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/7293d0cd-bbb9-40ce-87ee-9763b81d9a43', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'crm.ts:1137', message: 'After payment calculations', data: { totalPaid, downPayment, downPaymentPaid, dealAmount }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'D' }) }).catch(() => { });
    // #endregion

    const remainingAmount = Math.max(0, dealAmount - totalPaid);
    const progress = dealAmount > 0 ? (totalPaid / dealAmount) * 100 : 0;

    // Prepare data for PDF
    const pdfData = {
      deal: {
        dealCode: deal.dealCode || undefined,
        title: deal.title,
        dealAmount: dealAmount,
        client: deal.client ? {
          name: deal.client.name,
          email: deal.client.email || undefined,
          phone: deal.client.phone || undefined,
        } : undefined,
        dealer: deal.dealer ? {
          name: deal.dealer.name,
        } : undefined,
        property: deal.property ? {
          name: deal.property.name,
          propertyCode: deal.property.propertyCode || undefined,
        } : undefined,
      },
      summary: {
        totalAmount: dealAmount,
        paidAmount: totalPaid,
        remainingAmount: remainingAmount,
        progress: Math.round(progress * 100) / 100,
        status: remainingAmount <= 0.01 ? 'Fully Paid' : totalPaid > 0 ? 'Partially Paid' : 'Pending',
        downPayment: downPayment, // Down payment amount (planned)
        downPaymentPaid: downPaymentPaid, // Down payment actually paid via finance entries
      },
      installments: (plan?.installments || []).map((inst: any) => ({
        installmentNumber: inst.installmentNumber,
        amount: inst.amount,
        dueDate: inst.dueDate,
        paidAmount: inst.paidAmount || 0,
        status: inst.status,
        paymentMode: inst.paymentMode,
        notes: inst.notes,
      })),
      generatedAt: new Date(),
    };
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/7293d0cd-bbb9-40ce-87ee-9763b81d9a43', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'crm.ts:1180', message: 'Before PDF generation', data: { pdfDataDealTitle: pdfData.deal.title, installmentsCount: pdfData.installments.length, hasSummary: !!pdfData.summary, summaryStatus: pdfData.summary.status }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'D' }) }).catch(() => { });
    // #endregion

    // Generate PDF
    const { generatePaymentPlanPDF } = await import('../utils/pdf-generator');
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/7293d0cd-bbb9-40ce-87ee-9763b81d9a43', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'crm.ts:1184', message: 'Calling generatePaymentPlanPDF', data: { headersSent: res.headersSent }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'E' }) }).catch(() => { });
    // #endregion
    try {
      generatePaymentPlanPDF(pdfData, res);
    } catch (pdfError: any) {
      console.error('PDF generation error:', pdfError);
      throw pdfError; // Re-throw to be caught by outer catch
    }
  } catch (error: any) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/7293d0cd-bbb9-40ce-87ee-9763b81d9a43', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'crm.ts:1186', message: 'Error caught', data: { errorMessage: error?.message, errorStack: error?.stack?.substring(0, 500), errorName: error?.name, headersSent: res.headersSent }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'F' }) }).catch(() => { });
    // #endregion
    console.error('Generate PDF error:', error);
    logger.error('Generate PDF error:', error);
    if (!res.headersSent) {
      return errorResponse(res, error, 500, {
        success: false,
        error: error.message || 'Failed to generate PDF',
      });
    }
  }
});

// POST /api/crm/deals/:id/payment-plan
router.post('/deals/:id/payment-plan', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { PaymentPlanService } = await import('../services/payment-plan-service');

    // Get deal to extract clientId and dealAmount
    const deal = await prisma.deal.findUnique({
      where: { id: req.params.id },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            clientCode: true,
            status: true,
          },
        },
      },
    });

    if (!deal) {
      return res.status(404).json({ success: false, error: 'Deal not found' });
    }

    if (!deal.clientId) {
      return res.status(400).json({ success: false, error: 'Deal must have a client assigned' });
    }

    const plan = await PaymentPlanService.createPaymentPlan({
      dealId: req.params.id,
      clientId: deal.clientId,
      numberOfInstallments: req.body.numberOfInstallments,
      totalAmount: req.body.totalAmount || deal.dealAmount,
      startDate: new Date(req.body.startDate),
      installmentType: req.body.installmentType || 'monthly',
      downPayment: req.body.downPayment || 0,
      installmentAmounts: req.body.installmentAmounts,
      dueDates: req.body.dueDates?.map((d: string) => new Date(d)),
      paymentModes: req.body.paymentModes,
      notes: req.body.notes,
    });

    res.json({ success: true, data: plan });
  } catch (error: any) {
    logger.error('Create payment plan error:', error);
    return errorResponse(res, error, 400, {
      success: false,
      error: error.message || 'Failed to create payment plan',
    });
  }
});

// PUT /api/crm/payment-plan/:id
router.put('/payment-plan/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { PaymentPlanService } = await import('../services/payment-plan-service');

    // Get payment plan to find dealId
    const plan = await prisma.paymentPlan.findUnique({
      where: { id: req.params.id },
    });

    if (!plan) {
      return res.status(404).json({ success: false, error: 'Payment plan not found' });
    }

    // Update installments if provided
    if (req.body.installments && Array.isArray(req.body.installments)) {
      for (const inst of req.body.installments) {
        if (inst.id) {
          await PaymentPlanService.updateInstallment(inst.id, {
            amount: inst.amount,
            dueDate: inst.dueDate ? new Date(inst.dueDate) : undefined,
            paymentMode: inst.paymentMode,
            notes: inst.notes,
          });
        }
      }
    }

    // Recalculate payment plan
    const updatedPlan = await PaymentPlanService.recalculatePaymentPlan(plan.dealId);

    res.json({ success: true, data: updatedPlan });
  } catch (error: any) {
    logger.error('Update payment plan error:', error);
    return errorResponse(res, error, 400, {
      success: false,
      error: error.message || 'Failed to update payment plan',
    });
  }
});

// POST /api/crm/deals/:id/payments
router.post('/deals/:id/payments', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    // STRICT ACCOUNTING VALIDATION - Enforce deal payment safety rules
    const { AccountingSafetyService } = await import('../services/accounting-safety-service');
    await AccountingSafetyService.validateDealPayment({
      dealId: req.params.id,
      amount: req.body.amount,
      paymentType: req.body.paymentType,
    });

    const { PaymentService } = await import('../services/payment-service');
    const { PaymentPlanService } = await import('../services/payment-plan-service');

    const deal = await prisma.deal.findUnique({
      where: { id: req.params.id },
    });

    if (!deal) {
      return res.status(404).json({ success: false, error: 'Deal not found' });
    }

    // Create payment
    const payment = await PaymentService.createPayment({
      dealId: req.params.id,
      amount: req.body.amount,
      paymentType: req.body.paymentType || 'installment',
      paymentMode: req.body.paymentMode || 'cash',
      transactionId: req.body.transactionId,
      referenceNumber: req.body.referenceNumber,
      date: req.body.date ? new Date(req.body.date) : new Date(),
      remarks: req.body.remarks,
      createdBy: req.user?.id || '',
      installmentId: req.body.installmentId, // Link to specific installment if provided
    });

    // Sync payment plan if it exists
    if (req.body.installmentId) {
      await PaymentPlanService.syncPaymentPlanAfterPayment(
        req.params.id,
        req.body.amount,
        req.body.installmentId
      );
    } else {
      // If no specific installment, sync anyway to update totals
      await PaymentPlanService.syncPaymentPlanAfterPayment(req.params.id, req.body.amount);
    }

    res.json({ success: true, data: payment });
  } catch (error: any) {
    logger.error('Create payment error:', error);
    return errorResponse(res, error, 400, {
      success: false,
      error: error.message || 'Failed to create payment',
    });
  }
});

// PATCH /api/crm/deals/:dealId/payments/smart-allocate
router.patch('/deals/:dealId/payments/smart-allocate', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const dealId = req.params.dealId;
    const { amount, method } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Payment amount must be greater than 0',
      });
    }

    if (!method || !['cash', 'bank', 'other'].includes(method)) {
      return res.status(400).json({
        success: false,
        error: 'Payment method must be one of: cash, bank, other',
      });
    }

    const { PaymentPlanService } = await import('../services/payment-plan-service');

    const result = await PaymentPlanService.smartAllocatePayment(
      dealId,
      amount,
      method,
      new Date(),
      req.user?.id || ''
    );

    // Create audit log
    const { createAuditLog } = await import('../services/audit-log');
    await createAuditLog({
      entityType: 'payment',
      entityId: dealId,
      action: 'create',
      userId: req.user?.id,
      userName: req.user?.username,
      newValues: result,
      description: `Smart payment allocation: ${result.paymentApplied} applied${result.excessIgnored > 0 ? `, ${result.excessIgnored} excess ignored` : ''}`,
      req,
    });

    res.json({
      success: true,
      paymentApplied: result.paymentApplied,
      excessIgnored: result.excessIgnored,
      updatedInstallments: result.updatedInstallments,
      summary: result.summary,
      dealClosed: result.dealClosed,
      message: result.excessIgnored > 0
        ? `Payment applied: ${result.paymentApplied}. Excess amount (${result.excessIgnored}) ignored.`
        : `Payment of ${result.paymentApplied} successfully allocated across installments.`,
    });
  } catch (error: any) {
    logger.error('Smart allocation error:', error);
    return errorResponse(res, error, 400, {
      success: false,
      error: error.message || 'Failed to allocate payment',
    });
  }
});

router.post('/deals', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    // STRICT DEAL SAFETY VALIDATION - Enforce commercial contract rules
    const { DealSafetyService } = await import('../services/deal-safety-service');
    await DealSafetyService.validateDealCreation({
      clientId: req.body.clientId,
      propertyId: req.body.propertyId,
      dealAmount: req.body.dealAmount,
      stage: req.body.stage,
    });

    const { DealService } = await import('../services/deal-service');

    const deal = await DealService.createDeal({
      ...req.body,
      createdBy: req.user?.id || '',
    });

    await createActivity({
      type: 'deal',
      action: 'created',
      entityId: deal.id,
      entityName: deal.title,
      message: `Deal "${deal.title}" was created`,
      userId: req.user?.id,
      metadata: {
        value: deal.dealAmount,
        stage: deal.stage,
        clientId: deal.clientId,
        dealerId: deal.dealerId,
      },
    });

    res.status(201).json(deal);
  } catch (error: any) {
    logger.error('Create deal error:', error);
    return errorResponse(res, error, 400, { error: error.message || 'Failed to create deal' });
  }
});

router.put('/deals/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    // STRICT DEAL SAFETY VALIDATION - Enforce commercial contract rules
    const { DealSafetyService } = await import('../services/deal-safety-service');
    
    // Validate cancellation if status/stage is being set to cancelled
    if (req.body.status === 'cancelled' || req.body.stage === 'closed-lost') {
      await DealSafetyService.validateCancellation({
        dealId: req.params.id,
        reason: req.body.cancellationReason || req.body.notes,
      });
    }
    
    // Validate update
    await DealSafetyService.validateDealUpdate({
      dealId: req.params.id,
      clientId: req.body.clientId,
      propertyId: req.body.propertyId,
      dealAmount: req.body.dealAmount,
      stage: req.body.stage,
      status: req.body.status,
    });

    const { DealService } = await import('../services/deal-service');

    const deal = await DealService.updateDeal(req.params.id, {
      ...req.body,
      updatedBy: req.user?.id || '',
    });

    const updatedDeal = await prisma.deal.findUnique({
      where: { id: req.params.id },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            clientCode: true,
            status: true,
            // #region agent log
            // clientCode and status added for frontend compatibility
            // #endregion
          },
        },
        dealer: true,
      },
    });

    await createActivity({
      type: 'deal',
      action: 'updated',
      entityId: deal.id,
      entityName: deal.title,
      message: `Deal "${deal.title}" was updated`,
      userId: req.user?.id,
      metadata: {
        value: deal.dealAmount,
        stage: deal.stage,
        clientId: deal.clientId,
        dealerId: deal.dealerId,
      },
    });

    res.json(updatedDeal || deal);
  } catch (error) {
    return errorResponse(res, error);
  }
});

router.delete('/deals/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    // Soft delete - move to recycle bin instead of permanent deletion
    const deal = await prisma.deal.findUnique({
      where: { id: req.params.id },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            clientCode: true,
            status: true,
          },
        },
        dealer: true,
      },
    });

    if (!deal) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    const { softDeleteRecord } = await import('../services/soft-delete-service');
    await softDeleteRecord({
      entityType: 'deal',
      entityId: deal.id,
      entityName: deal.title,
      deletedBy: req.user?.id,
      deletedByName: req.user?.username,
    });

    await createActivity({
      type: 'deal',
      action: 'deleted',
      entityId: deal.id,
      entityName: deal.title,
      message: `Deal "${deal.title}" was moved to recycle bin`,
      userId: req.user?.id,
      metadata: {
        value: deal.dealAmount,
        stage: deal.stage,
        clientId: deal.clientId,
        dealerId: deal.dealerId,
      },
    });

    res.status(204).end();
  } catch (error: any) {
    logger.error('Failed to delete deal:', error);
    return errorResponse(res, error);
  }
});

// Communications
router.get('/communications', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit } = parsePaginationQuery(req.query);
    const skip = (page - 1) * limit;

    const where: any = {};
    const [communications, total] = await Promise.all([
      prisma.communication.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          client: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              clientCode: true,
              status: true,
            },
          },
          lead: true,
        },
        skip,
        take: limit,
      }),
      prisma.communication.count({ where }),
    ]);

    const pagination = calculatePagination(page, limit, total);
    return successResponse(res, communications, 200, pagination);
  } catch (error) {
    return errorResponse(res, error);
  }
});

router.get('/communications/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const item = await prisma.communication.findUnique({ where: { id: req.params.id } });
    if (!item) return res.status(404).json({ error: 'Communication not found' });
    res.json(item);
  } catch (error) {
    return errorResponse(res, error);
  }
});

router.post('/communications', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { leadId, clientId, dealId, assignedAgentId, ...rest } = req.body;
    // Whitelist only valid Communication scalar fields to prevent Prisma "Unknown argument" errors
    const COMM_SCALAR_FIELDS = new Set([
      'channel', 'content', 'activityDate', 'activityOutcome', 'activityType',
      'attachments', 'contactPersonId', 'contactPersonName', 'createdBy',
      'isDeleted', 'nextFollowUpDate', 'recurrence', 'recurrenceEndDate',
      'reminderDate', 'reminderEnabled', 'subject', 'tags', 'voiceNoteUrl',
    ]);
    const safeRest = Object.fromEntries(
      Object.entries(rest).filter(([key]) => COMM_SCALAR_FIELDS.has(key))
    );
    const item = await prisma.communication.create({
      data: {
        ...safeRest,
        ...(leadId ? { lead: { connect: { id: leadId } } } : {}),
        ...(clientId ? { client: { connect: { id: clientId } } } : {}),
        ...(dealId ? { deal: { connect: { id: dealId } } } : {}),
        ...(assignedAgentId ? { assignedAgent: { connect: { id: assignedAgentId } } } : {}),
      } as any,
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            clientCode: true,
            status: true,
          },
        },
        lead: true,
      },
    });

    await createActivity({
      type: 'communication',
      action: 'created',
      entityId: item.id,
      entityName: item.channel,
      message: `Communication logged via ${item.channel}`,
      userId: req.user?.id,
      metadata: {
        clientId: item.clientId,
        leadId: item.leadId,
        channel: item.channel,
      },
    });

    res.status(201).json(item);
  } catch (error) {
    return errorResponse(res, error);
  }
});

router.put('/communications/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { leadId, clientId, dealId, assignedAgentId, ...rest } = req.body;
    // Whitelist only valid Communication scalar fields
    const COMM_SCALAR_FIELDS = new Set([
      'channel', 'content', 'activityDate', 'activityOutcome', 'activityType',
      'attachments', 'contactPersonId', 'contactPersonName', 'createdBy',
      'isDeleted', 'nextFollowUpDate', 'recurrence', 'recurrenceEndDate',
      'reminderDate', 'reminderEnabled', 'subject', 'tags', 'voiceNoteUrl',
    ]);
    const safeRest = Object.fromEntries(
      Object.entries(rest).filter(([key]) => COMM_SCALAR_FIELDS.has(key))
    );
    const item = await prisma.communication.update({
      where: { id: req.params.id },
      data: {
        ...safeRest,
        ...(leadId !== undefined ? { lead: leadId ? { connect: { id: leadId } } : { disconnect: true } } : {}),
        ...(clientId !== undefined ? { client: clientId ? { connect: { id: clientId } } : { disconnect: true } } : {}),
        ...(dealId !== undefined ? { deal: dealId ? { connect: { id: dealId } } : { disconnect: true } } : {}),
        ...(assignedAgentId !== undefined ? { assignedAgent: assignedAgentId ? { connect: { id: assignedAgentId } } : { disconnect: true } } : {}),
      } as any,
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            clientCode: true,
            status: true,
          },
        },
        lead: true,
      },
    });

    await createActivity({
      type: 'communication',
      action: 'updated',
      entityId: item.id,
      entityName: item.channel,
      message: `Communication via ${item.channel} was updated`,
      userId: req.user?.id,
      metadata: {
        clientId: item.clientId,
        leadId: item.leadId,
        channel: item.channel,
      },
    });

    res.json(item);
  } catch (error) {
    return errorResponse(res, error);
  }
});

router.delete('/communications/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const item = await prisma.communication.delete({
      where: { id: req.params.id },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            clientCode: true,
            status: true,
          },
        },
        lead: true,
      },
    });

    await createActivity({
      type: 'communication',
      action: 'deleted',
      entityId: item.id,
      entityName: item.channel,
      message: `Communication via ${item.channel} was deleted`,
      userId: req.user?.id,
      metadata: {
        clientId: item.clientId,
        leadId: item.leadId,
        channel: item.channel,
      },
    });

    res.status(204).end();
  } catch (error) {
    return errorResponse(res, error);
  }
});

export default router;


