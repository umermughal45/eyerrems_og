"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.settingsService = void 0;
const client_1 = __importDefault(require("../prisma/client"));
const logger_1 = __importDefault(require("../utils/logger"));
const audit_log_1 = require("./audit-log");
class SettingsService {
    constructor() {
        this.cache = null;
        this.lastFetch = 0;
        this.CACHE_TTL = 1000 * 60 * 5; // 5 minutes
    }
    /**
     * Get application settings (Singleton)
     */
    async getSettings(forceRefresh = false) {
        const now = Date.now();
        if (!forceRefresh && this.cache && (now - this.lastFetch < this.CACHE_TTL)) {
            return this.cache;
        }
        try {
            let settings = await client_1.default.appSettings.findFirst();
            // If no settings exist, create default (should be handled by seed, but defensive)
            if (!settings) {
                settings = await client_1.default.appSettings.create({
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
        }
        catch (error) {
            logger_1.default.error('Error fetching application settings:', error);
            return this.cache; // Return stale cache on error
        }
    }
    /**
     * Update application settings
     */
    async updateSettings(data, req) {
        try {
            const current = await this.getSettings(true);
            const updated = await client_1.default.appSettings.update({
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
                await (0, audit_log_1.createAuditLog)({
                    entityType: 'AppSettings',
                    entityId: updated.id,
                    action: 'update',
                    req,
                    oldValues: current,
                    newValues: updated,
                    description: `Updated application branding and contact settings`,
                    userId: req.user?.id,
                    userName: req.user?.username || req.user?.email,
                });
            }
            return updated;
        }
        catch (error) {
            logger_1.default.error('Error updating application settings:', error);
            throw error;
        }
    }
    /**
     * Update a specific config (notifications or integrations)
     */
    async updateConfig(key, value, req) {
        const current = await this.getSettings(true);
        return this.updateSettings({ [key]: value }, req);
    }
    /**
     * Clear settings cache
     */
    clearCache() {
        this.cache = null;
        this.lastFetch = 0;
        logger_1.default.info('Settings cache cleared manually.');
    }
    /**
     * Generate Full System Report
     */
    async generateFullSystemReport(req) {
        try {
            const [propertyCount, tenantCount, unitCount, userCount] = await Promise.all([
                client_1.default.property.count(),
                client_1.default.tenant.count(),
                client_1.default.unit.count(),
                client_1.default.user.count()
            ]);
            const reportData = {
                timestamp: new Date().toISOString(),
                stats: {
                    properties: propertyCount,
                    tenants: tenantCount,
                    units: unitCount,
                    users: userCount
                },
                generatedBy: req?.user?.username || req?.user?.email || 'System'
            };
            if (req) {
                await (0, audit_log_1.createAuditLog)({
                    entityType: 'System',
                    entityId: 'Report',
                    action: 'create',
                    req,
                    newValues: reportData,
                    description: `Generated full system statistics report`,
                    userId: req.user?.id,
                    userName: req.user?.username || req.user?.email,
                });
            }
            return reportData;
        }
        catch (error) {
            logger_1.default.error('Failed to generate system report:', error);
            throw error;
        }
    }
}
exports.settingsService = new SettingsService();
exports.default = exports.settingsService;
//# sourceMappingURL=settings.service.js.map