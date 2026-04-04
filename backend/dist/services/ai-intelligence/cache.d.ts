/**
 * AI Intelligence Cache Service
 *
 * Caching rules:
 * - AI recalculation must be event-driven
 * - Never on page load
 * - Cache with TTL based on insight type
 */
declare class AICache {
    private cache;
    /**
     * Get cache TTL in milliseconds based on insight type
     */
    private getTTL;
    /**
     * Get cached value
     */
    get<T>(key: string): T | null;
    /**
     * Set cache value
     */
    set<T>(key: string, data: T, type: 'actual' | 'derived' | 'predicted'): void;
    /**
     * Invalidate cache for a specific key
     */
    invalidate(key: string): void;
    /**
     * Invalidate all cache entries matching a pattern
     */
    invalidatePattern(pattern: string): void;
    /**
     * Clear all cache
     */
    clear(): void;
    /**
     * Get cache statistics
     */
    getStats(): {
        size: number;
        entries: Array<{
            key: string;
            expiresAt: Date;
            computedAt: Date;
        }>;
    };
}
export declare const aiCache: AICache;
export {};
//# sourceMappingURL=cache.d.ts.map