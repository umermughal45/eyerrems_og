/**
 * Auto-Sync Workflow Services
 * Handles all automatic synchronization between modules
 */

import prisma from '../prisma/client';

/**
 * Auto-generate monthly invoices for active tenancies
 */
export async function generateMonthlyInvoices() {
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  // Find all active tenancies with nextInvoiceDate <= today
  const tenancies = await prisma.tenancy.findMany({
    where: {
      status: 'active',
      OR: [
        { nextInvoiceDate: { lte: today } },
        { nextInvoiceDate: null },
      ],
    },
    include: {
      property: true,
      tenant: true,
      lease: true,
    },
  });

  const generatedInvoices = [];

  for (const tenancy of tenancies) {
    try {
      // Calculate due date (typically 7 days from invoice date)
      const dueDate = new Date(today);
      dueDate.setDate(dueDate.getDate() + 7);

      // Generate invoice number
      const invoiceNumber = `INV-${currentYear}${String(currentMonth + 1).padStart(2, '0')}-${Date.now()}`;

      // Create invoice
      const invoice = await prisma.invoice.create({
        data: {
          invoiceNumber,
          tenantId: tenancy.tenantId,
          propertyId: tenancy.propertyId,
          billingDate: today,
          dueDate,
          amount: tenancy.monthlyRent,
          totalAmount: tenancy.monthlyRent,
          remainingAmount: tenancy.monthlyRent,
          status: 'unpaid',
        },
      });

      // Update next invoice date (next month same day)
      const nextInvoiceDate = new Date(today);
      nextInvoiceDate.setMonth(nextInvoiceDate.getMonth() + 1);

      await prisma.tenancy.update({
        where: { id: tenancy.id },
        data: { nextInvoiceDate },
      });

      // Auto-sync to Finance Ledger
      await syncInvoiceToFinanceLedger(invoice.id);

      // Update tenant ledger
      await updateTenantLedger(tenancy.tenantId, {
        entryType: 'debit',
        description: `Monthly rent invoice ${invoiceNumber}`,
        amount: tenancy.monthlyRent,
        referenceId: invoice.id,
        referenceType: 'invoice',
      });

      generatedInvoices.push(invoice);
    } catch (error) {
      console.error(`Error generating invoice for tenancy ${tenancy.id}:`, error);
    }
  }

  return generatedInvoices;
}

/**
 * Sync invoice to Finance Ledger (Income)
 * Note: FinanceLedger now requires a dealId. Invoices don't have Deals, so this is disabled.
 * Finance entries for invoices should be created through Deal relationships if needed.
 */
export async function syncInvoiceToFinanceLedger(invoiceId: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { tenant: true }, // Removed property include
  });

  if (!invoice) return null;

  // Check if already synced
  const existingLedger = await prisma.financeLedger.findFirst({
    where: {
      referenceType: 'invoice',
      referenceId: invoiceId,
      isDeleted: false,
    },
  });

  if (existingLedger) return existingLedger;

  // Create FinanceLedger entry
  const ledger = await prisma.financeLedger.create({
    data: {
      category: 'credit', // Income
      amount: invoice.totalAmount,
      date: invoice.createdAt,
      description: `Invoice generated: ${invoice.invoiceNumber}`,
      notes: `Tenant: ${invoice.tenant?.name || 'Unknown'}`,
      referenceType: 'invoice',
      referenceId: invoiceId,
      propertyId: invoice.propertyId,
      tenantId: invoice.tenantId,
      invoiceId: invoice.id,
    },
  });

  return ledger;
}

/**
 * Sync payment to Finance Ledger (Income - Received)
 * Note: FinanceLedger now requires a dealId. TenantPayments don't have Deals, so this is disabled.
 * Finance entries for payments should be created through Deal relationships if needed.
 */
export async function syncPaymentToFinanceLedger(paymentId: string) {
  const payment = await prisma.tenantPayment.findUnique({
    where: { id: paymentId },
    include: {
      tenant: true,
      invoice: { include: { property: true } },
    },
  });

  if (!payment) return null;

  // Update tenant ledger with allocated amount (credit entry)
  const revenueAmount = payment.allocatedAmount || payment.amount || 0;
  if (payment.tenantId && revenueAmount > 0) {
    await updateTenantLedger(payment.tenantId, {
      entryType: 'credit',
      description: `Payment received ${payment.paymentId}${(payment.allocations as any)?.length ? ` (${(payment.allocations as any).length} invoice(s))` : ''}`,
      amount: revenueAmount,
      referenceId: paymentId,
      referenceType: 'payment',
    });
  }

  // Check if already synced
  const existingLedger = await prisma.financeLedger.findFirst({
    where: {
      referenceType: 'payment',
      referenceId: paymentId,
      isDeleted: false,
    },
  });

  if (existingLedger) return existingLedger;

  // Create FinanceLedger entry for payment (Cash Flow)
  // Note: For Profitability (Accrual), we use Invoices. For Cash Flow, we use Payments.
  // We track both but can filter by referenceType in reports.
  const ledger = await prisma.financeLedger.create({
    data: {
      category: 'credit', // Cash In
      amount: revenueAmount,
      date: payment.date,
      description: `Payment received: ${payment.paymentId}`,
      notes: payment.method,
      referenceType: 'payment',
      referenceId: paymentId,
      // If invoice exists, link property from it, otherwise from payment if available
      propertyId: payment.invoice?.propertyId || (payment as any).propertyId || null,
      tenantId: payment.tenantId,
      paymentId: payment.id,
    },
  });

  return ledger;
}

/**
 * Sync property expense to Finance Ledger (Expense)
 * Note: FinanceLedger now requires a dealId. PropertyExpenses don't have Deals, so this is disabled.
 * Finance entries for property expenses should be created through Deal relationships if needed.
 */
export async function syncPropertyExpenseToFinanceLedger(expenseId: string) {
  const expense = await prisma.propertyExpense.findUnique({
    where: { id: expenseId },
    include: {}, // Removed property include to avoid DB mismatch
  });

  if (!expense) return null;

  // Check if already synced
  const existingLedger = await prisma.financeLedger.findFirst({
    where: {
      referenceType: 'expense',
      referenceId: expenseId,
      isDeleted: false,
    },
  });

  if (existingLedger) {
    return existingLedger;
  }

  // Create FinanceLedger entry
  const ledger = await prisma.financeLedger.create({
    data: {
      category: 'debit', // Expense
      amount: expense.amount,
      date: expense.date,
      description: `Property Expense: ${expense.category}`,
      notes: expense.description,
      referenceType: 'expense',
      referenceId: expenseId,
      propertyId: expense.propertyId,
    },
  });

  // Update expense with ledger ID
  await prisma.propertyExpense.update({
    where: { id: expenseId },
    data: { financeLedgerId: ledger.id },
  });

  // Auto-sync: Update dashboard KPIs
  await updateDashboardKPIs(expense.propertyId);

  return ledger;
}

/**
 * Sync maintenance request to Finance Ledger (Expense)
 * Note: FinanceLedger now requires a dealId. MaintenanceRequests don't have Deals, so this is disabled.
 * Finance entries for maintenance should be created through Deal relationships if needed.
 */
export async function syncMaintenanceToFinanceLedger(maintenanceId: string) {
  const maintenance = await prisma.maintenanceRequest.findUnique({
    where: { id: maintenanceId },
    include: { tenant: true }, // Removed property include
  });

  if (!maintenance || !maintenance.actualCost || maintenance.actualCost <= 0) {
    return null;
  }

  // Check if already synced
  const existingLedger = await prisma.financeLedger.findFirst({
    where: {
      referenceType: 'maintenance',
      referenceId: maintenanceId,
      isDeleted: false,
    },
  });

  if (existingLedger) return existingLedger;

  // Create FinanceLedger entry
  const ledger = await prisma.financeLedger.create({
    data: {
      category: 'debit', // Expense
      amount: maintenance.actualCost,
      date: maintenance.completedAt || new Date(),
      description: `Maintenance: ${maintenance.issueTitle}`,
      notes: `Priority: ${maintenance.priority}`,
      referenceType: 'maintenance',
      referenceId: maintenanceId,
      propertyId: maintenance.propertyId,
      tenantId: maintenance.tenantId,
    },
  });

  // Update maintenance with ledger ID
  await prisma.maintenanceRequest.update({
    where: { id: maintenanceId },
    data: { financeLedgerId: ledger.id },
  });

  return ledger;
}

/**
 * Sync commission payment to Finance Ledger (Expense)
 */
export async function syncCommissionToFinanceLedger(commissionId: string) {
  const commission = await prisma.commission.findUnique({
    where: { id: commissionId },
    include: {
      dealer: true,
      sale: {
        include: {
          property: true,
        },
      },
    },
  });

  if (!commission) return null;

  // Check if already synced
  const existingLedger = await prisma.financeLedger.findFirst({
    where: {
      referenceType: 'commission',
      referenceId: commissionId,
      category: 'debit',
    },
  });

  if (existingLedger) {
    return existingLedger;
  }

  // Find a Deal for this commission (through sale or dealer)
  // For now, skipping if no Deal is found
  if (!commission.saleId) {
    return null; // Commission without a sale/deal cannot create FinanceLedger
  }

  // Find Deal associated with the sale
  const deal = await prisma.deal.findFirst({
    where: {
      propertyId: commission.sale?.propertyId,
      isDeleted: false,
    },
  });

  if (!deal) {
    return null; // No Deal found for this commission
  }

  const ledger = await prisma.financeLedger.create({
    data: {
      dealId: deal.id,
      category: 'debit',
      amount: commission.amount,
      date: new Date(),
      description: `Commission payment: ${commission.dealer?.name || 'Dealer'}`,
      notes: `Commission rate: ${commission.rate}%`,
      referenceType: 'commission',
      referenceId: commissionId,
    },
  });

  return ledger;
}

/**
 * Sync deal payment to Finance Ledger (Income)
 */
export async function syncDealToFinanceLedger(dealId: string) {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: { client: true, property: true, dealer: true },
  });

  if (!deal || deal.stage !== 'closed-won') {
    return null;
  }

  const ledger = await prisma.financeLedger.create({
    data: {
      dealId: dealId,
      category: 'credit',
      amount: deal.dealAmount,
      date: deal.actualClosingDate || new Date(),
      description: `Deal closed: ${deal.title}`,
      notes: `Deal code: ${deal.dealCode || 'N/A'}`,
      referenceType: 'deal',
      referenceId: dealId,
    },
  });

  // Auto-sync: Calculate and create commission if dealer exists
  if (deal.dealerId && deal.commissionRate > 0 && deal.commissionAmount > 0) {
    // Check if commission already exists
    const existingCommission = await prisma.commission.findFirst({
      where: {
        dealerId: deal.dealerId,
        saleId: null, // Deal-based commission (not sale-based)
      },
    });

    if (!existingCommission) {
      await prisma.commission.create({
        data: {
          dealerId: deal.dealerId,
          rate: deal.commissionRate,
          amount: deal.commissionAmount,
        },
      });

      // Auto-sync commission to finance ledger
      const commission = await prisma.commission.findFirst({
        where: {
          dealerId: deal.dealerId,
          saleId: null,
        },
        orderBy: { createdAt: 'desc' },
      });

      if (commission) {
        await syncCommissionToFinanceLedger(commission.id);
      }
    }
  }

  // Auto-sync: Update dashboard KPIs if property exists
  if (deal.propertyId) {
    await updateDashboardKPIs(deal.propertyId);
  }

  return ledger;
}

/**
 * Sync payroll salary to Finance Ledger (Expense)
 * Note: FinanceLedger now requires a dealId. Payroll doesn't have Deals, so this is disabled.
 * Finance entries for payroll should be created through Deal relationships if needed.
 */
export async function syncPayrollToFinanceLedger(payrollId: string) {
  const payroll = await prisma.payroll.findUnique({
    where: { id: payrollId },
    include: { employee: true },
  });

  if (!payroll || payroll.paymentStatus !== 'paid') {
    return null;
  }

  // FinanceLedger requires a dealId, but payroll doesn't have a Deal
  // Skipping FinanceLedger creation for payroll
  // Payroll can be tracked separately or linked to a Deal if needed
  return null;
}

/**
 * Update tenant ledger entry
 */
export async function updateTenantLedger(
  tenantId: string,
  entry: {
    entryType: 'debit' | 'credit';
    description: string;
    amount: number;
    referenceId?: string;
    referenceType?: string;
  }
) {
  // Get current balance
  const lastEntry = await prisma.tenantLedger.findFirst({
    where: { tenantId, isDeleted: false },
    orderBy: { createdAt: 'desc' },
  });

  const currentBalance = lastEntry?.balance || 0;
  const newBalance =
    entry.entryType === 'debit'
      ? currentBalance + entry.amount
      : currentBalance - entry.amount;

  // Update tenant outstanding balance
  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      outstandingBalance: newBalance,
    },
  });

  // Create ledger entry
  const ledgerEntry = await prisma.tenantLedger.create({
    data: {
      ledgerNumber: `TL-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      tenantId,
      entryType: entry.entryType,
      description: entry.description,
      amount: entry.amount,
      balance: newBalance,
      referenceId: entry.referenceId,
      referenceType: entry.referenceType,
    },
  });

  return ledgerEntry;
}

/**
 * Auto-sync: Update dashboard KPIs when unit status changes
 */
export async function updateDashboardKPIs(propertyId: string) {
  try {
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: {
        id: true,
        units: {
          where: { isDeleted: false },
          include: {
            tenant: {
              where: { isDeleted: false },
            },
          },
        },
        floors: {
          where: { isDeleted: false },
          include: {
            units: {
              where: { isDeleted: false },
            },
          },
        },
      },
    });

    if (!property) return null;

    // Calculate occupancy metrics
    const totalUnits = property.units.length;
    const occupiedUnits = property.units.filter((u) => u.status === 'Occupied').length;
    const occupancyRate = totalUnits > 0 ? (occupiedUnits / totalUnits) * 100 : 0;

    // Calculate revenue from occupied units
    const monthlyRevenue = property.units
      .filter((u) => u.status === 'Occupied' && u.monthlyRent)
      .reduce((sum, u) => sum + (u.monthlyRent || 0), 0);

    // Calculate floor-based metrics
    const floorMetrics = property.floors.map((floor) => {
      const floorUnits = floor.units;
      const floorOccupied = floorUnits.filter((u) => u.status === 'Occupied').length;
      const floorRevenue = floorUnits
        .filter((u) => u.status === 'Occupied' && u.monthlyRent)
        .reduce((sum, u) => sum + (u.monthlyRent || 0), 0);

      return {
        floorId: floor.id,
        floorName: floor.name,
        floorNumber: floor.floorNumber,
        totalUnits: floorUnits.length,
        occupiedUnits: floorOccupied,
        revenue: floorRevenue,
      };
    });

    // Update revenue summary for current month
    const today = new Date();
    const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

    await prisma.revenueSummary.upsert({
      where: {
        propertyId_month: {
          propertyId,
          month: currentMonth,
        },
      },
      create: {
        propertyId,
        month: currentMonth,
        totalRevenue: monthlyRevenue,
        rentRevenue: monthlyRevenue,
        otherRevenue: 0,
      },
      update: {
        totalRevenue: monthlyRevenue,
        rentRevenue: monthlyRevenue,
      },
    });

    return {
      propertyId,
      totalUnits,
      occupiedUnits,
      occupancyRate: Math.round(occupancyRate * 100) / 100,
      monthlyRevenue,
      floorMetrics,
    };
  } catch (error) {
    console.error('Error updating dashboard KPIs:', error);
    return null;
  }
}

/**
 * Auto-create tenancy when tenant is assigned to property
 */
export async function createTenancyFromLease(leaseId: string) {
  const lease = await prisma.lease.findUnique({
    where: { id: leaseId },
    include: { tenant: { include: { unit: { include: { property: true } } } } },
  });

  if (!lease) return null;

  const property = lease.tenant.unit.property;

  // Calculate next invoice date (first of next month or lease start date)
  const nextInvoiceDate = new Date(lease.leaseStart);
  nextInvoiceDate.setMonth(nextInvoiceDate.getMonth() + 1);
  nextInvoiceDate.setDate(1);

  const tenancy = await prisma.tenancy.create({
    data: {
      propertyId: property.id,
      tenantId: lease.tenantId,
      leaseId: lease.id,
      leaseStart: lease.leaseStart,
      leaseEnd: lease.leaseEnd,
      monthlyRent: lease.rent,
      nextInvoiceDate,
      status: 'active',
    },
  });

  // Update property status
  await prisma.property.update({
    where: { id: property.id },
    data: { status: 'Occupied' },
  });

  // Update unit status
  await prisma.unit.update({
    where: { id: lease.unitId },
    data: { status: 'Occupied' },
  });

  // Auto-sync: Update dashboard KPIs
  await updateDashboardKPIs(property.id);

  return tenancy;
}

/**
 * Update property status when maintenance is filed
 */
export async function updatePropertyStatusOnMaintenance(maintenanceId: string) {
  const maintenance = await prisma.maintenanceRequest.findUnique({
    where: { id: maintenanceId },
    include: { property: true },
  });

  if (!maintenance) return;

  // Update property status if high priority
  if (maintenance.priority === 'high' || maintenance.priority === 'urgent') {
    await prisma.property.update({
      where: { id: maintenance.propertyId },
      data: { status: 'Under-Maintenance' },
    });
  }

  // Update maintenance status in property maintenance history
  const property = await prisma.property.findUnique({
    where: { id: maintenance.propertyId },
  });

  if (property) {
    // Note: maintenanceHistory field may not exist in schema
    // This is a placeholder for future implementation
    const maintenanceHistory: any[] = [];
    maintenanceHistory.push({
      id: maintenance.id,
      title: maintenance.issueTitle,
      date: maintenance.createdAt,
      status: maintenance.status,
    });

    // Note: Prisma doesn't support updating JSON fields directly in nested updates
    // This would need to be handled in the route handler
  }
}

