import prisma from '../prisma/client';
import logger from '../utils/logger';
import { createAuditLog } from './audit-log';
import { Request } from 'express';

class CurrencyService {
  /**
   * Get all active currencies
   */
  async getAllActive() {
    try {
      return await prisma.currency.findMany({
        where: { isActive: true },
        orderBy: { code: 'asc' },
      });
    } catch (error) {
      logger.error('Error fetching active currencies:', error);
      throw error;
    }
  }

  /**
   * Get all currencies (including inactive)
   */
  async getAll() {
    try {
      return await prisma.currency.findMany({
        orderBy: { code: 'asc' },
      });
    } catch (error) {
      logger.error('Error fetching all currencies:', error);
      throw error;
    }
  }

  /**
   * Update exchange rate for a currency
   */
  async updateRate(code: string, exchangeRate: number, req?: Request) {
    try {
      const oldCurrency = await prisma.currency.findUnique({
        where: { code },
      });

      const updated = await prisma.currency.update({
        where: { code },
        data: { exchangeRate, updatedAt: new Date() },
      });

      if (req) {
        await createAuditLog({
          entityType: 'Currency',
          entityId: code,
          action: 'update',
          req,
          oldValues: { exchangeRate: oldCurrency?.exchangeRate },
          newValues: { exchangeRate },
          description: `Updated exchange rate for ${code} to ${exchangeRate}`,
          userId: (req as any).user?.id,
          userName: (req as any).user?.username || (req as any).user?.email,
        });
      }

      return updated;
    } catch (error) {
      logger.error(`Error updating currency rate for ${code}:`, error);
      throw error;
    }
  }

  /**
   * Create or update a currency
   */
  async upsertCurrency(data: { code: string; symbol: string; exchangeRate?: number; isBase?: boolean; isActive?: boolean }, req?: Request) {
    try {
      const { code, ...rest } = data;
      
      const existing = await prisma.currency.findUnique({
        where: { code },
      });

      // If making this the base currency, unset previous base
      if (data.isBase) {
        await prisma.currency.updateMany({
          where: { isBase: true, NOT: { code } },
          data: { isBase: false },
        });
      }

      const result = await prisma.currency.upsert({
        where: { code },
        update: { ...rest, updatedAt: new Date() },
        create: { code, ...rest },
      });

      if (req) {
        await createAuditLog({
          entityType: 'Currency',
          entityId: code,
          action: existing ? 'update' : 'create',
          req,
          oldValues: existing,
          newValues: result,
          description: `${existing ? 'Updated' : 'Created'} currency: ${code}`,
          userId: (req as any).user?.id,
          userName: (req as any).user?.username || (req as any).user?.email,
        });
      }

      return result;
    } catch (error) {
      logger.error(`Error upserting currency ${data.code}:`, error);
      throw error;
    }
  }

  /**
   * Delete a currency (marks as inactive if it's the base or has history, but here we just deactivate)
   */
  async deactivateCurrency(code: string, req?: Request) {
    try {
      const currency = await prisma.currency.findUnique({ where: { code } });
      if (currency?.isBase) {
        throw new Error('Cannot deactivate the base currency.');
      }

      const result = await prisma.currency.update({
        where: { code },
        data: { isActive: false },
      });

      if (req) {
        await createAuditLog({
          entityType: 'Currency',
          entityId: code,
          action: 'update',
          req,
          description: `Deactivated currency: ${code}`,
          userId: (req as any).user?.id,
          userName: (req as any).user?.username || (req as any).user?.email,
        });
      }

      return result;
    } catch (error) {
      logger.error(`Error deactivating currency ${code}:`, error);
      throw error;
    }
  }
}

export const currencyService = new CurrencyService();
export default currencyService;
