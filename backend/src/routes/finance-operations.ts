/**
 * Finance Operations Extension - Refund, Transfer, Merge
 * Additive only. Execution happens here only.
 */

import express, { Response } from 'express';
import { z } from 'zod';
import { requireAuth, AuthenticatedRequest, requirePermission } from '../middleware/rbac';
import {
  createOperationRequest,
  approveOperation,
  rejectOperation,
  executeOperation,
  listOperations,
  getOperationById,
  getOperationsByDealId,
} from '../services/finance-operations-service';
import { FinancialOperationType, FinancialOperationStatus } from '@prisma/client';
import logger from '../utils/logger';

const router = (express as any).Router();

const requestRefundSchema = z.object({
  operationType: z.literal('REFUND'),
  reason: z.string().min(1, 'Reason is required'),
  dealId: z.string().uuid().optional(),
  sourcePaymentId: z.string().uuid(),
  amount: z.number().positive().optional(),
  partialAmount: z.number().positive().optional(),
});

const requestTransferSchema = z.object({
  operationType: z.literal('TRANSFER'),
  reason: z.string().min(1, 'Reason is required'),
  dealId: z.string().uuid().optional(),
  sourcePaymentId: z.string().uuid(),
  sourceClientId: z.string().uuid(),
  targetClientId: z.string().uuid(),
  amount: z.number().positive().optional(),
  partialAmount: z.number().positive().optional(),
});

const requestMergeSchema = z.object({
  operationType: z.literal('MERGE'),
  reason: z.string().min(1, 'Reason is required'),
  dealId: z.string().uuid().optional(),
  sourcePaymentId: z.string().uuid(),
  sourceDealId: z.string().uuid(),
  targetDealId: z.string().uuid().optional(),
  sourcePropertyId: z.string().uuid().optional(),
  targetPropertyId: z.string().uuid().optional(),
  amount: z.number().positive().optional(),
  partialAmount: z.number().positive().optional(),
});

const requestSchema = z.discriminatedUnion('operationType', [
  requestRefundSchema,
  requestTransferSchema,
  requestMergeSchema,
]);

router.post('/request', requireAuth, requirePermission('finance.vouchers.view'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = requestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    }
    const data = parsed.data as any;
    if (data.operationType === 'TRANSFER' && (data.amount ?? data.partialAmount ?? 0) <= 0) {
      return res.status(400).json({ error: 'Amount or partialAmount must be positive' });
    }
    if (data.operationType === 'MERGE') {
      if ((data.amount ?? data.partialAmount ?? 0) <= 0) {
        return res.status(400).json({ error: 'Amount or partialAmount must be positive' });
      }
      if (!data.targetDealId && !data.targetPropertyId) {
        return res.status(400).json({ error: 'Target deal or target property is required' });
      }
    }
    const op = await createOperationRequest(data, req.user!.id);
    res.status(201).json({ success: true, data: op });
  } catch (err: any) {
    logger.error('Finance operation request error:', err);
    res.status(400).json({ error: err.message || 'Failed to create request' });
  }
});

router.get('/', requireAuth, requirePermission('finance.vouchers.view'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    const operationType = req.query.operationType as string | undefined;
    const dealId = req.query.dealId as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

    const validStatuses = Object.values(FinancialOperationStatus);
    const validTypes = Object.values(FinancialOperationType);

    const { rows, total } = await listOperations({
      status: status && validStatuses.includes(status as any) ? (status as FinancialOperationStatus) : undefined,
      operationType: operationType && validTypes.includes(operationType as any) ? (operationType as FinancialOperationType) : undefined,
      dealId,
      limit,
      offset,
    });

    res.json({ success: true, data: rows, total });
  } catch (err: any) {
    logger.error('List finance operations error:', err);
    res.status(500).json({ error: err.message || 'Failed to list operations' });
  }
});

router.get('/deal/:dealId', requireAuth, requirePermission('finance.vouchers.view'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const ops = await getOperationsByDealId(req.params.dealId);
    res.json({ success: true, data: ops });
  } catch (err: any) {
    logger.error('Get deal operations error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch operations' });
  }
});

router.get('/:id', requireAuth, requirePermission('finance.vouchers.view'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const op = await getOperationById(req.params.id);
    if (!op) return res.status(404).json({ error: 'Operation not found' });
    res.json({ success: true, data: op });
  } catch (err: any) {
    logger.error('Get operation error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch operation' });
  }
});

router.put('/:id/approve', requireAuth, requirePermission('finance.vouchers.approve'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const op = await approveOperation(req.params.id, req.user!.id);
    res.json({ success: true, data: op });
  } catch (err: any) {
    logger.error('Approve operation error:', err);
    res.status(400).json({ error: err.message || 'Failed to approve' });
  }
});

router.put('/:id/reject', requireAuth, requirePermission('finance.vouchers.approve'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const op = await rejectOperation(req.params.id);
    res.json({ success: true, data: op });
  } catch (err: any) {
    logger.error('Reject operation error:', err);
    res.status(400).json({ error: err.message || 'Failed to reject' });
  }
});

router.put('/:id/execute', requireAuth, requirePermission('finance.vouchers.approve'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const op = await executeOperation(req.params.id, req.user!.id);
    res.json({ success: true, data: op });
  } catch (err: any) {
    logger.error('Execute operation error:', err);
    res.status(400).json({ error: err.message || 'Failed to execute' });
  }
});

export default router;
