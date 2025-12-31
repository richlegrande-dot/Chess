/**
 * Coaching Cache
 * 
 * Caches coaching reports by PGN hash to avoid recomputing analysis
 * for the same game. Uses LRU eviction to stay within memory limits.
 */

import * as safeStorage from '../storage/safeStorage';

export interface CachedReport {
  pgnHash: string;
  report: unknown; // CoachingReport type
  insights: unknown; // PlayerInsights type
  computedAt: number;
  computeDuration: number;
}

const STORAGE_PREFIX = 'coaching:report:';
const MAX_CACHED_REPORTS = 30;
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Generate a simple hash from PGN string
 */
export function hashPGN(pgn: string): string {
  let hash = 0;
  for (let i = 0; i < pgn.length; i++) {
    const char = pgn.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Get cached coaching report by PGN
 */
export function getCachedReport(pgn: string): CachedReport | null {
  const pgnHash = hashPGN(pgn);
  const key = `${STORAGE_PREFIX}${pgnHash}`;
  
  return safeStorage.getItem<CachedReport>(key, undefined, null);
}

/**
 * Save coaching report to cache
 */
export function cacheReport(
  pgn: string,
  report: unknown,
  insights: unknown,
  computeDuration: number
): void {
  const pgnHash = hashPGN(pgn);
  const key = `${STORAGE_PREFIX}${pgnHash}`;
  
  const cached: CachedReport = {
    pgnHash,
    report,
    insights,
    computedAt: Date.now(),
    computeDuration
  };
  
  // Check cache size and prune if needed
  const cacheSize = getCacheSize();
  if (cacheSize >= MAX_CACHED_REPORTS) {
    pruneOldestReports(Math.floor(MAX_CACHED_REPORTS * 0.7)); // Keep 70%
  }
  
  safeStorage.setItem(key, cached, {
    version: 1,
    ttl: CACHE_TTL
  });
}

/**
 * Get current cache size (number of reports)
 */
function getCacheSize(): number {
  let count = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(STORAGE_PREFIX)) {
      count++;
    }
  }
  return count;
}

/**
 * Prune oldest cached reports to target size
 */
function pruneOldestReports(targetSize: number): void {
  const reports: Array<{ key: string; timestamp: number }> = [];
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(STORAGE_PREFIX)) continue;
    
    const cached = safeStorage.getItem<CachedReport>(key);
    if (cached) {
      reports.push({ key, timestamp: cached.computedAt });
    }
  }
  
  // Sort by timestamp (oldest first)
  reports.sort((a, b) => a.timestamp - b.timestamp);
  
  // Remove oldest reports beyond target
  const toRemove = reports.length - targetSize;
  if (toRemove > 0) {
    reports.slice(0, toRemove).forEach(({ key }) => {
      localStorage.removeItem(key);
    });
    console.info(`[CoachingCache] Pruned ${toRemove} old reports`);
  }
}

/**
 * Clear all cached reports
 */
export function clearCache(): void {
  const keysToRemove: string[] = [];
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(STORAGE_PREFIX)) {
      keysToRemove.push(key);
    }
  }
  
  keysToRemove.forEach(key => localStorage.removeItem(key));
  console.info(`[CoachingCache] Cleared ${keysToRemove.length} cached reports`);
}

/**
 * Get cache statistics
 */
export function getCacheStats(): {
  totalReports: number;
  totalBytes: number;
  oldestReport: number | null;
  newestReport: number | null;
  averageComputeTime: number;
} {
  const reports: Array<{ timestamp: number; bytes: number; duration: number }> = [];
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(STORAGE_PREFIX)) continue;
    
    const value = localStorage.getItem(key);
    if (!value) continue;
    
    const cached = safeStorage.getItem<CachedReport>(key);
    if (cached) {
      reports.push({
        timestamp: cached.computedAt,
        bytes: new Blob([value]).size,
        duration: cached.computeDuration
      });
    }
  }
  
  if (reports.length === 0) {
    return {
      totalReports: 0,
      totalBytes: 0,
      oldestReport: null,
      newestReport: null,
      averageComputeTime: 0
    };
  }
  
  const timestamps = reports.map(r => r.timestamp);
  const totalBytes = reports.reduce((sum, r) => sum + r.bytes, 0);
  const totalDuration = reports.reduce((sum, r) => sum + r.duration, 0);
  
  return {
    totalReports: reports.length,
    totalBytes,
    oldestReport: Math.min(...timestamps),
    newestReport: Math.max(...timestamps),
    averageComputeTime: totalDuration / reports.length
  };
}
