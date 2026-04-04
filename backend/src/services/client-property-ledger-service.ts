/**
 * Client & Property Ledger Service
 * Accounting-correct, audit-ready, read-only.
 * Uses Ledger Engine as primary source; derives from deals+payments when empty.
 * No modification of historical data. All balances computed on-the-fly.
 */

import prisma from '../prisma/client';
import { getLedgerEntries as getLedgerEngineEntries } from './ledger-engine-service';
import { getEntityLedgerEntries } from './finance-operation-ledger-service';

export type LedgerSourceType = 'Deal' | 'Payment' | 'Refund' | 'Transfer' | 'Merge' | 'Journal' | 'Adjustment';
export type LedgerEntryStatus = 'Legacy' | 'Derived' | 'Payment' | 'Adjustment';

export interface LedgerEntryRow {
  id: string;
  date: string;
  reference_id: string;
  description: string;
  source_type: LedgerSourceType;
  debit: number;
  credit: number;
  running_balance: number;
  status: LedgerEntryStatus;
}

export interface LedgerSummary {
  dealValue: number;
  received: number;
  outstanding: number;
  aging?: {
    '0_30': number;
    '31_60': number;
    '61_90': number;
    '90_plus': number;
  };
}

export interface LedgerApiResponse {
  entityName: string;
  entityId: string;
  entries: LedgerEntryRow[];
  summary: LedgerSummary;
  openingBalanceRow?: LedgerEntryRow;
}

function toIsoDate(d: Date): string {
  return d.toISOString();
}

function mapEngineSourceToSpec(sourceType: string): LedgerSourceType {
  const m: Record<string, LedgerSourceType> = {
    payment: 'Payment',
    voucher: 'Deal',
    refund: 'Refund',
    transfer: 'Transfer',
    merge: 'Merge',
  };
  return (m[sourceType?.toLowerCase()] || 'Journal') as LedgerSourceType;
}

function mapSourceToStatus(sourceType: LedgerSourceType): LedgerEntryStatus {
  if (sourceType === 'Payment') return 'Payment';
  if (sourceType === 'Adjustment') return 'Adjustment';
  return 'Derived';
}

async function calculateClientAgingBuckets(clientId: string): Promise<{
  '0_30': number;
  '31_60': number;
  '61_90': number;
  '90_plus': number;
}> {
  const installments = await prisma.dealInstallment.findMany({
    where: { clientId, isDeleted: false },
    select: {
      amount: true,
      paidAmount: true,
      dueDate: true,
    },
  });

  const today = new Date();
  let bucket0_30 = 0;
  let bucket31_60 = 0;
  let bucket61_90 = 0;
  let bucket90_plus = 0;

  for (const inst of installments) {
    const unpaid = Math.max(0, inst.amount - inst.paidAmount);
    if (unpaid <= 0) continue;

    const days = Math.floor(
      (today.getTime() - inst.dueDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (days <= 30) bucket0_30 += unpaid;
    else if (days <= 60) bucket31_60 += unpaid;
    else if (days <= 90) bucket61_90 += unpaid;
    else bucket90_plus += unpaid;
  }

  return {
    '0_30': Number(bucket0_30.toFixed(2)),
    '31_60': Number(bucket31_60.toFixed(2)),
    '61_90': Number(bucket61_90.toFixed(2)),
    '90_plus': Number(bucket90_plus.toFixed(2)),
  };
}

/**
 * Get Client Ledger - Ledger Engine first, then derive from deals+payments (read-only)
 */
export async function getClientLedger(
  clientId: string,
  filters?: { startDate?: Date; endDate?: Date; sourceType?: string }
): Promise<LedgerApiResponse> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { id: true, name: true, clientCode: true },
  });
  if (!client) throw new Error('Client not found');

  const entries: LedgerEntryRow[] = [];
  let hasEngineEntries = false;
  let hasLegacyEntries = false;

  // 1. Ledger Engine entries (Refund, Transfer, Merge)
  try {
    const engineRows = await getLedgerEngineEntries('client', clientId, {
      startDate: filters?.startDate,
      endDate: filters?.endDate,
    });
    hasEngineEntries = engineRows.length > 0;
    for (const e of engineRows) {
      entries.push({
        id: e.id,
        date: toIsoDate(e.entryDate),
        reference_id: e.transactionUuid,
        description: e.narration || `${e.sourceType} - ${e.transactionUuid.slice(0, 8)}`,
        source_type: mapEngineSourceToSpec(e.sourceType),
        debit: e.debitAmount,
        credit: e.creditAmount,
        running_balance: 0, // computed below
        status: mapSourceToStatus(mapEngineSourceToSpec(e.sourceType)),
      });
    }
  } catch {
    // LedgerEngine may not exist
  }

  // 2. When no engine entries, derive from deals + payments (read-only, non-destructive)
  if (entries.length === 0) {
    const deals = await prisma.deal.findMany({
      where: {
        clientId,
        isDeleted: false,
        deletedAt: null,
        ...(filters?.startDate || filters?.endDate
          ? {
              OR: [
                { dealDate: { ...(filters.startDate && { gte: filters.startDate }), ...(filters.endDate && { lte: filters.endDate }) } },
                { payments: { some: { date: { ...(filters.startDate && { gte: filters.startDate }), ...(filters.endDate && { lte: filters.endDate }) }, deletedAt: null } } },
              ],
            }
          : {}),
      },
      include: {
        property: { select: { name: true } },
        payments: {
          where: { deletedAt: null, ...(filters?.startDate || filters?.endDate ? { date: { ...(filters.startDate && { gte: filters.startDate }), ...(filters.endDate && { lte: filters.endDate }) } } : {}) },
          orderBy: { date: 'asc' },
        },
      },
      orderBy: { dealDate: 'asc' },
    });

    for (const deal of deals) {
      const dealDate = deal.dealDate || deal.createdAt;
      const dealAmount = deal.dealAmount || 0;
      const includeDeal = (!filters?.startDate || dealDate >= filters.startDate) && (!filters?.endDate || dealDate <= filters.endDate);
      if (includeDeal && dealAmount > 0) {
        entries.push({
          id: `DEAL-${deal.id}`,
          date: toIsoDate(dealDate),
          reference_id: deal.dealCode || deal.id,
          description: `Sale: ${deal.title}${deal.property ? ` - ${deal.property.name}` : ''}`,
          source_type: 'Deal',
          debit: Number(dealAmount.toFixed(2)),
          credit: 0,
          running_balance: 0,
          status: 'Derived',
        });
      }
      for (const payment of deal.payments) {
        entries.push({
          id: payment.id,
          date: toIsoDate(payment.date),
          reference_id: payment.paymentId || payment.id,
          description: `Payment received${payment.remarks ? `: ${payment.remarks}` : ''} - ${payment.paymentMode || 'N/A'}`,
          source_type: 'Payment',
          debit: 0,
          credit: Number(payment.amount.toFixed(2)),
          running_balance: 0,
          status: 'Payment',
        });
      }
    }

    if (entries.length === 0) {
      try {
        const foEntries = await getEntityLedgerEntries('Client', clientId, filters);
        for (const fe of foEntries) {
          hasLegacyEntries = true;
          entries.push({
            id: fe.id,
            date: toIsoDate(fe.date),
            reference_id: fe.operationId,
            description: fe.description || `${fe.sourceType} - Op ${fe.operationId.slice(0, 8)}`,
            source_type: mapEngineSourceToSpec(fe.sourceType),
            debit: fe.debit,
            credit: fe.credit,
            running_balance: 0,
            status: 'Legacy',
          });
        }
      } catch {
        /* ignore */
      }
    }
  }

  entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (filters?.sourceType && filters.sourceType !== 'all') {
    const st = filters.sourceType.toLowerCase();
    const filtered = entries.filter((e) => e.source_type.toLowerCase() === st);
    entries.length = 0;
    entries.push(...filtered);
  }

  // Compute running balance on-the-fly: Previous + Debit - Credit (receivable: debit = owed, credit = paid)
  let runningBalance = 0;
  for (const e of entries) {
    runningBalance = Number((runningBalance + e.debit - e.credit).toFixed(2));
    e.running_balance = runningBalance;
  }

  const dealValue = entries.filter((e) => e.source_type === 'Deal').reduce((s, e) => s + e.debit, 0);
  const received = entries.filter((e) => e.source_type === 'Payment').reduce((s, e) => s + e.credit, 0);
  const outstanding = entries.length > 0 ? entries[entries.length - 1].running_balance : 0;

  // Opening balance = 0 (balance before first entry). Display-only, derived from deal recognition.
  const openingBalanceRow: LedgerEntryRow | undefined =
    entries.length > 0
      ? {
          id: 'OPENING',
          date: entries[0].date,
          reference_id: '—',
          description: 'OPENING BALANCE (B/F)',
          source_type: 'Deal',
          debit: 0,
          credit: 0,
          running_balance: 0,
          status: 'Derived',
        }
      : undefined;

  const aging = await calculateClientAgingBuckets(client.id);

  return {
    entityName: client.name || client.clientCode || 'Unknown Client',
    entityId: client.id,
    entries,
    summary: {
      dealValue: Number(dealValue.toFixed(2)),
      received: Number(received.toFixed(2)),
      outstanding: Number(outstanding.toFixed(2)),
      aging,
    },
    openingBalanceRow,
  };
}

/**
 * Get Property Ledger - Ledger Engine first, then derive from deals+payments (read-only)
 */
export async function getPropertyLedger(
  propertyId: string,
  filters?: { startDate?: Date; endDate?: Date; sourceType?: string }
): Promise<LedgerApiResponse> {
  const property = await prisma.property.findFirst({
    where: { id: propertyId, isDeleted: false },
    select: { id: true, name: true, propertyCode: true },
  });
  if (!property) throw new Error('Property not found');

  const entries: LedgerEntryRow[] = [];
  let hasLegacyEntries = false;

  try {
    const engineRows = await getLedgerEngineEntries('property', propertyId, {
      startDate: filters?.startDate,
      endDate: filters?.endDate,
    });
    for (const e of engineRows) {
      entries.push({
        id: e.id,
        date: toIsoDate(e.entryDate),
        reference_id: e.transactionUuid,
        description: e.narration || `${e.sourceType} - ${e.transactionUuid.slice(0, 8)}`,
        source_type: mapEngineSourceToSpec(e.sourceType),
        debit: e.debitAmount,
        credit: e.creditAmount,
        running_balance: 0,
        status: mapSourceToStatus(mapEngineSourceToSpec(e.sourceType)),
      });
    }
  } catch {
    /* LedgerEngine may not exist */
  }

  if (entries.length === 0) {
    const deals = await prisma.deal.findMany({
      where: {
        propertyId,
        isDeleted: false,
        deletedAt: null,
        ...(filters?.startDate || filters?.endDate
          ? {
              OR: [
                { dealDate: { ...(filters.startDate && { gte: filters.startDate }), ...(filters.endDate && { lte: filters.endDate }) } },
                { payments: { some: { date: { ...(filters.startDate && { gte: filters.startDate }), ...(filters.endDate && { lte: filters.endDate }) }, deletedAt: null } } },
              ],
            }
          : {}),
      },
      include: {
        client: { select: { name: true } },
        payments: {
          where: { deletedAt: null, ...(filters?.startDate || filters?.endDate ? { date: { ...(filters.startDate && { gte: filters.startDate }), ...(filters.endDate && { lte: filters.endDate }) } } : {}) },
          orderBy: { date: 'asc' },
        },
      },
      orderBy: { dealDate: 'asc' },
    });

    for (const deal of deals) {
      const dealDate = deal.dealDate || deal.createdAt;
      const dealAmount = deal.dealAmount || 0;
      const includeDeal = (!filters?.startDate || dealDate >= filters.startDate) && (!filters?.endDate || dealDate <= filters.endDate);
      if (includeDeal && dealAmount > 0) {
        entries.push({
          id: `DEAL-${deal.id}`,
          date: toIsoDate(dealDate),
          reference_id: deal.dealCode || deal.id,
          description: `Property Sale: ${deal.title}${deal.client ? ` - Client: ${deal.client.name}` : ''}`,
          source_type: 'Deal',
          debit: Number(dealAmount.toFixed(2)),
          credit: 0,
          running_balance: 0,
          status: 'Derived',
        });
      }
      for (const payment of deal.payments) {
        entries.push({
          id: `PAYMENT-${payment.id}`,
          date: toIsoDate(payment.date),
          reference_id: payment.paymentId || payment.id,
          description: `Payment received${payment.remarks ? `: ${payment.remarks}` : ''} - ${payment.paymentMode || 'N/A'}`,
          source_type: 'Payment',
          debit: 0,
          credit: Number(payment.amount.toFixed(2)),
          running_balance: 0,
          status: 'Payment',
        });
      }
    }

    if (entries.length === 0) {
      try {
        for (const d of deals) {
          const foEntries = await getEntityLedgerEntries('Deal', d.id, filters);
          for (const fe of foEntries) {
            hasLegacyEntries = true;
            entries.push({
              id: fe.id,
              date: toIsoDate(fe.date),
              reference_id: fe.operationId,
              description: fe.description || `${fe.sourceType} - Op ${fe.operationId.slice(0, 8)}`,
              source_type: mapEngineSourceToSpec(fe.sourceType),
              debit: fe.debit,
              credit: fe.credit,
              running_balance: 0,
              status: 'Legacy',
            });
          }
        }
      } catch {
        /* ignore */
      }
    }
  }

  entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (filters?.sourceType && filters.sourceType !== 'all') {
    const st = filters.sourceType.toLowerCase();
    const filtered = entries.filter((e) => e.source_type.toLowerCase() === st);
    entries.length = 0;
    entries.push(...filtered);
  }

  let runningBalance = 0;
  for (const e of entries) {
    runningBalance = Number((runningBalance + e.debit - e.credit).toFixed(2));
    e.running_balance = runningBalance;
  }

  const dealValue = entries.filter((e) => e.source_type === 'Deal').reduce((s, e) => s + e.debit, 0);
  const received = entries.filter((e) => e.source_type === 'Payment').reduce((s, e) => s + e.credit, 0);
  const outstanding = entries.length > 0 ? entries[entries.length - 1].running_balance : 0;

  // Opening balance = 0 (balance before first entry). Display-only, derived from deal recognition.
  const openingBalanceRow: LedgerEntryRow | undefined =
    entries.length > 0
      ? {
          id: 'OPENING',
          date: entries[0].date,
          reference_id: '—',
          description: 'OPENING BALANCE (B/F)',
          source_type: 'Deal',
          debit: 0,
          credit: 0,
          running_balance: 0,
          status: 'Derived',
        }
      : undefined;

  return {
    entityName: property.name || property.propertyCode || 'Unknown Property',
    entityId: property.id,
    entries,
    summary: {
      dealValue: Number(dealValue.toFixed(2)),
      received: Number(received.toFixed(2)),
      outstanding: Number(outstanding.toFixed(2)),
    },
    openingBalanceRow,
  };
}
