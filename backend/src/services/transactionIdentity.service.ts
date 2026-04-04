import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class TransactionIdentityEngine {
  /**
   * Generates a new unique Transaction ID in the format TRX-{YEAR}-{SEQUENCE}
   */
  static async generateTransactionID(): Promise<string> {
    const year = new Date().getFullYear();
    
    // We use a transaction to safely get the next sequence number by counting existing records for this year
    return await prisma.$transaction(async (tx) => {
      const prefix = `TRX-${year}-`;
      
      const lastRegistry = await tx.transactionIdentityRegistry.findFirst({
        where: { tid: { startsWith: prefix } },
        orderBy: { tid: 'desc' },
      });

      let sequence = 1;
      if (lastRegistry) {
        const lastSequenceStr = lastRegistry.tid.replace(prefix, '');
        const lastSequence = parseInt(lastSequenceStr, 10);
        if (!isNaN(lastSequence)) {
          sequence = lastSequence + 1;
        }
      }

      const sequenceString = sequence.toString().padStart(6, '0');
      return `${prefix}${sequenceString}`;
    });
  }

  /**
   * Attaches a T-ID to an entity by creating a registry record
   */
  static async attachTid(tid: string, entityType: string, entityId: string, moduleName: string): Promise<void> {
    await prisma.transactionIdentityRegistry.create({
      data: {
        tid,
        entityType,
        entityId,
        moduleName,
      },
    });
  }

  /**
   * Looks up a T-ID for a given entity
   */
  static async getTidForEntity(entityType: string, entityId: string): Promise<string | null> {
    const registry = await prisma.transactionIdentityRegistry.findFirst({
      where: {
        entityType,
        entityId,
      },
    });
    return registry?.tid || null;
  }
}
