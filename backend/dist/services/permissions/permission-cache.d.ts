/**
 * Permission Cache Service
 *
 * Implements in-memory caching for permission checks to improve performance.
 * Cache TTL: 5 minutes (configurable)
 */
interface CacheEntry {
    allowed: boolean;
    timestamp: number;
    reason?: string;
}
declare class PermissionCache {
    private cache;
    private readonly TTL;
    private readonly MAX_SIZE;
    /**
     * Generate cache key from roleId and permission
     */
    private getCacheKey;
    /**
     * Check if cache entry is still valid
     */
    private isValid;
    /**
     * Get cached permission result
     */
    get(roleId: string, permission: string): CacheEntry | null;
    /**
     * Set cached permission result
     */
    set(roleId: string, permission: string, allowed: boolean, reason?: string): void;
    /**
     * Invalidate cache for a specific role (when permissions change)
     */
    invalidateRole(roleId: string): void;
    /**
     * Clear all cache entries
     */
    clear(): void;
    /**
     * Evict oldest entries when cache is full
     */
    private evictOldest;
    /**
     * Get cache statistics
     */
    getStats(): {
        size: number;
        maxSize: number;
        hitRate?: number;
    };
}
export declare const permissionCache: PermissionCache;
export {};
//# sourceMappingURL=permission-cache.d.ts.map