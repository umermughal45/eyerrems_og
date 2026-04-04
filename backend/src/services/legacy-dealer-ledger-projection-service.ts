/**
 * Legacy Dealer Ledger Projection Service
 * READ-ONLY. Projects legacy commission/rebate/voucher data into ledger-shaped rows.
 * No mutation, no backfill, no recalculation of historical data.
 * Running balance computed at read-time only. Never stored.
 */

import prisma from '../prisma/client';

export interface LegacyDealerLedgerRow {
  id: string;
  trandate: Date;
  transactionNumber: string;
  memo: string;
  debitAmount: number;
  creditAmount: number;
  runningBalance: number;
  drCrStatus: 'DR' | 'CR';
  sourceType: 'LEGACY_COMMISSION';
  isLegacy: true;
}

export interface LegacyDealerLedgerProjectionResponse {
  hasLedgerEntries: false;
  hasLegacyEntries: boolean;
  openingBalance: number;
  openingBalanceSource: 'LEGACY';
  rows: LegacyDealerLedgerRow[];
}

/**
 * Check if dealer exists
 */
async function dealerExists(dealerId: string): Promise<boolean> {
  const dealer = await prisma.dealer.findUnique({
    where: { id: dealerId },
    select: { id: true },
  });
  return !!dealer;
}

/**
 * Project legacy commission records (Commission table) into ledger rows.
 * Commission = Credit (amount owed to dealer)
 */
async function projectCommissionRows(
  dealerId: string,
  filters?: { startDate?: Date; endDate?: Date }
): Promise<Array<{ date: Date; credit: number; memo: string; ref: string; id: string }>> {
  const where: any = { dealerId };
  if (filters?.startDate || filters?.endDate) {
    where.createdAt = {};
    if (filters.startDate) where.createdAt.gte = filters.startDate;
    if (filters.endDate) where.createdAt.lte = filters.endDate;
  }

  const commissions = await prisma.commission.findMany({
    where,
    include: { sale: { include: { property: { select: { name: true } } } } },
    orderBy: { createdAt: 'asc' },
  });

  return commissions.map((c) => ({
    id: `COMM-${c.id}`,
    date: c.createdAt,
    credit: Number((c.amount || 0).toFixed(2)),
    memo: `Commission${c.sale?.property?.name ? ` - ${c.sale.property.name}` : ''}${c.rate ? ` @ ${c.rate}%` : ''}`.trim(),
    ref: c.saleId || c.id,
  }));
}

/**
 * Project legacy sale commission records (Sale table) into ledger rows.
 * Sale.commission = Credit. Use only when Commission table has no matching record
 * to avoid double-count. For simplicity, we use Commission as primary; Sale as fallback
 * only for sales with commission but no Commission record.
 */
async function projectSaleCommissionRows(
  dealerId: string,
  filters?: { startDate?: Date; endDate?: Date }
): Promise<Array<{ date: Date; credit: number; memo: string; ref: string; id: string }>> {
  const where: any = { dealerId, commission: { gt: 0 } };
  if (filters?.startDate || filters?.endDate) {
    where.saleDate = {};
    if (filters.startDate) where.saleDate.gte = filters.startDate;
    if (filters.endDate) where.saleDate.lte = filters.endDate;
  }

  const sales = await prisma.sale.findMany({
    where,
    include: { property: { select: { name: true } } },
    orderBy: { saleDate: 'asc' },
  });

  const saleIds = sales.map((s) => s.id).filter(Boolean) as string[];
  const commissionIds = new Set<string>();
  if (saleIds.length > 0) {
    const comms = await prisma.commission.findMany({
      where: { saleId: { in: saleIds } },
      select: { saleId: true },
    });
    comms.forEach((c) => { if (c.saleId) commissionIds.add(c.saleId); });
  }

  return sales
    .filter((s) => !commissionIds.has(s.id))
    .map((s) => ({
      id: `SALE-${s.id}`,
      date: s.saleDate,
      credit: Number((s.commission || 0).toFixed(2)),
      memo: `Sale Commission${s.property?.name ? ` - ${s.property.name}` : ''}`.trim(),
      ref: s.id,
    }));
}

/**
 * Project voucher payments to dealer (Voucher with payeeType=Dealer) into ledger rows.
 * Payment = Debit (reduces payable)
 */
async function projectVoucherPaymentRows(
  dealerId: string,
  filters?: { startDate?: Date; endDate?: Date }
): Promise<Array<{ date: Date; debit: number; memo: string; ref: string; id: string }>> {
  const where: any = {
    payeeType: 'Dealer',
    payeeId: dealerId,
    status: 'posted',
  };
  if (filters?.startDate || filters?.endDate) {
    where.date = {};
    if (filters.startDate) where.date.gte = filters.startDate;
    if (filters.endDate) where.date.lte = filters.endDate;
  }

  const vouchers = await prisma.voucher.findMany({
    where,
    orderBy: { date: 'asc' },
  });

  return vouchers.map((v) => ({
    id: `VOUCH-${v.id}`,
    date: v.date,
    debit: Number((v.amount || 0).toFixed(2)),
    memo: v.description || `Payment to dealer - ${v.type} ${v.voucherNumber}`,
    ref: v.voucherNumber || v.id,
  }));
}

/**
 * Compute opening balance (prior to filter range). Read-time only, never stored.
 */
async function computeOpeningBalance(
  dealerId: string,
  filters?: { startDate?: Date; endDate?: Date }
): Promise<number> {
  if (!filters?.startDate) return 0;

  let total = 0;

  const commissions = await prisma.commission.findMany({
    where: { dealerId, createdAt: { lt: filters.startDate } },
    select: { amount: true },
  });
  total += commissions.reduce((s, c) => s + (c.amount || 0), 0);

  const salesWithoutCommission = await prisma.sale.findMany({
    where: { dealerId, commission: { gt: 0 }, saleDate: { lt: filters.startDate } },
    select: { id: true, commission: true },
  });
  const saleIdsForComm = salesWithoutCommission.map((s) => s.id).filter(Boolean) as string[];
  const commissionSaleIds = new Set<string>();
  if (saleIdsForComm.length > 0) {
    const comms = await prisma.commission.findMany({
      where: { saleId: { in: saleIdsForComm } },
      select: { saleId: true },
    });
    comms.forEach((c) => { if (c.saleId) commissionSaleIds.add(c.saleId); });
  }
  total += salesWithoutCommission
    .filter((s) => !commissionSaleIds.has(s.id))
    .reduce((s, sale) => s + (sale.commission || 0), 0);

  const vouchers = await prisma.voucher.findMany({
    where: {
      payeeType: 'Dealer',
      payeeId: dealerId,
      status: 'posted',
      date: { lt: filters.startDate },
    },
    select: { amount: true },
  });
  total -= vouchers.reduce((s, v) => s + (v.amount || 0), 0);

  return Number(total.toFixed(2));
}

/**
 * Get legacy dealer ledger projection.
 * READ-ONLY. No mutation. Running balance computed at read-time.
 */
export async function getLegacyDealerLedgerProjection(
  dealerId: string,
  filters?: { startDate?: Date; endDate?: Date }
): Promise<LegacyDealerLedgerProjectionResponse | null> {
  if (!dealerId) return null;
  if (!(await dealerExists(dealerId))) return null;

  const [commissionRows, saleRows, voucherRows, openingBalance] = await Promise.all([
    projectCommissionRows(dealerId, filters),
    projectSaleCommissionRows(dealerId, filters),
    projectVoucherPaymentRows(dealerId, filters),
    computeOpeningBalance(dealerId, filters),
  ]);

  type RawRow = { date: Date; debit?: number; credit?: number; memo: string; ref: string; id: string };
  const rawRows: RawRow[] = [
    ...commissionRows.map((r) => ({ ...r, debit: undefined, credit: r.credit })),
    ...saleRows.map((r) => ({ ...r, debit: undefined, credit: r.credit })),
    ...voucherRows.map((r) => ({ ...r, debit: r.debit, credit: undefined })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (rawRows.length === 0 && openingBalance === 0) {
    return {
      hasLedgerEntries: false,
      hasLegacyEntries: false,
      openingBalance: 0,
      openingBalanceSource: 'LEGACY',
      rows: [],
    };
  }

  const rows: LegacyDealerLedgerRow[] = [];
  if (openingBalance !== 0 || rawRows.length > 0) {
    const openingRowDate = filters?.startDate ?? (rawRows.length > 0 ? rawRows[0].date : new Date());
    rows.push({
      id: 'OPENING-LEGACY',
      trandate: openingRowDate,
      transactionNumber: '—',
      memo: 'OPENING BALANCE (Legacy)',
      debitAmount: 0,
      creditAmount: 0,
      runningBalance: openingBalance,
      drCrStatus: openingBalance >= 0 ? 'CR' : 'DR',
      sourceType: 'LEGACY_COMMISSION',
      isLegacy: true,
    });
  }
  let runningBalance = openingBalance;
  for (const r of rawRows) {
    const debit = r.debit ?? 0;
    const credit = r.credit ?? 0;
    runningBalance = Number((runningBalance + credit - debit).toFixed(2));
    rows.push({
      id: r.id,
      trandate: r.date,
      transactionNumber: r.ref,
      memo: r.memo,
      debitAmount: debit,
      creditAmount: credit,
      runningBalance,
      drCrStatus: runningBalance >= 0 ? 'CR' : 'DR',
      sourceType: 'LEGACY_COMMISSION',
      isLegacy: true,
    });
  }

  return {
    hasLedgerEntries: false,
    hasLegacyEntries: true,
    openingBalance,
    openingBalanceSource: 'LEGACY',
    rows,
  };
}
