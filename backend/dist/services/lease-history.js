"use strict";
/**
 * Lease History Service
 * Tracks all changes to leases including creation, updates, renewals, and status changes
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLeaseHistory = createLeaseHistory;
exports.getLeaseHistory = getLeaseHistory;
exports.trackLeaseRenewal = trackLeaseRenewal;
exports.trackLeaseStatusChange = trackLeaseStatusChange;
const client_1 = __importDefault(require("../prisma/client"));
/**
 * Create lease history entry
 */
async function createLeaseHistory(leaseId, action, changes) {
    try {
        // Get lease details for context
        const lease = await client_1.default.lease.findUnique({
            where: { id: leaseId },
            select: {
                id: true,
                leaseNumber: true,
                tenantId: true,
                unitId: true,
                status: true,
            },
        });
        if (!lease) {
            console.warn(`Lease ${leaseId} not found for history tracking`);
            return null;
        }
        // Store history in lease's renewalHistory JSON field (for now)
        // In future, this can be moved to a dedicated LeaseHistory table
        const currentLease = await client_1.default.lease.findUnique({
            where: { id: leaseId },
            select: { renewalHistory: true },
        });
        const history = currentLease?.renewalHistory || [];
        const historyEntry = {
            id: `hist-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            action,
            field: changes.field,
            oldValue: changes.oldValue,
            newValue: changes.newValue,
            changedBy: changes.changedBy,
            changedAt: new Date().toISOString(),
            notes: changes.notes,
            metadata: changes.metadata,
        };
        history.push(historyEntry);
        // Update lease with new history
        await client_1.default.lease.update({
            where: { id: leaseId },
            data: {
                renewalHistory: history,
            },
        });
        return historyEntry;
    }
    catch (error) {
        console.error('Error creating lease history:', error);
        return null;
    }
}
/**
 * Get lease history
 */
async function getLeaseHistory(leaseId) {
    try {
        const lease = await client_1.default.lease.findUnique({
            where: { id: leaseId },
            select: {
                id: true,
                leaseNumber: true,
                renewalHistory: true,
                createdAt: true,
                updatedAt: true,
                createdBy: true,
                updatedBy: true,
            },
        });
        if (!lease) {
            return null;
        }
        const history = lease.renewalHistory || [];
        // Add creation and update timestamps as history entries
        const fullHistory = [
            {
                id: 'initial-creation',
                action: 'created',
                changedAt: lease.createdAt.toISOString(),
                changedBy: lease.createdBy,
                notes: 'Lease initially created',
            },
            ...history,
        ];
        // Sort by date (newest first)
        fullHistory.sort((a, b) => {
            const dateA = new Date(a.changedAt || 0).getTime();
            const dateB = new Date(b.changedAt || 0).getTime();
            return dateB - dateA;
        });
        return {
            leaseId: lease.id,
            leaseNumber: lease.leaseNumber,
            history: fullHistory,
            totalEntries: fullHistory.length,
        };
    }
    catch (error) {
        console.error('Error getting lease history:', error);
        return null;
    }
}
/**
 * Track lease renewal
 */
async function trackLeaseRenewal(leaseId, renewalData) {
    const lease = await client_1.default.lease.findUnique({
        where: { id: leaseId },
    });
    if (!lease) {
        throw new Error('Lease not found');
    }
    // Update renewal history
    await createLeaseHistory(leaseId, 'renewed', {
        field: 'leaseEnd',
        oldValue: lease.leaseEnd.toISOString(),
        newValue: renewalData.newLeaseEnd.toISOString(),
        changedBy: renewalData.renewedBy,
        notes: renewalData.notes || 'Lease renewed',
        metadata: {
            oldRent: lease.rent,
            newRent: renewalData.newRent || lease.rent,
            renewalDate: new Date().toISOString(),
        },
    });
    // Update lease renewal date
    const renewalHistory = lease.renewalHistory || [];
    renewalHistory.push({
        renewalDate: new Date().toISOString(),
        newLeaseEnd: renewalData.newLeaseEnd.toISOString(),
        newRent: renewalData.newRent || lease.rent,
    });
    await client_1.default.lease.update({
        where: { id: leaseId },
        data: {
            renewalDate: new Date(),
            renewalHistory: renewalHistory,
            leaseEnd: renewalData.newLeaseEnd,
            ...(renewalData.newRent && { rent: renewalData.newRent }),
        },
    });
}
/**
 * Track lease status change
 */
async function trackLeaseStatusChange(leaseId, newStatus, changedBy, notes) {
    const lease = await client_1.default.lease.findUnique({
        where: { id: leaseId },
    });
    if (!lease) {
        throw new Error('Lease not found');
    }
    if (lease.status === newStatus) {
        return; // No change
    }
    await createLeaseHistory(leaseId, 'status_changed', {
        field: 'status',
        oldValue: lease.status,
        newValue: newStatus,
        changedBy,
        notes: notes || `Lease status changed from ${lease.status} to ${newStatus}`,
    });
}
//# sourceMappingURL=lease-history.js.map