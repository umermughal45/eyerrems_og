"use strict";
/**
 * Finance Operation Ledger Service
 * Additive only. Writes ledger entries for Refund, Transfer, Merge operations.
 * Single source of truth for future finance operations. Does NOT touch existing LedgerEntry.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeFinanceOperationLedger = writeFinanceOperationLedger;
exports.getEntityLedgerEntries = getEntityLedgerEntries;
exports.getEntityBalance = getEntityBalance;
const client_1 = __importDefault(require("../prisma/client"));
/**
 * Write double-entry ledger rows for a finance operation.
 * One row per side. Balance = SUM(debit) - SUM(credit) per entity.
 */
async function writeFinanceOperationLedger(entries, tx) {
    const client = tx ?? client_1.default;
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
async function getEntityLedgerEntries(entityType, entityId, filters) {
    const where = { entityType, entityId };
    if (filters?.startDate || filters?.endDate) {
        where.date = {};
        if (filters.startDate)
            where.date.gte = filters.startDate;
        if (filters.endDate)
            where.date.lte = filters.endDate;
    }
    const rows = await client_1.default.financeOperationLedgerEntry.findMany({
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
async function getEntityBalance(entityType, entityId, asOfDate) {
    const where = { entityType, entityId };
    if (asOfDate)
        where.date = { lte: asOfDate };
    const rows = await client_1.default.financeOperationLedgerEntry.findMany({ where });
    let balance = 0;
    for (const r of rows) {
        if (r.side === 'debit')
            balance += r.amount;
        else
            balance -= r.amount;
    }
    return balance;
}
//# sourceMappingURL=finance-operation-ledger-service.js.map