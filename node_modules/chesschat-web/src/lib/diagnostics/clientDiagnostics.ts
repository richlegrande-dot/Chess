/**
 * Client-Side Diagnostics Panel
 * 
 * Hidden debugging panel accessible via ?debug=1 query parameter.
 * Shows storage footprint, performance metrics, and system health.
 */

import { getStorageFootprint } from '../storage/safeStorage';
import { getCacheStats } from '../coaching/coachingCache';
import { getLearningStats } from '../coaching/masteryModel';
import * as rateLimitedLogger from '../logging/rateLimitedLogger';

export interface DiagnosticsData {
  storage: {
    totalBytes: number;
    totalMB: number;
    namespaces: Record<string, { bytes: number; mb: number }>;
    lastPruned: number;
  };
  coaching: {
    cachedReports: number;
    cacheBytes: number;
    cacheMB: number;
    oldestCacheEntry: number | null;
    averageComputeTime: number;
  };
  learning: {
    totalConcepts: number;
    masteredConcepts: number;
    inProgressConcepts: number;
    needsReviewConcepts: number;
    averageMastery: number;
  };
  performance: {
    lastAnalysisDuration: number | null;
    cacheHitRate: number;
  };
  logging: {
    uniqueMessages: number;
    totalSuppressed: number;
  };
  serverStatus: {
    lastDegradedResponse: string | null;
    lastResponseTime: number | null;
  };
  timestamp: number;
}

let lastAnalysisDuration: number | null = null;
let cacheHits = 0;
let cacheMisses = 0;
let lastDegradedResponse: string | null = null;
let lastServerResponseTime: number | null = null;

/**
 * Record analysis performance metric
 */
export function recordAnalysisDuration(durationMs: number): void {
  lastAnalysisDuration = durationMs;
}

/**
 * Record cache hit
 */
export function recordCacheHit(): void {
  cacheHits++;
}

/**
 * Record cache miss
 */
export function recordCacheMiss(): void {
  cacheMisses++;
}

/**
 * Record degraded server response
 */
export function recordDegradedResponse(message: string, responseTimeMs: number): void {
  lastDegradedResponse = message;
  lastServerResponseTime = responseTimeMs;
}

/**
 * Calculate cache hit rate
 */
function getCacheHitRate(): number {
  const total = cacheHits + cacheMisses;
  return total > 0 ? cacheHits / total : 0;
}

/**
 * Collect all diagnostics data
 */
export function collectDiagnostics(): DiagnosticsData {
  const storageFootprint = getStorageFootprint();
  const cacheStats = getCacheStats();
  const learningStats = getLearningStats();
  const loggerStats = rateLimitedLogger.getCacheStats();
  
  // Convert bytes to MB for readability
  const toMB = (bytes: number) => bytes / (1024 * 1024);
  
  const namespaces: Record<string, { bytes: number; mb: number }> = {};
  for (const [ns, bytes] of Object.entries(storageFootprint.namespaces)) {
    namespaces[ns] = {
      bytes,
      mb: parseFloat(toMB(bytes).toFixed(2))
    };
  }
  
  return {
    storage: {
      totalBytes: storageFootprint.totalBytes,
      totalMB: parseFloat(toMB(storageFootprint.totalBytes).toFixed(2)),
      namespaces,
      lastPruned: storageFootprint.lastPruned
    },
    coaching: {
      cachedReports: cacheStats.totalReports,
      cacheBytes: cacheStats.totalBytes,
      cacheMB: parseFloat(toMB(cacheStats.totalBytes).toFixed(2)),
      oldestCacheEntry: cacheStats.oldestReport,
      averageComputeTime: Math.round(cacheStats.averageComputeTime)
    },
    learning: learningStats,
    performance: {
      lastAnalysisDuration,
      cacheHitRate: parseFloat(getCacheHitRate().toFixed(3))
    },
    logging: loggerStats,
    serverStatus: {
      lastDegradedResponse,
      lastResponseTime: lastServerResponseTime
    },
    timestamp: Date.now()
  };
}

/**
 * Format diagnostics as human-readable text
 */
export function formatDiagnostics(data: DiagnosticsData): string {
  const lines: string[] = [
    '=== ChessChat Client Diagnostics ===',
    `Generated: ${new Date(data.timestamp).toLocaleString()}`,
    '',
    '--- Storage ---',
    `Total: ${data.storage.totalMB} MB (${data.storage.totalBytes.toLocaleString()} bytes)`,
    'Namespaces:'
  ];
  
  for (const [ns, info] of Object.entries(data.storage.namespaces)) {
    lines.push(`  ${ns}: ${info.mb} MB`);
  }
  
  if (data.storage.lastPruned > 0) {
    const pruneDate = new Date(data.storage.lastPruned);
    lines.push(`Last pruned: ${pruneDate.toLocaleString()}`);
  }
  
  lines.push(
    '',
    '--- Coaching Cache ---',
    `Reports cached: ${data.coaching.cachedReports}`,
    `Cache size: ${data.coaching.cacheMB} MB`,
    `Average compute time: ${data.coaching.averageComputeTime}ms`
  );
  
  if (data.coaching.oldestCacheEntry) {
    const oldestDate = new Date(data.coaching.oldestCacheEntry);
    lines.push(`Oldest entry: ${oldestDate.toLocaleString()}`);
  }
  
  lines.push(
    '',
    '--- Learning Progress ---',
    `Total concepts: ${data.learning.totalConcepts}`,
    `Mastered: ${data.learning.masteredConcepts}`,
    `In progress: ${data.learning.inProgressConcepts}`,
    `Needs review: ${data.learning.needsReviewConcepts}`,
    `Average mastery: ${(data.learning.averageMastery * 100).toFixed(1)}%`,
    '',
    '--- Performance ---'
  );
  
  if (data.performance.lastAnalysisDuration !== null) {
    lines.push(`Last analysis: ${data.performance.lastAnalysisDuration}ms`);
  } else {
    lines.push('Last analysis: N/A');
  }
  
  lines.push(
    `Cache hit rate: ${(data.performance.cacheHitRate * 100).toFixed(1)}%`,
    '',
    '--- Logging ---',
    `Unique messages: ${data.logging.uniqueMessages}`,
    `Messages suppressed: ${data.logging.totalSuppressed}`,
    '',
    '--- Server Status ---'
  );
  
  if (data.serverStatus.lastDegradedResponse) {
    lines.push(
      `Last degraded response: ${data.serverStatus.lastDegradedResponse}`,
      `Response time: ${data.serverStatus.lastServerResponseTime}ms`
    );
  } else {
    lines.push('No recent degraded responses');
  }
  
  return lines.join('\n');
}

/**
 * Check if debug mode is enabled
 */
export function isDebugMode(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.get('debug') === '1';
}

/**
 * Reset all diagnostics counters
 */
export function resetDiagnostics(): void {
  lastAnalysisDuration = null;
  cacheHits = 0;
  cacheMisses = 0;
  lastDegradedResponse = null;
  lastServerResponseTime = null;
  rateLimitedLogger.clearCache();
}
