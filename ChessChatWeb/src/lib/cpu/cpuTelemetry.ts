/**
 * CPU Move Telemetry Logger
 * 
 * Tracks Worker attempts, fallback usage, and ensures single-move fallback policy.
 */

import type { 
  CPUMoveTelemetry, 
  CPUMoveStats, 
  WorkerErrorType 
} from '../../types/cpuTelemetry';
import { validateNoStickyFallback, classifyWorkerError } from '../../types/cpuTelemetry';

class CPUTelemetryLogger {
  private stats: CPUMoveStats = {
    totalMoves: 0,
    workerAttempts: 0,
    workerSuccesses: 0,
    fallbackUses: 0,
    consecutiveFallbacks: 0,
    avgWorkerTimeMs: 0,
    avgFallbackTimeMs: 0,
    recentMoves: [],
  };

  /**
   * Log a CPU move with full telemetry
   * Validates no sticky fallback
   */
  logMove(telemetry: CPUMoveTelemetry): void {
    console.log('[CPU Telemetry] Move logged:', {
      moveNumber: telemetry.moveNumber,
      cpuLevel: telemetry.cpuLevel,
      apiAttempted: telemetry.apiAttempted,
      apiSucceeded: telemetry.apiSucceeded,
      fallbackUsed: telemetry.fallbackUsedThisMove,
      source: telemetry.source,
      timeMs: telemetry.timeMs,
    });

    // Update stats
    this.stats.totalMoves++;
    
    if (telemetry.apiAttempted) {
      this.stats.workerAttempts++;
      
      if (telemetry.apiSucceeded) {
        this.stats.workerSuccesses++;
        this.stats.consecutiveFallbacks = 0; // Reset on success
        
        // Update avg worker time
        const prevTotal = this.stats.avgWorkerTimeMs * (this.stats.workerSuccesses - 1);
        this.stats.avgWorkerTimeMs = (prevTotal + (telemetry.workerTimeMs || 0)) / this.stats.workerSuccesses;
      }
    }
    
    if (telemetry.fallbackUsedThisMove) {
      this.stats.fallbackUses++;
      this.stats.consecutiveFallbacks++;
      
      // Update avg fallback time
      const prevTotal = this.stats.avgFallbackTimeMs * (this.stats.fallbackUses - 1);
      this.stats.avgFallbackTimeMs = (prevTotal + (telemetry.fallbackTimeMs || 0)) / this.stats.fallbackUses;
    } else {
      this.stats.consecutiveFallbacks = 0;
    }
    
    // Add to recent moves (keep last 10)
    this.stats.recentMoves = [telemetry, ...this.stats.recentMoves].slice(0, 10);
    
    // CRITICAL: Validate no sticky fallback
    try {
      validateNoStickyFallback(this.stats);
    } catch (error) {
      console.error('[CPU Telemetry] ❌ STICKY FALLBACK VIOLATION:', error);
      // Log to persistent storage if available
      if (typeof window !== 'undefined' && (window as any).gameStore) {
        const store = (window as any).gameStore;
        store.getState().logFeatureError('cpu-fallback', 
          `Sticky fallback detected: ${error instanceof Error ? error.message : String(error)}`,
          { telemetry, stats: this.stats }
        );
      }
      throw error; // Re-throw to fail fast
    }

    // Log success metrics
    if (this.stats.totalMoves > 0) {
      const successRate = (this.stats.workerSuccesses / this.stats.workerAttempts) * 100;
      const fallbackRate = (this.stats.fallbackUses / this.stats.totalMoves) * 100;
      
      console.log('[CPU Telemetry] Session stats:', {
        totalMoves: this.stats.totalMoves,
        workerSuccessRate: successRate.toFixed(1) + '%',
        fallbackRate: fallbackRate.toFixed(1) + '%',
        consecutiveFallbacks: this.stats.consecutiveFallbacks,
        avgWorkerTime: Math.round(this.stats.avgWorkerTimeMs) + 'ms',
        avgFallbackTime: Math.round(this.stats.avgFallbackTimeMs) + 'ms',
      });
    }
  }

  /**
   * Create telemetry record for Worker API success
   */
  createWorkerSuccess(params: {
    moveNumber: number;
    cpuLevel: number;
    requestId: string;
    moveFrom: string;
    moveTo: string;
    depthReached: number;
    workerTimeMs: number;
    totalTimeMs: number;
  }): CPUMoveTelemetry {
    return {
      timestamp: Date.now(),
      moveNumber: params.moveNumber,
      cpuLevel: params.cpuLevel,
      requestId: params.requestId,
      
      apiAttempted: true,
      apiSucceeded: true,
      apiErrorCode: undefined,
      apiErrorMessage: undefined,
      
      fallbackUsedThisMove: false,
      fallbackStickyState: false,
      
      timeMs: params.totalTimeMs,
      workerTimeMs: params.workerTimeMs,
      fallbackTimeMs: undefined,
      
      moveFrom: params.moveFrom,
      moveTo: params.moveTo,
      depthReached: params.depthReached,
      source: 'worker',
    };
  }

  /**
   * Create telemetry record for Worker API failure + fallback
   */
  createWorkerFailureWithFallback(params: {
    moveNumber: number;
    cpuLevel: number;
    requestId: string;
    moveFrom: string;
    moveTo: string;
    depthReached: number;
    error: Error;
    statusCode?: number;
    workerTimeMs: number;
    fallbackTimeMs: number;
    totalTimeMs: number;
  }): CPUMoveTelemetry {
    const errorType = classifyWorkerError(params.error, params.statusCode);
    
    if (!errorType) {
      throw new Error(
        `Non-transient error should not trigger fallback: ${params.error.message}. ` +
        `Only WORKER_TIMEOUT, WORKER_CPU_LIMIT, NETWORK_ERROR, INVALID_RESPONSE are allowed.`
      );
    }
    
    return {
      timestamp: Date.now(),
      moveNumber: params.moveNumber,
      cpuLevel: params.cpuLevel,
      requestId: params.requestId,
      
      apiAttempted: true,
      apiSucceeded: false,
      apiErrorCode: errorType,
      apiErrorMessage: params.error.message,
      
      fallbackUsedThisMove: true,
      fallbackStickyState: false,
      
      timeMs: params.totalTimeMs,
      workerTimeMs: params.workerTimeMs,
      fallbackTimeMs: params.fallbackTimeMs,
      
      moveFrom: params.moveFrom,
      moveTo: params.moveTo,
      depthReached: params.depthReached,
      source: 'fallback',
    };
  }

  /**
   * Create telemetry record for local computation (no Worker attempt)
   */
  createLocalComputation(params: {
    moveNumber: number;
    cpuLevel: number;
    requestId: string;
    moveFrom: string;
    moveTo: string;
    depthReached: number;
    totalTimeMs: number;
  }): CPUMoveTelemetry {
    return {
      timestamp: Date.now(),
      moveNumber: params.moveNumber,
      cpuLevel: params.cpuLevel,
      requestId: params.requestId,
      
      apiAttempted: false,
      apiSucceeded: false,
      apiErrorCode: undefined,
      apiErrorMessage: undefined,
      
      fallbackUsedThisMove: false,
      fallbackStickyState: false,
      
      timeMs: params.totalTimeMs,
      workerTimeMs: undefined,
      fallbackTimeMs: undefined,
      
      moveFrom: params.moveFrom,
      moveTo: params.moveTo,
      depthReached: params.depthReached,
      source: 'local',
    };
  }

  /**
   * Get current stats
   */
  getStats(): CPUMoveStats {
    return { ...this.stats };
  }

  /**
   * Reset stats (e.g., new game)
   */
  reset(): void {
    this.stats = {
      totalMoves: 0,
      workerAttempts: 0,
      workerSuccesses: 0,
      fallbackUses: 0,
      consecutiveFallbacks: 0,
      avgWorkerTimeMs: 0,
      avgFallbackTimeMs: 0,
      recentMoves: [],
    };
    console.log('[CPU Telemetry] Stats reset');
  }
}

// Singleton instance
export const cpuTelemetry = new CPUTelemetryLogger();
