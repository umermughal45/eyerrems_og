import express, { Response } from 'express';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';
import { currencyService } from '../services/currency.service';

const router = (express as any).Router();

/**
 * Get all active currencies
 */
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const currencies = await currencyService.getAllActive();
    res.json(currencies);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch currencies' });
  }
});

/**
 * Get all currencies (Admin)
 */
router.get('/all', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const currencies = await currencyService.getAll();
    res.json(currencies);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch all currencies' });
  }
});

/**
 * Update exchange rate
 */
router.put('/:code/rate', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { code } = req.params;
    const { rate } = req.body;

    if (typeof rate !== 'number') {
      return res.status(400).json({ error: 'Invalid rate' });
    }

    const updated = await currencyService.updateRate(code, rate, req);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update currency rate' });
  }
});

/**
 * Create or Update Currency
 */
router.post('/', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const result = await currencyService.upsertCurrency(req.body, req);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to upsert currency' });
  }
});

/**
 * Deactivate Currency
 */
router.delete('/:code', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { code } = req.params;
    const result = await currencyService.deactivateCurrency(code, req);
    res.json({ success: true, message: `Currency ${code} deactivated` });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to deactivate currency' });
  }
});

export default router;
