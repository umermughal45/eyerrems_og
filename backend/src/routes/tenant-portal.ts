import express, { Response } from 'express';
import { z } from 'zod';
import prisma from '../prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { syncPaymentToFinanceLedger, updateTenantLedger } from '../services/workflows';
import { getOverdueRentAlerts, getTenantLeaseExpiryAlerts } from '../services/tenant-alerts';

const router = (express as any).Router();

// Helper to generate receipt number
async function generateReceiptNumber(): Promise<string> {
  let code: string = '';
  let exists = true;
  while (exists) {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(1000 + Math.random() * 9000);
    code = `REC-${dateStr}-${random}`;
    const existing = await prisma.receipt.findUnique({ where: { receiptNumber: code } });
    exists = !!existing;
  }
  return code;
}

// Helper to generate ticket number
async function generateTicketNumber(): Promise<string> {
  let code: string = '';
  let exists = true;
  while (exists) {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(1000 + Math.random() * 9000);
    code = `TKT-${dateStr}-${random}`;
    const existing = await prisma.maintenanceTicket.findUnique({ where: { ticketNumber: code } });
    exists = !!existing;
  }
  return code;
}

// Helper to generate notice number
async function generateNoticeNumber(): Promise<string> {
  let code: string = '';
  let exists = true;
  while (exists) {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(1000 + Math.random() * 9000);
    code = `NOT-${dateStr}-${random}`;
    const existing = await prisma.noticeToVacate.findUnique({ where: { noticeNumber: code } });
    exists = !!existing;
  }
  return code;
}

// GET /tenant/:id/dashboard - Get tenant dashboard data
router.get('/:id/dashboard', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const tenant = await prisma.tenant.findFirst({
      where: { id, isDeleted: false },
      include: {
        unit: {
          include: {
            property: true,
          },
        },
        leases: {
          where: { status: 'Active', isDeleted: false },
          orderBy: { leaseStart: 'desc' },
          take: 1,
        },
      },
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const activeLease = tenant.leases[0] || null;

    // Get invoices
    const invoices = await prisma.invoice.findMany({
      where: { tenantId: id },
      orderBy: { billingDate: 'desc' },
    });

    // Get payments
    const payments = await prisma.tenantPayment.findMany({
      where: { tenantId: id },
      orderBy: { date: 'desc' },
      take: 10,
    });

    // Calculate stats
    const now = new Date();
    const overdueInvoices = invoices.filter((inv) => {
      const dueDate = new Date(inv.dueDate);
      return dueDate < now && inv.status !== 'paid' && inv.status !== 'Paid';
    });
    const overdueRent = overdueInvoices.reduce((sum, inv) => sum + (Number(inv.remainingAmount || inv.totalAmount || 0)), 0);

    const upcomingInvoices = invoices
      .filter((inv) => {
        const dueDate = new Date(inv.dueDate);
        return dueDate >= now && inv.status !== 'paid' && inv.status !== 'Paid';
      })
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

    const nextDueDate = upcomingInvoices.length > 0 ? upcomingInvoices[0].dueDate : null;

    const outstandingBalance = invoices
      .filter((inv) => inv.status !== 'paid' && inv.status !== 'Paid')
      .reduce((sum, inv) => sum + Number(inv.remainingAmount || inv.totalAmount || inv.amount || 0), 0);

    let leaseExpiryDays = null;
    if (activeLease?.leaseEnd) {
      const leaseEnd = new Date(activeLease.leaseEnd);
      const daysDiff = Math.ceil((leaseEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      leaseExpiryDays = daysDiff;
    }

    // Get maintenance tickets
    const tickets = await prisma.maintenanceTicket.findMany({
      where: { tenantId: id, isDeleted: false },
      orderBy: { createdAt: 'desc' },
    });
    const pendingTickets = tickets.filter((t) => t.status === 'open' || t.status === 'in-progress').length;

    // Get announcements
    const allAnnouncements = await prisma.announcement.findMany({
      where: {
        isActive: true,
        isDeleted: false,
        OR: [
          { targetAudience: 'all' },
          { targetAudience: 'specific-tenants' },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // Filter announcements for this tenant
    const announcements = allAnnouncements.filter((ann) => {
      if (ann.targetAudience === 'all') return true;
      if (ann.targetAudience === 'specific-tenants') {
        const targetIds = Array.isArray(ann.targetTenantIds) ? ann.targetTenantIds : [];
        return targetIds.includes(id);
      }
      if (ann.expiresAt && new Date(ann.expiresAt) < now) return false;
      return false;
    }).slice(0, 5);

    // Payment timeline (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const recentInvoices = invoices
      .filter((inv) => new Date(inv.billingDate || inv.dueDate) >= sixMonthsAgo)
      .sort((a, b) => new Date(a.billingDate || a.dueDate).getTime() - new Date(b.billingDate || b.dueDate).getTime())
      .slice(0, 6);

    res.json({
      success: true,
      data: {
        tenant,
        lease: activeLease,
        stats: {
          currentRent: activeLease?.rent || 0,
          overdueRent,
          nextDueDate,
          outstandingBalance,
          leaseExpiryDays,
          pendingTickets,
        },
        lastInvoices: invoices.slice(0, 3),
        paymentStatusTimeline: recentInvoices,
        announcements,
      },
    });
  } catch (error) {
    console.error('Get tenant dashboard error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard data',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /tenant/:id/ledger - Get tenant ledger
router.get('/:id/ledger', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const ledgerEntries = await prisma.tenantLedger.findMany({
      where: { tenantId: id, isDeleted: false },
      orderBy: { entryDate: 'asc' },
    });

    // If no ledger entries, generate from invoices and payments
    if (ledgerEntries.length === 0) {
      const invoices = await prisma.invoice.findMany({
        where: { tenantId: id },
        orderBy: { billingDate: 'asc' },
      });

      const payments = await prisma.tenantPayment.findMany({
        where: { tenantId: id },
        orderBy: { date: 'asc' },
      });

      const tenant = await prisma.tenant.findFirst({ where: { id } });
      
      // Start with opening balance (if any)
      let runningBalance = 0;

      // Create ledger entries from invoices and payments
      const allEntries = [
        ...invoices.map((inv) => ({
          entryDate: inv.billingDate || inv.dueDate,
          entryType: 'debit' as const,
          description: `Rent Invoice - ${inv.invoiceNumber || inv.id.slice(0, 8)}`,
          amount: inv.totalAmount || inv.amount || 0,
          referenceId: inv.id,
          referenceType: 'invoice',
        })),
        ...payments.map((pay) => ({
          entryDate: pay.date,
          entryType: 'credit' as const,
          description: `Payment - ${pay.paymentId || pay.id.slice(0, 8)}`,
          amount: pay.allocatedAmount || pay.amount || 0, // Use allocated amount if available
          referenceId: pay.id,
          referenceType: 'payment',
        })),
      ].sort((a, b) => new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime());

      // Calculate running balances correctly
      const entriesWithBalance = allEntries.map((entry) => {
        if (entry.entryType === 'debit') {
          runningBalance += entry.amount;
        } else {
          runningBalance -= entry.amount;
        }
        return {
          ...entry,
          balance: Math.round(runningBalance * 100) / 100,
        };
      });

      const totalDebits = entriesWithBalance
        .filter((e) => e.entryType === 'debit')
        .reduce((sum, e) => sum + e.amount, 0);
      const totalCredits = entriesWithBalance
        .filter((e) => e.entryType === 'credit')
        .reduce((sum, e) => sum + e.amount, 0);

      return res.json({
        success: true,
        data: entriesWithBalance,
        summary: {
          totalDebits: Math.round(totalDebits * 100) / 100,
          totalCredits: Math.round(totalCredits * 100) / 100,
          currentBalance: Math.round(runningBalance * 100) / 100,
          openingBalance: 0,
        },
      });
    }

    // Calculate summary from ledger entries
    const debits = ledgerEntries.filter((e) => e.entryType === 'debit');
    const credits = ledgerEntries.filter((e) => e.entryType === 'credit');
    const totalDebits = debits.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const totalCredits = credits.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    
    // Get current balance from last entry
    const currentBalance = ledgerEntries.length > 0 
      ? Number(ledgerEntries[ledgerEntries.length - 1].balance || 0)
      : 0;
    
    // Calculate opening balance (balance before first entry)
    let openingBalance = 0;
    if (ledgerEntries.length > 0) {
      const firstEntry = ledgerEntries[0];
      if (firstEntry.entryType === 'debit') {
        openingBalance = Number(firstEntry.balance || 0) - Number(firstEntry.amount || 0);
      } else {
        openingBalance = Number(firstEntry.balance || 0) + Number(firstEntry.amount || 0);
      }
    }

    res.json({
      success: true,
      data: ledgerEntries.map((entry) => ({
        ...entry,
        balance: Math.round(Number(entry.balance || 0) * 100) / 100,
        amount: Math.round(Number(entry.amount || 0) * 100) / 100,
      })),
      summary: {
        totalDebits: Math.round(totalDebits * 100) / 100,
        totalCredits: Math.round(totalCredits * 100) / 100,
        currentBalance: Math.round(currentBalance * 100) / 100,
        openingBalance: Math.round(openingBalance * 100) / 100,
      },
    });
  } catch (error) {
    console.error('Get tenant ledger error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch ledger',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// POST /tenant/:id/pay - Process online payment
router.post('/:id/pay', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      invoiceId,
      amount,
      method,
      referenceNumber,
      notes,
      attachments,
      months,
    } = req.body;

    const paymentAmount = Number(amount);
    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      return res.status(400).json({ error: 'Invalid payment amount' });
    }

    const tenant = await prisma.tenant.findFirst({
      where: { id, isDeleted: false },
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    // Generate payment ID
    const paymentId = `PAY-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // Create payment
    const payment = await prisma.tenantPayment.create({
      data: {
        paymentId,
        tenantId: id,
        invoiceId: invoiceId || null,
        amount: paymentAmount,
        method: method || 'Online Payment',
        referenceNumber: referenceNumber || null,
        notes: notes || null,
        attachments: attachments ? JSON.parse(JSON.stringify(attachments)) : null,
        date: new Date(),
        status: (method === 'Bank Slip' || method?.toLowerCase().includes('slip')) ? 'pending' : 'completed',
        createdByUserId: req.user?.id,
      },
      include: {
        tenant: true,
        invoice: true,
      },
    });

    // Handle payment allocation (partial/advance payment)
    let remainingPaymentAmount = paymentAmount;
    const allocationDetails: any[] = [];

    // If invoiceId provided, allocate to that invoice first
    if (invoiceId) {
      const invoice = await prisma.invoice.findFirst({ 
        where: { id: invoiceId },
        include: { tenant: true },
      });
      
      if (invoice) {
        const invoiceRemaining = invoice.remainingAmount || invoice.totalAmount || 0;
        const allocatedAmount = Math.min(remainingPaymentAmount, invoiceRemaining);
        
        if (allocatedAmount > 0) {
          const newRemaining = Math.max(0, invoiceRemaining - allocatedAmount);
          const newStatus = newRemaining === 0 ? 'paid' : 'partial';

          await prisma.invoice.update({
            where: { id: invoiceId },
            data: {
              remainingAmount: newRemaining,
              status: newStatus,
            },
          });

          allocationDetails.push({
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            allocatedAmount,
            remainingAfterPayment: newRemaining,
          });

          remainingPaymentAmount -= allocatedAmount;
        }
      }
    }

    // If payment amount exceeds invoice or no invoice specified, allocate to oldest unpaid invoices
    if (remainingPaymentAmount > 0) {
      const unpaidInvoices = await prisma.invoice.findMany({
        where: {
          tenantId: id,
          status: { in: ['unpaid', 'partial', 'overdue'] },
        },
        orderBy: { dueDate: 'asc' },
      });

      for (const invoice of unpaidInvoices) {
        if (remainingPaymentAmount <= 0) break;
        if (invoiceId && invoice.id === invoiceId) continue; // Skip if already allocated

        const invoiceRemaining = invoice.remainingAmount || invoice.totalAmount || 0;
        const allocatedAmount = Math.min(remainingPaymentAmount, invoiceRemaining);

        if (allocatedAmount > 0) {
          const newRemaining = Math.max(0, invoiceRemaining - allocatedAmount);
          const newStatus = newRemaining === 0 ? 'paid' : 'partial';

          await prisma.invoice.update({
            where: { id: invoice.id },
            data: {
              remainingAmount: newRemaining,
              status: newStatus,
            },
          });

          allocationDetails.push({
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            allocatedAmount,
            remainingAfterPayment: newRemaining,
          });

          remainingPaymentAmount -= allocatedAmount;
        }
      }
    }

    // Update payment with allocations
    await prisma.tenantPayment.update({
      where: { id: payment.id },
      data: {
        allocatedAmount: paymentAmount - remainingPaymentAmount,
        overpaymentAmount: remainingPaymentAmount > 0 ? remainingPaymentAmount : 0,
        allocations: allocationDetails.length > 0 ? (allocationDetails as any) : null,
      },
    });

    // Update tenant outstanding balance
    const paymentApplied = paymentAmount - remainingPaymentAmount;
    const newOutstanding = Math.max(0, (tenant.outstandingBalance || 0) - paymentApplied);
    
    // If overpayment, add to advance balance
    const advanceBalance = remainingPaymentAmount > 0 ? remainingPaymentAmount : 0;
    
    await prisma.tenant.update({
      where: { id },
      data: { 
        outstandingBalance: newOutstanding,
        advanceBalance: (tenant.advanceBalance || 0) + advanceBalance,
      },
    });

    // Create ledger entry using workflow
    await updateTenantLedger(id, {
      entryType: 'credit',
      description: `Payment - ${paymentId}${allocationDetails.length > 0 ? ` (${allocationDetails.length} invoice(s))` : ''}`,
      amount: paymentApplied,
      referenceId: payment.id,
      referenceType: 'payment',
    });

    // Auto-sync to Finance Ledger
    await syncPaymentToFinanceLedger(payment.id);

    // Generate receipt
    const receiptNumber = await generateReceiptNumber();
    const receipt = await prisma.receipt.create({
      data: {
        receiptNumber,
        tenantId: id,
        paymentId: payment.id,
        invoiceId: invoiceId || null,
        amount: paymentApplied,
        paymentMethod: method || 'Online Payment',
        receiptDate: new Date(),
        createdBy: req.user?.id,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Payment processed successfully',
      data: {
        payment: {
          ...payment,
          allocatedAmount: paymentApplied,
          overpaymentAmount: advanceBalance,
          allocations: allocationDetails,
        },
        receipt,
        summary: {
          totalPaid: paymentApplied,
          overpayment: advanceBalance,
          invoicesPaid: allocationDetails.filter(a => a.remainingAfterPayment === 0).length,
          invoicesPartial: allocationDetails.filter(a => a.remainingAfterPayment > 0).length,
        },
      },
    });
  } catch (error) {
    console.error('Process payment error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process payment',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// POST /tenant/:id/ticket - Create maintenance ticket
router.post('/:id/ticket', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { category, title, description, priority, photos } = req.body;

    if (!category || !title || !description) {
      return res.status(400).json({ error: 'Category, title, and description are required' });
    }

    const tenant = await prisma.tenant.findFirst({
      where: { id, isDeleted: false },
      include: { unit: true },
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const ticketNumber = await generateTicketNumber();

    const ticket = await prisma.maintenanceTicket.create({
      data: {
        ticketNumber,
        tenantId: id,
        unitId: tenant.unitId,
        category,
        title,
        description,
        priority: priority || 'medium',
        status: 'open',
        photos: photos ? JSON.parse(JSON.stringify(photos)) : null,
        createdBy: req.user?.id,
      },
      include: {
        tenant: true,
      },
    });

    // Create activity log
    await prisma.maintenanceActivity.create({
      data: {
        ticketId: ticket.id,
        action: 'created',
        description: 'Maintenance ticket created by tenant',
        performedBy: req.user?.id || 'system',
      },
    });

    // Also create maintenance request in property module (if unit has property)
    if (tenant.unitId) {
      const unit = await prisma.unit.findUnique({
        where: { id: tenant.unitId },
        include: { property: true },
      });

      if (unit?.propertyId) {
        try {
          await prisma.maintenanceRequest.create({
            data: {
              propertyId: unit.propertyId,
              tenantId: id,
              unitId: tenant.unitId,
              issueTitle: title,
              issueDescription: description,
              priority: priority || 'medium',
              status: 'open',
            },
          });
        } catch (error) {
          // If maintenance request already exists or creation fails, continue
          console.warn('Could not create maintenance request:', error);
        }
      }
    }

    res.status(201).json({
      success: true,
      message: 'Maintenance ticket created successfully',
      data: ticket,
    });
  } catch (error) {
    console.error('Create ticket error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create maintenance ticket',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /tenant/:id/tickets - Get maintenance tickets
router.get('/:id/tickets', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.query;

    const where: any = {
      tenantId: id,
      isDeleted: false,
    };

    if (status) {
      where.status = status;
    }

    const tickets = await prisma.maintenanceTicket.findMany({
      where,
      include: {
        activities: {
          orderBy: { performedAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: tickets,
    });
  } catch (error) {
    console.error('Get tickets error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch tickets',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// POST /tenant/:id/notice - Submit notice to vacate
router.post('/:id/notice', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { reason, moveOutDate, supportingDocs } = req.body;

    if (!reason || !moveOutDate) {
      return res.status(400).json({ error: 'Reason and move-out date are required' });
    }

    const tenant = await prisma.tenant.findFirst({
      where: { id, isDeleted: false },
      include: { unit: true },
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const noticeNumber = await generateNoticeNumber();

    const notice = await prisma.noticeToVacate.create({
      data: {
        noticeNumber,
        tenantId: id,
        unitId: tenant.unitId,
        reason,
        moveOutDate: new Date(moveOutDate),
        supportingDocs: supportingDocs ? JSON.parse(JSON.stringify(supportingDocs)) : null,
        status: 'pending',
        createdBy: req.user?.id,
      },
      include: {
        tenant: true,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Notice to vacate submitted successfully',
      data: notice,
    });
  } catch (error) {
    console.error('Submit notice error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit notice',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /tenant/:id/receipt/:paymentId - Generate receipt
router.get('/:id/receipt/:paymentId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id, paymentId } = req.params;

    const receipt = await prisma.receipt.findFirst({
      where: {
        tenantId: id,
        paymentId,
        isDeleted: false,
      },
      include: {
        tenant: true,
      },
    });

    if (!receipt) {
      return res.status(404).json({ error: 'Receipt not found' });
    }

    // In production, generate PDF here
    // For now, return receipt data
    res.json({
      success: true,
      data: {
        receipt,
        receiptUrl: receipt.receiptUrl || null,
      },
    });
  } catch (error) {
    console.error('Get receipt error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch receipt',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /tenant/:id/notifications - Get tenant notifications (overdue, lease expiry)
router.get('/:id/notifications', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const tenant = await prisma.tenant.findFirst({
      where: { id, isDeleted: false },
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    // Get overdue rent alerts
    const overdueAlerts = await getOverdueRentAlerts(id);
    const leaseExpiryAlerts = await getTenantLeaseExpiryAlerts(id);

    // Get pending maintenance tickets
    const pendingTickets = await prisma.maintenanceTicket.count({
      where: {
        tenantId: id,
        status: { in: ['open', 'in-progress'] },
        isDeleted: false,
      },
    });

    // Get pending notices
    const pendingNotices = await prisma.noticeToVacate.count({
      where: {
        tenantId: id,
        status: 'pending',
        isDeleted: false,
      },
    });

    res.json({
      success: true,
      data: {
        overdueRent: {
          count: overdueAlerts.summary.count,
          totalAmount: overdueAlerts.summary.totalOverdueAmount,
          totalLateFees: overdueAlerts.summary.totalLateFees,
          totalDue: overdueAlerts.summary.totalDue,
          invoices: overdueAlerts.alerts,
        },
        leaseExpiry: {
          critical: leaseExpiryAlerts.critical,
          urgent: leaseExpiryAlerts.urgent,
          warning: leaseExpiryAlerts.warning,
          summary: leaseExpiryAlerts.summary,
        },
        maintenance: {
          pendingTickets,
        },
        notices: {
          pendingNotices,
        },
        summary: {
          totalNotifications:
            overdueAlerts.summary.count +
            leaseExpiryAlerts.summary.total +
            pendingTickets +
            pendingNotices,
        },
      },
    });
  } catch (error) {
    console.error('Get tenant notifications error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch notifications',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /tenant/:id/receipts - Get all receipts
router.get('/:id/receipts', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const receipts = await prisma.receipt.findMany({
      where: {
        tenantId: id,
        isDeleted: false,
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            tenantCode: true,
          },
        },
      },
      orderBy: { receiptDate: 'desc' },
    });

    res.json({
      success: true,
      data: receipts,
      count: receipts.length,
    });
  } catch (error) {
    console.error('Get receipts error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch receipts',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// POST /tenant/:id/pay/advance - Make advance payment (for future invoices)
router.post('/:id/pay/advance', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { amount, method, referenceNumber, notes } = req.body;

    const paymentAmount = Number(amount);
    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      return res.status(400).json({ error: 'Invalid payment amount' });
    }

    const tenant = await prisma.tenant.findFirst({
      where: { id, isDeleted: false },
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    // Generate payment ID
    const paymentId = `PAY-ADV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // Create advance payment (no invoice linked)
    const payment = await prisma.tenantPayment.create({
      data: {
        paymentId,
        tenantId: id,
        invoiceId: null,
        amount: paymentAmount,
        allocatedAmount: 0, // No allocation for advance payment
        overpaymentAmount: paymentAmount, // Full amount is advance
        method: method || 'Online Payment',
        referenceNumber: referenceNumber || null,
        notes: notes || `Advance payment - ${notes || 'No notes'}`,
        date: new Date(),
        status: (method === 'Bank Slip' || method?.toLowerCase().includes('slip')) ? 'pending' : 'completed',
        createdByUserId: req.user?.id,
      },
    });

    // Update tenant advance balance
    await prisma.tenant.update({
      where: { id },
      data: {
        advanceBalance: (tenant.advanceBalance || 0) + paymentAmount,
      },
    });

    // Create ledger entry
    await updateTenantLedger(id, {
      entryType: 'credit',
      description: `Advance Payment - ${paymentId}`,
      amount: paymentAmount,
      referenceId: payment.id,
      referenceType: 'payment',
    });

    // Auto-sync to Finance Ledger
    await syncPaymentToFinanceLedger(payment.id);

    // Generate receipt
    const receiptNumber = await generateReceiptNumber();
    const receipt = await prisma.receipt.create({
      data: {
        receiptNumber,
        tenantId: id,
        paymentId: payment.id,
        invoiceId: null,
        amount: paymentAmount,
        paymentMethod: method || 'Online Payment',
        receiptDate: new Date(),
        createdBy: req.user?.id,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Advance payment processed successfully',
      data: {
        payment,
        receipt,
        advanceBalance: (tenant.advanceBalance || 0) + paymentAmount,
      },
    });
  } catch (error) {
    console.error('Process advance payment error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process advance payment',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

