/**
 * Position Criticality Analyzer
 * Determines how much time should be spent analyzing a position
 */

import { Chess, Move } from 'chess.js';
import { ChessGame } from './chess';
import { evaluateBoard } from './chessAI';

export interface PositionCriticality {
  isCritical: boolean;
  score: number; // 0-100
  reasons: string[];
  recommendedTimeMultiplier: number; // 0.5-3.0
  recommendedDepthBonus: number; // 0-2
}

/**
 * Analyze how critical/complex a position is
 * Critical positions deserve more thinking time
 */
export function analyzePositionCriticality(chess: ChessGame): PositionCriticality {
  let score = 0;
  const reasons: string[] = [];
  
  // Create a Chess instance for analysis
  const chessInstance = new Chess(chess.getFEN());
  
  // 1. Check status - being in check is always critical
  if (chess.isCheck()) {
    score += 35;
    reasons.push('in-check');
  }
  
  // 2. Count available captures and check for major piece trades
  const allMoves = chessInstance.moves({ verbose: true });
  const captures = allMoves.filter((m: Move) => m.captured);
  
  // Check for queen trades or major piece captures
  const queenTrades = captures.filter((m: Move) => m.captured === 'q' || (m.piece === 'q' && m.captured));
  const majorPieceCaptures = captures.filter((m: Move) => ['q', 'r'].includes(m.captured || ''));
  
  if (queenTrades.length > 0) {
    score += 40;
    reasons.push('queen-trade-available');
  } else if (majorPieceCaptures.length > 0) {
    score += 30;
    reasons.push('major-piece-capture');
  } else if (captures.length >= 3) {
    score += 20;
    reasons.push('multiple-captures-available');
  } else if (captures.length >= 1) {
    score += 10;
    reasons.push('captures-available');
  }
  
  // 3. Tactical complexity - many possible moves suggests complex position
  const legalMoves = allMoves.length;
  if (legalMoves > 35) {
    score += 15;
    reasons.push('high-move-count');
  } else if (legalMoves < 15) {
    score += 10;
    reasons.push('forcing-position');
  }
  
  // 4. Material balance - imbalanced positions are more critical
  const evaluation = evaluateBoard(chess);
  const materialImbalance = Math.abs(evaluation);
  if (materialImbalance > 500) { // More than 5 pawns
    score += 25;
    reasons.push('large-material-imbalance');
  } else if (materialImbalance > 300) { // More than 3 pawns
    score += 15;
    reasons.push('material-imbalance');
  }
  
  // 5. Endgame detection - endgames require precision
  const pieceCount = countPieces(chess);
  if (pieceCount <= 12) {
    score += 20;
    reasons.push('endgame-precision-required');
  } else if (pieceCount <= 16) {
    score += 10;
    reasons.push('late-middlegame');
  }
  
  // 6. Checkmate threats - can we deliver checkmate soon?
  if (hasCheckmateThreats(chess)) {
    score += 30;
    reasons.push('checkmate-threats');
  }
  
  // 7. Hanging pieces - pieces under attack
  const hangingPieces = countHangingPieces(chess);
  if (hangingPieces > 0) {
    score += hangingPieces * 15;
    reasons.push(`${hangingPieces}-pieces-under-attack`);
  }
  
  // Calculate recommendations based on criticality score
  const isCritical = score >= 40;
  const timeMultiplier = calculateTimeMultiplier(score);
  const depthBonus = calculateDepthBonus(score);
  
  return {
    isCritical,
    score: Math.min(100, score),
    reasons,
    recommendedTimeMultiplier: timeMultiplier,
    recommendedDepthBonus: depthBonus
  };
}

/**
 * Count total pieces on board (excluding kings)
 */
function countPieces(chess: ChessGame): number {
  let count = 0;
  const chessInstance = new Chess(chess.getFEN());
  const board = chessInstance.board();
  
  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const piece = board[rank][file];
      if (piece && piece.type !== 'k') {
        count++;
      }
    }
  }
  
  return count;
}

/**
 * Check if there are checkmate threats available
 * (Can we checkmate in 1-2 moves?)
 */
function hasCheckmateThreats(chess: ChessGame): boolean {
  const chessInstance = new Chess(chess.getFEN());
  // Quick check: if we can check the opponent
  const moves = chessInstance.moves({ verbose: true });
  
  for (const move of moves) {
    const chessCopy = new Chess(chess.getFEN());
    chessCopy.move(move);
    
    // If this gives check, it might be a mating attack
    if (chessCopy.inCheck()) {
      // Count opponent's legal responses
      const responses = chessCopy.moves().length;
      if (responses <= 2) {
        // Very few responses to check = potential mating attack
        return true;
      }
    }
    
    // If this is checkmate, definitely critical!
    if (chessCopy.isCheckmate()) {
      return true;
    }
  }
  
  return false;
}

/**
 * Count pieces that are hanging (attacked and not defended)
 * Simplified version - checks if piece can be captured
 */
function countHangingPieces(chess: ChessGame): number {
  let hangingCount = 0;
  const chessInstance = new Chess(chess.getFEN());
  const moves = chessInstance.moves({ verbose: true });
  
  // Look at all capture moves - these target potentially hanging pieces
  const captures = moves.filter((m: Move) => m.captured);
  
  // Group by target square to avoid double-counting
  const targetSquares = new Set(captures.map((m: Move) => m.to));
  
  // Check each target - if it's a piece being captured, it might be hanging
  for (const square of targetSquares) {
    const piece = chessInstance.get(square);
    if (piece && piece.type !== 'p') {
      // Not a pawn - losing a piece is more critical
      hangingCount++;
    }
  }
  
  return Math.min(hangingCount, 3); // Cap at 3 to avoid over-weighting
}

/**
 * Calculate time multiplier based on criticality score
 * Returns 0.5x for simple positions, up to 3.0x for critical
 */
function calculateTimeMultiplier(score: number): number {
  if (score < 20) return 0.5;  // Simple position - think fast
  if (score < 40) return 1.0;  // Normal position - standard time
  if (score < 60) return 1.5;  // Moderately critical
  if (score < 80) return 2.0;  // Very critical
  return 2.5;  // Extremely critical - take your time
}

/**
 * Calculate depth bonus based on criticality score
 * Returns 0-2 extra depth for critical positions
 */
function calculateDepthBonus(score: number): number {
  if (score < 40) return 0;  // Normal depth
  if (score < 60) return 1;  // +1 depth
  return 2;  // +2 depth for very critical positions
}

/**
 * Quick evaluation for obviously simple positions
 * Returns true if position is straightforward
 */
export function isSimplePosition(chess: ChessGame): boolean {
  const criticality = analyzePositionCriticality(chess);
  return criticality.score < 25 && !criticality.isCritical;
}
