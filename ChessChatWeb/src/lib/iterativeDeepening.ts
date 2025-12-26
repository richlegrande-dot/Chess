/**
 * Iterative Deepening Search
 * Progressively searches deeper until time runs out
 * Always returns best move found so far (anytime algorithm)
 */

import { Square } from 'chess.js';
import { ChessGame } from './chess';
import { findBestMove, evaluateBoard } from './chessAI';

export interface IterativeSearchResult {
  move: { from: Square; to: Square };
  depth: number;           // Depth actually achieved
  evaluation: number;      // Position evaluation
  timeMs: number;          // Time taken
  isComplete: boolean;     // True if reached maxDepth, false if timed out
  nodesSearched: number;   // Number of positions evaluated
}

export interface IterativeSearchConfig {
  minDepth: number;        // Minimum depth to search (default: 1)
  maxDepth: number;        // Maximum depth to search (default: 5)
  timeLimit: number;       // Time budget in milliseconds
  minTimePerDepth: number; // Minimum time to allocate per depth (default: 200ms)
}

/**
 * Find best move using iterative deepening
 * Searches depth 1, then 2, then 3... until time runs out
 * Always returns a move, even if interrupted
 */
export function findBestMoveIterative(
  chess: ChessGame,
  config: IterativeSearchConfig
): IterativeSearchResult {
  const startTime = performance.now();
  let currentBestMove: { from: Square; to: Square } | null = null;
  let currentBestEval = 0;
  let currentDepth = config.minDepth;
  let totalNodes = 0;
  
  console.log(`[Iterative Deepening] Starting search: minDepth=${config.minDepth}, maxDepth=${config.maxDepth}, timeLimit=${config.timeLimit}ms`);
  
  // Always do at least one iteration
  while (currentDepth <= config.maxDepth) {
    const iterationStart = performance.now();
    const remainingTime = config.timeLimit - (iterationStart - startTime);
    
    // Stop if we don't have enough time for another iteration
    // Deeper searches take exponentially more time, so we need a buffer
    if (remainingTime < config.minTimePerDepth) {
      console.log(`[Iterative Deepening] Insufficient time for depth ${currentDepth} (${remainingTime}ms remaining)`);
      break;
    }
    
    // Estimate if we have time for this depth
    // Each depth level roughly takes 5-6x longer than the previous
    if (currentDepth > config.minDepth + 1) {
      const lastIterationTime = iterationStart - startTime;
      const estimatedTime = lastIterationTime * 5; // More optimistic estimate
      
      if (estimatedTime > remainingTime * 1.2) {
        console.log(`[Iterative Deepening] Estimated time for depth ${currentDepth} (${estimatedTime}ms) exceeds remaining time (${remainingTime}ms)`);
        break;
      }
    }
    
    try {
      // Search at this depth with remaining time budget
      console.log(`[Iterative Deepening] Searching depth ${currentDepth} (${Math.round(remainingTime)}ms remaining)`);
      
      const result = findBestMove(chess, currentDepth, remainingTime);
      
      if (result) {
        // Update best move found
        currentBestMove = result;
        currentBestEval = evaluateBoard(chess.clone().makeMove(result.from, result.to) || chess);
        
        const iterationTime = performance.now() - iterationStart;
        console.log(`[Iterative Deepening] Depth ${currentDepth} complete in ${Math.round(iterationTime)}ms, move: ${result.from}→${result.to}`);
        
        // Move to next depth
        currentDepth++;
      } else {
        console.log(`[Iterative Deepening] No move found at depth ${currentDepth}`);
        break;
      }
      
    } catch (error) {
      console.log(`[Iterative Deepening] Search failed at depth ${currentDepth}:`, error);
      break;
    }
    
    // Check if we've used most of our time
    const elapsed = performance.now() - startTime;
    if (elapsed > config.timeLimit * 0.95) {
      console.log(`[Iterative Deepening] Time budget exhausted (${Math.round(elapsed)}ms / ${config.timeLimit}ms)`);
      break;
    }
  }
  
  const totalTime = performance.now() - startTime;
  const finalDepth = currentDepth - 1; // Last completed depth
  const isComplete = finalDepth >= config.maxDepth;
  
  console.log(`[Iterative Deepening] Search complete: depth=${finalDepth}/${config.maxDepth}, time=${Math.round(totalTime)}ms, complete=${isComplete}`);
  
  if (!currentBestMove) {
    throw new Error('Iterative deepening failed to find any move');
  }
  
  return {
    move: currentBestMove,
    depth: finalDepth,
    evaluation: currentBestEval,
    timeMs: totalTime,
    isComplete,
    nodesSearched: totalNodes
  };
}

/**
 * Adaptive iterative deepening that adjusts based on position complexity
 */
export function findBestMoveAdaptive(
  chess: ChessGame,
  baseDepth: number,
  maxDepth: number,
  timeLimit: number,
  isComplexPosition: boolean
): IterativeSearchResult {
  const config: IterativeSearchConfig = {
    minDepth: isComplexPosition ? Math.min(2, baseDepth) : Math.max(1, baseDepth - 1),
    maxDepth: isComplexPosition ? maxDepth : Math.min(maxDepth, baseDepth + 1),
    timeLimit,
    minTimePerDepth: 200
  };
  
  return findBestMoveIterative(chess, config);
}
