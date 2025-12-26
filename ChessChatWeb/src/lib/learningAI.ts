/**
 * Learning AI Wrapper
 * Integrates learning database with existing chess AI
 * Provides enhanced move selection using learned knowledge
 */

import { Chess, Square } from 'chess.js';
import { ChessGame } from './chess';
import { findBestMove } from './chessAI';
import { learningDB } from './learningDatabase';
import { getBookMove } from './openingBook';

export interface LearningMoveResult {
  move: { from: Square; to: Square; promotion?: string };
  source: 'learned' | 'opening-book' | 'learned-opening' | 'ai-search';
  confidence?: number; // 0-1, for learned moves
  searchDepth?: number; // for AI search
}

/**
 * Find best move using learning system
 * Falls back to standard AI if no learned move available
 */
export function findBestMoveWithLearning(
  chessGame: ChessGame,
  depth: number,
  cpuLevel: number,
  moveHistory: string[]
): LearningMoveResult {
  // Create a Chess instance for internal use
  const chess = new Chess(chessGame.getFEN());
  const fen = chess.fen();
  const cpuColor = chess.turn() === 'w' ? 'white' : 'black';

  // 1. Check if we have a high-confidence learned move for this exact position
  if (cpuLevel >= 7) {
    const learnedMove = learningDB.getLearnedMove(fen, cpuLevel === 8 ? 0.65 : 0.60);
    if (learnedMove) {
      // Validate the move is legal
      const moves = chess.moves({ verbose: true });
      const isLegal = moves.some(m => m.from === learnedMove.from && m.to === learnedMove.to);
      
      if (isLegal) {
        return {
          move: learnedMove as { from: Square; to: Square; promotion?: string },
          source: 'learned',
          confidence: 0.85,
        };
      }
    }
  }

  // 2. Check learned opening lines (for first 6 moves)
  if (cpuLevel >= 7 && moveHistory.length < 6) {
    const successfulOpening = learningDB.getSuccessfulOpening(cpuColor, cpuLevel === 8 ? 3 : 2);
    if (successfulOpening && successfulOpening.length > moveHistory.length) {
      const nextMove = successfulOpening[moveHistory.length];
      // Try to make this move
      try {
        const move = chess.move(nextMove);
        if (move) {
          chess.undo(); // Undo to return to original state
          return {
            move: { from: move.from, to: move.to, promotion: move.promotion },
            source: 'learned-opening',
            confidence: 0.80,
          };
        }
      } catch (e) {
        // Invalid move, fall through
      }
    }
  }

  // 3. Check static opening book (for first 8 moves)
  if (cpuLevel >= 5 && moveHistory.length < 8) {
    const bookMove = getBookMove(fen);
    if (bookMove) {
      return {
        move: bookMove,
        source: 'opening-book',
      };
    }
  }

  // 4. Fall back to standard AI search with time limit
  // Time limits based on CPU level:
  // Level 7: 8 seconds, Level 8: 15 seconds, others: 5 seconds
  let maxTimeMs = 5000; // Default 5 seconds
  if (cpuLevel === 8) {
    maxTimeMs = 15000; // 15 seconds for level 8
  } else if (cpuLevel === 7) {
    maxTimeMs = 8000; // 8 seconds for level 7
  } else if (cpuLevel >= 5) {
    maxTimeMs = 5000; // 5 seconds for level 5-6
  } else {
    maxTimeMs = 3000; // 3 seconds for level 1-4
  }
  
  // Create ChessGame wrapper for findBestMove
  const chessForAI = new ChessGame(fen);
  const aiMove = findBestMove(chessForAI, depth, maxTimeMs);
  
  if (!aiMove) {
    throw new Error('AI search failed to find a move');
  }
  
  return {
    move: aiMove,
    source: 'ai-search',
    searchDepth: depth,
  };
}

/**
 * Record the outcome of a game for learning
 */
export function recordGameForLearning(
  result: 'win' | 'loss' | 'draw',
  cpuColor: 'white' | 'black',
  cpuLevel: number,
  moveHistory: string[],
  finalFen: string
): void {
  if (cpuLevel < 7) {
    return; // Only learn for levels 7-8
  }

  learningDB.recordGame({
    result,
    cpuColor,
    cpuLevel,
    moveCount: moveHistory.length,
    finalPosition: finalFen,
    openingMoves: moveHistory.slice(0, 8),
  });

  console.log(`[LearningAI] Recorded ${result} for level ${cpuLevel} (${moveHistory.length} moves)`);
}

/**
 * Record a specific position and move outcome for learning
 * Should be called during game for key positions
 */
export function recordPositionForLearning(
  fen: string,
  move: { from: string; to: string; promotion?: string },
  outcome: 'win' | 'loss' | 'draw'
): void {
  learningDB.recordPosition(fen, move, outcome);
}

/**
 * Get learning statistics for display
 */
export function getLearningStats() {
  const stats = learningDB.getStatistics();
  return {
    totalGames: stats.totalGames,
    wins: stats.wins,
    losses: stats.losses,
    draws: stats.draws,
    winRate: stats.totalGames > 0 ? (stats.wins / stats.totalGames * 100).toFixed(1) : '0.0',
    level7WinRate: (learningDB.getWinRateForLevel(7) * 100).toFixed(1),
    level8WinRate: (learningDB.getWinRateForLevel(8) * 100).toFixed(1),
  };
}

/**
 * Clear all learning data
 */
export function clearLearningData(): void {
  learningDB.clearAll();
}

/**
 * Export learning data
 */
export function exportLearningData(): string {
  return learningDB.exportData();
}
