"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const currency_service_1 = require("../services/currency.service");
const router = express_1.default.Router();
/**
 * Get all active currencies
 */
router.get('/', auth_1.authenticate, async (req, res) => {
    try {
        const currencies = await currency_service_1.currencyService.getAllActive();
        res.json(currencies);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch currencies' });
    }
});
/**
 * Get all currencies (Admin)
 */
router.get('/all', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const currencies = await currency_service_1.currencyService.getAll();
        res.json(currencies);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch all currencies' });
    }
});
/**
 * Update exchange rate
 */
router.put('/:code/rate', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const { code } = req.params;
        const { rate } = req.body;
        if (typeof rate !== 'number') {
            return res.status(400).json({ error: 'Invalid rate' });
        }
        const updated = await currency_service_1.currencyService.updateRate(code, rate, req);
        res.json(updated);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to update currency rate' });
    }
});
/**
 * Create or Update Currency
 */
router.post('/', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const result = await currency_service_1.currencyService.upsertCurrency(req.body, req);
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to upsert currency' });
    }
});
/**
 * Deactivate Currency
 */
router.delete('/:code', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const { code } = req.params;
        const result = await currency_service_1.currencyService.deactivateCurrency(code, req);
        res.json({ success: true, message: `Currency ${code} deactivated` });
    }
    catch (error) {
        res.status(400).json({ error: error.message || 'Failed to deactivate currency' });
    }
});
exports.default = router;
//# sourceMappingURL=currency.js.map