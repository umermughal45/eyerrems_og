/**
 * CRM Transaction Routes
 * Provides TID-based transaction lookup and search.
 * Mounted at /api/transactions-crm
 *
 * IMPORTANT: Static routes must be declared BEFORE dynamic /:tid route.
 */
import express, { Response } from 'express';
import prisma from '../prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { UnifiedSearchService } from '../services/unified-search-service';
import { TransactionIdentityEngine } from '../services/transactionIdentity.service';
import { successResponse, errorResponse } from '../utils/error-handler';
import logger from '../utils/logger';

const router = (express as any).Router();

/**
 * Generate a new TID (for use in forms before submission)
 * GET /api/transactions-crm/generate/tid
 * MUST be before /:tid to avoid route conflict
 */
router.get('/generate/tid', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const tid = await TransactionIdentityEngine.generateTransactionID();
    return successResponse(res, { tid });
  } catch (error) {
    logger.error('Generate TID error:', error);
    return errorResponse(res, error);
  }
});

/**
 * Get the TID for a specific client (used by deal creation form to auto-link TID)
 * GET /api/transactions-crm/client/:clientId/tid
 */
router.get('/client/:clientId/tid', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { clientId } = req.params;

    if (!clientId) {
      return res.status(400).json({ success: false, error: 'clientId is required' });
    }

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, tid: true, clientCode: true, name: true },
    });

    if (!client) {
      return res.status(404).json({ success: false, error: 'Client not found' });
    }

    return successResponse(res, {
      clientId: client.id,
      clientCode: client.clientCode,
      clientName: client.name,
      tid: client.tid,
    });
  } catch (error) {
    logger.error('Get client TID error:', error);
    return errorResponse(res, error);
  }
});

/**
 * Search transaction by TID, lead code, or client code
 * GET /api/transactions-crm/search?tid=TRX-2026-000001
 * GET /api/transactions-crm/search?tid=LD-0001
 * GET /api/transactions-crm/search?tid=CLI-0001
 */
router.get('/search', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { tid } = req.query;

    if (!tid || typeof tid !== 'string' || !tid.trim()) {
      return res.status(400).json({ success: false, error: 'TID query parameter is required' });
    }

    const result = await UnifiedSearchService.searchByTID(tid.trim());

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'No transaction found',
        message: `No records found for TID: ${tid}`,
      });
    }

    return successResponse(res, result);
  } catch (error) {
    logger.error('Transaction search error:', error);
    return errorResponse(res, error);
  }
});

/**
 * Get full transaction details by TID (or lead code / client code)
 * GET /api/transactions-crm/:tid
 */
router.get('/:tid', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { tid } = req.params;

    if (!tid || !tid.trim()) {
      return res.status(400).json({ success: false, error: 'TID is required' });
    }

    const result = await UnifiedSearchService.searchByTID(tid.trim());

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found',
        message: `No transaction found with TID: ${tid}`,
      });
    }

    return successResponse(res, result);
  } catch (error) {
    logger.error('Get transaction error:', error);
    return errorResponse(res, error);
  }
});

export default router;
