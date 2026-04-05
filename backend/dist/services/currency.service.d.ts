import { Request } from 'express';
declare class CurrencyService {
    /**
     * Get all active currencies
     */
    getAllActive(): Promise<any>;
    /**
     * Get all currencies (including inactive)
     */
    getAll(): Promise<any>;
    /**
     * Update exchange rate for a currency
     */
    updateRate(code: string, exchangeRate: number, req?: Request): Promise<any>;
    /**
     * Create or update a currency
     */
    upsertCurrency(data: {
        code: string;
        symbol: string;
        exchangeRate?: number;
        isBase?: boolean;
        isActive?: boolean;
    }, req?: Request): Promise<any>;
    /**
     * Delete a currency (marks as inactive if it's the base or has history, but here we just deactivate)
     */
    deactivateCurrency(code: string, req?: Request): Promise<any>;
}
export declare const currencyService: CurrencyService;
export default currencyService;
//# sourceMappingURL=currency.service.d.ts.map