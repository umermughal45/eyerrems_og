"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.currencyService = void 0;
const client_1 = __importDefault(require("../prisma/client"));
const logger_1 = __importDefault(require("../utils/logger"));
const audit_log_1 = require("./audit-log");
class CurrencyService {
    /**
     * Get all active currencies
     */
    async getAllActive() {
        try {
            return await client_1.default.currency.findMany({
                where: { isActive: true },
                orderBy: { code: 'asc' },
            });
        }
        catch (error) {
            logger_1.default.error('Error fetching active currencies:', error);
            throw error;
        }
    }
    /**
     * Get all currencies (including inactive)
     */
    async getAll() {
        try {
            return await client_1.default.currency.findMany({
                orderBy: { code: 'asc' },
            });
        }
        catch (error) {
            logger_1.default.error('Error fetching all currencies:', error);
            throw error;
        }
    }
    /**
     * Update exchange rate for a currency
     */
    async updateRate(code, exchangeRate, req) {
        try {
            const oldCurrency = await client_1.default.currency.findUnique({
                where: { code },
            });
            const updated = await client_1.default.currency.update({
                where: { code },
                data: { exchangeRate, updatedAt: new Date() },
            });
            if (req) {
                await (0, audit_log_1.createAuditLog)({
                    entityType: 'Currency',
                    entityId: code,
                    action: 'update',
                    req,
                    oldValues: { exchangeRate: oldCurrency?.exchangeRate },
                    newValues: { exchangeRate },
                    description: `Updated exchange rate for ${code} to ${exchangeRate}`,
                    userId: req.user?.id,
                    userName: req.user?.username || req.user?.email,
                });
            }
            return updated;
        }
        catch (error) {
            logger_1.default.error(`Error updating currency rate for ${code}:`, error);
            throw error;
        }
    }
    /**
     * Create or update a currency
     */
    async upsertCurrency(data, req) {
        try {
            const { code, ...rest } = data;
            const existing = await client_1.default.currency.findUnique({
                where: { code },
            });
            // If making this the base currency, unset previous base
            if (data.isBase) {
                await client_1.default.currency.updateMany({
                    where: { isBase: true, NOT: { code } },
                    data: { isBase: false },
                });
            }
            const result = await client_1.default.currency.upsert({
                where: { code },
                update: { ...rest, updatedAt: new Date() },
                create: { code, ...rest },
            });
            if (req) {
                await (0, audit_log_1.createAuditLog)({
                    entityType: 'Currency',
                    entityId: code,
                    action: existing ? 'update' : 'create',
                    req,
                    oldValues: existing,
                    newValues: result,
                    description: `${existing ? 'Updated' : 'Created'} currency: ${code}`,
                    userId: req.user?.id,
                    userName: req.user?.username || req.user?.email,
                });
            }
            return result;
        }
        catch (error) {
            logger_1.default.error(`Error upserting currency ${data.code}:`, error);
            throw error;
        }
    }
    /**
     * Delete a currency (marks as inactive if it's the base or has history, but here we just deactivate)
     */
    async deactivateCurrency(code, req) {
        try {
            const currency = await client_1.default.currency.findUnique({ where: { code } });
            if (currency?.isBase) {
                throw new Error('Cannot deactivate the base currency.');
            }
            const result = await client_1.default.currency.update({
                where: { code },
                data: { isActive: false },
            });
            if (req) {
                await (0, audit_log_1.createAuditLog)({
                    entityType: 'Currency',
                    entityId: code,
                    action: 'update',
                    req,
                    description: `Deactivated currency: ${code}`,
                    userId: req.user?.id,
                    userName: req.user?.username || req.user?.email,
                });
            }
            return result;
        }
        catch (error) {
            logger_1.default.error(`Error deactivating currency ${code}:`, error);
            throw error;
        }
    }
}
exports.currencyService = new CurrencyService();
exports.default = exports.currencyService;
//# sourceMappingURL=currency.service.js.map