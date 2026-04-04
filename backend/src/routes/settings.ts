import express, { Response } from 'express';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';
import { settingsService } from '../services/settings.service';
import logger from '../utils/logger';

const router = (express as any).Router();

/**
 * Get application settings
 */
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const settings = await settingsService.getSettings();
    
    // Mask sensitive integration keys
    if (settings?.integrationConfig?.resend?.apiKey) {
      const cloned = JSON.parse(JSON.stringify(settings));
      const key = cloned.integrationConfig.resend.apiKey;
      cloned.integrationConfig.resend.apiKey = key.substring(0, 4) + '...' + key.slice(-4);
      return res.json(cloned);
    }
    
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

/**
 * Update application settings (Branding & Contact)
 */
router.put('/', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { 
      companyName, 
      companyEmail, 
      supportPhone, 
      companyAddress,
      companyLogo,
      selectedCurrency,
      notificationConfig,
      integrationConfig
    } = req.body;
    
    // Validation
    if (companyName !== undefined && !companyName) {
      return res.status(400).json({ error: 'Company Name is required' });
    }

    if (companyEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(companyEmail)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }
    }

    const updateData: any = {};
    if (companyName !== undefined) updateData.companyName = companyName;
    if (companyEmail !== undefined) updateData.companyEmail = companyEmail;
    if (supportPhone !== undefined) updateData.supportPhone = supportPhone;
    if (companyAddress !== undefined) updateData.companyAddress = companyAddress;
    if (companyLogo !== undefined) updateData.companyLogo = companyLogo;
    if (selectedCurrency !== undefined) updateData.selectedCurrency = selectedCurrency;
    if (notificationConfig !== undefined) updateData.notificationConfig = notificationConfig;
    
    if (integrationConfig !== undefined) {
      // Prevent overwriting authentic keys with masked strings
      if (integrationConfig.resend?.apiKey && integrationConfig.resend.apiKey.includes('...')) {
        const current = await settingsService.getSettings();
        if (current?.integrationConfig?.resend?.apiKey) {
          integrationConfig.resend.apiKey = current.integrationConfig.resend.apiKey;
        }
      }
      updateData.integrationConfig = integrationConfig;
    }

    const updated = await settingsService.updateSettings(updateData, req);

    res.json({ success: true, settings: updated });
  } catch (error: any) {
    console.error('API Error in PUT /settings:', error);
    res.status(500).json({ error: 'Failed to update settings', details: error.message || String(error) });
  }
});

/**
 * Clear settings cache
 */
router.post('/clear-cache', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    settingsService.clearCache();
    res.json({ success: true, message: 'Settings cache cleared' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to clear cache' });
  }
});

/**
 * Generate Full System Report (Stub)
 */
router.post('/generate-report', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    logger.info(`System report requested by ${req.user?.username || req.user?.email}`);
    
    const reportData = await settingsService.generateFullSystemReport(req);

    res.json({ 
      success: true, 
      message: 'System report generated successfully.',
      data: reportData
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

export default router;
