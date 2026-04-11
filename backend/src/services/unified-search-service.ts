import prisma from '../prisma/client';

export interface UnifiedSearchResult {
  tid: string;
  lead?: any;
  client?: any;
  deals: any[];
  properties: any[];
  dealers: any[];
  paymentPlans: any[];
  installments: any[];
  payments: any[];
  activities: any[];
}

export class UnifiedSearchService {
  /**
   * Deep search across the entire business lifecycle using a TID.
   * Searches Lead, Client, Deal (and their nested PaymentPlan, Installments, Payments).
   * Also supports searching by leadCode (LD-0001) or clientCode (CLI-0001 / LD-CLI-0001).
   */
  static async searchByTID(tid: string): Promise<UnifiedSearchResult | null> {
    if (!tid) return null;

    const normalizedTid = tid.trim().toUpperCase();

    // Detect if the query is a lead code (LD-####) or client code (CLI-#### / LD-CLI-####)
    const isLeadCode = /^LD-\d{4}$/.test(normalizedTid);
    const isClientCode = /^(CLI-\d{4}|LD-CLI-\d{4})$/.test(normalizedTid);

    let resolvedTid = normalizedTid;

    if (isLeadCode) {
      // Resolve lead code → TID
      const leadByCode = await prisma.lead.findFirst({
        where: { leadCode: normalizedTid, isDeleted: false },
        select: { tid: true },
      });
      if (leadByCode?.tid) resolvedTid = leadByCode.tid;
      else return null;
    } else if (isClientCode) {
      // Resolve client code → TID
      const clientByCode = await prisma.client.findFirst({
        where: { clientCode: normalizedTid, isDeleted: false },
        select: { tid: true },
      });
      if (clientByCode?.tid) resolvedTid = clientByCode.tid;
      else return null;
    }

    const [lead, client, deals] = await Promise.all([
      prisma.lead.findFirst({
        where: { tid: resolvedTid, isDeleted: false },
        include: { assignedAgent: { select: { username: true, email: true } } },
      }),
      prisma.client.findFirst({
        where: { tid: resolvedTid, isDeleted: false },
      }),
      prisma.deal.findMany({
        where: { tid: resolvedTid, isDeleted: false },
        include: {
          property: {
            select: {
              id: true, name: true, address: true, type: true,
              status: true, totalArea: true, salePrice: true,
            },
          },
          dealer: {
            select: { id: true, name: true, phone: true, email: true, commissionRate: true },
          },
          paymentPlan: {
            include: {
              installments: {
                orderBy: { installmentNumber: 'asc' },
              },
            },
          },
          payments: {
            where: { deletedAt: null },
            orderBy: { date: 'desc' },
          },
        },
      }),
    ]);

    // Also search by client TID to find deals linked to that client
    let clientDeals = deals;
    if (client && deals.length === 0) {
      clientDeals = await prisma.deal.findMany({
        where: { clientId: client.id, isDeleted: false },
        include: {
          property: {
            select: {
              id: true, name: true, address: true, type: true,
              status: true, totalArea: true, salePrice: true,
            },
          },
          dealer: {
            select: { id: true, name: true, phone: true, email: true, commissionRate: true },
          },
          paymentPlan: {
            include: {
              installments: {
                orderBy: { installmentNumber: 'asc' },
              },
            },
          },
          payments: {
            where: { deletedAt: null },
            orderBy: { date: 'desc' },
          },
        },
      });
    }

    if (!lead && !client && clientDeals.length === 0) {
      return null;
    }

    // Flatten payment plans and installments
    const paymentPlans = clientDeals
      .map((d: any) => d.paymentPlan)
      .filter(Boolean)
      .map((pp: any) => ({ ...pp, installments: undefined }));

    const installments = clientDeals
      .flatMap((d: any) => d.paymentPlan?.installments || []);

    const payments = clientDeals.flatMap((d: any) => d.payments || []);

    // CRM activities
    const activities = await prisma.cRMActivity.findMany({
      where: {
        OR: [
          ...(lead ? [{ leadId: lead.id }] : []),
          ...(client ? [{ clientId: client.id }] : []),
          ...(clientDeals.length > 0 ? [{ dealId: { in: clientDeals.map((d: any) => d.id) } }] : []),
        ],
      },
      orderBy: { activityDate: 'desc' },
      take: 20,
    });

    const properties = clientDeals
      .map((d: any) => d.property)
      .filter(Boolean)
      .filter((p: any, i: number, arr: any[]) => arr.findIndex((x: any) => x.id === p.id) === i);

    const dealers = clientDeals
      .map((d: any) => d.dealer)
      .filter(Boolean)
      .filter((d: any, i: number, arr: any[]) => arr.findIndex((x: any) => x.id === d.id) === i);

    return {
      tid: resolvedTid,
      lead: lead || undefined,
      client: client || undefined,
      deals: clientDeals.map((d: any) => ({ ...d, paymentPlan: undefined, payments: undefined })),
      properties,
      dealers,
      paymentPlans,
      installments,
      payments,
      activities,
    };
  }

  /**
   * Get unified ledger for an entity (CLIENT, PROPERTY, or DEALER)
   */
  static async getLedger(type: 'CLIENT' | 'PROPERTY' | 'DEALER', id: string) {
    let tid: string | null = null;

    if (type === 'CLIENT') {
      const client = await prisma.client.findUnique({ where: { id }, select: { tid: true } });
      tid = client?.tid || null;
    } else if (type === 'PROPERTY') {
      const property = await prisma.property.findUnique({ where: { id }, select: { tid: true } });
      tid = property?.tid || null;
    } else if (type === 'DEALER') {
      const dealer = await prisma.dealer.findUnique({ where: { id }, select: { tid: true } });
      tid = dealer?.tid || null;
    }

    if (!tid) return [];

    const deals = await prisma.deal.findMany({
      where: { tid, isDeleted: false },
      select: { id: true },
    });
    if (deals.length === 0) return [];

    return await prisma.ledgerEntry.findMany({
      where: {
        dealId: { in: deals.map((d) => d.id) },
        deletedAt: null,
      },
      orderBy: { date: 'desc' },
    });
  }
}
