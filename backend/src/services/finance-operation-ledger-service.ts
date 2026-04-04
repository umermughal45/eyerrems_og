/**
 * Finance Operation Ledger Service
 * Additive only. Writes ledger entries for Refund, Transfer, Merge operations.
 * Single source of truth for future finance operations. Does NOT touch existing LedgerEntry.
 */

import prisma from '../prisma/client';

export type SourceType = 'refund' | 'transfer' | 'merge';
export type EntrySide = 'debit' | 'credit';
export type EntityType = 'Client' | 'Dealer' | 'Property' | 'Deal';

export interface WriteLedgerEntryInput {
  entityType: EntityType;
  entityId: string;
  accountId: string;
  amount: number;
  side: EntrySide;
  sourceType: SourceType;
  operationId: string;
  voucherId?: string;
  paymentId?: string;
  description?: string;
  date?: Date;
}

/**
 * Write double-entry ledger rows for a finance operation.
 * One row per side. Balance = SUM(debit) - SUM(credit) per entity.
 */
export async function writeFinanceOperationLedger(
  entries: WriteLedgerEntryInput[],
  tx?: any
): Promise<void> {
  const client = tx ?? prisma;
  const date = new Date();

  for (const e of entries) {
    await client.financeOperationLedgerEntry.create({
      data: {
        entityType: e.entityType,
        entityId: e.entityId,
        accountId: e.accountId,
        amount: e.amount,
        side: e.side,
        sourceType: e.sourceType,
        operationId: e.operationId,
        voucherId: e.voucherId ?? null,
        paymentId: e.paymentId ?? null,
        description: e.description ?? null,
        date: e.date ?? date,
      },
    });
  }
}

/**
 * Get ledger entries for an entity. Balance = SUM(debit) - SUM(credit).
 */
export async function getEntityLedgerEntries(
  entityType: EntityType,
  entityId: string,
  filters?: { startDate?: Date; endDate?: Date }
): Promise<
  Array<{
    id: string;
    date: Date;
    description: string | null;
    debit: number;
    credit: number;
    sourceType: string;
    operationId: string;
    voucherId: string | null;
  }>
> {
  const where: any = { entityType, entityId };
  if (filters?.startDate || filters?.endDate) {
    where.date = {};
    if (filters.startDate) where.date.gte = filters.startDate;
    if (filters.endDate) where.date.lte = filters.endDate;
  }

  const rows = await prisma.financeOperationLedgerEntry.findMany({
    where,
    orderBy: { date: 'asc' },
  });

  return rows.map((r) => ({
    id: r.id,
    date: r.date,
    description: r.description,
    debit: r.side === 'debit' ? r.amount : 0,
    credit: r.side === 'credit' ? r.amount : 0,
    sourceType: r.sourceType,
    operationId: r.operationId,
    voucherId: r.voucherId,
  }));
}

/**
 * Get closing balance for an entity from finance operation ledger.
 * Balance = SUM(debit) - SUM(credit)
 */
export async function getEntityBalance(
  entityType: EntityType,
  entityId: string,
  asOfDate?: Date
): Promise<number> {
  const where: any = { entityType, entityId };
  if (asOfDate) where.date = { lte: asOfDate };

  const rows = await prisma.financeOperationLedgerEntry.findMany({ where });
  let balance = 0;
  for (const r of rows) {
    if (r.side === 'debit') balance += r.amount;
    else balance -= r.amount;
  }
  return balance;
}
