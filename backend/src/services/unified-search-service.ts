import prisma from '../prisma/client';

export interface UnifiedSearchResult {
  tid: string;
  lead?: any;
  client?: any;
  properties: any[];
  dealers: any[];
  deals: any[];
  payments: any[];
  ledgerEntries: any[];
}

export class UnifiedSearchService {
  /**
   * Deep search across the entire business lifecycle using a TID
   */
  static async searchByTID(tid: string): Promise<UnifiedSearchResult | null> {
    if (!tid) return null;

    const [lead, client, properties, dealers, deals, payments, ledgerEntries] = await Promise.all([
      prisma.lead.findFirst({ 
        where: { tid, isDeleted: false },
        include: { assignedAgent: { select: { username: true, email: true } } }
      }),
      prisma.client.findFirst({ 
        where: { tid, isDeleted: false },
        include: { deals: true }
      }),
      prisma.property.findMany({
        where: { tid, isDeleted: false },
      }),
      prisma.dealer.findMany({
        where: { tid, isDeleted: false },
      }),
      prisma.deal.findMany({ 
        where: { tid, isDeleted: false },
        include: { property: true, dealer: true }
      }),
      prisma.payment.findMany({ 
        where: { deal: { tid }, deletedAt: null },
        include: { deal: true }
      }),
      prisma.ledgerEntry.findMany({ 
        where: { remarks: { contains: `[TID:${tid}]` }, deletedAt: null },
        orderBy: { date: 'desc' }
      }),
    ]);

    // If nothing found at all, return null
    if (!lead && !client && properties.length === 0 && dealers.length === 0 && deals.length === 0 && ledgerEntries.length === 0) {
      // One last check: maybe the TID is partial? 
      // But for ERP-style search, exact TID is usually preferred.
      return null;
    }

    return {
      tid,
      lead,
      client,
      properties,
      dealers,
      deals,
      payments,
      ledgerEntries,
    };
  }

  /**
   * Get unified ledger for an entity (CLIENT, PROPERTY, or DEALER)
   */
  static async getLedger(type: 'CLIENT' | 'PROPERTY' | 'DEALER', id: string) {
    // This will fetch all ledger entries related to this entity's TID(s)
    // For simplicity, we find the entity first to get its TID
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
        remarks: { contains: `[LEDGER:${type}]` },
      },
      orderBy: { date: 'desc' }
    });
  }
}
