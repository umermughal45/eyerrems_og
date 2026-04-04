import { Request } from 'express';
declare class CurrencyService {
    /**
     * Get all active currencies
     */
    getAllActive(): Promise<{
        symbol: string;
        code: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        isActive: boolean;
        exchangeRate: number;
        isBase: boolean;
    }[]>;
    /**
     * Get all currencies (including inactive)
     */
    getAll(): Promise<{
        symbol: string;
        code: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        isActive: boolean;
        exchangeRate: number;
        isBase: boolean;
    }[]>;
    /**
     * Update exchange rate for a currency
     */
    updateRate(code: string, exchangeRate: number, req?: Request): Promise<{
        symbol: string;
        code: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        isActive: boolean;
        exchangeRate: number;
        isBase: boolean;
    }>;
    /**
     * Create or update a currency
     */
    upsertCurrency(data: {
        code: string;
        symbol: string;
        exchangeRate?: number;
        isBase?: boolean;
        isActive?: boolean;
    }, req?: Request): Promise<{
        symbol: string;
        code: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        isActive: boolean;
        exchangeRate: number;
        isBase: boolean;
    }>;
    /**
     * Delete a currency (marks as inactive if it's the base or has history, but here we just deactivate)
     */
    deactivateCurrency(code: string, req?: Request): Promise<{
        symbol: string;
        code: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        isActive: boolean;
        exchangeRate: number;
        isBase: boolean;
    }>;
}
export declare const currencyService: CurrencyService;
export default currencyService;
//# sourceMappingURL=currency.service.d.ts.map