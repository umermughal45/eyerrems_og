/**
 * UnifiedLedgerService - Unified ledger service for Client, Dealer, and Property ledgers
 * Implements proper double-entry accounting with running balance calculation
 */

import prisma from '../prisma/client';
import { LedgerService } from './ledger-service';
import { DealerLedgerService } from './dealer-ledger-service';
import { getEntityLedgerEntries } from './finance-operation-ledger-service';
import { getLedgerEntries as getLedgerEngineEntries } from './ledger-engine-service';
import { getLegacyDealerLedgerProjection } from './legacy-dealer-ledger-projection-service';
import { getClientLedger as getClientLedgerFromService, getPropertyLedger as getPropertyLedgerFromService } from './client-property-ledger-service';

export type LedgerSourceType = 'deal' | 'payment' | 'voucher' | 'refund' | 'transfer' | 'merge' | 'commission' | 'expense' | 'adjustment';

export interface LedgerEntry {
  id: string;
  date: Date;
  referenceNo: string | null;
  description: string;
  debit: number;
  credit: number;
  runningBalance: number;
  sourceType?: LedgerSourceType;
  transactionUuid?: string;
  isLegacy?: boolean;
  status?: string;
}

export interface LedgerResponse {
  entityName: string;
  entityId: string;
  entries: LedgerEntry[];
  summary: {
    totalDebit: number;
    totalCredit: number;
    closingBalance: number;
    openingBalance?: number;
    openingBalanceSource?: 'Derived' | 'Legacy';
    hasLegacyEntries?: boolean;
    dealValue?: number;
    received?: number;
    outstanding?: number;
  };
}

export class UnifiedLedgerService {
  /**
   * Get unified ledger for any entity type
   */
  static async getLedger(
    type: 'client' | 'dealer' | 'property',
    id: string,
    filters?: {
      startDate?: Date;
      endDate?: Date;
      sourceType?: string;
    }
  ): Promise<LedgerResponse> {
    switch (type) {
      case 'client':
        return await this.getClientLedger(id, filters);
      case 'dealer':
        return await this.getDealerLedger(id, filters);
      case 'property':
        return await this.getPropertyLedger(id, filters);
      default:
        throw new Error(`Invalid ledger type: ${type}`);
    }
  }

  /**
   * Get Client Ledger - delegates to client-property-ledger-service (accounting-correct, read-only)
   */
  private static async getClientLedger(
    clientId: string,
    filters?: { startDate?: Date; endDate?: Date; sourceType?: string }
  ): Promise<LedgerResponse> {
    const res = await getClientLedgerFromService(clientId, filters);
    const allEntries = res.openingBalanceRow
      ? [{ ...res.openingBalanceRow, running_balance: 0 }, ...res.entries]
      : res.entries;
    const entries: LedgerEntry[] = allEntries.map((e) => ({
      id: e.id,
      date: new Date(e.date),
      referenceNo: e.reference_id,
      description: e.description,
      debit: e.debit,
      credit: e.credit,
      runningBalance: e.running_balance,
      sourceType: e.source_type.toLowerCase() as LedgerSourceType,
      transactionUuid: e.reference_id,
      isLegacy: e.status === 'Legacy',
      status: e.status,
    }));
    return {
      entityName: res.entityName,
      entityId: res.entityId,
      entries,
      summary: {
        totalDebit: res.summary.dealValue,
        totalCredit: res.summary.received,
        closingBalance: res.summary.outstanding,
        openingBalance: 0,
        openingBalanceSource: 'Derived',
        hasLegacyEntries: false,
        dealValue: res.summary.dealValue,
        received: res.summary.received,
        outstanding: res.summary.outstanding,
      },
    };
  }

  /**
   * Get Dealer Ledger with proper double-entry format
   * Priority: LedgerEngineEntry > DealerLedger > Legacy Projection (Commission/Sale/Voucher)
   * Rules:
   * - Commission → Credit (amount owed to dealer)
   * - Payment → Debit (payment reduces payable)
   * - Adjustment → Credit/Debit based on amount sign
   */
  private static async getDealerLedger(
    dealerId: string,
    filters?: { startDate?: Date; endDate?: Date }
  ): Promise<LedgerResponse> {
    const dealer = await prisma.dealer.findUnique({
      where: { id: dealerId },
      select: { id: true, name: true },
    });

    if (!dealer) {
      throw new Error('Dealer not found');
    }

    // 1. Prefer Ledger Engine entries (new engine)
    try {
      const engineEntries = await getLedgerEngineEntries('dealer', dealerId, filters);
      if (engineEntries.length > 0) {
        const entries: LedgerEntry[] = [];
        let runningBalance = 0;
        for (const e of engineEntries) {
          runningBalance += e.debitAmount - e.creditAmount;
          entries.push({
            id: e.id,
            date: e.entryDate,
            referenceNo: e.transactionUuid,
            description: e.narration || `${e.sourceType} - ${e.transactionUuid.slice(0, 8)}`,
            debit: e.debitAmount,
            credit: e.creditAmount,
            runningBalance: Number(runningBalance.toFixed(2)),
            sourceType: e.sourceType as LedgerSourceType,
            transactionUuid: e.transactionUuid,
            isLegacy: false,
          });
        }
        const totalDebit = entries.reduce((s, x) => s + x.debit, 0);
        const totalCredit = entries.reduce((s, x) => s + x.credit, 0);
        return {
          entityName: dealer.name || 'Unknown Dealer',
          entityId: dealer.id,
          entries,
          summary: {
            totalDebit: Number(totalDebit.toFixed(2)),
            totalCredit: Number(totalCredit.toFixed(2)),
            closingBalance: Number(runningBalance.toFixed(2)),
            openingBalance: 0,
            openingBalanceSource: 'Derived',
            hasLegacyEntries: false,
          },
        };
      }
    } catch {
      // LedgerEngine table may not exist or error - fall through
    }

    // 2. Use DealerLedger if it has entries
    const where: any = { dealerId };
    if (filters?.startDate || filters?.endDate) {
      where.date = {};
      if (filters.startDate) where.date.gte = filters.startDate;
      if (filters.endDate) where.date.lte = filters.endDate;
    }

    const dealerLedgerEntries = await prisma.dealerLedger.findMany({
      where,
      include: {
        deal: {
          include: {
            client: { select: { id: true, name: true } },
            property: { select: { id: true, name: true } },
          },
        },
        client: { select: { id: true, name: true } },
      },
      orderBy: { date: 'asc' },
    });

    // 3. If DealerLedger is empty, use Legacy Projection (Commission, Sale, Voucher)
    if (dealerLedgerEntries.length === 0) {
      const projection = await getLegacyDealerLedgerProjection(dealerId, filters);
      if (projection && projection.hasLegacyEntries && projection.rows.length > 0) {
        const entries: LedgerEntry[] = projection.rows.map((r) => ({
          id: r.id,
          date: r.trandate,
          referenceNo: r.transactionNumber,
          description: r.memo,
          debit: r.debitAmount,
          credit: r.creditAmount,
          runningBalance: r.runningBalance,
          sourceType: 'commission' as LedgerSourceType,
          transactionUuid: r.id,
          isLegacy: true,
        }));
        const totalDebit = entries.reduce((s, e) => s + e.debit, 0);
        const totalCredit = entries.reduce((s, e) => s + e.credit, 0);
        const closingBalance = entries.length > 0 ? entries[entries.length - 1].runningBalance : projection.openingBalance;
        return {
          entityName: dealer.name || 'Unknown Dealer',
          entityId: dealer.id,
          entries,
          summary: {
            totalDebit: Number(totalDebit.toFixed(2)),
            totalCredit: Number(totalCredit.toFixed(2)),
            closingBalance: Number(closingBalance.toFixed(2)),
            openingBalance: projection.openingBalance,
            openingBalanceSource: 'Legacy',
            hasLegacyEntries: true,
          },
        };
      }
      // No DealerLedger and no legacy data - return empty with no fake zeros
      return {
        entityName: dealer.name || 'Unknown Dealer',
        entityId: dealer.id,
        entries: [],
        summary: {
          totalDebit: 0,
          totalCredit: 0,
          closingBalance: 0,
          openingBalance: 0,
          openingBalanceSource: 'Derived',
          hasLegacyEntries: false,
        },
      };
    }

    const entries: LedgerEntry[] = [];
    let runningBalance = 0;

    for (const entry of dealerLedgerEntries) {
      if (entry.entryType === 'commission') {
        // Commission: Credit (increases payable)
        runningBalance += entry.amount;
        entries.push({
          id: entry.id,
          date: entry.date,
          referenceNo: entry.referenceId || entry.deal?.dealCode || entry.id,
          description: `Commission${entry.deal ? `: ${entry.deal.title}` : ''}${entry.description ? ` - ${entry.description}` : ''}`,
          debit: 0,
          credit: Number(entry.amount.toFixed(2)),
          runningBalance: Number(runningBalance.toFixed(2)),
          sourceType: 'commission',
          transactionUuid: entry.id,
          isLegacy: false,
        });
      } else if (entry.entryType === 'payment') {
        // Payment: Debit (reduces payable)
        runningBalance -= entry.amount;
        entries.push({
          id: entry.id,
          date: entry.date,
          referenceNo: entry.referenceId || entry.id,
          description: `Payment to dealer${entry.description ? `: ${entry.description}` : ''} - ${entry.referenceType || 'N/A'}`,
          debit: Number(entry.amount.toFixed(2)),
          credit: 0,
          runningBalance: Number(runningBalance.toFixed(2)),
          sourceType: 'payment',
          transactionUuid: entry.id,
          isLegacy: false,
        });
      } else if (entry.entryType === 'adjustment') {
        // Adjustment: Can be positive (credit) or negative (debit)
        if (entry.amount > 0) {
          runningBalance += entry.amount;
          entries.push({
            id: entry.id,
            date: entry.date,
            referenceNo: entry.referenceId || entry.id,
            description: `Adjustment${entry.description ? `: ${entry.description}` : ''}`,
            debit: 0,
            credit: Number(entry.amount.toFixed(2)),
            runningBalance: Number(runningBalance.toFixed(2)),
            sourceType: 'adjustment',
            transactionUuid: entry.id,
            isLegacy: false,
          });
        } else {
          runningBalance += entry.amount; // Already negative
          entries.push({
            id: entry.id,
            date: entry.date,
            referenceNo: entry.referenceId || entry.id,
            description: `Adjustment${entry.description ? `: ${entry.description}` : ''}`,
            debit: Number(Math.abs(entry.amount).toFixed(2)),
            credit: 0,
            runningBalance: Number(runningBalance.toFixed(2)),
            sourceType: 'adjustment',
            transactionUuid: entry.id,
            isLegacy: false,
          });
        }
      }
    }

    // Calculate totals
    const totalDebit = entries.reduce((sum, e) => sum + e.debit, 0);
    const totalCredit = entries.reduce((sum, e) => sum + e.credit, 0);
    const closingBalance = runningBalance;

    return {
      entityName: dealer.name || 'Unknown Dealer',
      entityId: dealer.id,
      entries,
      summary: {
        totalDebit: Number(totalDebit.toFixed(2)),
        totalCredit: Number(totalCredit.toFixed(2)),
        closingBalance: Number(closingBalance.toFixed(2)),
        openingBalance: 0,
        openingBalanceSource: 'Derived',
        hasLegacyEntries: false,
      },
    };
  }

  /**
   * Get Property Ledger - delegates to client-property-ledger-service (accounting-correct, read-only)
   */
  private static async getPropertyLedger(
    propertyId: string,
    filters?: { startDate?: Date; endDate?: Date; sourceType?: string }
  ): Promise<LedgerResponse> {
    const res = await getPropertyLedgerFromService(propertyId, filters);
    const allEntries = res.openingBalanceRow
      ? [{ ...res.openingBalanceRow, running_balance: 0 }, ...res.entries]
      : res.entries;
    const entries: LedgerEntry[] = allEntries.map((e) => ({
      id: e.id,
      date: new Date(e.date),
      referenceNo: e.reference_id,
      description: e.description,
      debit: e.debit,
      credit: e.credit,
      runningBalance: e.running_balance,
      sourceType: e.source_type.toLowerCase() as LedgerSourceType,
      transactionUuid: e.reference_id,
      isLegacy: e.status === 'Legacy',
      status: e.status,
    }));
    return {
      entityName: res.entityName,
      entityId: res.entityId,
      entries,
      summary: {
        totalDebit: res.summary.dealValue,
        totalCredit: res.summary.received,
        closingBalance: res.summary.outstanding,
        openingBalance: 0,
        openingBalanceSource: 'Derived',
        hasLegacyEntries: false,
        dealValue: res.summary.dealValue,
        received: res.summary.received,
        outstanding: res.summary.outstanding,
      },
    };
  }
}

