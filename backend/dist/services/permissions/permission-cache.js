"use strict";
/**
 * Permission Cache Service
 *
 * Implements in-memory caching for permission checks to improve performance.
 * Cache TTL: 5 minutes (configurable)
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.permissionCache = void 0;
const logger_1 = __importDefault(require("../../utils/logger"));
class PermissionCache {
    constructor() {
        this.cache = new Map();
        this.TTL = 5 * 60 * 1000; // 5 minutes in milliseconds
        this.MAX_SIZE = 10000; // Maximum cache entries
    }
    /**
     * Generate cache key from roleId and permission
     */
    getCacheKey(roleId, permission) {
        return `${roleId}:${permission}`;
    }
    /**
     * Check if cache entry is still valid
     */
    isValid(entry) {
        return Date.now() - entry.timestamp < this.TTL;
    }
    /**
     * Get cached permission result
     */
    get(roleId, permission) {
        const key = this.getCacheKey(roleId, permission);
        const entry = this.cache.get(key);
        if (!entry) {
            return null;
        }
        if (!this.isValid(entry)) {
            this.cache.delete(key);
            return null;
        }
        return entry;
    }
    /**
     * Set cached permission result
     */
    set(roleId, permission, allowed, reason) {
        // Prevent cache from growing too large
        if (this.cache.size >= this.MAX_SIZE) {
            this.evictOldest();
        }
        const key = this.getCacheKey(roleId, permission);
        this.cache.set(key, {
            allowed,
            timestamp: Date.now(),
            reason,
        });
    }
    /**
     * Invalidate cache for a specific role (when permissions change)
     */
    invalidateRole(roleId) {
        const keysToDelete = [];
        for (const key of this.cache.keys()) {
            if (key.startsWith(`${roleId}:`)) {
                keysToDelete.push(key);
            }
        }
        keysToDelete.forEach(key => this.cache.delete(key));
        logger_1.default.info(`Invalidated ${keysToDelete.length} cache entries for role ${roleId}`);
    }
    /**
     * Clear all cache entries
     */
    clear() {
        this.cache.clear();
        logger_1.default.info('Permission cache cleared');
    }
    /**
     * Evict oldest entries when cache is full
     */
    evictOldest() {
        const entries = Array.from(this.cache.entries());
        // Sort by timestamp (oldest first)
        entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
        // Remove 20% of oldest entries
        const toRemove = Math.floor(entries.length * 0.2);
        for (let i = 0; i < toRemove; i++) {
            this.cache.delete(entries[i][0]);
        }
        logger_1.default.info(`Evicted ${toRemove} oldest cache entries`);
    }
    /**
     * Get cache statistics
     */
    getStats() {
        return {
            size: this.cache.size,
            maxSize: this.MAX_SIZE,
        };
    }
}
// Singleton instance
exports.permissionCache = new PermissionCache();
//# sourceMappingURL=permission-cache.js.map