/**
 * Lease History Service
 * Tracks all changes to leases including creation, updates, renewals, and status changes
 */

import prisma from '../prisma/client';

/**
 * Create lease history entry
 */
export async function createLeaseHistory(
  leaseId: string,
  action: 'created' | 'updated' | 'renewed' | 'status_changed' | 'terminated' | 'expired',
  changes: {
    field?: string;
    oldValue?: any;
    newValue?: any;
    changedBy?: string;
    notes?: string;
    metadata?: any;
  }
) {
  try {
    // Get lease details for context
    const lease = await prisma.lease.findUnique({
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
    const currentLease = await prisma.lease.findUnique({
      where: { id: leaseId },
      select: { renewalHistory: true },
    });

    const history = (currentLease?.renewalHistory as any[]) || [];
    
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
    await prisma.lease.update({
      where: { id: leaseId },
      data: {
        renewalHistory: history as any,
      },
    });

    return historyEntry;
  } catch (error) {
    console.error('Error creating lease history:', error);
    return null;
  }
}

/**
 * Get lease history
 */
export async function getLeaseHistory(leaseId: string) {
  try {
    const lease = await prisma.lease.findUnique({
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

    const history = (lease.renewalHistory as any[]) || [];

    // Add creation and update timestamps as history entries
    const fullHistory = [
      {
        id: 'initial-creation',
        action: 'created' as const,
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
  } catch (error) {
    console.error('Error getting lease history:', error);
    return null;
  }
}

/**
 * Track lease renewal
 */
export async function trackLeaseRenewal(
  leaseId: string,
  renewalData: {
    newLeaseEnd: Date;
    newRent?: number;
    renewedBy?: string;
    notes?: string;
  }
) {
  const lease = await prisma.lease.findUnique({
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
  const renewalHistory = (lease.renewalHistory as any[]) || [];
  renewalHistory.push({
    renewalDate: new Date().toISOString(),
    newLeaseEnd: renewalData.newLeaseEnd.toISOString(),
    newRent: renewalData.newRent || lease.rent,
  });

  await prisma.lease.update({
    where: { id: leaseId },
    data: {
      renewalDate: new Date(),
      renewalHistory: renewalHistory as any,
      leaseEnd: renewalData.newLeaseEnd,
      ...(renewalData.newRent && { rent: renewalData.newRent }),
    },
  });
}

/**
 * Track lease status change
 */
export async function trackLeaseStatusChange(
  leaseId: string,
  newStatus: string,
  changedBy?: string,
  notes?: string
) {
  const lease = await prisma.lease.findUnique({
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

