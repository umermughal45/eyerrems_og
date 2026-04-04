/**
 * Enhanced Finance API Routes
 * Includes Finance Ledger with auto-sync
 */

import express, { Response } from 'express';
import { z } from 'zod';
import prisma from '../prisma/client';
import { requireAuth, AuthenticatedRequest, requirePermission } from '../middleware/rbac';
import { createAuditLog } from '../services/audit-log';
import {
  syncInvoiceToFinanceLedger,
  syncPaymentToFinanceLedger,
  syncDealToFinanceLedger,
  syncPayrollToFinanceLedger,
} from '../services/workflows';

const router = (express as any).Router();

// Validation schemas
const createFinanceLedgerSchema = z.object({
  referenceType: z.enum(['invoice', 'salary', 'expense', 'deal', 'payment', 'maintenance', 'property_expense']),
  referenceId: z.string().uuid().optional(),
  category: z.string(), // Category: credit, debit, commission, etc.
  amount: z.number().positive(),
  date: z.string().datetime().optional(),
  notes: z.string().optional(),
  description: z.string().optional(),
  dealId: z.string().uuid().optional(),
  propertyId: z.string().uuid().optional(),
  tenantId: z.string().uuid().optional(),
  payrollId: z.string().uuid().optional(),
  invoiceId: z.string().uuid().optional(),
  paymentId: z.string().uuid().optional(),
});

// Get finance ledger entries
router.get(
  '/ledger',
  requireAuth,
  requirePermission('finance.view'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const {
        category,
        referenceType,
        dealId,
        startDate,
        endDate,
        page = '1',
        limit = '50',
      } = req.query;

      const where: any = { isDeleted: false };

      if (category) where.category = category;
      if (referenceType) where.referenceType = referenceType;
      if (dealId) where.dealId = dealId;
      if (startDate && endDate) {
        where.date = {
          gte: new Date(startDate as string),
          lte: new Date(endDate as string),
        };
      }

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const skip = (pageNum - 1) * limitNum;

      const [entries, total] = await Promise.all([
        prisma.financeLedger.findMany({
          where,
          include: {
            deal: { 
              select: { 
                id: true, 
                title: true, 
                dealCode: true,
                property: { select: { id: true, name: true, propertyCode: true } },
                client: { select: { id: true, name: true, clientCode: true } }
              } 
            },
          },
          orderBy: { date: 'desc' },
          skip,
          take: limitNum,
        }),
        prisma.financeLedger.count({ where }),
      ]);

      res.json({
        entries,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Get finance summary
router.get(
  '/summary',
  requireAuth,
  requirePermission('finance.view'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { startDate, endDate, dealId } = req.query;

      const where: any = { isDeleted: false };

      if (dealId) where.dealId = dealId;
      if (startDate && endDate) {
        where.date = {
          gte: new Date(startDate as string),
          lte: new Date(endDate as string),
        };
      }

      // Filter credit entries (category = 'credit' or positive amounts)
      // Filter debit entries (category = 'debit' or negative amounts)
      const [allEntries] = await Promise.all([
        prisma.financeLedger.findMany({
          where,
          select: { amount: true, category: true },
        }),
      ]);

      const income = allEntries
        .filter(e => e.category === 'credit' || (e.amount > 0 && e.category !== 'debit'))
        .reduce((acc, e) => ({ sum: acc.sum + e.amount, count: acc.count + 1 }), { sum: 0, count: 0 });
      
      const expenses = allEntries
        .filter(e => e.category === 'debit' || (e.amount < 0 && e.category !== 'credit'))
        .reduce((acc, e) => ({ sum: acc.sum + Math.abs(e.amount), count: acc.count + 1 }), { sum: 0, count: 0 });

      res.json({
        income: {
          total: income.sum,
          count: income.count,
        },
        expenses: {
          total: expenses.sum,
          count: expenses.count,
        },
        netProfit: income.sum - expenses.sum,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Create finance ledger entry (manual)
router.post(
  '/ledger',
  requireAuth,
  requirePermission('finance.create'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const data = createFinanceLedgerSchema.parse(req.body);

      const ledger = await prisma.financeLedger.create({
        data: {
          dealId: data.dealId,
          category: data.category,
          amount: data.amount,
          date: data.date ? new Date(data.date) : new Date(),
          notes: data.notes,
          description: data.description,
          referenceType: data.referenceType,
          referenceId: data.referenceId,
          propertyId: data.propertyId,
          tenantId: data.tenantId,
          payrollId: data.payrollId,
          invoiceId: data.invoiceId,
          paymentId: data.paymentId,
          createdBy: req.user?.id,
        },
      });

      // Audit log
      await createAuditLog({
        entityType: 'finance_ledger',
        entityId: ledger.id,
        action: 'create',
        userId: req.user?.id,
        userName: req.user?.username,
        userRole: req.user?.role?.name,
        newValues: ledger,
        description: `Finance ledger entry created: ${ledger.category} - ${ledger.description || ledger.notes || 'N/A'} - ${ledger.amount}`,
        req,
      });

      res.status(201).json(ledger);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  }
);

// Sync invoice to finance ledger (auto-sync)
router.post(
  '/sync/invoice/:invoiceId',
  requireAuth,
  requirePermission('finance.sync'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const ledger = await syncInvoiceToFinanceLedger(req.params.invoiceId);

      if (!ledger) {
        return res.status(404).json({ error: 'Invoice not found' });
      }

      res.json(ledger);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Sync payment to finance ledger (auto-sync)
router.post(
  '/sync/payment/:paymentId',
  requireAuth,
  requirePermission('finance.sync'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const ledger = await syncPaymentToFinanceLedger(req.params.paymentId);

      if (!ledger) {
        return res.status(404).json({ error: 'Payment not found' });
      }

      res.json(ledger);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Sync deal to finance ledger (auto-sync)
router.post(
  '/sync/deal/:dealId',
  requireAuth,
  requirePermission('finance.sync'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const ledger = await syncDealToFinanceLedger(req.params.dealId);

      if (!ledger) {
        return res.status(404).json({ error: 'Deal not found or not closed' });
      }

      res.json(ledger);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Sync payroll to finance ledger (auto-sync)
router.post(
  '/sync/payroll/:payrollId',
  requireAuth,
  requirePermission('finance.sync'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const ledger = await syncPayrollToFinanceLedger(req.params.payrollId);

      if (!ledger) {
        return res.status(404).json({ error: 'Payroll not found or not paid' });
      }

      res.json(ledger);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Get finance ledger by reference
router.get(
  '/ledger/reference/:referenceType/:referenceId',
  requireAuth,
  requirePermission('finance.view'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { referenceType, referenceId } = req.params;

      const ledger = await prisma.financeLedger.findFirst({
        where: {
          referenceType,
          referenceId,
          isDeleted: false,
        },
        include: {
          deal: {
            include: {
              property: { select: { id: true, name: true, propertyCode: true } },
              client: { select: { id: true, name: true, clientCode: true } }
            }
          },
        },
      });

      if (!ledger) {
        return res.status(404).json({ error: 'Ledger entry not found' });
      }

      res.json(ledger);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

export default router;

