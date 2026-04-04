import { Request } from 'express';
declare class SettingsService {
    private cache;
    private lastFetch;
    private CACHE_TTL;
    /**
     * Get application settings (Singleton)
     */
    getSettings(forceRefresh?: boolean): Promise<any>;
    /**
     * Update application settings
     */
    updateSettings(data: any, req?: Request): Promise<any>;
    /**
     * Update a specific config (notifications or integrations)
     */
    updateConfig(key: 'notificationConfig' | 'integrationConfig', value: any, req?: Request): Promise<any>;
    /**
     * Clear settings cache
     */
    clearCache(): void;
    /**
     * Generate Full System Report
     */
    generateFullSystemReport(req?: Request): Promise<{
        timestamp: string;
        stats: {
            properties: number;
            tenants: number;
            units: number;
            users: number;
        };
        generatedBy: any;
    }>;
}
export declare const settingsService: SettingsService;
export default settingsService;
//# sourceMappingURL=settings.service.d.ts.map