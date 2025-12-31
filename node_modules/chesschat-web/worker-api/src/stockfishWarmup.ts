/**
 * Stockfish Warmup Utilities
 * 
 * Provides lightweight probes to detect Render cold starts
 * before attempting expensive analysis operations.
 */

export interface StockfishEnv {
  STOCKFISH_SERVER_URL: string;
  STOCKFISH_API_KEY: string;
}

export interface WarmupResult {
  warm: boolean;
  latencyMs: number;
  error?: string;
  timestamp: string;
}

/**
 * Lightweight probe to check if Stockfish server is warm and responsive.
 * Uses a short timeout (1200ms) to quickly detect cold starts.
 * 
 * @param env - Environment variables with Stockfish connection details
 * @param timeoutMs - Maximum wait time (default: 1200ms for fast fail)
 * @returns WarmupResult indicating warm status and latency
 */
export async function probeStockfishWarmth(
  env: StockfishEnv,
  timeoutMs: number = 1200
): Promise<WarmupResult> {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    try {
      const response = await fetch(`${env.STOCKFISH_SERVER_URL}/health`, {
        method: 'GET',
        headers: { 
          'Accept': 'application/json',
          'X-Warmup-Probe': 'true'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        return {
          warm: false,
          latencyMs,
          error: `Health check failed: HTTP ${response.status}`,
          timestamp
        };
      }
      
      const health = await response.json() as any;
      if (health.status !== 'healthy') {
        return {
          warm: false,
          latencyMs,
          error: `Server status: ${health.status}`,
          timestamp
        };
      }

      // Consider warm if responds quickly (< 1000ms is definitely warm)
      return {
        warm: latencyMs < 1000,
        latencyMs,
        timestamp
      };
      
    } finally {
      clearTimeout(timeoutId);
    }
    
  } catch (error: any) {
    const latencyMs = Date.now() - startTime;
    
    // Timeout or network error = cold/unavailable
    return {
      warm: false,
      latencyMs,
      error: error.name === 'AbortError' ? 'Timeout (likely cold start)' : error.message,
      timestamp
    };
  }
}

/**
 * Result of warmup-guarded analysis operation
 */
export interface WarmupGuardResult {
  shouldProceed: boolean;
  analysisMode: 'full' | 'degraded';
  reason?: string;
  warmupResult: WarmupResult;
}

/**
 * Guard function to decide if full analysis should proceed.
 * Returns degraded mode recommendation if Stockfish appears cold.
 */
export async function shouldProceedWithAnalysis(
  env: StockfishEnv
): Promise<WarmupGuardResult> {
  const warmupResult = await probeStockfishWarmth(env);
  
  if (warmupResult.warm) {
    return {
      shouldProceed: true,
      analysisMode: 'full',
      warmupResult
    };
  }
  
  return {
    shouldProceed: false,
    analysisMode: 'degraded',
    reason: warmupResult.error || 'Stockfish cold start detected',
    warmupResult
  };
}
