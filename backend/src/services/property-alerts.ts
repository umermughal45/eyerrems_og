/**
 * Property Alerts Service
 * Handles maintenance due alerts and lease expiry alerts
 */

import prisma from '../prisma/client';

/**
 * Check for maintenance requests that are due
 * Returns maintenance requests that need attention
 */
export async function getMaintenanceDueAlerts(propertyId?: string) {
  const where: any = {
    isDeleted: false,
    status: { in: ['open', 'assigned', 'in-progress'] },
  };

  if (propertyId) {
    where.propertyId = propertyId;
  }

  // Get high/urgent priority maintenance that's been open for more than 3 days
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  const urgentMaintenance = await prisma.maintenanceRequest.findMany({
    where: {
      ...where,
      priority: { in: ['high', 'urgent'] },
      createdAt: { lte: threeDaysAgo },
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
          phone: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  // Get maintenance that's been in-progress for more than 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const overdueMaintenance = await prisma.maintenanceRequest.findMany({
    where: {
      ...where,
      status: 'in-progress',
      updatedAt: { lte: sevenDaysAgo },
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
          phone: true,
          email: true,
        },
      },
    },
    orderBy: { updatedAt: 'asc' },
  });

  return {
    urgent: urgentMaintenance,
    overdue: overdueMaintenance,
    total: urgentMaintenance.length + overdueMaintenance.length,
  };
}

/**
 * Check for leases that are expiring soon
 * Returns leases expiring in 30, 15, and 7 days
 */
export async function getLeaseExpiryAlerts(propertyId?: string) {
  const today = new Date();
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(today.getDate() + 30);
  
  const fifteenDaysFromNow = new Date();
  fifteenDaysFromNow.setDate(today.getDate() + 15);
  
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(today.getDate() + 7);

  const where: any = {
    isDeleted: false,
    status: 'Active',
    leaseEnd: {
      gte: today,
      lte: thirtyDaysFromNow,
    },
  };

  // If propertyId provided, filter by property through unit
  if (propertyId) {
    where.unit = {
      propertyId,
      isDeleted: false,
    };
  }

  const expiringLeases = await prisma.lease.findMany({
    where,
    include: {
      tenant: {
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
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
  const leasesExpiringIn30Days = expiringLeases.filter(
    (lease) => {
      const daysRemaining = Math.ceil(
        (lease.leaseEnd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );
      return daysRemaining <= 30 && daysRemaining > 15;
    }
  );

  const leasesExpiringIn15Days = expiringLeases.filter(
    (lease) => {
      const daysRemaining = Math.ceil(
        (lease.leaseEnd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );
      return daysRemaining <= 15 && daysRemaining > 7;
    }
  );

  const leasesExpiringIn7Days = expiringLeases.filter(
    (lease) => {
      const daysRemaining = Math.ceil(
        (lease.leaseEnd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );
      return daysRemaining <= 7 && daysRemaining > 0;
    }
  );

  const expiredLeases = expiringLeases.filter(
    (lease) => lease.leaseEnd < today
  );

  return {
    expiringIn30Days: leasesExpiringIn30Days,
    expiringIn15Days: leasesExpiringIn15Days,
    expiringIn7Days: leasesExpiringIn7Days,
    expired: expiredLeases,
    total: expiringLeases.length,
  };
}

/**
 * Get all property alerts (maintenance + lease expiry)
 */
export async function getAllPropertyAlerts(propertyId?: string) {
  const [maintenanceAlerts, leaseAlerts] = await Promise.all([
    getMaintenanceDueAlerts(propertyId),
    getLeaseExpiryAlerts(propertyId),
  ]);

  return {
    maintenance: maintenanceAlerts,
    leaseExpiry: leaseAlerts,
    totalAlerts: maintenanceAlerts.total + leaseAlerts.total,
  };
}

