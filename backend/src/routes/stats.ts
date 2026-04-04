import express, { Response } from 'express';
import { Prisma } from '../prisma/client';
import prisma from '../prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';

// Helper function to format time ago
function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return 'Just now';
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
  }

  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 4) {
    return `${diffInWeeks} week${diffInWeeks > 1 ? 's' : ''} ago`;
  }

  const diffInMonths = Math.floor(diffInDays / 30);
  return `${diffInMonths} month${diffInMonths > 1 ? 's' : ''} ago`;
}

const router = (express as any).Router();

const columnExists = async (tableName: string, columnName: string) => {
  const rows = await prisma.$queryRaw<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND LOWER(table_name) = LOWER(${tableName})
        AND LOWER(column_name) = LOWER(${columnName})
    ) AS "exists";
  `;
  return Boolean(rows[0]?.exists);
};

// Get properties stats
router.get('/properties', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    // Get all property counts
    const totalProperties = await prisma.property.count({
      where: { isDeleted: false },
    });

    const totalMaintenanceRequests = await prisma.maintenanceRequest.count({
      where: { isDeleted: false },
    });

    const activeProperties = await prisma.property.count({
      where: {
        isDeleted: false,
        status: 'Active',
      },
    });

    const maintenanceProperties = await prisma.property.count({
      where: {
        isDeleted: false,
        status: 'Maintenance',
      },
    });

    const vacantProperties = await prisma.property.count({
      where: {
        isDeleted: false,
        status: 'Vacant',
      },
    });

    const propertiesForSale = await prisma.property.count({
      where: {
        isDeleted: false,
        status: 'For Sale',
      },
    });

    const soldProperties = await prisma.property.count({
      where: {
        isDeleted: false,
        status: 'Sold',
      },
    });

    // Get total sale value for properties for sale
    const saleValueResult = await prisma.sale.aggregate({
      where: {
        isDeleted: false,
        status: 'Completed',
      },
      _sum: {
        saleValue: true,
      },
    });

    const saleValue = saleValueResult._sum.saleValue || 0;

    // Get units stats - only count units from non-house properties
    const totalUnits = await prisma.unit.count({
      where: {
        isDeleted: false,
        property: {
          type: { not: 'house' },
          isDeleted: false,
        },
      },
    });

    const occupiedUnits = await prisma.unit.count({
      where: {
        isDeleted: false,
        status: 'Occupied',
        property: {
          type: { not: 'house' },
          isDeleted: false,
        },
      },
    });

    const vacantUnits = await prisma.unit.count({
      where: {
        isDeleted: false,
        status: 'Vacant',
        property: {
          type: { not: 'house' },
          isDeleted: false,
        },
      },
    });

    // Get house stats for hybrid occupancy calculation
    const totalHouses = await prisma.property.count({
      where: {
        type: 'house',
        isDeleted: false,
      },
    });

    const rentedOrSoldHouses = await prisma.property.count({
      where: {
        type: 'house',
        status: { in: ['For Rent', 'Sold'] },
        isDeleted: false,
      },
    });

    // Calculate hybrid occupancy rate: (occupiedUnits + rentedOrSoldHouses) / (totalUnits + totalHouses) * 100
    const totalOccupiable = totalUnits + totalHouses;
    const totalOccupied = occupiedUnits + rentedOrSoldHouses;
    const occupancyRate = totalOccupiable > 0
      ? Math.round((totalOccupied / totalOccupiable) * 100 * 10) / 10  // Round to 1 decimal
      : 0;
    const vacancyRate = totalUnits > 0 ? Math.round((vacantUnits / totalUnits) * 100) : 0;

    // Get monthly revenue (sum of all occupied units' rent)
    const monthlyRevenueResult = await prisma.unit.aggregate({
      where: {
        isDeleted: false,
        status: 'Occupied',
      },
      _sum: {
        monthlyRent: true,
      },
    });

    const monthlyRevenue = monthlyRevenueResult._sum.monthlyRent || 0;

    // Get tenants count
    const totalTenants = await prisma.tenant.count({
      where: { isDeleted: false },
    });

    // Calculate properties change (this month vs last month)
    const now = new Date();
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const propertiesThisMonth = await prisma.property.count({
      where: {
        isDeleted: false,
        createdAt: {
          gte: startOfThisMonth,
        },
      },
    });

    const propertiesLastMonth = await prisma.property.count({
      where: {
        isDeleted: false,
        createdAt: {
          gte: startOfLastMonth,
          lte: endOfLastMonth,
        },
      },
    });

    const propertiesChange =
      propertiesLastMonth > 0
        ? `+${propertiesThisMonth} this month`
        : propertiesThisMonth > 0
          ? `+${propertiesThisMonth} this month`
          : '+0 this month';

    // Calculate tenants change
    const tenantsThisMonth = await prisma.tenant.count({
      where: {
        isDeleted: false,
        createdAt: {
          gte: startOfThisMonth,
        },
      },
    });

    const tenantsLastMonth = await prisma.tenant.count({
      where: {
        isDeleted: false,
        createdAt: {
          gte: startOfLastMonth,
          lte: endOfLastMonth,
        },
      },
    });

    const tenantsChange =
      tenantsLastMonth > 0
        ? `+${tenantsThisMonth} this month`
        : tenantsThisMonth > 0
          ? `+${tenantsThisMonth} this month`
          : '+0 this month';

    // Get property type distribution
    const propertyTypeData = await prisma.property.groupBy({
      by: ['type'],
      where: { isDeleted: false },
      _count: {
        id: true,
      },
    });

    // Get property status distribution
    const propertyStatusData = await prisma.property.groupBy({
      by: ['status'],
      where: { isDeleted: false },
      _count: {
        id: true,
      },
    });

    // Format property type data for charts
    const formattedPropertyTypeData = propertyTypeData.map((item) => ({
      name: item.type || 'Unknown',
      value: item._count.id,
    }));

    // Format property status data for charts
    const formattedPropertyStatusData = propertyStatusData.map((item) => ({
      name: item.status || 'Unknown',
      value: item._count.id,
    }));

    // Generate property added trend data for last 6 months
    const propertiesAddedTrend = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
      const count = await prisma.property.count({
        where: { createdAt: { gte: start, lte: end }, isDeleted: false }
      });
      propertiesAddedTrend.push({
        month: start.toLocaleString('default', { month: 'short' }),
        amount: count
      });
    }

    // Get recent activities from Activity table
    let formattedActivities: any[] = [];
    try {
      // Check if Activity model exists in Prisma client
      if (prisma.activity) {
        const recentActivities = await prisma.activity.findMany({
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            type: true,
            action: true,
            entityName: true,
            message: true,
            createdAt: true,
            metadata: true,
          },
        });

        // Format activities for frontend
        formattedActivities = recentActivities.map((activity) => {
          const timeAgo = getTimeAgo(activity.createdAt);
          return {
            id: activity.id,
            type: activity.type,
            action: activity.action,
            message: activity.message,
            time: timeAgo,
            entityName: activity.entityName,
            metadata: activity.metadata,
          };
        });
      }
    } catch (error) {
      // If Activity table doesn't exist yet, return empty array
      console.warn('Activity table not available yet. Run: npx prisma generate && npx prisma migrate dev');
      formattedActivities = [];
    }

    res.json({
      success: true,
      data: {
        totalProperties,
        totalMaintenanceRequests,
        activeProperties,
        maintenanceProperties,
        vacantProperties,
        propertiesForSale,
        soldProperties,
        saleValue,
        totalUnits,
        occupiedUnits,
        vacantUnits,
        occupancyRate, // Already in percentage (0-100), rounded to 1 decimal
        vacancyRate,
        monthlyRevenue,
        totalTenants,
        propertiesChange,
        tenantsChange,
        propertyTypeData: formattedPropertyTypeData,
        propertyStatusData: formattedPropertyStatusData,
        propertiesAddedTrend,
        recentActivities: formattedActivities,
        // Additional fields for hybrid occupancy calculation
        totalHouses,
        rentedOrSoldHouses,
        totalOccupiable: totalOccupiable,
        totalOccupied: totalOccupied,
      },
    });
  } catch (error) {
    console.error('Get properties stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch properties stats',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get HR stats
router.get('/hr', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    // Get total employees
    const totalEmployees = await prisma.employee.count({
      where: { isDeleted: false },
    });

    // Get employees change (this month vs last month)
    const now = new Date();
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const employeesThisMonth = await prisma.employee.count({
      where: {
        isDeleted: false,
        createdAt: {
          gte: startOfThisMonth,
        },
      },
    });

    const employeesChange = employeesThisMonth > 0
      ? `+${employeesThisMonth} this month`
      : '+0 this month';

    // Get today's date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    // Get active today (employees with attendance marked as present or late)
    const activeToday = await prisma.attendance.count({
      where: {
        isDeleted: false,
        date: { gte: today, lte: endOfDay },
        status: { in: ['present', 'late', 'half-day'] },
      },
    });

    // Calculate attendance rate
    const attendanceRate = totalEmployees > 0
      ? Math.round((activeToday / totalEmployees) * 100)
      : 0;

    // Get pending leaves
    const pendingLeaves = await prisma.leaveRequest.count({
      where: {
        isDeleted: false,
        status: 'pending',
      },
    });

    // Get urgent leaves (within 3 days)
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    const urgentLeaves = await prisma.leaveRequest.count({
      where: {
        isDeleted: false,
        status: 'pending',
        startDate: { lte: threeDaysFromNow },
      },
    });

    // Calculate average work hours per week
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const attendanceRecords = await prisma.attendance.findMany({
      where: {
        isDeleted: false,
        date: { gte: oneWeekAgo },
        hours: { not: null },
      },
      select: {
        hours: true,
      },
    });

    const totalHours = attendanceRecords.reduce((sum, record) => sum + (record.hours || 0), 0);
    const avgWorkHours = attendanceRecords.length > 0
      ? Math.round((totalHours / attendanceRecords.length) * 10) / 10
      : 0;

    res.json({
      success: true,
      data: {
        totalEmployees,
        activeToday,
        pendingLeaves,
        avgWorkHours,
        employeesChange,
        attendanceRate,
        urgentLeaves,
      },
    });
  } catch (error) {
    console.error('Get HR stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch HR stats',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get CRM stats
router.get('/crm', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    // Get total leads for current user
    const totalLeads = await prisma.lead.count({
      where: { assignedToUserId: req.user?.id, isDeleted: false }
    });

    // Get active leads (new, qualified, negotiation)
    const activeLeads = await prisma.lead.count({
      where: {
        assignedToUserId: req.user?.id,
        isDeleted: false,
        status: { in: ['new', 'qualified', 'negotiation'] }
      }
    });

    // Get converted leads (won)
    const convertedLeads = await prisma.lead.count({
      where: {
        assignedToUserId: req.user?.id,
        isDeleted: false,
        status: 'won'
      }
    });

    // Calculate conversion rate
    const conversionRate = totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0;

    // Get leads by source for chart data
    const leadsBySource = await prisma.lead.groupBy({
      by: ['source'],
      _count: { id: true },
      where: { assignedToUserId: req.user?.id, isDeleted: false, source: { not: null } }
    });

    // Get leads by status for chart data
    const leadsByStatus = await prisma.lead.groupBy({
      by: ['status'],
      _count: { id: true },
      where: { assignedToUserId: req.user?.id, isDeleted: false }
    });

    // Get clients count (exclude deleted)
    const totalClients = await prisma.client.count({
      where: { isDeleted: false }
    });
    const activeClients = await prisma.client.count({
      where: {
        status: 'active',
        isDeleted: false
      }
    });

    // Get deals count
    const totalDeals = await prisma.deal.count();
    const activeDeals = await prisma.deal.count({
      where: { stage: { in: ['prospecting', 'proposal', 'negotiation'] } }
    });

    // Get dealers count
    const totalDealers = await prisma.dealer.count();

    // Format leads conversion data for charts
    const leadsConversionData = leadsBySource.map(item => ({
      name: item.source || 'Unknown',
      value: Number((item as any)._count?.id || 0)
    }));

    // Format leads by status data
    const leadsStatusData = leadsByStatus.map(item => ({
      name: item.status || 'Unknown',
      value: Number((item as any)._count?.id || 0)
    }));

    res.json({
      success: true,
      data: {
        totalLeads,
        activeLeads,
        convertedLeads,
        conversionRate,
        totalClients,
        activeClients,
        totalDeals,
        activeDeals,
        totalDealers,
        leadsConversionData,
        leadsStatusData
      },
    });
  } catch (error) {
    console.error('Get CRM stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch CRM stats',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get Finance stats (placeholder for now)
router.get('/finance', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const now = new Date();
    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    const startOfPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfPreviousMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    const outstandingStatuses = ['unpaid', 'overdue', 'pending'];

    const [hasTransactionType, hasLegacyType, hasTotalAmount, hasRemainingAmount] = await Promise.all([
      columnExists('Transaction', 'transactionType'),
      columnExists('Transaction', 'type'),
      columnExists('Transaction', 'totalAmount'),
      columnExists('Invoice', 'remainingAmount'),
    ]);

    const transactionSumField: 'totalAmount' | 'amount' = hasTotalAmount ? 'totalAmount' : 'amount';
    const invoiceSumField: 'remainingAmount' | 'amount' = hasRemainingAmount ? 'remainingAmount' : 'amount';

    const sumTransactionsByType = async (
      direction: 'income' | 'expense',
      dateRange?: { gte: Date; lte: Date }
    ): Promise<number> => {
      if (hasTransactionType) {
        const transactionSumSelection: any =
          transactionSumField === 'totalAmount' ? { totalAmount: true } : { amount: true };
        const aggregate = await prisma.transaction.aggregate({
          where: {
            transactionType: { equals: direction, mode: 'insensitive' as const },
            ...(dateRange ? { date: dateRange } : {}),
          },
          _sum: transactionSumSelection,
        });
        return transactionSumField === 'totalAmount'
          ? Number(aggregate._sum?.totalAmount || 0)
          : Number(aggregate._sum?.amount || 0);
      }

      if (hasLegacyType) {
        const valueColumn =
          transactionSumField === 'totalAmount' ? Prisma.sql`"totalAmount"` : Prisma.sql`"amount"`;
        const rows = dateRange
          ? await prisma.$queryRaw<{ sum: number }[]>(Prisma.sql`
              SELECT COALESCE(SUM(${valueColumn}), 0)::float AS sum
              FROM "Transaction"
              WHERE LOWER("type") = ${direction}
                AND "date" BETWEEN ${dateRange.gte} AND ${dateRange.lte}
            `)
          : await prisma.$queryRaw<{ sum: number }[]>(Prisma.sql`
              SELECT COALESCE(SUM(${valueColumn}), 0)::float AS sum
              FROM "Transaction"
              WHERE LOWER("type") = ${direction}
            `);
        return Number(rows[0]?.sum || 0);
      }

      return 0;
    };

    const statusFilter = (statuses: string[]): Prisma.InvoiceWhereInput => ({
      OR: statuses.map((status) => ({
        status: { equals: status, mode: 'insensitive' as const },
      })),
    });

    const sumOutstanding = async (where: Prisma.InvoiceWhereInput): Promise<number> => {
      const invoiceSumSelection: any =
        invoiceSumField === 'remainingAmount' ? { remainingAmount: true } : { amount: true };
      const aggregate = await prisma.invoice.aggregate({
        where,
        _sum: invoiceSumSelection,
      });
      return invoiceSumField === 'remainingAmount'
        ? Number(aggregate._sum?.remainingAmount || 0)
        : Number(aggregate._sum?.amount || 0);
    };

    const percentChange = (current: number, previous: number): number | null => {
      if (previous === 0) {
        return current === 0 ? 0 : null;
      }
      return Number((((current - previous) / previous) * 100).toFixed(2));
    };

    const [
      totalRevenue,
      monthlyRevenue,
      previousMonthlyRevenue,
      outstandingPayments,
      previousOutstanding,
      monthlyExpenses,
      previousMonthlyExpenses,
      totalCommissionsResult,
      commissionsThisMonthResult,
      commissionsPreviousMonthResult,
    ] = await Promise.all([
      sumTransactionsByType('income'),
      sumTransactionsByType('income', { gte: startOfCurrentMonth, lte: endOfCurrentMonth }),
      sumTransactionsByType('income', { gte: startOfPreviousMonth, lte: endOfPreviousMonth }),
      sumOutstanding(statusFilter(outstandingStatuses)),
      sumOutstanding({
        ...statusFilter(outstandingStatuses),
        dueDate: { lte: endOfPreviousMonth },
      }),
      sumTransactionsByType('expense', { gte: startOfCurrentMonth, lte: endOfCurrentMonth }),
      sumTransactionsByType('expense', { gte: startOfPreviousMonth, lte: endOfPreviousMonth }),
      prisma.commission.aggregate({
        _sum: { amount: true },
      }),
      prisma.commission.aggregate({
        where: {
          createdAt: {
            gte: startOfCurrentMonth,
            lte: endOfCurrentMonth,
          },
        },
        _sum: { amount: true },
      }),
      prisma.commission.aggregate({
        where: {
          createdAt: {
            gte: startOfPreviousMonth,
            lte: endOfPreviousMonth,
          },
        },
        _sum: { amount: true },
      }),
    ]);

    const dealerCommissions = totalCommissionsResult._sum.amount || 0;
    const commissionsThisMonth = commissionsThisMonthResult._sum.amount || 0;
    const commissionsPreviousMonth = commissionsPreviousMonthResult._sum.amount || 0;

    // Calculate rent revenue (income transactions excluding sale-related)
    const rentTransactions = await prisma.transaction.findMany({
      where: {
        transactionType: 'income',
        status: 'completed',
      },
      include: {
        transactionCategory: true,
      },
    });

    const rentRevenueTransactions = rentTransactions.filter((tx) => {
      const categoryName = tx.transactionCategory?.name?.toLowerCase() || '';
      const description = tx.description?.toLowerCase() || '';
      const isSale = categoryName.includes('sale') ||
        description.includes('sale') ||
        description.includes('property sale');
      return !isSale;
    });

    const totalRentRevenue = rentRevenueTransactions.reduce(
      (sum, tx) => sum + (tx.totalAmount || tx.amount || 0),
      0
    );

    // Get payments linked to invoices (rent payments)
    const rentPayments = await prisma.tenantPayment.findMany({
      where: {
        status: 'completed',
        invoice: {
          isNot: null,
        },
      },
    });

    const rentRevenueFromPayments = rentPayments.reduce(
      (sum, payment) => sum + (payment.amount || 0),
      0
    );

    const totalRentRevenueFinal = totalRentRevenue + rentRevenueFromPayments;

    // Calculate sale revenue from completed sales
    const completedSales = await prisma.sale.findMany({
      where: {
        status: { in: ['Completed', 'completed'] },
        isDeleted: false,
      },
    });

    const totalSaleRevenue = completedSales.reduce((sum, sale) => sum + (sale.saleValue || 0), 0);

    // Calculate total expenses
    const totalExpenses = await sumTransactionsByType('expense');

    // Calculate total revenue (sum of all realized income from payments and transactions)
    // Total Revenue = All Income Transactions + Rent Payments + Sale Revenue (not including expenses)
    // Note: totalRevenue includes all income transactions (rent, sale, and other)
    // rentRevenueFromPayments includes payments that are separate from transactions
    // totalSaleRevenue includes completed sales that are separate from transactions
    const calculatedTotalRevenue = totalRevenue + rentRevenueFromPayments + totalSaleRevenue;

    // Calculate total profit
    // Rent Profit = Rent Revenue - Expenses
    // Sale Profit = Sale Revenue - Property Costs
    const totalPropertyCost = completedSales.reduce(
      (sum, sale) => sum + (sale.actualPropertyValue || 0),
      0
    );
    const rentProfit = totalRentRevenueFinal - totalExpenses;
    const saleProfit = totalSaleRevenue - totalPropertyCost;
    const totalProfit = rentProfit + saleProfit;

    // Calculate monthly rent revenue
    const monthlyRentTransactions = rentRevenueTransactions.filter((tx) => {
      const txDate = new Date(tx.date);
      return txDate >= startOfCurrentMonth && txDate <= endOfCurrentMonth;
    });
    const monthlyRentRevenueFromTransactions = monthlyRentTransactions.reduce(
      (sum, tx) => sum + (tx.totalAmount || tx.amount || 0),
      0
    );
    const monthlyRentPayments = rentPayments.filter((payment) => {
      const paymentDate = new Date(payment.date);
      return paymentDate >= startOfCurrentMonth && paymentDate <= endOfCurrentMonth;
    });
    const monthlyRentRevenueFromPayments = monthlyRentPayments.reduce(
      (sum, payment) => sum + (payment.amount || 0),
      0
    );
    const monthlyRentRevenue = monthlyRentRevenueFromTransactions + monthlyRentRevenueFromPayments;

    // Calculate monthly sale revenue
    const monthlySales = completedSales.filter((sale) => {
      const saleDate = sale.saleDate ? new Date(sale.saleDate) : new Date(sale.createdAt);
      return saleDate >= startOfCurrentMonth && saleDate <= endOfCurrentMonth;
    });
    const monthlySaleRevenue = monthlySales.reduce((sum, sale) => sum + (sale.saleValue || 0), 0);

    // Calculate monthly profit
    const monthlyProfit = monthlyRentRevenue + monthlySaleRevenue - monthlyExpenses;

    // Calculate 6-month historical trend
    const financeTrendData = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
      const income = await sumTransactionsByType('income', { gte: start, lte: end });
      const expense = await sumTransactionsByType('expense', { gte: start, lte: end });
      financeTrendData.push({
        month: start.toLocaleString('default', { month: 'short' }),
        income,
        expense,
        cash: income - expense
      });
    }

    res.json({
      success: true,
      data: {
        totalRevenue: calculatedTotalRevenue,
        totalProfit,
        rentRevenue: totalRentRevenueFinal,
        saleRevenue: totalSaleRevenue,
        monthlyRevenue: monthlyRentRevenue + monthlySaleRevenue,
        monthlyProfit,
        revenueChangePercent: percentChange(monthlyRevenue, previousMonthlyRevenue),
        outstandingPayments,
        paymentsChangePercent: percentChange(outstandingPayments, previousOutstanding),
        monthlyExpenses,
        expensesChangePercent: percentChange(monthlyExpenses, previousMonthlyExpenses),
        dealerCommissions,
        commissionsChangePercent: percentChange(commissionsThisMonth, commissionsPreviousMonth),
      },
    });
  } catch (error) {
    console.error('Get Finance stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch Finance stats',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get dashboard alerts
router.get('/alerts', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const today = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);

    // Get overdue invoices
    const overdueInvoices = await prisma.invoice.findMany({
      where: {
        status: { in: ['unpaid', 'partial', 'overdue'] },
        dueDate: { lt: today },
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        property: {
          select: {
            id: true,
            name: true,
            propertyCode: true,
          },
        },
      },
      orderBy: { dueDate: 'asc' },
      take: 10,
    });

    // Get expiring leases (within 30 days)
    const expiringLeases = await prisma.lease.findMany({
      where: {
        status: 'Active',
        leaseEnd: {
          gte: today,
          lte: thirtyDaysFromNow,
        },
        isDeleted: false,
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        unit: {
          include: {
            property: {
              select: {
                id: true,
                name: true,
                propertyCode: true,
              },
            },
          },
        },
      },
      orderBy: { leaseEnd: 'asc' },
      take: 10,
    });

    // Get properties with low occupancy (< 50%)
    const properties = await prisma.property.findMany({
      where: {
        isDeleted: false,
        type: { not: 'house' },
      },
      include: {
        units: {
          where: { isDeleted: false },
        },
        tenancies: {
          where: { status: 'active' },
        },
      },
    });

    const lowOccupancyProperties = properties
      .map((property) => {
        const totalUnits = property.units.length;
        const occupiedUnits = property.tenancies.length;
        const occupancyRate = totalUnits > 0 ? (occupiedUnits / totalUnits) * 100 : 0;
        return {
          property: {
            id: property.id,
            name: property.name,
            propertyCode: property.propertyCode,
          },
          occupancyRate: Math.round(occupancyRate * 10) / 10,
          totalUnits,
          occupiedUnits,
          vacantUnits: totalUnits - occupiedUnits,
        };
      })
      .filter((p) => p.occupancyRate < 50 && p.totalUnits > 0)
      .sort((a, b) => a.occupancyRate - b.occupancyRate)
      .slice(0, 10);

    // Get pending maintenance requests
    const pendingMaintenance = await prisma.maintenanceRequest.findMany({
      where: {
        status: { in: ['open', 'assigned', 'in-progress'] },
        isDeleted: false,
      },
      include: {
        property: {
          select: {
            id: true,
            name: true,
            propertyCode: true,
          },
        },
        tenant: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: 10,
    });

    // Calculate totals
    const totalOverdueAmount = overdueInvoices.reduce(
      (sum, inv) => sum + (inv.remainingAmount || inv.totalAmount),
      0
    );

    res.json({
      success: true,
      data: {
        overdueInvoices: {
          count: overdueInvoices.length,
          totalAmount: Math.round(totalOverdueAmount * 100) / 100,
          invoices: overdueInvoices.map((inv) => ({
            id: inv.id,
            invoiceNumber: inv.invoiceNumber,
            tenant: inv.tenant,
            property: inv.property,
            amount: inv.remainingAmount || inv.totalAmount,
            dueDate: inv.dueDate,
            daysOverdue: Math.floor(
              (today.getTime() - inv.dueDate.getTime()) / (1000 * 60 * 60 * 24)
            ),
          })),
        },
        expiringLeases: {
          count: expiringLeases.length,
          leases: expiringLeases.map((lease) => ({
            id: lease.id,
            leaseNumber: lease.leaseNumber,
            tenant: lease.tenant,
            property: lease.unit.property,
            unit: {
              id: lease.unit.id,
              unitName: lease.unit.unitName,
            },
            leaseEnd: lease.leaseEnd,
            daysRemaining: Math.ceil(
              (lease.leaseEnd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
            ),
          })),
        },
        lowOccupancy: {
          count: lowOccupancyProperties.length,
          properties: lowOccupancyProperties,
        },
        pendingMaintenance: {
          count: pendingMaintenance.length,
          requests: pendingMaintenance.map((req) => ({
            id: req.id,
            issueTitle: req.issueTitle,
            priority: req.priority,
            status: req.status,
            property: req.property,
            tenant: req.tenant,
            createdAt: req.createdAt,
          })),
        },
        summary: {
          totalAlerts:
            overdueInvoices.length +
            expiringLeases.length +
            lowOccupancyProperties.length +
            pendingMaintenance.length,
          criticalAlerts: overdueInvoices.length + pendingMaintenance.filter((r) => r.priority === 'urgent').length,
        },
      },
    });
  } catch (error) {
    console.error('Get dashboard alerts error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard alerts',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get revenue vs expense graph data
router.get('/finance/revenue-vs-expense', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { months = 6 } = req.query;
    const monthsCount = parseInt(months as string) || 6;

    const now = new Date();
    const data: any[] = [];

    for (let i = monthsCount - 1; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);

      const monthLabel = monthStart.toLocaleString('default', { month: 'short', year: 'numeric' });

      // Get revenue (income) for this month
      const revenueResult = await prisma.financeLedger.aggregate({
        where: {
          category: 'credit',
          date: {
            gte: monthStart,
            lte: monthEnd,
          },
          isDeleted: false,
        },
        _sum: {
          amount: true,
        },
      });

      // Get expenses for this month
      const expenseResult = await prisma.financeLedger.aggregate({
        where: {
          category: 'debit',
          date: {
            gte: monthStart,
            lte: monthEnd,
          },
          isDeleted: false,
        },
        _sum: {
          amount: true,
        },
      });

      const revenue = revenueResult._sum?.amount || 0;
      const expenses = expenseResult._sum?.amount || 0;
      const profit = revenue - expenses;

      data.push({
        month: monthLabel,
        revenue: Math.round(revenue * 100) / 100,
        expenses: Math.round(expenses * 100) / 100,
        profit: Math.round(profit * 100) / 100,
      });
    }

    res.json({
      success: true,
      data,
    });
  } catch (error: any) {
    console.error('Get revenue vs expense data error:', error);

    // Check if it's a column not found error
    if (error?.code === 'P2022' || error?.message?.includes('column') || error?.message?.includes('does not exist')) {
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch revenue vs expense data',
        message: error instanceof Error ? error.message : 'Unknown error',
        hint: 'This usually means the database schema is out of sync with the code.',
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to fetch revenue vs expense data',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get occupancy trend graph data
router.get('/properties/occupancy-trend', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { months = 6 } = req.query;
    const monthsCount = parseInt(months as string) || 6;

    const now = new Date();
    const data: any[] = [];

    for (let i = monthsCount - 1; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);

      const monthLabel = monthStart.toLocaleString('default', { month: 'short', year: 'numeric' });

      // Get units that existed at the end of this month
      const totalUnits = await prisma.unit.count({
        where: {
          isDeleted: false,
          createdAt: { lte: monthEnd },
          property: {
            type: { not: 'house' },
            isDeleted: false,
          },
        },
      });

      // Get occupied units at the end of this month (using leases)
      const occupiedUnits = await prisma.lease.count({
        where: {
          isDeleted: false,
          status: 'Active',
          leaseStart: { lte: monthEnd },
          OR: [
            { leaseEnd: { gte: monthEnd } },
          ],
        },
      });

      // Also count houses that were rented/sold
      const rentedHouses = await prisma.property.count({
        where: {
          type: 'house',
          isDeleted: false,
          status: { in: ['For Rent', 'Sold'] },
          createdAt: { lte: monthEnd },
        },
      });

      const totalOccupiable = totalUnits + rentedHouses;
      const totalOccupied = occupiedUnits + rentedHouses;
      const occupancyRate = totalOccupiable > 0
        ? Math.round((totalOccupied / totalOccupiable) * 100 * 10) / 10
        : 0;

      data.push({
        month: monthLabel,
        occupancyRate,
        totalUnits: totalOccupiable,
        occupiedUnits: totalOccupied,
        vacantUnits: totalOccupiable - totalOccupied,
      });
    }

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Get occupancy trend data error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch occupancy trend data',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
