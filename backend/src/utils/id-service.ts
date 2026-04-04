import prisma from '../prisma/client';

export class IdService {
  /**
   * Generate sequential Entity ID (e.g., LD0001, CL0001)
   */
  static async generateEntityId(prefix: 'LD' | 'CL' | 'DL' | 'PR' | 'DEAL' | 'PAY'): Promise<string> {
    const modelMap: Record<string, any> = {
      LD: prisma.lead,
      CL: prisma.client,
      DL: prisma.dealer,
      PR: prisma.property,
      DEAL: prisma.deal,
      PAY: prisma.payment,
    };

    const fieldMap: Record<string, string> = {
      LD: 'leadCode',
      CL: 'clientCode',
      DL: 'dealerCode',
      PR: 'propertyCode',
      DEAL: 'dealCode',
      PAY: 'paymentId',
    };

    const model = modelMap[prefix];
    const field = fieldMap[prefix];

    if (!model || !field) throw new Error(`Invalid prefix: ${prefix}`);

    // Find the latest record with this prefix
    const lastRecord = await model.findFirst({
      where: { [field]: { startsWith: prefix } },
      orderBy: { [field]: 'desc' },
      select: { [field]: true },
    });

    let nextNumber = 1;
    if (lastRecord && lastRecord[field]) {
      const currentCode = lastRecord[field];
      const match = currentCode.match(new RegExp(`^${prefix}(\\d+)$`));
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }

    return `${prefix}${nextNumber.toString().padStart(4, '0')}`;
  }

  /**
   * Generate YYYY-MM-#### sequential TID
   */
  static async generateTID(): Promise<string> {
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const prefix = `${year}-${month}-`;

    // Search across all major entities for the latest TID this month
    const [lastLead, lastClient, lastDeal] = await Promise.all([
      prisma.lead.findFirst({ where: { tid: { startsWith: prefix } }, orderBy: { tid: 'desc' }, select: { tid: true } }),
      prisma.client.findFirst({ where: { tid: { startsWith: prefix } }, orderBy: { tid: 'desc' }, select: { tid: true } }),
      prisma.deal.findFirst({ where: { tid: { startsWith: prefix } }, orderBy: { tid: 'desc' }, select: { tid: true } }),
    ]);

    const tids = [lastLead?.tid, lastClient?.tid, lastDeal?.tid].filter(Boolean) as string[];
    tids.sort().reverse();

    let nextNumber = 1;
    if (tids.length > 0) {
      const lastTid = tids[0];
      const parts = lastTid.split('-');
      // Parts: [YYYY, MM, ####]
      const lastNum = parseInt(parts[2], 10);
      if (!isNaN(lastNum)) {
        nextNumber = lastNum + 1;
      }
    }

    return `${prefix}${nextNumber.toString().padStart(4, '0')}`;
  }
}
