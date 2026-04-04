"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnifiedSearchService = void 0;
const client_1 = __importDefault(require("../prisma/client"));
class UnifiedSearchService {
    /**
     * Deep search across the entire business lifecycle using a TID
     */
    static async searchByTID(tid) {
        if (!tid)
            return null;
        const [lead, client, properties, dealers, deals, payments, ledgerEntries] = await Promise.all([
            client_1.default.lead.findFirst({
                where: { tid, isDeleted: false },
                include: { assignedAgent: { select: { username: true, email: true } } }
            }),
            client_1.default.client.findFirst({
                where: { tid, isDeleted: false },
                include: { deals: true }
            }),
            client_1.default.property.findMany({
                where: { tid, isDeleted: false },
            }),
            client_1.default.dealer.findMany({
                where: { tid, isDeleted: false },
            }),
            client_1.default.deal.findMany({
                where: { tid, isDeleted: false },
                include: { property: true, dealer: true }
            }),
            client_1.default.payment.findMany({
                where: { deal: { tid }, deletedAt: null },
                include: { deal: true }
            }),
            client_1.default.ledgerEntry.findMany({
                where: { remarks: { contains: `[TID:${tid}]` }, deletedAt: null },
                orderBy: { date: 'desc' }
            }),
        ]);
        // If nothing found at all, return null
        if (!lead && !client && properties.length === 0 && dealers.length === 0 && deals.length === 0 && ledgerEntries.length === 0) {
            // One last check: maybe the TID is partial? 
            // But for ERP-style search, exact TID is usually preferred.
            return null;
        }
        return {
            tid,
            lead,
            client,
            properties,
            dealers,
            deals,
            payments,
            ledgerEntries,
        };
    }
    /**
     * Get unified ledger for an entity (CLIENT, PROPERTY, or DEALER)
     */
    static async getLedger(type, id) {
        // This will fetch all ledger entries related to this entity's TID(s)
        // For simplicity, we find the entity first to get its TID
        let tid = null;
        if (type === 'CLIENT') {
            const client = await client_1.default.client.findUnique({ where: { id }, select: { tid: true } });
            tid = client?.tid || null;
        }
        else if (type === 'PROPERTY') {
            const property = await client_1.default.property.findUnique({ where: { id }, select: { tid: true } });
            tid = property?.tid || null;
        }
        else if (type === 'DEALER') {
            const dealer = await client_1.default.dealer.findUnique({ where: { id }, select: { tid: true } });
            tid = dealer?.tid || null;
        }
        if (!tid)
            return [];
        const deals = await client_1.default.deal.findMany({
            where: { tid, isDeleted: false },
            select: { id: true },
        });
        if (deals.length === 0)
            return [];
        return await client_1.default.ledgerEntry.findMany({
            where: {
                dealId: { in: deals.map((d) => d.id) },
                deletedAt: null,
                remarks: { contains: `[LEDGER:${type}]` },
            },
            orderBy: { date: 'desc' }
        });
    }
}
exports.UnifiedSearchService = UnifiedSearchService;
//# sourceMappingURL=unified-search-service.js.map