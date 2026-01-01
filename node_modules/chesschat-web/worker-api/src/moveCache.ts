/**
 * Move Cache Module
 * 
 * Simple in-memory cache for chess moves to reduce repeated Stockfish calls.
 * Cache key: `${fen}:${cpuLevel}`
 * TTL: Configurable (default 30 seconds)
 * 
 * Architecture Change #3: Part of making Render Stockfish the sole engine
 * while optimizing for repeated position requests (retries, user refresh, etc)
 */

interface CachedMove {
  move: string;
  evaluation?: number;
  depth?: number;
  timestamp: number;
}

export class MoveCache {
  private cache = new Map<string, CachedMove>();
  private maxSize: number;
  private ttlMs: number;
  
  // Statistics for monitoring
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    expired: 0,
  };

  constructor(maxSize: number = 1000, ttlSeconds: number = 30) {
    this.maxSize = maxSize;
    this.ttlMs = ttlSeconds * 1000;
  }

  /**
   * Generate cache key from FEN and CPU level
   */
  private getCacheKey(fen: string, cpuLevel: number): string {
    // Use first 50 chars of FEN to keep keys short
    // FEN format: position, active color, castling, en passant, halfmove, fullmove
    // We care most about position + active color
    const fenShort = fen.substring(0, 50);
    return `${fenShort}:${cpuLevel}`;
  }

  /**
   * Get cached move if available and not expired
   */
  get(fen: string, cpuLevel: number): string | null {
    const key = this.getCacheKey(fen, cpuLevel);
    const cached = this.cache.get(key);
    
    if (!cached) {
      this.stats.misses++;
      return null;
    }
    
    // Check expiration
    const age = Date.now() - cached.timestamp;
    if (age > this.ttlMs) {
      this.cache.delete(key);
      this.stats.expired++;
      this.stats.misses++;
      return null;
    }
    
    this.stats.hits++;
    return cached.move;
  }

  /**
   * Store move in cache
   */
  set(fen: string, cpuLevel: number, move: string, evaluation?: number, depth?: number): void {
    // Evict oldest entry if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
        this.stats.evictions++;
      }
    }
    
    const key = this.getCacheKey(fen, cpuLevel);
    this.cache.set(key, {
      move,
      evaluation,
      depth,
      timestamp: Date.now(),
    });
  }

  /**
   * Clear all cached entries
   */
  clear(): void {
    this.cache.clear();
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      expired: 0,
    };
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    hits: number;
    misses: number;
    hitRate: number;
    evictions: number;
    expired: number;
  } {
    const total = this.stats.hits + this.stats.misses;
    return {
      size: this.cache.size,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: total > 0 ? (this.stats.hits / total) * 100 : 0,
      evictions: this.stats.evictions,
      expired: this.stats.expired,
    };
  }

  /**
   * Periodic cleanup of expired entries
   * Call this occasionally to prevent memory bloat
   */
  cleanup(): void {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [key, cached] of this.cache.entries()) {
      const age = now - cached.timestamp;
      if (age > this.ttlMs) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      console.log('[MoveCache] Cleaned up expired entries:', cleanedCount);
    }
  }
}

// Global singleton instance
let globalCacheInstance: MoveCache | null = null;

/**
 * Get or create the global move cache instance
 */
export function getMoveCache(maxSize?: number, ttlSeconds?: number): MoveCache {
  if (!globalCacheInstance) {
    globalCacheInstance = new MoveCache(maxSize, ttlSeconds);
    console.log('[MoveCache] Initialized:', {
      maxSize: maxSize || 1000,
      ttlSeconds: ttlSeconds || 30,
    });
  }
  return globalCacheInstance;
}

/**
 * Get cache statistics (for admin/monitoring endpoints)
 */
export function getCacheStats(): ReturnType<MoveCache['getStats']> {
  if (!globalCacheInstance) {
    return {
      size: 0,
      hits: 0,
      misses: 0,
      hitRate: 0,
      evictions: 0,
      expired: 0,
    };
  }
  return globalCacheInstance.getStats();
}
