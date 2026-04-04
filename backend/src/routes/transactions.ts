import express, { Response } from 'express';
import { authenticate } from '../middleware/auth';
import prisma from '../prisma/client';
import { errorResponse, successResponse } from '../utils/error-handler';
import logger from '../utils/logger';
import { TransactionIdentityEngine } from '../services/transactionIdentity.service';

const router = express.Router();

/**
 * Get all entities associated with a specific Transaction ID
 * @route GET /api/transactions/:tid
 */
router.get('/:tid', authenticate, async (req: any, res: Response) => {
  try {
    const { tid } = req.params;

    if (!tid) {
      return res.status(400).json({ success: false, error: 'Transaction ID is required' });
    }

    const registryEntries = await prisma.transactionIdentityRegistry.findMany({
      where: { tid },
      orderBy: { createdAt: 'asc' },
    });

    if (!registryEntries || registryEntries.length === 0) {
      return res.status(404).json({ success: false, error: 'Transaction ID not found' });
    }

    // Enhance entries with basic entity details for the timeline
    const enhancedEntries = await Promise.all(
      registryEntries.map(async (entry: any) => {
        let details = null;
        let url = '';

        try {
          switch (entry.entityType) {
            case 'lead':
              const lead = await prisma.lead.findUnique({ where: { id: entry.entityId }, select: { name: true, status: true, id: true } });
              details = lead;
              url = `/crm/leads`; // Generic path, UI handles modal
              break;
            case 'client':
              const client = await prisma.client.findUnique({ where: { id: entry.entityId }, select: { name: true, status: true, id: true } });
              details = client;
              url = `/crm/clients`;
              break;
            case 'deal':
              const deal = await prisma.deal.findUnique({ where: { id: entry.entityId }, select: { title: true, status: true, id: true, dealCode: true } });
              details = deal;
              url = `/crm/deals/${entry.entityId}`;
              break;
            case 'invoice':
              const invoice = await prisma.invoice.findUnique({ where: { id: entry.entityId }, select: { invoiceNumber: true, status: true, totalAmount: true, id: true } });
              details = invoice;
              url = `/finance/invoices`;
              break;
            case 'payment':
              const payment = await prisma.payment.findUnique({ where: { id: entry.entityId }, select: { paymentId: true, amount: true, paymentMode: true, id: true } });
              details = payment;
              url = `/finance/payments`;
              break;
          }
        } catch (e) {
          logger.warn(`Failed to fetch details for ${entry.entityType} ${entry.entityId}`);
        }

        return {
          ...entry,
          details,
          url,
        };
      })
    );

    return successResponse(res, {
      tid,
      timeline: enhancedEntries,
      count: enhancedEntries.length,
    });
  } catch (error: any) {
    logger.error(`Error fetching transaction ${req.params.tid}:`, error);
    return errorResponse(res, error);
  }
});

export default router;
