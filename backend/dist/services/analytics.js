"use strict";
/**
 * Dashboard Analytics Service
 * Provides interactive analytics and reporting
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPropertyDashboard = getPropertyDashboard;
exports.getOverallDashboard = getOverallDashboard;
exports.getRevenueTrends = getRevenueTrends;
exports.getExpenseTrends = getExpenseTrends;
exports.getTopProperties = getTopProperties;
const client_1 = __importDefault(require("../prisma/client"));
/**
 * Get property dashboard data
 */
async function getPropertyDashboard(propertyId) {
    const property = await client_1.default.property.findUnique({
        where: { id: propertyId },
        include: {
            tenancies: {
                where: { status: 'active' },
                include: { tenant: true },
            },
            propertyExpenses: {
                where: { isDeleted: false },
                orderBy: { date: 'desc' },
                take: 10,
            },
            maintenanceRequests: {
                where: { isDeleted: false },
                orderBy: { createdAt: 'desc' },
                take: 10,
            },
            deals: {
                where: { isDeleted: false },
                include: {
                    financeLedgers: {
                        where: { isDeleted: false },
                        orderBy: { date: 'desc' },
                    },
                },
            },
        },
    });
    if (!property) {
        throw new Error('Property not found');
    }
    // Get all finance ledgers from deals
    const allFinanceLedgers = property.deals.flatMap((deal) => deal.financeLedgers);
    // Calculate income (from invoices and payments)
    const income = allFinanceLedgers
        .filter((ledger) => ledger.category === 'credit' || (ledger.amount > 0 && ledger.category !== 'debit'))
        .reduce((sum, ledger) => sum + ledger.amount, 0);
    // Calculate expenses
    const expenses = allFinanceLedgers
        .filter((ledger) => ledger.category === 'debit' || (ledger.amount < 0 && ledger.category !== 'credit'))
        .reduce((sum, ledger) => sum + Math.abs(ledger.amount), 0);
    // Calculate net profit
    const netProfit = income - expenses;
    // Get occupancy rate
    const totalUnits = property.totalUnits || 1;
    const occupiedUnits = property.tenancies.length;
    const occupancyRate = (occupiedUnits / totalUnits) * 100;
    // Get maintenance stats
    const openMaintenance = property.maintenanceRequests.filter((req) => req.status !== 'completed' && req.status !== 'cancelled').length;
    return {
        property: {
            id: property.id,
            name: property.name,
            code: property.propertyCode,
            status: property.status,
            type: property.type,
        },
        financials: {
            income,
            expenses,
            netProfit,
            occupancyRate: Math.round(occupancyRate * 100) / 100,
        },
        occupancy: {
            totalUnits,
            occupiedUnits,
            vacantUnits: totalUnits - occupiedUnits,
        },
        maintenance: {
            openRequests: openMaintenance,
            totalRequests: property.maintenanceRequests.length,
        },
        recentExpenses: property.propertyExpenses,
        recentMaintenance: property.maintenanceRequests,
    };
}
/**
 * Get overall dashboard analytics
 */
async function getOverallDashboard(filters) {
    const where = { isDeleted: false };
    if (filters?.propertyId) {
        where.propertyId = filters.propertyId;
    }
    // Get all properties with deals
    const properties = await client_1.default.property.findMany({
        where: { isDeleted: false },
        include: {
            tenancies: { where: { status: 'active' } },
            deals: {
                where: { isDeleted: false },
                include: {
                    financeLedgers: {
                        where: {
                            isDeleted: false,
                            ...(filters?.startDate && filters?.endDate
                                ? {
                                    date: {
                                        gte: filters.startDate,
                                        lte: filters.endDate,
                                    },
                                }
                                : {}),
                        },
                    },
                },
            },
        },
    });
    // Calculate totals
    const totalProperties = properties.length;
    const totalOccupied = properties.reduce((sum, p) => sum + p.tenancies.length, 0);
    const totalVacant = properties.reduce((sum, p) => sum + (p.totalUnits - p.tenancies.length), 0);
    // Financial totals - get all finance ledgers from deals
    const totalIncome = properties.reduce((sum, p) => {
        const allLedgers = p.deals.flatMap((deal) => deal.financeLedgers);
        return (sum +
            allLedgers
                .filter((l) => l.category === 'credit' || (l.amount > 0 && l.category !== 'debit'))
                .reduce((s, l) => s + l.amount, 0));
    }, 0);
    const totalExpenses = properties.reduce((sum, p) => {
        const allLedgers = p.deals.flatMap((deal) => deal.financeLedgers);
        return (sum +
            allLedgers
                .filter((l) => l.category === 'debit' || (l.amount < 0 && l.category !== 'credit'))
                .reduce((s, l) => s + Math.abs(l.amount), 0));
    }, 0);
    // Get active deals
    const activeDeals = await client_1.default.deal.count({
        where: {
            isDeleted: false,
            stage: { notIn: ['closed-won', 'closed-lost'] },
        },
    });
    // Get pending invoices
    const pendingInvoices = await client_1.default.invoice.count({
        where: {
            status: { in: ['unpaid', 'overdue', 'partial'] },
        },
    });
    // Get open maintenance requests
    const openMaintenance = await client_1.default.maintenanceRequest.count({
        where: {
            isDeleted: false,
            status: { notIn: ['completed', 'cancelled'] },
        },
    });
    return {
        properties: {
            total: totalProperties,
            occupied: totalOccupied,
            vacant: totalVacant,
            occupancyRate: totalProperties > 0 ? (totalOccupied / (totalOccupied + totalVacant)) * 100 : 0,
        },
        financials: {
            totalIncome,
            totalExpenses,
            netProfit: totalIncome - totalExpenses,
        },
        crm: {
            activeDeals,
            pendingInvoices,
        },
        maintenance: {
            openRequests: openMaintenance,
        },
    };
}
/**
 * Get revenue trends (monthly)
 */
async function getRevenueTrends(months = 12) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);
    const ledgers = await client_1.default.financeLedger.findMany({
        where: {
            isDeleted: false,
            category: 'credit',
            date: {
                gte: startDate,
                lte: endDate,
            },
        },
        orderBy: { date: 'asc' },
    });
    // Group by month
    const monthlyData = {};
    ledgers.forEach((ledger) => {
        const monthKey = `${ledger.date.getFullYear()}-${String(ledger.date.getMonth() + 1).padStart(2, '0')}`;
        monthlyData[monthKey] = (monthlyData[monthKey] || 0) + ledger.amount;
    });
    return Object.entries(monthlyData)
        .map(([month, revenue]) => ({ month, revenue }))
        .sort((a, b) => a.month.localeCompare(b.month));
}
/**
 * Get expense trends (monthly)
 */
async function getExpenseTrends(months = 12) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);
    const ledgers = await client_1.default.financeLedger.findMany({
        where: {
            isDeleted: false,
            category: 'debit',
            date: {
                gte: startDate,
                lte: endDate,
            },
        },
        orderBy: { date: 'asc' },
    });
    // Group by month
    const monthlyData = {};
    ledgers.forEach((ledger) => {
        const monthKey = `${ledger.date.getFullYear()}-${String(ledger.date.getMonth() + 1).padStart(2, '0')}`;
        monthlyData[monthKey] = (monthlyData[monthKey] || 0) + ledger.amount;
    });
    return Object.entries(monthlyData)
        .map(([month, expense]) => ({ month, expense }))
        .sort((a, b) => a.month.localeCompare(b.month));
}
/**
 * Get top performing properties
 */
async function getTopProperties(limit = 10) {
    const properties = await client_1.default.property.findMany({
        where: { isDeleted: false },
        include: {
            deals: {
                where: { isDeleted: false },
                include: {
                    financeLedgers: {
                        where: { isDeleted: false },
                    },
                },
            },
            tenancies: {
                where: { status: 'active' },
            },
        },
    });
    const propertyPerformance = properties.map((property) => {
        const allLedgers = property.deals.flatMap((deal) => deal.financeLedgers);
        const income = allLedgers
            .filter((l) => l.category === 'credit' || (l.amount > 0 && l.category !== 'debit'))
            .reduce((sum, l) => sum + l.amount, 0);
        const expenses = allLedgers
            .filter((l) => l.category === 'debit' || (l.amount < 0 && l.category !== 'credit'))
            .reduce((sum, l) => sum + Math.abs(l.amount), 0);
        return {
            propertyId: property.id,
            propertyName: property.name,
            propertyCode: property.propertyCode,
            income,
            expenses,
            netProfit: income - expenses,
            occupancy: property.tenancies.length,
            totalUnits: property.totalUnits,
        };
    });
    return propertyPerformance
        .sort((a, b) => b.netProfit - a.netProfit)
        .slice(0, limit);
}
//# sourceMappingURL=analytics.js.map