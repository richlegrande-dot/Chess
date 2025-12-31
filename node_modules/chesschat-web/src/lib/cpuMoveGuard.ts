/**
 * CPU Move Guard
 * Ensures CPU moves execute safely with timeout protection and single-flight guarantees
 */

import { cpuLogger } from './logger';

interface CPUMoveRequest {
  id: string;
  startTime: number;
  timeout: number;
  abortController: AbortController;
}

class CPUMoveGuard {
  private currentRequest: CPUMoveRequest | null = null;
  private readonly DEFAULT_TIMEOUT = 3000; // 3 seconds max
  private readonly EXTENDED_TIMEOUT = 5000; // 5 seconds for complex positions

  /**
   * Execute CPU move with timeout and single-flight protection
   */
  async executeCPUMove<T>(
    moveFunction: (signal: AbortSignal) => Promise<T>,
    options: {
      timeout?: number;
      positionComplexity?: 'simple' | 'complex';
    } = {}
  ): Promise<{ success: true; result: T } | { success: false; error: string }> {
    // Cancel any existing request
    if (this.currentRequest) {
      cpuLogger.warn('CPU move already in progress - cancelling previous request');
      this.currentRequest.abortController.abort();
      this.currentRequest = null;
    }

    const timeout = options.timeout || 
      (options.positionComplexity === 'complex' ? this.EXTENDED_TIMEOUT : this.DEFAULT_TIMEOUT);
    
    const abortController = new AbortController();
    const requestId = `cpu_${Date.now()}`;

    this.currentRequest = {
      id: requestId,
      startTime: Date.now(),
      timeout,
      abortController,
    };

    cpuLogger.debug(`Starting CPU move ${requestId} with ${timeout}ms timeout`);

    try {
      // Race between the move function and timeout
      const result = await Promise.race([
        moveFunction(abortController.signal),
        this.createTimeoutPromise(timeout, requestId),
      ]);

      const elapsedMs = Date.now() - this.currentRequest.startTime;
      cpuLogger.debug(`CPU move ${requestId} completed in ${elapsedMs}ms`);

      this.currentRequest = null;
      return { success: true, result: result as T };
    } catch (error) {
      const elapsedMs = Date.now() - (this.currentRequest?.startTime || Date.now());
      this.currentRequest = null;

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          cpuLogger.warn(`CPU move ${requestId} was aborted after ${elapsedMs}ms`);
          return { success: false, error: 'CPU move was cancelled' };
        }
        
        if (error.message.includes('timeout')) {
          cpuLogger.error(`CPU move ${requestId} timed out after ${elapsedMs}ms`);
          return { success: false, error: 'CPU move timed out' };
        }

        cpuLogger.error(`CPU move ${requestId} failed: ${error.message}`, error);
        return { success: false, error: error.message };
      }

      cpuLogger.error(`CPU move ${requestId} failed with unknown error`, error);
      return { success: false, error: 'Unknown CPU error' };
    }
  }

  /**
   * Create a promise that rejects after timeout
   */
  private createTimeoutPromise(timeoutMs: number, requestId: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        if (this.currentRequest?.id === requestId) {
          this.currentRequest.abortController.abort();
          reject(new Error(`CPU move timeout after ${timeoutMs}ms`));
        }
      }, timeoutMs);
    });
  }

  /**
   * Check if CPU is currently processing
   */
  isProcessing(): boolean {
    return this.currentRequest !== null;
  }

  /**
   * Cancel current CPU move
   */
  cancel(): void {
    if (this.currentRequest) {
      cpuLogger.info(`Cancelling CPU move ${this.currentRequest.id}`);
      this.currentRequest.abortController.abort();
      this.currentRequest = null;
    }
  }

  /**
   * Get current request info (for diagnostics)
   */
  getCurrentRequestInfo(): { id: string; elapsedMs: number; timeout: number } | null {
    if (!this.currentRequest) return null;
    
    return {
      id: this.currentRequest.id,
      elapsedMs: Date.now() - this.currentRequest.startTime,
      timeout: this.currentRequest.timeout,
    };
  }
}

// Export singleton instance
export const cpuMoveGuard = new CPUMoveGuard();
