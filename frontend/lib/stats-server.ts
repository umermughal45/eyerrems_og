import prisma from './db'
// import { Prisma } from '@prisma/client'

// Helper function to format time ago
function getTimeAgo(date: Date): string {
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diffInSeconds < 60) return 'Just now'

  const diffInMinutes = Math.floor(diffInSeconds / 60)
  if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`

  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`

  const diffInDays = Math.floor(diffInHours / 24)
  if (diffInDays < 7) return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`

  const diffInWeeks = Math.floor(diffInDays / 7)
  if (diffInWeeks < 4) return `${diffInWeeks} week${diffInWeeks > 1 ? 's' : ''} ago`

  const diffInMonths = Math.floor(diffInDays / 30)
  return `${diffInMonths} month${diffInMonths > 1 ? 's' : ''} ago`
}

const columnExists = async (tableName: string, columnName: string) => {
  try {
    const rows = await prisma.$queryRaw<{ exists: boolean }[]>`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND LOWER(table_name) = LOWER(${tableName})
          AND LOWER(column_name) = LOWER(${columnName})
      ) AS "exists";
    `
    return Boolean(rows[0]?.exists)
  } catch (error) {
    return false
  }
}

export async function getPropertiesStatsServer() {
  const totalProperties = await prisma.property.count({
    where: { isDeleted: false },
  })

  const totalMaintenanceRequests = await prisma.maintenanceRequest.count({
    where: { isDeleted: false },
  })

  const activeProperties = await prisma.property.count({
    where: { isDeleted: false, status: 'Active' },
  })

  const totalUnits = await prisma.unit.count({
    where: {
      isDeleted: false,
      property: { type: { not: 'house' }, isDeleted: false },
    },
  })

  const occupiedUnits = await prisma.unit.count({
    where: {
      isDeleted: false,
      status: 'Occupied',
      property: { type: { not: 'house' }, isDeleted: false },
    },
  })

  const totalHouses = await prisma.property.count({
    where: { type: 'house', isDeleted: false },
  })

  const rentedOrSoldHouses = await prisma.property.count({
    where: {
      type: 'house',
      status: { in: ['For Rent', 'Sold'] },
      isDeleted: false,
    },
  })

  const totalOccupiable = totalUnits + totalHouses
  const totalOccupied = occupiedUnits + rentedOrSoldHouses
  const occupancyRate = totalOccupiable > 0 ? Math.round((totalOccupied / totalOccupiable) * 100 * 10) / 10 : 0

  const monthlyRevenueResult = await prisma.unit.aggregate({
    where: { isDeleted: false, status: 'Occupied' },
    _sum: { monthlyRent: true },
  })

  const totalTenants = await prisma.tenant.count({
    where: { isDeleted: false },
  })

  const now = new Date()
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const propertiesThisMonth = await prisma.property.count({
    where: { isDeleted: false, createdAt: { gte: startOfThisMonth } },
  })
  const propertiesChange = `+${propertiesThisMonth} this month`

  const tenantsThisMonth = await prisma.tenant.count({
    where: { isDeleted: false, createdAt: { gte: startOfThisMonth } },
  })
  const tenantsChange = `+${tenantsThisMonth} this month`

  const propertyTypeData = await prisma.property.groupBy({
    by: ['type'],
    where: { isDeleted: false },
    _count: { id: true },
  })

  const recentActivities = (await prisma.activity.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
  })) || []

  return {
    totalProperties,
    totalMaintenanceRequests,
    activeProperties,
    totalUnits,
    occupiedUnits,
    occupancyRate,
    monthlyRevenue: monthlyRevenueResult._sum.monthlyRent || 0,
    totalTenants,
    propertiesChange,
    tenantsChange,
    propertyTypeData: propertyTypeData.map((item: any) => ({
      name: item.type || 'Unknown',
      value: item._count.id,
    })),
    recentActivities: recentActivities.map((activity: any) => ({
      id: activity.id,
      type: activity.type,
      action: activity.action,
      message: activity.message,
      time: getTimeAgo(activity.createdAt),
      entityName: activity.entityName,
      createdAt: activity.createdAt,
    })),
  }
}

export async function getHRStatsServer() {
  const totalEmployees = await prisma.employee.count({
    where: { isDeleted: false },
  })

  const now = new Date()
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const employeesThisMonth = await prisma.employee.count({
    where: { isDeleted: false, createdAt: { gte: startOfThisMonth } },
  })

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const endOfDay = new Date()
  endOfDay.setHours(23, 59, 59, 999)

  const activeToday = await prisma.attendance.count({
    where: {
      isDeleted: false,
      date: { gte: today, lte: endOfDay },
      status: { in: ['present', 'late', 'half-day'] },
    },
  })

  // Get pending leaves
  const pendingLeaves = await prisma.leaveRequest.count({
    where: { isDeleted: false, status: 'pending' },
  })

  // Get urgent leaves (within 3 days)
  const threeDaysFromNow = new Date()
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3)
  const urgentLeaves = await prisma.leaveRequest.count({
    where: {
      isDeleted: false,
      status: 'pending',
      startDate: { lte: threeDaysFromNow },
    },
  })

  // Calculate average work hours per week
  const oneWeekAgo = new Date()
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

  const attendanceRecords = await prisma.attendance.findMany({
    where: {
      isDeleted: false,
      date: { gte: oneWeekAgo },
      hours: { not: null },
    },
    select: { hours: true },
  })

  const totalHours = attendanceRecords.reduce((sum: number, record: any) => sum + (record.hours || 0), 0)
  const avgWorkHours = attendanceRecords.length > 0
    ? Math.round((totalHours / attendanceRecords.length) * 10) / 10
    : 0

  return {
    totalEmployees,
    activeToday,
    pendingLeaves,
    urgentLeaves,
    avgWorkHours,
    employeesChange: `+${employeesThisMonth} this month`,
    attendanceRate: totalEmployees > 0 ? Math.round((activeToday / totalEmployees) * 100) : 0,
  }
}

export async function getCRMStatsServer() {
  const totalLeads = await prisma.lead.count({ where: { isDeleted: false } })
  // Active leads (new, qualified, negotiation)
  const activeLeads = await prisma.lead.count({
    where: {
      isDeleted: false,
      status: { in: ['new', 'qualified', 'negotiation'] }
    }
  })

  // Converted leads (won)
  const convertedLeads = await prisma.lead.count({
    where: {
      isDeleted: false,
      status: 'won'
    }
  })

  // Conversion rate
  const conversionRate = totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0

  const totalClients = await prisma.client.count({ where: { isDeleted: false } })
  // Active clients
  const activeClients = await prisma.client.count({
    where: { status: 'active', isDeleted: false }
  })

  const totalDeals = await prisma.deal.count()
  // Active deals
  const activeDeals = await prisma.deal.count({
    where: { stage: { in: ['prospecting', 'proposal', 'negotiation'] } }
  })

  const totalDealers = await prisma.dealer.count()
  // Leads by source (for chart)
  const leadsBySource = await prisma.lead.groupBy({
    by: ['source'],
    _count: { id: true },
    where: { isDeleted: false, source: { not: null } }
  })

  // Leads by status (for chart)
  const leadsByStatus = await prisma.lead.groupBy({
    by: ['status'],
    _count: { id: true },
    where: { isDeleted: false }
  })

  return {
    totalLeads,
    activeLeads,
    convertedLeads,
    conversionRate,
    totalClients,
    activeClients,
    totalDeals,
    activeDeals,
    totalDealers,
    leadsConversionData: leadsBySource.map((item: any) => ({
      name: item.source || 'Unknown',
      value: item._count.id
    })),
    leadsStatusData: leadsByStatus.map((item: any) => ({
      name: item.status || 'Unknown',
      value: item._count.id
    }))
  }
}

export async function getFinanceStatsServer() {
  const [hasTotalAmount, hasRemainingAmount] = await Promise.all([
    columnExists('Transaction', 'totalAmount'),
    columnExists('Invoice', 'remainingAmount'),
  ])

  const transactionSumField = hasTotalAmount ? 'totalAmount' : 'amount'
  const invoiceSumField = hasRemainingAmount ? 'remainingAmount' : 'amount'

  const totalRevenueAggregate = await (prisma.transaction as any).aggregate({
    where: { transactionType: { equals: 'income', mode: 'insensitive' } },
    _sum: { [transactionSumField]: true },
  })

  const totalRevenue = Number(totalRevenueAggregate._sum?.[transactionSumField] || 0)

  const outstandingAggregate = await (prisma.invoice as any).aggregate({
    where: { status: { in: ['unpaid', 'partial', 'overdue'], mode: 'insensitive' } },
    _sum: { [invoiceSumField]: true },
  })

  const outstandingPayments = Number(outstandingAggregate._sum?.[invoiceSumField] || 0)

  const now = new Date()
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const endOfThisMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

  const monthlyExpensesAggregate = await (prisma.transaction as any).aggregate({
    where: {
      transactionType: { equals: 'expense', mode: 'insensitive' },
      date: { gte: startOfThisMonth, lte: endOfThisMonth },
    },
    _sum: { [transactionSumField]: true },
  })

  const monthlyExpenses = Number(monthlyExpensesAggregate._sum?.[transactionSumField] || 0)

  const totalCommissions = await prisma.commission.aggregate({
    _sum: { amount: true },
  })

  return {
    totalRevenue,
    outstandingPayments,
    monthlyExpenses,
    dealerCommissions: totalCommissions._sum.amount || 0,
  }
}

export async function getRevenueVsExpenseServer(monthsCount = 12) {
  const now = new Date()
  const data = []

  for (let i = monthsCount - 1; i >= 0; i--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999)
    const monthLabel = monthStart.toLocaleString('default', { month: 'short', year: 'numeric' })

    const revenueResult = await prisma.financeLedger.aggregate({
      where: { category: 'credit', date: { gte: monthStart, lte: monthEnd }, isDeleted: false },
      _sum: { amount: true },
    })

    const expenseResult = await prisma.financeLedger.aggregate({
      where: { category: 'debit', date: { gte: monthStart, lte: monthEnd }, isDeleted: false },
      _sum: { amount: true },
    })

    const revenue = revenueResult._sum?.amount || 0
    const expenses = expenseResult._sum?.amount || 0

    data.push({
      month: monthLabel,
      revenue: Math.round(revenue),
      profit: Math.round(revenue - expenses),
    })
  }

  return data
}

export async function getDashboardDataServer() {
  const [
    propsData,
    hrData,
    crmData,
    financeData,
    salesData,
    leasesData,
    revenueVsExpense,
    allProperties
  ] = await Promise.all([
    getPropertiesStatsServer(),
    getHRStatsServer(),
    getCRMStatsServer(),
    getFinanceStatsServer(),
    prisma.sale.findMany({ where: { isDeleted: false } }),
    prisma.lease.findMany({ where: { isDeleted: false } }),
    getRevenueVsExpenseServer(12),
    prisma.property.findMany({
      where: { isDeleted: false },
      include: {
        _count: {
          select: { units: { where: { isDeleted: false } } }
        }
      }
    })
  ])

  return {
    propsData,
    hrData,
    crmData,
    financeData,
    salesData: JSON.parse(JSON.stringify(salesData)),
    leasesData: JSON.parse(JSON.stringify(leasesData)),
    revenueVsExpense,
    allProperties: JSON.parse(JSON.stringify(allProperties))
  }
}

export async function getFinancePageStatsServer() {
  const [financeData, financeTrendData] = await Promise.all([
    getFinanceStatsServer(),
    getRevenueVsExpenseServer(6),
  ])

  return {
    ...financeData,
    financeTrendData,
  }
}

export async function getCRMPageStatsServer() {
  const [
    crmData,
    leads,
    clients,
    deals,
    commissions
  ] = await Promise.all([
    getCRMStatsServer(),
    prisma.lead.findMany({ where: { isDeleted: false } }),
    prisma.client.findMany({ where: { isDeleted: false } }),
    prisma.deal.findMany({ where: { isDeleted: false } }),
    prisma.commission.findMany(),
  ])

  // Move some calculation logic here for "instant" feel
  const pipelineData = [
    { stage: "New", count: leads.filter((l: any) => (l.status || "").toLowerCase() === "new").length, color: "#3b82f6" },
    { stage: "Qualified", count: leads.filter((l: any) => (l.status || "").toLowerCase() === "qualified").length, color: "#8b5cf6" },
    { stage: "Proposal", count: deals.filter((d: any) => (d.stage || "").toLowerCase() === "proposal").length, color: "#f59e0b" },
    { stage: "Negotiation", count: deals.filter((d: any) => (d.stage || "").toLowerCase() === "negotiation").length, color: "#ef4444" },
    { stage: "Closing", count: deals.filter((d: any) => ["closing", "closed-won", "won"].includes((d.stage || "").toLowerCase())).length, color: "#10b981" },
  ]

  const recentActivities: any[] = []
  leads.slice(0, 5).forEach((lead: any) => {
    recentActivities.push({
      id: `lead-${lead.id}`,
      type: "lead",
      action: "created",
      title: `New lead: ${lead.name}`,
      timestamp: lead.createdAt.toISOString(),
      icon: "UserPlus",
    })
  })
  clients.slice(0, 5).forEach((client: any) => {
    recentActivities.push({
      id: `client-${client.id}`,
      type: "client",
      action: "created",
      title: `New client: ${client.name}`,
      timestamp: client.createdAt.toISOString(),
      icon: "Users",
    })
  })
  
  recentActivities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  return {
    ...crmData,
    pipelineData,
    recentActivities: recentActivities.slice(0, 10),
    leadsCount: leads.length,
    clientsCount: clients.length,
    dealsCount: deals.length,
    // Add other fields needed by CRMView
  }
}

export async function getPropertiesDetailsServer(searchTerm?: string) {
  const [statsData, properties] = await Promise.all([
    getPropertiesStatsServer(),
    prisma.property.findMany({
      where: {
        isDeleted: false,
        OR: searchTerm ? [
          { name: { contains: searchTerm, mode: 'insensitive' } },
          { location: { contains: searchTerm, mode: 'insensitive' } },
          { address: { contains: searchTerm, mode: 'insensitive' } },
        ] : undefined
      },
      include: {
        locationNode: true,
        _count: {
          select: { units: { where: { isDeleted: false } } }
        }
      }
    })
  ])

  return {
    statsData,
    properties: JSON.parse(JSON.stringify(properties))
  }
}

export async function getTenantsDetailsServer() {
  const tenants = await prisma.tenant.findMany({
    where: { isDeleted: false },
    include: {
      unit: {
        include: {
          property: true
        }
      },
      leases: {
        where: { isDeleted: false },
        orderBy: { createdAt: 'desc' },
        take: 1
      }
    }
  })

  return {
    tenants: JSON.parse(JSON.stringify(tenants))
  }
}

export async function getSalesDetailsServer() {
  const sales = await prisma.sale.findMany({
    where: { isDeleted: false },
    include: {
      property: true,
      buyers: {
        where: { isDeleted: false }
      }
    }
  })

  return {
    sales: JSON.parse(JSON.stringify(sales))
  }
}

export async function getEmployeesDetailsServer() {
  const [employees, statsData] = await Promise.all([
    prisma.employee.findMany({
      where: { isDeleted: false },
      orderBy: { joinDate: 'desc' }
    }),
    getHRStatsServer()
  ])

  return {
    employees: JSON.parse(JSON.stringify(employees)),
    statsData
  }
}
