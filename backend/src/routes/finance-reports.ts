/**
 * Enhanced Finance Reports Routes
 * Includes: Income Statement, Cash Flow, Closing Balance, Overdue handling, Exports
 */

import express, { Response } from 'express';
import { z } from 'zod';
import prisma from '../prisma/client';
import { requireAuth, AuthenticatedRequest, requirePermission } from '../middleware/rbac';
import {
  syncInvoiceToFinanceLedger,
  syncPaymentToFinanceLedger,
  syncPayrollToFinanceLedger,
} from '../services/workflows';
import {
  generateIncomeStatement,
  generateCashFlowStatement,
  generateClosingBalance,
  calculateOverdueInvoices,
} from '../services/reports';
import { generatePropertyProfitabilityReport } from '../services/property-analytics-service';

const router = (express as any).Router();

// Validation schemas
const reportPeriodSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  propertyId: z.string().uuid().optional(),
});

const createPaymentSchema = z.object({
  tenantId: z.string().uuid().optional(),
  invoiceId: z.string().uuid().optional(),
  amount: z.number().positive(),
  method: z.enum(['cash', 'bank', 'online', 'card', 'other']),
  referenceNumber: z.string().optional(),
  notes: z.string().optional(),
  date: z.string().datetime().optional(),
});

/**
 * GET /reports/income-statement
 * Generate Income Statement report
 */
router.get(
  '/income-statement',
  requireAuth,
  requirePermission('finance.view'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { startDate, endDate, propertyId } = reportPeriodSchema.parse(req.query);

      const report = await generateIncomeStatement(
        new Date(startDate),
        new Date(endDate),
        propertyId
      );

      res.json(report);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * GET /reports/cash-flow
 * Generate Cash Flow Statement
 */
router.get(
  '/cash-flow',
  requireAuth,
  requirePermission('finance.view'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { startDate, endDate, propertyId } = reportPeriodSchema.parse(req.query);

      const report = await generateCashFlowStatement(
        new Date(startDate),
        new Date(endDate),
        propertyId
      );

      res.json(report);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * GET /reports/closing-balance
 * Generate Closing Balance / Trial Balance report
 */
router.get(
  '/closing-balance',
  requireAuth,
  requirePermission('finance.view'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { asOfDate, propertyId } = z.object({
        asOfDate: z.string().datetime(),
        propertyId: z.string().uuid().optional(),
      }).parse(req.query);

      const report = await generateClosingBalance(
        new Date(asOfDate),
        propertyId
      );

      res.json(report);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * GET /overdue-invoices
 * Get overdue invoices with late fee calculation
 */
router.get(
  '/overdue-invoices',
  requireAuth,
  requirePermission('finance.view'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const overdue = await calculateOverdueInvoices();
      res.json(overdue);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * GET /reports/property-profitability
 * Get property profitability report
 */
router.get(
  '/property-profitability',
  requireAuth,
  requirePermission('finance.view'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { startDate, endDate, propertyId } = reportPeriodSchema.parse(req.query);

      const report = await generatePropertyProfitabilityReport(
        new Date(startDate),
        new Date(endDate),
        propertyId
      );

      res.json(report);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * GET /ledger/account/:accountId
 * Get ledger entries for a specific account (General Ledger = journal_lines).
 * Returns entries in shape expected by Account Ledger UI.
 */
router.get(
  '/ledger/account/:accountId',
  requireAuth,
  requirePermission('finance.view'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { accountId } = req.params;
      const { startDate, endDate } = req.query;

      const journalWhere: any = {
        status: 'posted',
        lines: { some: { accountId } },
      };
      if (startDate && endDate) {
        journalWhere.date = {
          gte: new Date(startDate as string),
          lte: new Date(endDate as string),
        };
      }

      const journalEntries = await prisma.journalEntry.findMany({
        where: journalWhere,
        include: {
          lines: {
            where: { accountId },
            include: { account: true },
          },
          vouchers: {
            include: {
              property: { select: { name: true } },
              deal: {
                include: {
                  client: { select: { name: true } },
                  property: { select: { name: true } },
                },
              },
            },
          },
          dealReceipts: {
            include: {
              deal: {
                include: {
                  client: { select: { name: true } },
                  property: { select: { name: true } },
                },
              },
            },
          },
        },
        orderBy: { date: 'desc' },
      });

      const entries: any[] = [];
      let balance = 0;

      for (const entry of journalEntries) {
        for (const line of entry.lines) {
          const isDebit = line.debit > 0;
          const amount = isDebit ? line.debit : line.credit;
          const voucher = entry.vouchers?.[0];
          const receipt = entry.dealReceipts;

          if (line.accountId === accountId) {
            if (isDebit) balance += amount;
            else balance -= amount;
          }

          const counterpartLine = entry.lines.find(
            (l: any) => l.id !== line.id && ((isDebit && l.credit > 0) || (!isDebit && l.debit > 0))
          );

          entries.push({
            id: line.id,
            date: entry.date,
            accountDebit: isDebit ? line.account.name : (counterpartLine?.account?.name || ''),
            accountCredit: !isDebit ? line.account.name : (counterpartLine?.account?.name || ''),
            debitAccountId: isDebit ? line.accountId : null,
            creditAccountId: !isDebit ? line.accountId : null,
            amount,
            remarks: line.description || entry.description || entry.narration,
            dealTitle: voucher?.deal?.title || receipt?.deal?.title || null,
            clientName: voucher?.deal?.client?.name || receipt?.deal?.client?.name || null,
            propertyName: voucher?.property?.name || voucher?.deal?.property?.name || receipt?.deal?.property?.name || null,
            paymentId: receipt?.receiptNo || voucher?.voucherNumber || null,
          });
        }
      }

      res.json({
        accountId,
        balance: Number(balance.toFixed(2)),
        entries,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * POST /payments
 * Create payment with auto-linking and auto-journal entry
 */
router.post(
  '/payments',
  requireAuth,
  requirePermission('finance.create'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const data = createPaymentSchema.parse(req.body);

      // Generate payment ID
      const paymentId = `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

      const payment = await prisma.tenantPayment.create({
        data: {
          paymentId,
          tenantId: data.tenantId,
          invoiceId: data.invoiceId,
          amount: data.amount,
          method: data.method,
          referenceNumber: data.referenceNumber,
          notes: data.notes,
          date: data.date ? new Date(data.date) : new Date(),
          status: 'completed',
          createdByUserId: req.user?.id,
        },
        include: {
          tenant: true,
          invoice: { include: { property: true } },
        },
      });

      // Auto-sync to Finance Ledger
      await syncPaymentToFinanceLedger(payment.id);

      // Auto-create journal entry if accounts configured
      if (payment.invoice) {
        // Journal entry already handled in syncPaymentToFinanceLedger workflow
      }

      res.status(201).json(payment);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * GET /invoices/export/:id
 * Export invoice as PDF (placeholder - implement PDF generation)
 */
router.get(
  '/invoices/export/:id',
  requireAuth,
  requirePermission('finance.view'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const invoice = await prisma.invoice.findUnique({
        where: { id: req.params.id },
        include: {
          tenant: true,
          property: true,
          tenantPayments: true,
        },
      });

      if (!invoice) {
        return res.status(404).json({ error: 'Invoice not found' });
      }

      // TODO: Implement PDF generation using library like pdfkit or puppeteer
      // For now, return JSON data that can be used by frontend to generate PDF
      res.json({
        invoice,
        format: 'json',
        message: 'PDF generation not implemented. Use frontend PDF generator.',
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * GET /transactions/export
 * Export transactions as Excel (placeholder)
 */
router.get(
  '/transactions/export',
  requireAuth,
  requirePermission('finance.view'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { startDate, endDate, category, propertyId } = req.query;

      const where: any = { isDeleted: false };

      if (startDate && endDate) {
        where.date = {
          gte: new Date(startDate as string),
          lte: new Date(endDate as string),
        };
      }
      if (category) where.category = category;
      if (propertyId) where.propertyId = propertyId;

      const transactions = await prisma.transaction.findMany({
        where,
        include: {
          tenant: true,
          property: true,
          transactionCategory: true,
        },
        orderBy: { date: 'desc' },
      });

      // TODO: Implement Excel export using library like exceljs
      // For now, return JSON data
      res.json({
        transactions,
        format: 'json',
        message: 'Excel export not implemented. Use frontend Excel generator.',
        count: transactions.length,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

export default router;

