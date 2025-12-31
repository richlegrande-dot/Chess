/**
 * CPU Move Telemetry Types
 * 
 * Tracks Worker API attempts, fallback usage, and ensures
 * fallback is NEVER sticky across multiple moves.
 */

/**
 * Worker error classification
 * Only these errors should trigger fallback - all others fail hard
 */
export enum WorkerErrorType {
  WORKER_TIMEOUT = 'WORKER_TIMEOUT',
  WORKER_CPU_LIMIT = 'WORKER_CPU_LIMIT',
  NETWORK_ERROR = 'NETWORK_ERROR',
  INVALID_RESPONSE = 'INVALID_RESPONSE',
}

/**
 * Telemetry data for each CPU move
 * Persisted to WorkerCallLog and surfaced via admin endpoints
 */
export interface CPUMoveTelemetry {
  // Move identification
  timestamp: number;
  moveNumber: number;
  cpuLevel: number;
  requestId: string;

  // Worker attempt tracking
  apiAttempted: boolean;              // Did we try the Worker API?
  apiSucceeded: boolean;              // Did Worker API succeed?
  apiErrorCode?: WorkerErrorType;     // Error classification if failed
  apiErrorMessage?: string;           // Human-readable error

  // Fallback tracking
  fallbackUsedThisMove: boolean;      // Did we use fallback THIS move?
  fallbackStickyState: false;         // MUST ALWAYS BE FALSE after fix

  // Performance metrics
  timeMs: number;                     // Total time for move
  workerTimeMs?: number;              // Time spent in Worker (if attempted)
  fallbackTimeMs?: number;            // Time spent in fallback (if used)

  // Move result
  moveFrom: string;
  moveTo: string;
  depthReached: number;
  source: 'worker' | 'fallback' | 'local';
}

/**
 * Aggregated stats across multiple moves
 */
export interface CPUMoveStats {
  totalMoves: number;
  workerAttempts: number;
  workerSuccesses: number;
  fallbackUses: number;
  consecutiveFallbacks: number;       // SHOULD NEVER BE > 1

  // Performance
  avgWorkerTimeMs: number;
  avgFallbackTimeMs: number;
  
  // Recent history (last 10 moves)
  recentMoves: CPUMoveTelemetry[];
}

/**
 * Validate that fallback is not sticky
 * Throws error if violation detected
 */
export function validateNoStickyFallback(stats: CPUMoveStats): void {
  // Check if last two moves both used fallback with Worker enabled
  const lastTwo = stats.recentMoves.slice(0, 2);
  
  if (lastTwo.length === 2) {
    const [current, previous] = lastTwo;
    
    // If previous move used fallback AND current move used fallback
    // AND both attempted Worker, this is a sticky fallback bug
    if (
      previous.fallbackUsedThisMove &&
      previous.apiAttempted &&
      current.fallbackUsedThisMove &&
      current.apiAttempted
    ) {
      throw new Error(
        `STICKY FALLBACK DETECTED: Two consecutive moves used fallback despite Worker being attempted. ` +
        `Previous: ${previous.requestId}, Current: ${current.requestId}. ` +
        `This violates the single-move fallback contract.`
      );
    }
  }
  
  // Check consecutive fallback counter
  if (stats.consecutiveFallbacks > 1) {
    throw new Error(
      `STICKY FALLBACK DETECTED: ${stats.consecutiveFallbacks} consecutive fallbacks. ` +
      `Fallback should only be used for ONE move, then Worker must be retried.`
    );
  }
}

/**
 * Classify Worker API error into transient categories
 * Only transient errors should trigger fallback
 */
export function classifyWorkerError(error: Error, statusCode?: number): WorkerErrorType | null {
  const message = error.message.toLowerCase();
  
  // Network/timeout errors (transient - should fallback)
  if (message.includes('timeout') || message.includes('timed out')) {
    return WorkerErrorType.WORKER_TIMEOUT;
  }
  
  if (statusCode === 503 || message.includes('service unavailable')) {
    return WorkerErrorType.WORKER_CPU_LIMIT;
  }
  
  if (statusCode === 502 || statusCode === 504 || message.includes('network')) {
    return WorkerErrorType.NETWORK_ERROR;
  }
  
  if (message.includes('parse') || message.includes('invalid json') || message.includes('not in legal moves')) {
    return WorkerErrorType.INVALID_RESPONSE;
  }
  
  // All other errors should fail hard (null = no fallback)
  return null;
}

/**
 * Log CPU move to Prisma (WorkerCallLog)
 * This will be called by the Worker API or frontend
 */
export interface WorkerCallLogData {
  timestamp: number;
  endpoint: string;
  method: string;
  success: boolean;
  latencyMs: number;
  error?: string;
  request: {
    fen: string;
    difficulty: number;
    gameId: string;
  };
  response: {
    move?: string;
    mode?: string;
    depth?: number;
  };
  telemetry: CPUMoveTelemetry;
}
