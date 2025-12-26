/**
 * CPU Worker - Off-Main-Thread Chess Engine
 * 
 * Runs chess move calculation in a Web Worker to prevent UI blocking.
 * Supports time-sliced execution, cancellation, and tactical pre-filtering.
 */

import { ChessGame } from '../lib/chess';
import { 
  analyzeTacticalSituation, 
  getBestTacticalMove, 
  filterTacticallySafeMoves 
} from '../lib/tactics/tacticalMicroEngine';

interface WorkerRequest {
  type: 'compute' | 'cancel';
  requestId: string;
  fen?: string;
  cpuLevel?: number;
  timeLimitMs?: number;
  minDepth?: number;
  maxDepth?: number;
  debug?: boolean;
  openingBook?: boolean;  // Whether to use opening book
  // Advanced features from level config
  useQuiescence?: boolean;
  quiescenceDepth?: number;
  beamWidth?: number;
  useAspiration?: boolean;
  aspirationWindow?: number;
  // Learning context for adaptive teaching
  learningContext?: {
    userSignatures: Array<{
      category: string;
      title: string;
      mistakeType: string;
      confidenceScore: number;
      masteryScore: number;
      occurrences: number;
    }>;
    gamesPlayed: number;
  };
}

interface WorkerResponse {
  type: 'result' | 'error' | 'log';
  requestId: string;
  move?: { from: string; to: string };
  metadata?: {
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
  error?: string;
  log?: string;
}

// Active computation state
let activeRequest: {
  requestId: string;
  canceled: boolean;
  startTime: number;
} | null = null;

/**
 * Cancel token for checking if computation should stop
 */
function isCanceled(): boolean {
  return activeRequest?.canceled || false;
}

/**
 * Time-sliced iterative deepening search
 * Yields control periodically to stay responsive
 */
async function computeMoveSliced(
  chess: ChessGame,
  minDepth: number,
  maxDepth: number,
  timeLimitMs: number,
  debug: boolean,
  useQuiescence: boolean = false,
  quiescenceDepth: number = 0,
  beamWidth: number = 0,
  useAspiration: boolean = false,
  aspirationWindow: number = 50
): Promise<{ metadata: WorkerResponse['metadata'], bestMove: { from: string; to: string } | null }> {
  const startTime = performance.now();
  let currentDepth = minDepth;
  let sliceCount = 0;
  const sliceMs = 16; // Yield every 16ms for responsiveness
  let bestMove: { from: string; to: string } | null = null;
  
  if (debug) {
    postMessage({
      type: 'log',
      requestId: activeRequest?.requestId,
      log: `[Worker] Starting search: minDepth=${minDepth}, maxDepth=${maxDepth}, timeLimit=${timeLimitMs}ms`
    });
  }
  
  // Import and use time-sliced search (simplified version inline for now)
  while (currentDepth <= maxDepth) {
    const iterStart = performance.now();
    const remainingTime = timeLimitMs - (iterStart - startTime);
    
    // Check cancellation
    if (isCanceled()) {
      if (debug) postMessage({ type: 'log', requestId: activeRequest?.requestId, log: '[Worker] Canceled' });
      break;
    }
    
    // Check time budget
    if (remainingTime < 200) {
      if (debug) postMessage({ type: 'log', requestId: activeRequest?.requestId, log: `[Worker] Out of time at depth ${currentDepth}` });
      break;
    }
    
    // Estimate if we have time for this depth
    if (currentDepth > minDepth) {
      const lastIterTime = iterStart - startTime;
      const estimatedTime = lastIterTime * 8;
      if (estimatedTime > remainingTime) {
        if (debug) postMessage({ type: 'log', requestId: activeRequest?.requestId, log: `[Worker] Skipping depth ${currentDepth} (estimated ${estimatedTime}ms > ${remainingTime}ms remaining)` });
        break;
      }
    }
    
    try {
      // Use existing findBestMove but with time-slicing awareness
      const { findBestMove } = await import('../lib/chessAI');
      
      // Yield to event loop before heavy computation
      await new Promise(resolve => setTimeout(resolve, 0));
      sliceCount++;
      
      const result = findBestMove(
        chess, 
        currentDepth, 
        remainingTime,
        useQuiescence,
        quiescenceDepth,
        beamWidth,
        useAspiration,
        aspirationWindow
      );
      
      if (result) {
        // Save the best move found so far
        bestMove = result;
        
        if (debug) {
          const iterTime = performance.now() - iterStart;
          postMessage({
            type: 'log',
            requestId: activeRequest?.requestId,
            log: `[Worker] Depth ${currentDepth} complete in ${iterTime.toFixed(0)}ms, move: ${result.from}→${result.to}`
          });
        }
        
        currentDepth++;
      } else {
        break;
      }
      
      // Yield periodically during search
      if ((performance.now() - iterStart) > sliceMs) {
        await new Promise(resolve => setTimeout(resolve, 0));
        sliceCount++;
      }
      
    } catch (error) {
      if (debug) postMessage({ type: 'log', requestId: activeRequest?.requestId, log: `[Worker] Error at depth ${currentDepth}: ${error}` });
      break;
    }
    
    // Final time check
    const elapsed = performance.now() - startTime;
    if (elapsed > timeLimitMs * 0.95) {
      if (debug) postMessage({ type: 'log', requestId: activeRequest?.requestId, log: `[Worker] Time budget exhausted (${elapsed.toFixed(0)}ms)` });
      break;
    }
  }
  
  const totalTime = performance.now() - startTime;
  const finalDepth = currentDepth - 1;
  
  return {
    metadata: {
      depthReached: finalDepth,
      timeMs: totalTime,
      sliceCount,
      complete: finalDepth >= maxDepth,
      source: 'search'
    },
    bestMove
  };
}

/**
 * Main message handler
 */
self.addEventListener('message', async (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  
  if (request.type === 'cancel') {
    if (activeRequest && activeRequest.requestId === request.requestId) {
      activeRequest.canceled = true;
      if (request.debug) {
        postMessage({
          type: 'log',
          requestId: request.requestId,
          log: '[Worker] Cancellation requested'
        });
      }
    }
    return;
  }
  
  if (request.type === 'compute') {
    // Cancel any previous request
    if (activeRequest) {
      activeRequest.canceled = true;
    }
    
    // Setup new request
    activeRequest = {
      requestId: request.requestId,
      canceled: false,
      startTime: performance.now()
    };
    
    try {
      // Validate inputs
      if (!request.fen || !request.timeLimitMs || !request.minDepth || !request.maxDepth) {
        throw new Error('Missing required parameters');
      }
      
      // Create chess instance
      const chess = new ChessGame(request.fen);
      
      // Log configuration for debugging (only if debug flag is set)
      if (request.debug) {
        console.log('[Worker] Configuration:', {
          level: request.cpuLevel,
          depth: `${request.minDepth}-${request.maxDepth}`,
          timeLimit: request.timeLimitMs + 'ms',
          openingBook: request.openingBook,
          beamWidth: request.beamWidth,
          quiescence: request.useQuiescence ? `depth ${request.quiescenceDepth}` : 'off',
          aspiration: request.useAspiration ? `window ±${request.aspirationWindow}` : 'off'
        });
      }
      
      // Check for immediate legal moves
      const allMoves: { from: string; to: string }[] = [];
      for (let rank = 1; rank <= 8; rank++) {
        for (let file of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
          const square = `${file}${rank}` as any;
          const piece = chess.getPiece(square);
          if (piece && piece.charAt(0) === chess.getTurn()) {
            const moves = chess.getLegalMoves(square);
            moves.forEach(to => allMoves.push({ from: square, to }));
          }
        }
      }
      
      if (allMoves.length === 0) {
        throw new Error('No legal moves available');
      }
      
      // PRIORITY 0: Opening book disabled in worker to avoid initialization issues
      // PRIORITY 0: Opening book disabled in worker to avoid initialization issues
      // Opening book will be checked in main thread instead
      
      // Tactical micro-engine: Quick pre-pass for critical situations
      const startTime = performance.now();
      const tacticalAnalysis = analyzeTacticalSituation(request.fen!);
      const tacticalMove = getBestTacticalMove(request.fen!);
      
      if (request.debug) {
        postMessage({
          type: 'log',
          requestId: request.requestId,
          log: `[Worker] Tactical analysis: mateForUs=${tacticalAnalysis.mateIn1ForUs}, mateAgainstUs=${tacticalAnalysis.mateIn1AgainstUs.length}, hanging=${tacticalAnalysis.hangingPieces.length}`
        });
      }
      
      // Priority 1: If we have mate-in-1, play it immediately
      if (tacticalAnalysis.mateIn1ForUs && tacticalMove.move) {
        postMessage({
          type: 'result',
          requestId: request.requestId,
          move: tacticalMove.move,
          metadata: {
            depthReached: 1,
            timeMs: performance.now() - startTime,
            sliceCount: 0,
            complete: true,
            tacticalSafety: {
              rejectedMoves: 0,
              reasons: [tacticalMove.reason]
            },
            source: 'tactical_safe'
          }
        });
        return;
      }
      
      // Priority 2: Filter out moves that allow mate-in-1
      let rejectedMoves: Array<{ move: { from: string; to: string }; reason: string }> = [];
      
      if (tacticalAnalysis.mateIn1AgainstUs.length > 0) {
        const { safeMoves, rejected } = filterTacticallySafeMoves(request.fen!, allMoves);
        
        if (safeMoves.length > 0) {
          rejectedMoves = rejected;
          
          if (request.debug) {
            postMessage({
              type: 'log',
              requestId: request.requestId,
              log: `[Worker] Filtered out ${rejected.length} unsafe moves (allow mate)`
            });
          }
          
          // If only one safe move, return it immediately
          if (safeMoves.length === 1) {
            postMessage({
              type: 'result',
              requestId: request.requestId,
              move: safeMoves[0],
              metadata: {
                depthReached: 1,
                timeMs: performance.now() - startTime,
                sliceCount: 0,
                complete: true,
                tacticalSafety: {
                  rejectedMoves: rejected.length,
                  reasons: rejected.map(r => r.reason)
                },
                source: 'tactical_safe'
              }
            });
            return;
          }
        }
      }
      
      // Run time-sliced search on candidate moves
      const { metadata, bestMove } = await computeMoveSliced(
        chess,
        request.minDepth!,
        request.maxDepth!,
        request.timeLimitMs!,
        request.debug || false,
        request.useQuiescence || false,
        request.quiescenceDepth || 0,
        request.beamWidth || 0,
        request.useAspiration || false,
        request.aspirationWindow || 50
      );
      
      if (!bestMove) {
        // Fallback to random legal move
        const fallbackMove = allMoves[Math.floor(Math.random() * allMoves.length)];
        postMessage({
          type: 'result',
          requestId: request.requestId,
          move: fallbackMove,
          metadata: {
            ...metadata,
            source: 'fallback'
          }
        });
        return;
      }
      
      // Success - return result with tactical safety metadata
      postMessage({
        type: 'result',
        requestId: request.requestId,
        move: bestMove,
        metadata: {
          ...metadata,
          tacticalSafety: rejectedMoves.length > 0 ? {
            rejectedMoves: rejectedMoves.length,
            reasons: rejectedMoves.map(r => r.reason).slice(0, 3)
          } : undefined
        }
      });
      
    } catch (error) {
      postMessage({
        type: 'error',
        requestId: request.requestId,
        error: error instanceof Error ? error.message : String(error)
      });
    } finally {
      if (activeRequest && activeRequest.requestId === request.requestId) {
        activeRequest = null;
      }
    }
  }
});

// Signal ready
postMessage({ type: 'log', requestId: 'init', log: '[Worker] CPU Worker initialized' });
