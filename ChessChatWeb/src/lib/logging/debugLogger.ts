/**
 * Production-safe debug logger
 * Logs are only output when debug mode is enabled
 */

const isDebugMode = (): boolean => {
  // Check URL parameter
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    if (params.get('debug') === '1') return true;
  }
  
  // Check localStorage flag
  if (typeof localStorage !== 'undefined') {
    if (localStorage.getItem('chess_debug') === 'true') return true;
  }
  
  // Check environment (development mode)
  if (import.meta.env?.DEV) return true;
  
  return false;
};

export const debugLog = {
  log: (...args: unknown[]) => {
    if (isDebugMode()) {
      console.log(...args);
    }
  },
  
  warn: (...args: unknown[]) => {
    if (isDebugMode()) {
      console.warn(...args);
    }
  },
  
  error: (...args: unknown[]) => {
    // Always log errors, even in production
    console.error(...args);
  },
  
  info: (...args: unknown[]) => {
    if (isDebugMode()) {
      console.info(...args);
    }
  },
  
  debug: (...args: unknown[]) => {
    if (isDebugMode()) {
      console.debug(...args);
    }
  },
  
  // Check if debug mode is active
  isEnabled: isDebugMode
};
