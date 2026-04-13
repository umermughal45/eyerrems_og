/**
 * TransactionIdentityEngine
 *
 * STRICT RULE: TID is generated ONCE — at Client (or Lead) creation.
 * All downstream entities (Deal, Payment, LedgerEntry) INHERIT the client's TID.
 * No other service is allowed to call generateTransactionID() independently.
 *
 * Format: TRX-YYYY-XXXX  (e.g. TRX-2026-0001)
 */

import prisma from '../prisma/client';

export class TransactionIdentityEngine {
  /**
   * Generate a new unique TID.
   * ONLY call this from Client creation (or Lead creation as the lineage root).
   * All other entities must inherit via inheritTidFromClient().
   */
  static async generateTransactionID(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `TRX-${year}-`;

    // Atomic sequence increment using the Sequence table
    try {
      const seq = await prisma.sequence.update({
        where: { prefix: `tid-${year}` },
        data: { current: { increment: 1 } },
      });
      return `${prefix}${seq.current.toString().padStart(4, '0')}`;
    } catch (err: any) {
      if (err.code === 'P2025') {
        // Sequence row doesn't exist yet — find the current max and seed it
        const lastRegistry = await prisma.transactionIdentityRegistry.findFirst({
          where: { tid: { startsWith: prefix } },
          orderBy: { tid: 'desc' },
          select: { tid: true },
        });

        let nextSeq = 1;
        if (lastRegistry?.tid) {
          const num = parseInt(lastRegistry.tid.replace(prefix, ''), 10);
          if (!isNaN(num)) nextSeq = num + 1;
        }

        // Also check Client, Lead, Deal tables for any existing TIDs this year
        const [lastClient, lastLead, lastDeal] = await Promise.all([
          prisma.client.findFirst({ where: { tid: { startsWith: prefix } }, orderBy: { tid: 'desc' }, select: { tid: true } }),
          prisma.lead.findFirst({ where: { tid: { startsWith: prefix } }, orderBy: { tid: 'desc' }, select: { tid: true } }),
          prisma.deal.findFirst({ where: { tid: { startsWith: prefix } }, orderBy: { tid: 'desc' }, select: { tid: true } }),
        ]);

        for (const rec of [lastClient, lastLead, lastDeal]) {
          if (rec?.tid) {
            const num = parseInt(rec.tid.replace(prefix, ''), 10);
            if (!isNaN(num) && num >= nextSeq) nextSeq = num + 1;
          }
        }

        const seq = await prisma.sequence.upsert({
          where: { prefix: `tid-${year}` },
          create: { prefix: `tid-${year}`, current: nextSeq },
          update: { current: { increment: 1 } },
        });
        return `${prefix}${seq.current.toString().padStart(4, '0')}`;
      }
      throw err;
    }
  }

  /**
   * Inherit TID from a client record.
   * Use this for Deal, Payment, LedgerEntry creation.
   * Throws if the client has no TID (data integrity violation).
   */
  static async inheritTidFromClient(clientId: string): Promise<string> {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { tid: true, clientCode: true },
    });

    if (!client) {
      throw new Error(`Client not found: ${clientId}`);
    }

    if (!client.tid) {
      throw new Error(
        `Client ${client.clientCode ?? clientId} has no TID. ` +
        `Run the TID backfill migration before creating related records.`
      );
    }

    return client.tid;
  }

  /**
   * Attach a TID to an entity in the registry (idempotent).
   */
  static async attachTid(
    tid: string,
    entityType: string,
    entityId: string,
    moduleName: string
  ): Promise<void> {
    // Idempotent — skip if already registered
    const existing = await prisma.transactionIdentityRegistry.findFirst({
      where: { tid, entityType, entityId },
    });
    if (existing) return;

    await prisma.transactionIdentityRegistry.create({
      data: { tid, entityType, entityId, moduleName },
    });
  }

  /**
   * Look up the TID for a given entity.
   */
  static async getTidForEntity(
    entityType: string,
    entityId: string
  ): Promise<string | null> {
    const registry = await prisma.transactionIdentityRegistry.findFirst({
      where: { entityType, entityId },
    });
    return registry?.tid ?? null;
  }

  /**
   * Validate that a TID string matches the canonical format.
   */
  static isValidTidFormat(tid: string): boolean {
    return /^TRX-\d{4}-\d{4,}$/.test(tid);
  }
}
