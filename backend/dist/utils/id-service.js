"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IdService = void 0;
const client_1 = __importDefault(require("../prisma/client"));
class IdService {
    /**
     * Generate sequential Entity ID (e.g., LD0001, CL0001)
     */
    static async generateEntityId(prefix) {
        const modelMap = {
            LD: client_1.default.lead,
            CL: client_1.default.client,
            DL: client_1.default.dealer,
            PR: client_1.default.property,
            DEAL: client_1.default.deal,
            PAY: client_1.default.payment,
        };
        const fieldMap = {
            LD: 'leadCode',
            CL: 'clientCode',
            DL: 'dealerCode',
            PR: 'propertyCode',
            DEAL: 'dealCode',
            PAY: 'paymentId',
        };
        const model = modelMap[prefix];
        const field = fieldMap[prefix];
        if (!model || !field)
            throw new Error(`Invalid prefix: ${prefix}`);
        // Find the latest record with this prefix
        const lastRecord = await model.findFirst({
            where: { [field]: { startsWith: prefix } },
            orderBy: { [field]: 'desc' },
            select: { [field]: true },
        });
        let nextNumber = 1;
        if (lastRecord && lastRecord[field]) {
            const currentCode = lastRecord[field];
            const match = currentCode.match(new RegExp(`^${prefix}(\\d+)$`));
            if (match) {
                nextNumber = parseInt(match[1], 10) + 1;
            }
        }
        return `${prefix}${nextNumber.toString().padStart(4, '0')}`;
    }
    /**
     * Generate YYYY-MM-#### sequential TID
     */
    static async generateTID() {
        const now = new Date();
        const year = now.getFullYear();
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const prefix = `${year}-${month}-`;
        // Search across all major entities for the latest TID this month
        const [lastLead, lastClient, lastDeal] = await Promise.all([
            client_1.default.lead.findFirst({ where: { tid: { startsWith: prefix } }, orderBy: { tid: 'desc' }, select: { tid: true } }),
            client_1.default.client.findFirst({ where: { tid: { startsWith: prefix } }, orderBy: { tid: 'desc' }, select: { tid: true } }),
            client_1.default.deal.findFirst({ where: { tid: { startsWith: prefix } }, orderBy: { tid: 'desc' }, select: { tid: true } }),
        ]);
        const tids = [lastLead?.tid, lastClient?.tid, lastDeal?.tid].filter(Boolean);
        tids.sort().reverse();
        let nextNumber = 1;
        if (tids.length > 0) {
            const lastTid = tids[0];
            const parts = lastTid.split('-');
            // Parts: [YYYY, MM, ####]
            const lastNum = parseInt(parts[2], 10);
            if (!isNaN(lastNum)) {
                nextNumber = lastNum + 1;
            }
        }
        return `${prefix}${nextNumber.toString().padStart(4, '0')}`;
    }
}
exports.IdService = IdService;
//# sourceMappingURL=id-service.js.map