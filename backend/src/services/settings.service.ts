import prisma from '../prisma/client';
import logger from '../utils/logger';
import { createAuditLog } from './audit-log';
import { Request } from 'express';

class SettingsService {
  private cache: any = null;
  private lastFetch: number = 0;
  private CACHE_TTL = 1000 * 60 * 5; // 5 minutes

  /**
   * Get application settings (Singleton)
   */
  async getSettings(forceRefresh = false): Promise<any> {
    const now = Date.now();
    if (!forceRefresh && this.cache && (now - this.lastFetch < this.CACHE_TTL)) {
      return this.cache;
    }

    try {
      let settings = await prisma.appSettings.findFirst();

      // If no settings exist, create default (should be handled by seed, but defensive)
      if (!settings) {
        settings = await prisma.appSettings.create({
          data: {
            companyName: 'REMS Branding',
            companyEmail: null,
            supportPhone: null,
            companyAddress: null,
            companyLogo: null,
            selectedCurrency: 'PKR',
            notificationConfig: {},
            integrationConfig: {}
          }
        });
      }

      this.cache = settings;
      this.lastFetch = now;
      return settings;
    } catch (error) {
      logger.error('Error fetching application settings:', error);
      return this.cache; // Return stale cache on error
    }
  }

  /**
   * Update application settings
   */
  async updateSettings(data: any, req?: Request): Promise<any> {
    try {
      const current = await this.getSettings(true);
      
      const updated = await prisma.appSettings.update({
        where: { id: current.id },
        data: {
          ...data,
          updatedAt: new Date()
        }
      });

      // Update cache
      this.cache = updated;
      this.lastFetch = Date.now();

      // Audit log
      if (req) {
        await createAuditLog({
          entityType: 'AppSettings',
          entityId: updated.id,
          action: 'update',
          req,
          oldValues: current,
          newValues: updated,
          description: `Updated application branding and contact settings`,
          userId: (req as any).user?.id,
          userName: (req as any).user?.username || (req as any).user?.email,
        });
      }

      return updated;
    } catch (error) {
      logger.error('Error updating application settings:', error);
      throw error;
    }
  }

  /**
   * Update a specific config (notifications or integrations)
   */
  async updateConfig(key: 'notificationConfig' | 'integrationConfig', value: any, req?: Request) {
    const current = await this.getSettings(true);
    return this.updateSettings({ [key]: value }, req);
  }

  /**
   * Clear settings cache
   */
  clearCache() {
    this.cache = null;
    this.lastFetch = 0;
    logger.info('Settings cache cleared manually.');
  }

  /**
   * Generate Full System Report
   */
  async generateFullSystemReport(req?: Request) {
    try {
      const [propertyCount, tenantCount, unitCount, userCount] = await Promise.all([
        prisma.property.count(),
        prisma.tenant.count(),
        prisma.unit.count(),
        prisma.user.count()
      ]);

      const reportData = {
        timestamp: new Date().toISOString(),
        stats: {
          properties: propertyCount,
          tenants: tenantCount,
          units: unitCount,
          users: userCount
        },
        generatedBy: (req as any)?.user?.username || (req as any)?.user?.email || 'System'
      };

      if (req) {
        await createAuditLog({
          entityType: 'System',
          entityId: 'Report',
          action: 'create',
          req,
          newValues: reportData,
          description: `Generated full system statistics report`,
          userId: (req as any).user?.id,
          userName: (req as any).user?.username || (req as any).user?.email,
        });
      }

      return reportData;
    } catch (error) {
      logger.error('Failed to generate system report:', error);
      throw error;
    }
  }
}

export const settingsService = new SettingsService();
export default settingsService;
