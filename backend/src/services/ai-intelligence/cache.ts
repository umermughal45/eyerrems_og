/**
 * AI Intelligence Cache Service
 * 
 * Caching rules:
 * - AI recalculation must be event-driven
 * - Never on page load
 * - Cache with TTL based on insight type
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: Date;
  computedAt: Date;
}

class AICache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  
  /**
   * Get cache TTL in milliseconds based on insight type
   */
  private getTTL(type: 'actual' | 'derived' | 'predicted'): number {
    // Actual data: 5 minutes
    if (type === 'actual') return 5 * 60 * 1000;
    // Derived metrics: 15 minutes
    if (type === 'derived') return 15 * 60 * 1000;
    // Predicted insights: 30 minutes
    return 30 * 60 * 1000;
  }
  
  /**
   * Get cached value
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (new Date() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data as T;
  }
  
  /**
   * Set cache value
   */
  set<T>(key: string, data: T, type: 'actual' | 'derived' | 'predicted'): void {
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
  invalidate(key: string): void {
    this.cache.delete(key);
  }
  
  /**
   * Invalidate all cache entries matching a pattern
   */
  invalidatePattern(pattern: string): void {
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
  clear(): void {
    this.cache.clear();
  }
  
  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    entries: Array<{ key: string; expiresAt: Date; computedAt: Date }>;
  } {
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

export const aiCache = new AICache();
