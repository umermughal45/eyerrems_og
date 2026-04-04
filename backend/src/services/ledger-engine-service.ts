/**
 * Ledger Engine Service
 * Single source of truth for Balance = SUM(debit_amount) - SUM(credit_amount)
 * Additive only. Reads existing data, records new entries. No recalculation or backfill.
 */

import prisma from '../prisma/client';

export type SourceType = 'payment' | 'voucher' | 'refund' | 'transfer' | 'merge';
export type EntityType = 'client' | 'dealer' | 'property';

export interface WriteLedgerEntryInput {
  transactionUuid: string;
  entryDate: Date;
  accountId: string;
  entityType: EntityType;
  entityId: string;
  debitAmount: number;
  creditAmount: number;
  narration?: string;
  sourceType: SourceType;
  status?: 'posted' | 'reversed';
}

/**
 * Write one ledger entry (one side of double-entry).
 * Balance = SUM(debit_amount) - SUM(credit_amount) per entity.
 */
export async function writeLedgerEntry(
  input: WriteLedgerEntryInput,
  tx?: any
): Promise<string> {
  const client = tx ?? prisma;
  const entry = await client.ledgerEngineEntry.create({
    data: {
      transactionUuid: input.transactionUuid,
      entryDate: input.entryDate,
      accountId: input.accountId,
      entityType: input.entityType,
      entityId: input.entityId,
      debitAmount: input.debitAmount,
      creditAmount: input.creditAmount,
      narration: input.narration ?? null,
      sourceType: input.sourceType,
      status: input.status ?? 'posted',
    },
  });
  return entry.id;
}

/**
 * Get ledger entries for an entity.
 * Prefer ledger_entries when available. No fallback - caller merges with legacy.
 */
export async function getLedgerEntries(
  entityType: EntityType,
  entityId: string,
  filters?: { startDate?: Date; endDate?: Date; status?: 'posted' }
): Promise<
  Array<{
    id: string;
    entryDate: Date;
    transactionUuid: string;
    debitAmount: number;
    creditAmount: number;
    narration: string | null;
    sourceType: string;
    status: string;
  }>
> {
  const where: any = { entityType, entityId };
  if (filters?.status) where.status = filters.status;
  if (filters?.startDate || filters?.endDate) {
    where.entryDate = {};
    if (filters.startDate) where.entryDate.gte = filters.startDate;
    if (filters.endDate) where.entryDate.lte = filters.endDate;
  }

  const rows = await prisma.ledgerEngineEntry.findMany({
    where,
    orderBy: { entryDate: 'asc' },
  });

  return rows.map((r) => ({
    id: r.id,
    entryDate: r.entryDate,
    transactionUuid: r.transactionUuid,
    debitAmount: r.debitAmount,
    creditAmount: r.creditAmount,
    narration: r.narration,
    sourceType: r.sourceType,
    status: r.status,
  }));
}

/**
 * Get balance for an entity from Ledger Engine.
 * Balance = SUM(debit_amount) - SUM(credit_amount)
 */
export async function getEntityBalance(
  entityType: EntityType,
  entityId: string,
  asOfDate?: Date,
  status: 'posted' = 'posted'
): Promise<number> {
  const where: any = { entityType, entityId, status };
  if (asOfDate) where.entryDate = { lte: asOfDate };

  const agg = await prisma.ledgerEngineEntry.aggregate({
    where,
    _sum: { debitAmount: true, creditAmount: true },
  });

  const debit = agg._sum?.debitAmount ?? 0;
  const credit = agg._sum?.creditAmount ?? 0;
  return debit - credit;
}
