"use strict";
/**
 * Tenant Alerts Service
 * Handles overdue rent alerts and lease expiry alerts for tenants
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOverdueRentAlerts = getOverdueRentAlerts;
exports.getTenantLeaseExpiryAlerts = getTenantLeaseExpiryAlerts;
exports.getAllTenantAlerts = getAllTenantAlerts;
const client_1 = __importDefault(require("../prisma/client"));
/**
 * Get overdue invoices for a tenant or all tenants
 */
async function getOverdueRentAlerts(tenantId) {
    const today = new Date();
    const where = {
        status: { in: ['unpaid', 'partial', 'overdue'] },
        dueDate: { lt: today },
        isDeleted: false,
    };
    if (tenantId) {
        where.tenantId = tenantId;
    }
    const overdueInvoices = await client_1.default.invoice.findMany({
        where,
        include: {
            tenant: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    phone: true,
                    tenantCode: true,
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
    });
    // Calculate days overdue and late fees
    const alerts = overdueInvoices.map((invoice) => {
        const daysOverdue = Math.floor((today.getTime() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24));
        // Calculate late fee
        let lateFee = 0;
        const invoiceData = invoice;
        if (invoice.lateFeeRule === 'fixed' && invoiceData.lateFeeAmount) {
            lateFee = daysOverdue * invoiceData.lateFeeAmount;
        }
        else if (invoice.lateFeeRule === 'percentage' && invoiceData.lateFeePercent) {
            lateFee = (invoice.totalAmount * invoiceData.lateFeePercent * daysOverdue) / 30;
        }
        else {
            // Default: 2% per 30 days
            lateFee = (invoice.totalAmount * 0.02 * daysOverdue) / 30;
        }
        const totalDue = (invoice.remainingAmount || invoice.totalAmount) + lateFee;
        return {
            ...invoice,
            daysOverdue,
            lateFee: Math.round(lateFee * 100) / 100,
            totalDue: Math.round(totalDue * 100) / 100,
        };
    });
    // Update invoice status to overdue if not already
    const invoiceIds = overdueInvoices
        .filter(inv => inv.status !== 'overdue')
        .map(inv => inv.id);
    if (invoiceIds.length > 0) {
        await client_1.default.invoice.updateMany({
            where: { id: { in: invoiceIds } },
            data: { status: 'overdue' },
        });
    }
    const totalOverdueAmount = alerts.reduce((sum, inv) => sum + (inv.remainingAmount || inv.totalAmount), 0);
    const totalLateFees = alerts.reduce((sum, inv) => sum + inv.lateFee, 0);
    return {
        alerts,
        summary: {
            count: alerts.length,
            totalOverdueAmount: Math.round(totalOverdueAmount * 100) / 100,
            totalLateFees: Math.round(totalLateFees * 100) / 100,
            totalDue: Math.round((totalOverdueAmount + totalLateFees) * 100) / 100,
        },
    };
}
/**
 * Get lease expiry alerts for tenants
 */
async function getTenantLeaseExpiryAlerts(tenantId) {
    const today = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);
    const where = {
        isDeleted: false,
        status: 'Active',
        leaseEnd: {
            gte: today,
            lte: thirtyDaysFromNow,
        },
    };
    if (tenantId) {
        where.tenantId = tenantId;
    }
    const expiringLeases = await client_1.default.lease.findMany({
        where,
        include: {
            tenant: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    phone: true,
                },
            },
            unit: {
                select: {
                    id: true,
                    unitName: true,
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
    });
    // Categorize by days remaining
    const categorized = expiringLeases.map((lease) => {
        const daysRemaining = Math.ceil((lease.leaseEnd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        let alertLevel = 'warning';
        if (daysRemaining <= 7) {
            alertLevel = 'critical';
        }
        else if (daysRemaining <= 15) {
            alertLevel = 'urgent';
        }
        return {
            ...lease,
            daysRemaining,
            alertLevel,
        };
    });
    const critical = categorized.filter((l) => l.alertLevel === 'critical');
    const urgent = categorized.filter((l) => l.alertLevel === 'urgent');
    const warning = categorized.filter((l) => l.alertLevel === 'warning');
    return {
        critical,
        urgent,
        warning,
        all: categorized,
        summary: {
            total: categorized.length,
            critical: critical.length,
            urgent: urgent.length,
            warning: warning.length,
        },
    };
}
/**
 * Get all tenant alerts (overdue rent + lease expiry)
 */
async function getAllTenantAlerts(tenantId) {
    const [overdueAlerts, leaseExpiryAlerts] = await Promise.all([
        getOverdueRentAlerts(tenantId),
        getTenantLeaseExpiryAlerts(tenantId),
    ]);
    return {
        overdueRent: overdueAlerts,
        leaseExpiry: leaseExpiryAlerts,
        totalAlerts: overdueAlerts.summary.count + leaseExpiryAlerts.summary.total,
    };
}
//# sourceMappingURL=tenant-alerts.js.map