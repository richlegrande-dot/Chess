/**
 * Decision Context Analyzer
 * 
 * Analyzes the context of each decision to understand WHY mistakes happen.
 * Tracks position type, material balance, king safety, time pressure, etc.
 */

import { ChessGame } from '../ChessGame';
import { DecisionContext } from './types';

// ============================================================================
// POSITION TYPE CLASSIFICATION
// ============================================================================

function classifyPositionStructure(position: ChessGame): DecisionContext['positionType'] {
  try {
    const fen = position.fen();
    const board = position.board();
    
    // Count pawns in center
    let centerPawns = 0;
    const centerSquares = ['d4', 'd5', 'e4', 'e5'];
    
    centerSquares.forEach(square => {
      const piece = position.get(square as any);
      if (piece && piece.type === 'p') {
        centerPawns++;
      }
    });
    
    // Count total pieces (excluding kings and pawns)
    let totalPieces = 0;
    board.flat().forEach(square => {
      if (square && square.type !== 'k' && square.type !== 'p') {
        totalPieces++;
      }
    });
    
    // Classification logic
    if (centerPawns === 0 && totalPieces >= 8) {
      return 'open';  // No central pawns, many pieces
    }
    
    if (centerPawns >= 3) {
      return 'closed';  // Locked center
    }
    
    // Check for tactical features
    const moves = position.moves({ verbose: true });
    const captures = moves.filter((m: any) => m.captured).length;
    const checks = moves.filter((m: any) => position.inCheck()).length;
    
    if (captures >= 3 || checks > 0) {
      return 'tactical';
    }
    
    return 'semi-open';  // Default
  } catch {
    return 'semi-open';
  }
}

// ============================================================================
// MATERIAL BALANCE
// ============================================================================

function evaluateMaterialBalance(position: ChessGame): number {
  try {
    const board = position.board();
    const pieceValues: Record<string, number> = {
      'p': 100,
      'n': 320,
      'b': 330,
      'r': 500,
      'q': 900,
      'k': 0
    };
    
    let balance = 0;
    const turn = position.turn();
    
    board.flat().forEach(square => {
      if (square) {
        const value = pieceValues[square.type] || 0;
        if (square.color === turn) {
          balance += value;
        } else {
          balance -= value;
        }
      }
    });
    
    return balance;  // Positive = advantage, negative = disadvantage
  } catch {
    return 0;
  }
}

// ============================================================================
// KING SAFETY ASSESSMENT
// ============================================================================

function assessKingSafety(position: ChessGame): DecisionContext['kingSafety'] {
  try {
    const turn = position.turn();
    const board = position.board();
    
    // Find king position
    let kingSquare: { rank: number, file: number } | null = null;
    
    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const piece = board[rank][file];
        if (piece && piece.type === 'k' && piece.color === turn) {
          kingSquare = { rank, file };
          break;
        }
      }
      if (kingSquare) break;
    }
    
    if (!kingSquare) return 'safe';
    
    // Check for immediate danger
    if (position.inCheck()) {
      return 'critical';
    }
    
    // Check if castled
    const hasCastled = position.hasCastled ? position.hasCastled() : false;
    
    // Check pawn shield
    const pawnShield = countPawnShield(board, kingSquare, turn);
    
    // Count attackers near king
    const nearbyAttackers = countNearbyAttackers(position, kingSquare, turn);
    
    // Evaluation
    if (nearbyAttackers >= 2 || pawnShield === 0) {
      return 'exposed';
    }
    
    if (!hasCastled && kingSquare.file >= 3 && kingSquare.file <= 5) {
      return 'exposed';  // King in center
    }
    
    return 'safe';
  } catch {
    return 'safe';
  }
}

function countPawnShield(
  board: any[][],
  kingSquare: { rank: number, file: number },
  color: 'w' | 'b'
): number {
  let shield = 0;
  const direction = color === 'w' ? -1 : 1;
  const shieldRank = kingSquare.rank + direction;
  
  if (shieldRank < 0 || shieldRank >= 8) return 0;
  
  for (let fileOffset = -1; fileOffset <= 1; fileOffset++) {
    const file = kingSquare.file + fileOffset;
    if (file >= 0 && file < 8) {
      const piece = board[shieldRank][file];
      if (piece && piece.type === 'p' && piece.color === color) {
        shield++;
      }
    }
  }
  
  return shield;
}

function countNearbyAttackers(
  position: ChessGame,
  kingSquare: { rank: number, file: number },
  color: 'w' | 'b'
): number {
  try {
    const board = position.board();
    let attackers = 0;
    
    // Check 2-square radius around king
    for (let rankOffset = -2; rankOffset <= 2; rankOffset++) {
      for (let fileOffset = -2; fileOffset <= 2; fileOffset++) {
        const rank = kingSquare.rank + rankOffset;
        const file = kingSquare.file + fileOffset;
        
        if (rank >= 0 && rank < 8 && file >= 0 && file < 8) {
          const piece = board[rank][file];
          if (piece && piece.color !== color && piece.type !== 'p') {
            attackers++;
          }
        }
      }
    }
    
    return attackers;
  } catch {
    return 0;
  }
}

// ============================================================================
// TIME PRESSURE DETECTION
// ============================================================================

function isUnderTimePressure(thinkTime?: number, averageTime?: number): boolean {
  if (!thinkTime || !averageTime) return false;
  
  // Time pressure if move was made in <30% of average time
  // or if move was <2 seconds in complex position
  return thinkTime < averageTime * 0.3 || thinkTime < 2000;
}

// ============================================================================
// GAME PHASE DETERMINATION
// ============================================================================

function determineGamePhase(position: ChessGame): DecisionContext['phaseOfGame'] {
  try {
    const board = position.board();
    const history = position.history();
    const moveCount = history.length;
    
    // Count total pieces (excluding pawns and kings)
    let totalPieces = 0;
    let queens = 0;
    
    board.flat().forEach(square => {
      if (square) {
        if (square.type !== 'k' && square.type !== 'p') {
          totalPieces++;
        }
        if (square.type === 'q') {
          queens++;
        }
      }
    });
    
    // Opening: First 10-15 moves with most pieces
    if (moveCount < 15 && totalPieces >= 12) {
      return 'opening';
    }
    
    // Endgame: Few pieces remaining or no queens
    if (totalPieces <= 6 || (queens === 0 && totalPieces <= 8)) {
      return 'endgame';
    }
    
    // Middlegame: Everything else
    return 'middlegame';
  } catch {
    return 'middlegame';
  }
}

// ============================================================================
// PUBLIC API
// ============================================================================

export function analyzeDecisionContext(
  position: ChessGame,
  thinkTime?: number,
  averageTime?: number
): DecisionContext {
  return {
    positionType: classifyPositionStructure(position),
    materialBalance: evaluateMaterialBalance(position),
    kingSafety: assessKingSafety(position),
    timePressure: isUnderTimePressure(thinkTime, averageTime),
    phaseOfGame: determineGamePhase(position)
  };
}

/**
 * Check if a position context matches a signature's typical context
 */
export function contextMatchesSignature(
  current: DecisionContext,
  typical: DecisionContext[]
): boolean {
  if (typical.length === 0) return false;
  
  // Check if current context is similar to any typical context
  return typical.some(ctx => {
    let matches = 0;
    let total = 0;
    
    if (ctx.positionType === current.positionType) matches++;
    total++;
    
    if (Math.abs(ctx.materialBalance - current.materialBalance) < 200) matches++;
    total++;
    
    if (ctx.kingSafety === current.kingSafety) matches++;
    total++;
    
    if (ctx.phaseOfGame === current.phaseOfGame) matches++;
    total++;
    
    // Match if >= 75% features match
    return (matches / total) >= 0.75;
  });
}
