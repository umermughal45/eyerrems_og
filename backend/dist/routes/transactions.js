"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const client_1 = __importDefault(require("../prisma/client"));
const error_handler_1 = require("../utils/error-handler");
const logger_1 = __importDefault(require("../utils/logger"));
const router = express_1.default.Router();
/**
 * Get all entities associated with a specific Transaction ID
 * @route GET /api/transactions/:tid
 */
router.get('/:tid', auth_1.authenticate, async (req, res) => {
    try {
        const { tid } = req.params;
        if (!tid) {
            return res.status(400).json({ success: false, error: 'Transaction ID is required' });
        }
        const registryEntries = await client_1.default.transactionIdentityRegistry.findMany({
            where: { tid },
            orderBy: { createdAt: 'asc' },
        });
        if (!registryEntries || registryEntries.length === 0) {
            return res.status(404).json({ success: false, error: 'Transaction ID not found' });
        }
        // Enhance entries with basic entity details for the timeline
        const enhancedEntries = await Promise.all(registryEntries.map(async (entry) => {
            let details = null;
            let url = '';
            try {
                switch (entry.entityType) {
                    case 'lead':
                        const lead = await client_1.default.lead.findUnique({ where: { id: entry.entityId }, select: { name: true, status: true, id: true } });
                        details = lead;
                        url = `/crm/leads`; // Generic path, UI handles modal
                        break;
                    case 'client':
                        const client = await client_1.default.client.findUnique({ where: { id: entry.entityId }, select: { name: true, status: true, id: true } });
                        details = client;
                        url = `/crm/clients`;
                        break;
                    case 'deal':
                        const deal = await client_1.default.deal.findUnique({ where: { id: entry.entityId }, select: { title: true, status: true, id: true, dealCode: true } });
                        details = deal;
                        url = `/crm/deals/${entry.entityId}`;
                        break;
                    case 'invoice':
                        const invoice = await client_1.default.invoice.findUnique({ where: { id: entry.entityId }, select: { invoiceNumber: true, status: true, totalAmount: true, id: true } });
                        details = invoice;
                        url = `/finance/invoices`;
                        break;
                    case 'payment':
                        const payment = await client_1.default.payment.findUnique({ where: { id: entry.entityId }, select: { paymentId: true, amount: true, paymentMode: true, id: true } });
                        details = payment;
                        url = `/finance/payments`;
                        break;
                }
            }
            catch (e) {
                logger_1.default.warn(`Failed to fetch details for ${entry.entityType} ${entry.entityId}`);
            }
            return {
                ...entry,
                details,
                url,
            };
        }));
        return (0, error_handler_1.successResponse)(res, {
            tid,
            timeline: enhancedEntries,
            count: enhancedEntries.length,
        });
    }
    catch (error) {
        logger_1.default.error(`Error fetching transaction ${req.params.tid}:`, error);
        return (0, error_handler_1.errorResponse)(res, error);
    }
});
exports.default = router;
//# sourceMappingURL=transactions.js.map