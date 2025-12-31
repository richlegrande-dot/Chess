/**
 * Rate-Limited Logger
 * 
 * Prevents console spam by rate-limiting duplicate log messages.
 * Tracks message frequency and suppresses repeats within a time window.
 */

interface LogEntry {
  lastLogged: number;
  count: number;
}

const logCache = new Map<string, LogEntry>();
const DEFAULT_RATE_LIMIT_MS = 30000; // 30 seconds

/**
 * Generate a key for the log message
 */
function getLogKey(level: string, message: string): string {
  // Include level and first 100 chars of message
  return `${level}:${message.substring(0, 100)}`;
}

/**
 * Check if a log should be suppressed
 */
function shouldLog(key: string, rateLimitMs: number): boolean {
  const now = Date.now();
  const entry = logCache.get(key);
  
  if (!entry) {
    logCache.set(key, { lastLogged: now, count: 1 });
    return true;
  }
  
  const timeSinceLastLog = now - entry.lastLogged;
  
  if (timeSinceLastLog < rateLimitMs) {
    entry.count++;
    return false;
  }
  
  // Log again and include suppression count
  const suppressedCount = entry.count - 1;
  if (suppressedCount > 0) {
    console.info(`[RateLimitedLogger] Previous message repeated ${suppressedCount} times`);
  }
  
  entry.lastLogged = now;
  entry.count = 1;
  return true;
}

/**
 * Rate-limited console.log
 */
export function log(message: string, ...args: unknown[]): void {
  const key = getLogKey('log', message);
  if (shouldLog(key, DEFAULT_RATE_LIMIT_MS)) {
    console.log(message, ...args);
  }
}

/**
 * Rate-limited console.info
 */
export function info(message: string, ...args: unknown[]): void {
  const key = getLogKey('info', message);
  if (shouldLog(key, DEFAULT_RATE_LIMIT_MS)) {
    console.info(message, ...args);
  }
}

/**
 * Rate-limited console.warn
 */
export function warn(message: string, ...args: unknown[]): void {
  const key = getLogKey('warn', message);
  if (shouldLog(key, DEFAULT_RATE_LIMIT_MS)) {
    console.warn(message, ...args);
  }
}

/**
 * Rate-limited console.error
 */
export function error(message: string, ...args: unknown[]): void {
  const key = getLogKey('error', message);
  if (shouldLog(key, DEFAULT_RATE_LIMIT_MS)) {
    console.error(message, ...args);
  }
}

/**
 * Always log (bypass rate limiting) - use sparingly
 */
export function always(level: 'log' | 'info' | 'warn' | 'error', message: string, ...args: unknown[]): void {
  console[level](message, ...args);
}

/**
 * Clear the log cache (useful for testing)
 */
export function clearCache(): void {
  logCache.clear();
}

/**
 * Get current cache stats
 */
export function getCacheStats(): { uniqueMessages: number; totalSuppressed: number } {
  let totalSuppressed = 0;
  logCache.forEach(entry => {
    totalSuppressed += entry.count - 1;
  });
  
  return {
    uniqueMessages: logCache.size,
    totalSuppressed
  };
}
