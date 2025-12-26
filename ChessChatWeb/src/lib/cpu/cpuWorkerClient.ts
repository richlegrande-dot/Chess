/**
 * CPU Worker Client - Main Thread Interface
 * 
 * Manages communication with the CPU Web Worker.
 * Provides a clean Promise-based API for computing moves.
 */

import { CPU_MOVE_GRACE_MS } from './cpuConfig';

export interface ComputeMoveRequest {
  fen: string;
  cpuLevel: number;
  timeLimitMs: number;
  minDepth: number;
  maxDepth: number;
  debug?: boolean;
  openingBook?: boolean;  // Whether to use opening book
  // Advanced features from level config
  useQuiescence?: boolean;
  quiescenceDepth?: number;
  beamWidth?: number;
  useAspiration?: boolean;
  aspirationWindow?: number;
}

export interface ComputeMoveResult {
  move: { from: string; to: string };
  metadata: {
    depthReached: number;
    timeMs: number;
    sliceCount: number;
    complete: boolean;
    tacticalSafety?: {
      rejectedMoves: number;
      reasons: string[];
    };
    source: 'tactical_safe' | 'search' | 'fallback' | 'opening_book';
    evaluation?: number;
  };
}

interface PendingRequest {
  requestId: string;
  resolve: (result: ComputeMoveResult) => void;
  reject: (error: Error) => void;
  timeoutId: NodeJS.Timeout;
}

/**
 * CPU Worker Client
 * Singleton that manages the worker lifecycle and request/response handling
 */
export class CpuWorkerClient {
  private worker: Worker | null = null;
  private pendingRequests = new Map<string, PendingRequest>();
  private requestCounter = 0;
  private initPromise: Promise<void> | null = null;
  
  /**
   * Initialize the worker
   */
  private async init(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }
    
    this.initPromise = new Promise((resolve, reject) => {
      try {
        // Create worker with module type
        this.worker = new Worker(
          new URL('../../workers/cpuWorker.ts', import.meta.url),
          { type: 'module' }
        );
        
        // Setup message handler
        this.worker.addEventListener('message', this.handleMessage.bind(this));
        
        // Setup error handler
        this.worker.addEventListener('error', (error) => {
          console.error('[CpuWorkerClient] Worker error:', {
            message: error.message,
            filename: error.filename,
            lineno: error.lineno,
            colno: error.colno,
            error: error.error,
            fullError: error
          });
          // Reject all pending requests
          for (const [requestId, pending] of this.pendingRequests.entries()) {
            clearTimeout(pending.timeoutId);
            pending.reject(new Error(`Worker error: ${error.message} at ${error.filename}:${error.lineno}`));
            this.pendingRequests.delete(requestId);
          }
        });
        
        // Worker is ready
        resolve();
      } catch (error) {
        reject(error);
      }
    });
    
    return this.initPromise;
  }
  
  /**
   * Handle messages from worker
   */
  private handleMessage(event: MessageEvent): void {
    const response = event.data;
    
    // Handle log messages
    if (response.type === 'log') {
      if (localStorage.getItem('debug') === 'true') {
        console.log(response.log);
      }
      return;
    }
    
    // Handle result/error messages
    const pending = this.pendingRequests.get(response.requestId);
    if (!pending) {
      return; // Stale response
    }
    
    clearTimeout(pending.timeoutId);
    this.pendingRequests.delete(response.requestId);
    
    if (response.type === 'result') {
      pending.resolve({
        move: response.move!,
        metadata: response.metadata!
      });
    } else if (response.type === 'error') {
      pending.reject(new Error(response.error || 'Worker computation failed'));
    }
  }
  
  /**
   * Compute a move using the worker
   */
  public async computeMove(request: ComputeMoveRequest): Promise<ComputeMoveResult> {
    // Ensure worker is initialized
    await this.init();
    
    if (!this.worker) {
      throw new Error('Worker not initialized');
    }
    
    // Generate unique request ID
    const requestId = `req-${++this.requestCounter}-${Date.now()}`;
    
    // Create promise for response
    return new Promise((resolve, reject) => {
      // Setup timeout using global grace period
      const timeoutMs = request.timeLimitMs + CPU_MOVE_GRACE_MS;
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        
        // Cancel the worker request
        this.worker?.postMessage({
          type: 'cancel',
          requestId,
          debug: request.debug
        });
        
        reject(new Error(`Worker timeout after ${timeoutMs}ms`));
      }, timeoutMs);
      
      // Store pending request
      this.pendingRequests.set(requestId, {
        requestId,
        resolve,
        reject,
        timeoutId
      });
      
      // Send request to worker
      this.worker!.postMessage({
        type: 'compute',
        requestId,
        fen: request.fen,
        cpuLevel: request.cpuLevel,
        timeLimitMs: request.timeLimitMs,
        minDepth: request.minDepth,
        maxDepth: request.maxDepth,
        debug: request.debug,
        openingBook: request.openingBook,
        useQuiescence: request.useQuiescence,
        quiescenceDepth: request.quiescenceDepth,
        beamWidth: request.beamWidth,
        useAspiration: request.useAspiration,
        aspirationWindow: request.aspirationWindow
      });
    });
  }
  
  /**
   * Cancel a specific request
   */
  public cancel(requestId: string): void {
    const pending = this.pendingRequests.get(requestId);
    if (pending) {
      clearTimeout(pending.timeoutId);
      this.pendingRequests.delete(requestId);
      
      this.worker?.postMessage({
        type: 'cancel',
        requestId
      });
    }
  }
  
  /**
   * Cancel all pending requests
   */
  public cancelAll(): void {
    for (const requestId of this.pendingRequests.keys()) {
      this.cancel(requestId);
    }
  }
  
  /**
   * Terminate the worker
   */
  public terminate(): void {
    this.cancelAll();
    this.worker?.terminate();
    this.worker = null;
    this.initPromise = null;
  }
}

// Singleton instance
let cpuWorkerClient: CpuWorkerClient | null = null;

/**
 * Get or create the CPU worker client singleton
 */
export function getCpuWorkerClient(): CpuWorkerClient {
  if (!cpuWorkerClient) {
    cpuWorkerClient = new CpuWorkerClient();
  }
  return cpuWorkerClient;
}

/**
 * Terminate the current worker client
 * Useful for cleanup or forcing recreation
 */
export function terminateCpuWorkerClient(): void {
  if (cpuWorkerClient) {
    cpuWorkerClient.terminate();
    cpuWorkerClient = null;
  }
}
