/**
 * Financial Reports Service
 * Generates Income Statement, Cash Flow, Closing Balance reports
 */

import prisma from '../prisma/client';

/**
 * Generate Income Statement
 */
export async function generateIncomeStatement(startDate: Date, endDate: Date, propertyId?: string) {
  const where: any = {
    isDeleted: false,
    date: {
      gte: startDate,
      lte: endDate,
    },
  };

  if (propertyId) {
    where.propertyId = propertyId;
  }

  const [incomeEntries, expenseEntries] = await Promise.all([
    prisma.financeLedger.findMany({
      where: { ...where, category: 'credit' },
      include: { 
        deal: {
          include: {
            property: { select: { id: true, name: true, propertyCode: true } },
            client: { select: { id: true, name: true, clientCode: true } }
          }
        },
      },
    }),
    prisma.financeLedger.findMany({
      where: { ...where, category: 'debit' },
      include: { 
        deal: {
          include: {
            property: { select: { id: true, name: true, propertyCode: true } },
            client: { select: { id: true, name: true, clientCode: true } }
          }
        },
      },
    }),
  ]);

  const totalRevenue = incomeEntries.reduce((sum, entry) => sum + entry.amount, 0);
  const totalExpenses = expenseEntries.reduce((sum, entry) => sum + entry.amount, 0);
  const netIncome = totalRevenue - totalExpenses;

  // Group income by source
  const incomeBySource: { [key: string]: number } = {};
  incomeEntries.forEach((entry) => {
    const source = entry.referenceType || 'other';
    incomeBySource[source] = (incomeBySource[source] || 0) + entry.amount;
  });

  // Group expenses by category
  const expensesByCategory: { [key: string]: number } = {};
  expenseEntries.forEach((entry) => {
    const category = entry.description?.split(':')[0] || 'other';
    expensesByCategory[category] = (expensesByCategory[category] || 0) + entry.amount;
  });

  return {
    period: {
      startDate,
      endDate,
    },
    revenue: {
      total: totalRevenue,
      breakdown: incomeBySource,
      entries: incomeEntries,
    },
    expenses: {
      total: totalExpenses,
      breakdown: expensesByCategory,
      entries: expenseEntries,
    },
    netIncome,
    netIncomePercent: totalRevenue > 0 ? (netIncome / totalRevenue) * 100 : 0,
  };
}

/**
 * Generate Cash Flow Statement
 */
export async function generateCashFlowStatement(startDate: Date, endDate: Date, propertyId?: string) {
  const where: any = {
    isDeleted: false,
    date: {
      gte: startDate,
      lte: endDate,
    },
  };

  if (propertyId) {
    where.propertyId = propertyId;
  }

  // Get all payments (cash inflows)
  const payments = await prisma.tenantPayment.findMany({
    where: {
      date: {
        gte: startDate,
        lte: endDate,
      },
      status: 'completed',
      ...(propertyId ? {
        invoice: {
          propertyId,
        },
      } : {}),
    },
    include: { tenant: true, invoice: { include: { property: true } } },
  });

  // Get all expenses paid (cash outflows)
  const expenses = await prisma.financeLedger.findMany({
    where: {
      ...where,
      transactionType: 'debit',
      referenceType: { in: ['property_expense', 'maintenance', 'salary'] },
    },
    include: { 
      deal: {
        include: {
          property: { select: { id: true, name: true, propertyCode: true } }
        }
      },
    },
  });

  const cashInflows = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const cashOutflows = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const netCashFlow = cashInflows - cashOutflows;

  return {
    period: {
      startDate,
      endDate,
    },
    operatingActivities: {
      cashInflows: {
        rentPayments: payments
          .filter((p) => p.invoice)
          .reduce((sum, p) => sum + p.amount, 0),
        dealPayments: 0, // Can be added if deal payments tracked separately
        total: cashInflows,
      },
      cashOutflows: {
        propertyExpenses: expenses
          .filter((e) => e.referenceType === 'property_expense')
          .reduce((sum, e) => sum + e.amount, 0),
        maintenance: expenses
          .filter((e) => e.referenceType === 'maintenance')
          .reduce((sum, e) => sum + e.amount, 0),
        salaries: expenses
          .filter((e) => e.referenceType === 'salary')
          .reduce((sum, e) => sum + e.amount, 0),
        total: cashOutflows,
      },
    },
    netCashFlow,
    payments,
    expenses,
  };
}

/**
 * Generate Closing Balance Report (Trial Balance)
 */
export async function generateClosingBalance(asOfDate: Date, propertyId?: string) {
  const where: any = {
    isDeleted: false,
    date: {
      lte: asOfDate,
    },
  };

  if (propertyId) {
    where.propertyId = propertyId;
  }

  const [incomeEntries, expenseEntries, invoices, payments] = await Promise.all([
    prisma.financeLedger.findMany({
      where: { ...where, category: 'income' },
    }),
    prisma.financeLedger.findMany({
      where: { ...where, category: 'expense' },
    }),
    prisma.invoice.findMany({
      where: {
        billingDate: { lte: asOfDate },
        status: { notIn: ['cancelled'] },
      },
    }),
    prisma.tenantPayment.findMany({
      where: {
        date: { lte: asOfDate },
        status: 'completed',
      },
    }),
  ]);

  const totalIncome = incomeEntries.reduce((sum, e) => sum + e.amount, 0);
  const totalExpenses = expenseEntries.reduce((sum, e) => sum + e.amount, 0);
  const totalInvoiced = invoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
  const totalPaid = payments.reduce((sum, pay) => sum + pay.amount, 0);
  const totalOutstanding = invoices
    .filter((inv) => inv.status !== 'paid')
    .reduce((sum, inv) => sum + inv.remainingAmount, 0);

  const closingBalance = totalIncome - totalExpenses;
  const cashBalance = totalPaid - totalExpenses;

  return {
    asOfDate,
    income: {
      total: totalIncome,
      invoiced: totalInvoiced,
      received: totalPaid,
    },
    expenses: {
      total: totalExpenses,
    },
    balances: {
      netIncome: closingBalance,
      cash: cashBalance,
      outstanding: totalOutstanding,
    },
    summary: {
      totalIncome,
      totalExpenses,
      netIncome: closingBalance,
      cashBalance,
      outstandingReceivables: totalOutstanding,
    },
  };
}

/**
 * Calculate overdue invoices with late fees
 */
export async function calculateOverdueInvoices() {
  const today = new Date();
  
  const invoices = await prisma.invoice.findMany({
    where: {
      status: { in: ['unpaid', 'partial', 'overdue'] },
      dueDate: { lt: today },
    },
    include: { tenant: true, property: true },
  });

  const overdueInvoices = invoices.map((invoice) => {
    const daysOverdue = Math.floor(
      (today.getTime() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Calculate late fee based on lateFeeRule
    let lateFee = 0;
    if (invoice.lateFeeRule === 'fixed') {
      // Assuming fixed fee per day or fixed amount - adjust as needed
      lateFee = daysOverdue * 100; // Example: 100 per day
    } else if (invoice.lateFeeRule === 'percentage') {
      // Assuming percentage per day or month
      lateFee = (invoice.totalAmount * 0.02 * daysOverdue) / 30; // 2% per 30 days
    }

    const totalDue = invoice.remainingAmount + lateFee;

    return {
      ...invoice,
      daysOverdue,
      lateFee,
      totalDue,
    };
  });

  const totalOverdueAmount = overdueInvoices.reduce((sum, inv) => sum + inv.remainingAmount, 0);
  const totalLateFees = overdueInvoices.reduce((sum, inv) => sum + inv.lateFee, 0);

  // Update invoice status to overdue
  await prisma.invoice.updateMany({
    where: {
      id: { in: overdueInvoices.map((inv) => inv.id) },
      status: { notIn: ['paid', 'cancelled'] },
    },
    data: { status: 'overdue' },
  });

  return {
    invoices: overdueInvoices,
    summary: {
      count: overdueInvoices.length,
      totalOverdueAmount,
      totalLateFees,
      totalDue: totalOverdueAmount + totalLateFees,
    },
  };
}

