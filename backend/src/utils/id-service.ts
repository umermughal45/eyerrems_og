import prisma from '../prisma/client';

export class IdService {
  /**
   * Generate sequential Entity ID with dash-separated format.
   * Lead:   LD-0001
   * Client: CLI-0001 (direct) or LD-CLI-0001 (converted from lead)
   * Dealer: DL-0001
   */
  static async generateEntityId(prefix: 'LD' | 'CL' | 'DL' | 'PR' | 'DEAL' | 'PAY'): Promise<string> {
    // Map old prefix to new dash-separated format
    const dashPrefixMap: Record<string, string> = {
      LD: 'LD',
      CL: 'CLI',
      DL: 'DL',
      PR: 'PR',
      DEAL: 'DEAL',
      PAY: 'PAY',
    };

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
    const dashPrefix = dashPrefixMap[prefix];

    if (!model || !field) throw new Error(`Invalid prefix: ${prefix}`);

    // Find the latest record with this dash-prefix (e.g. "LD-", "CLI-")
    // Also handle legacy records without dashes (e.g. "LD0001")
    const lastRecord = await model.findFirst({
      where: { [field]: { startsWith: dashPrefix + '-' } },
      orderBy: { [field]: 'desc' },
      select: { [field]: true },
    });

    let nextNumber = 1;
    if (lastRecord && lastRecord[field]) {
      const currentCode = lastRecord[field] as string;
      // Match "PREFIX-NNNN" pattern
      const match = currentCode.match(new RegExp(`^${dashPrefix}-(\\d+)$`));
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    } else {
      // Check legacy format (no dash) to continue sequence
      const legacyRecord = await model.findFirst({
        where: { [field]: { startsWith: prefix } },
        orderBy: { [field]: 'desc' },
        select: { [field]: true },
      });
      if (legacyRecord && legacyRecord[field]) {
        const currentCode = legacyRecord[field] as string;
        const match = currentCode.match(new RegExp(`^${prefix}(\\d+)$`));
        if (match) {
          nextNumber = parseInt(match[1], 10) + 1;
        }
      }
    }

    return `${dashPrefix}-${nextNumber.toString().padStart(4, '0')}`;
  }

  /**
   * Generate a converted-client code in format LD-CLI-NNNN.
   * Used when a lead is converted to a client.
   */
  static async generateConvertedClientCode(): Promise<string> {
    const prefix = 'LD-CLI';

    const lastRecord = await prisma.client.findFirst({
      where: { clientCode: { startsWith: prefix + '-' } },
      orderBy: { clientCode: 'desc' },
      select: { clientCode: true },
    });

    let nextNumber = 1;
    if (lastRecord?.clientCode) {
      const match = lastRecord.clientCode.match(/^LD-CLI-(\d+)$/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }

    return `${prefix}-${nextNumber.toString().padStart(4, '0')}`;
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
