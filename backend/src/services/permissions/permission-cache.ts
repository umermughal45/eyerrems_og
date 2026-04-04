/**
 * Permission Cache Service
 * 
 * Implements in-memory caching for permission checks to improve performance.
 * Cache TTL: 5 minutes (configurable)
 */

import logger from '../../utils/logger';

interface CacheEntry {
  allowed: boolean;
  timestamp: number;
  reason?: string;
}

class PermissionCache {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly TTL = 5 * 60 * 1000; // 5 minutes in milliseconds
  private readonly MAX_SIZE = 10000; // Maximum cache entries

  /**
   * Generate cache key from roleId and permission
   */
  private getCacheKey(roleId: string, permission: string): string {
    return `${roleId}:${permission}`;
  }

  /**
   * Check if cache entry is still valid
   */
  private isValid(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp < this.TTL;
  }

  /**
   * Get cached permission result
   */
  get(roleId: string, permission: string): CacheEntry | null {
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
  set(roleId: string, permission: string, allowed: boolean, reason?: string): void {
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
  invalidateRole(roleId: string): void {
    const keysToDelete: string[] = [];
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${roleId}:`)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => this.cache.delete(key));
    logger.info(`Invalidated ${keysToDelete.length} cache entries for role ${roleId}`);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    logger.info('Permission cache cleared');
  }

  /**
   * Evict oldest entries when cache is full
   */
  private evictOldest(): void {
    const entries = Array.from(this.cache.entries());
    // Sort by timestamp (oldest first)
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    // Remove 20% of oldest entries
    const toRemove = Math.floor(entries.length * 0.2);
    for (let i = 0; i < toRemove; i++) {
      this.cache.delete(entries[i][0]);
    }
    
    logger.info(`Evicted ${toRemove} oldest cache entries`);
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; maxSize: number; hitRate?: number } {
    return {
      size: this.cache.size,
      maxSize: this.MAX_SIZE,
    };
  }
}

// Singleton instance
export const permissionCache = new PermissionCache();
