"use strict";
/**
 * Ledger Engine Service
 * Single source of truth for Balance = SUM(debit_amount) - SUM(credit_amount)
 * Additive only. Reads existing data, records new entries. No recalculation or backfill.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeLedgerEntry = writeLedgerEntry;
exports.getLedgerEntries = getLedgerEntries;
exports.getEntityBalance = getEntityBalance;
const client_1 = __importDefault(require("../prisma/client"));
/**
 * Write one ledger entry (one side of double-entry).
 * Balance = SUM(debit_amount) - SUM(credit_amount) per entity.
 */
async function writeLedgerEntry(input, tx) {
    const client = tx ?? client_1.default;
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
async function getLedgerEntries(entityType, entityId, filters) {
    const where = { entityType, entityId };
    if (filters?.status)
        where.status = filters.status;
    if (filters?.startDate || filters?.endDate) {
        where.entryDate = {};
        if (filters.startDate)
            where.entryDate.gte = filters.startDate;
        if (filters.endDate)
            where.entryDate.lte = filters.endDate;
    }
    const rows = await client_1.default.ledgerEngineEntry.findMany({
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
async function getEntityBalance(entityType, entityId, asOfDate, status = 'posted') {
    const where = { entityType, entityId, status };
    if (asOfDate)
        where.entryDate = { lte: asOfDate };
    const agg = await client_1.default.ledgerEngineEntry.aggregate({
        where,
        _sum: { debitAmount: true, creditAmount: true },
    });
    const debit = agg._sum?.debitAmount ?? 0;
    const credit = agg._sum?.creditAmount ?? 0;
    return debit - credit;
}
//# sourceMappingURL=ledger-engine-service.js.map