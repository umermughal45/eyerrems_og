/**
 * GET /api/search/:tid
 *
 * Global TID search — resolves any of:
 *   TRX-2026-0001   (canonical TID)
 *   LD-0001         (lead code)
 *   CLI-0001        (client code)
 *   LD-CLI-0001     (converted-client code)
 *   DEAL-0001       (deal code)
 *   PAY-0001        (payment ID)
 *
 * Returns the full entity graph: { client, lead, deals, properties, payments, ... }
 */

import express, { Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { UnifiedSearchService } from '../services/unified-search-service';
import prisma from '../prisma/client';

const router = (express as any).Router();

router.get('/:tid', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const raw = (req.params.tid ?? '').trim();
    if (!raw) {
      return res.status(400).json({ success: false, error: 'TID is required' });
    }

    const query = raw.toUpperCase();

    // Resolve DEAL-#### → client TID
    if (/^DEAL-\d{4}$/.test(query)) {
      const deal = await prisma.deal.findFirst({
        where: { dealCode: query, isDeleted: false },
        select: { tid: true, clientId: true },
      });
      if (!deal) {
        return res.status(404).json({ success: false, error: `No deal found with code: ${query}` });
      }
      // Use deal's TID or fall through to client lookup
      const resolvedTid = deal.tid ?? null;
      if (!resolvedTid) {
        return res.status(404).json({ success: false, error: `Deal ${query} has no TID assigned yet` });
      }
      const result = await UnifiedSearchService.searchByTID(resolvedTid);
      if (!result) {
        return res.status(404).json({ success: false, error: `No records found for TID: ${resolvedTid}` });
      }
      return res.json({ success: true, data: result });
    }

    // Resolve PAY-#### → client TID via deal
    if (/^PAY-\d{4}$/.test(query)) {
      const payment = await prisma.payment.findFirst({
        where: { paymentId: query, deletedAt: null },
        select: { tid: true, dealId: true },
      });
      if (!payment) {
        return res.status(404).json({ success: false, error: `No payment found with ID: ${query}` });
      }
      const resolvedTid = payment.tid ?? null;
      if (!resolvedTid) {
        return res.status(404).json({ success: false, error: `Payment ${query} has no TID assigned yet` });
      }
      const result = await UnifiedSearchService.searchByTID(resolvedTid);
      if (!result) {
        return res.status(404).json({ success: false, error: `No records found for TID: ${resolvedTid}` });
      }
      return res.json({ success: true, data: result });
    }

    // Standard TID / lead code / client code — delegate to UnifiedSearchService
    const result = await UnifiedSearchService.searchByTID(raw);
    if (!result) {
      return res.status(404).json({ success: false, error: `No records found for: ${raw}` });
    }

    return res.json({ success: true, data: result });
  } catch (err: any) {
    console.error('Global search error:', err);
    return res.status(500).json({ success: false, error: err.message ?? 'Search failed' });
  }
});

export default router;
