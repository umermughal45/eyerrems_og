"use strict";
/**
 * AI Intelligence Cache Service
 *
 * Caching rules:
 * - AI recalculation must be event-driven
 * - Never on page load
 * - Cache with TTL based on insight type
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiCache = void 0;
class AICache {
    constructor() {
        this.cache = new Map();
    }
    /**
     * Get cache TTL in milliseconds based on insight type
     */
    getTTL(type) {
        // Actual data: 5 minutes
        if (type === 'actual')
            return 5 * 60 * 1000;
        // Derived metrics: 15 minutes
        if (type === 'derived')
            return 15 * 60 * 1000;
        // Predicted insights: 30 minutes
        return 30 * 60 * 1000;
    }
    /**
     * Get cached value
     */
    get(key) {
        const entry = this.cache.get(key);
        if (!entry)
            return null;
        if (new Date() > entry.expiresAt) {
            this.cache.delete(key);
            return null;
        }
        return entry.data;
    }
    /**
     * Set cache value
     */
    set(key, data, type) {
        const ttl = this.getTTL(type);
        this.cache.set(key, {
            data,
            expiresAt: new Date(Date.now() + ttl),
            computedAt: new Date(),
        });
    }
    /**
     * Invalidate cache for a specific key
     */
    invalidate(key) {
        this.cache.delete(key);
    }
    /**
     * Invalidate all cache entries matching a pattern
     */
    invalidatePattern(pattern) {
        const regex = new RegExp(pattern);
        for (const key of this.cache.keys()) {
            if (regex.test(key)) {
                this.cache.delete(key);
            }
        }
    }
    /**
     * Clear all cache
     */
    clear() {
        this.cache.clear();
    }
    /**
     * Get cache statistics
     */
    getStats() {
        const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
            key,
            expiresAt: entry.expiresAt,
            computedAt: entry.computedAt,
        }));
        return {
            size: this.cache.size,
            entries,
        };
    }
}
exports.aiCache = new AICache();
//# sourceMappingURL=cache.js.map