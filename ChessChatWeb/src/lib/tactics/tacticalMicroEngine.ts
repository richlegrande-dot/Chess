/**
 * Tactical Micro-Engine
 * 
 * Lightweight tactical analysis for chess positions.
 * Detects critical threats and hanging pieces without heavy search.
 * 
 * Features:
 * - Immediate mate detection (mate-in-1 for/against us)
 * - Hanging piece detection
 * - Forcing move preference
 * - Tactical safety filters
 */

import { Chess } from 'chess.js';

export interface TacticalAnalysis {
  // Immediate threats
  mateIn1ForUs: string | null;           // Move that delivers mate
  mateIn1AgainstUs: string[];            // Opponent moves that deliver mate
  
  // Hanging pieces
  hangingPieces: Array<{
    square: string;
    piece: string;
    attackers: number;
    defenders: number;
  }>;
  
  // Forcing moves
  forcingMoves: Array<{
    move: string;
    reason: 'check' | 'capture' | 'threat';
  }>;
  
  // Overall safety
  positionSafe: boolean;
  urgentThreats: string[];
}

/**
 * Analyze a position for tactical features
 */
export function analyzeTacticalSituation(fen: string): TacticalAnalysis {
  const chess = new Chess(fen);
  
  return {
    mateIn1ForUs: findMateIn1(chess),
    mateIn1AgainstUs: findOpponentMateIn1(chess),
    hangingPieces: findHangingPieces(chess),
    forcingMoves: findForcingMoves(chess),
    positionSafe: isPositionSafe(chess),
    urgentThreats: identifyUrgentThreats(chess)
  };
}

/**
 * Find if we have a mate-in-1
 */
function findMateIn1(chess: Chess): string | null {
  const moves = chess.moves({ verbose: true });
  
  for (const move of moves) {
    chess.move(move);
    if (chess.isCheckmate()) {
      chess.undo();
      return move.san;
    }
    chess.undo();
  }
  
  return null;
}

/**
 * Find opponent mate-in-1 threats
 */
function findOpponentMateIn1(chess: Chess): string[] {
  const threats: string[] = [];
  const moves = chess.moves({ verbose: true });
  
  // Try each of our moves, then check if opponent has mate
  for (const move of moves) {
    chess.move(move);
    
    const opponentMoves = chess.moves({ verbose: true });
    for (const opponentMove of opponentMoves) {
      chess.move(opponentMove);
      if (chess.isCheckmate()) {
        threats.push(`${move.san} allows ${opponentMove.san}#`);
      }
      chess.undo();
    }
    
    chess.undo();
  }
  
  return threats;
}

/**
 * Find hanging pieces (attacked more than defended)
 */
function findHangingPieces(chess: Chess): Array<{
  square: string;
  piece: string;
  attackers: number;
  defenders: number;
}> {
  const hanging: Array<{
    square: string;
    piece: string;
    attackers: number;
    defenders: number;
  }> = [];
  
  const board = chess.board();
  const currentTurn = chess.turn();
  
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const square = board[row][col];
      if (square && square.color === currentTurn) {
        const squareName = indexToSquare(row, col);
        const attackers = countAttackers(chess, squareName, currentTurn === 'w' ? 'b' : 'w');
        const defenders = countAttackers(chess, squareName, currentTurn);
        
        if (attackers > defenders) {
          hanging.push({
            square: squareName,
            piece: square.type,
            attackers,
            defenders
          });
        }
      }
    }
  }
  
  return hanging;
}

/**
 * Count attackers of a square
 */
function countAttackers(chess: Chess, square: string, color: 'w' | 'b'): number {
  let count = 0;
  
  // Get the board state as FEN
  const fen = chess.fen();
  const fenParts = fen.split(' ');
  
  // Create a new board with switched turn
  fenParts[1] = color;
  const switchedFen = fenParts.join(' ');
  
  try {
    const tempChess = new Chess(switchedFen);
    const moves = tempChess.moves({ verbose: true });
    
    for (const move of moves) {
      if (move.to === square) {
        count++;
      }
    }
  } catch (e) {
    // Invalid FEN, return 0
    return 0;
  }
  
  return count;
}

/**
 * Convert board index to square name
 */
function indexToSquare(row: number, col: number): string {
  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const rank = 8 - row;
  return files[col] + rank;
}

/**
 * Find forcing moves (checks, captures, threats)
 */
function findForcingMoves(chess: Chess): Array<{
  move: string;
  reason: 'check' | 'capture' | 'threat';
}> {
  const forcing: Array<{
    move: string;
    reason: 'check' | 'capture' | 'threat';
  }> = [];
  
  const moves = chess.moves({ verbose: true });
  
  for (const move of moves) {
    chess.move(move);
    
    if (chess.inCheck()) {
      forcing.push({ move: move.san, reason: 'check' });
    } else if (move.captured) {
      forcing.push({ move: move.san, reason: 'capture' });
    } else {
      // Check if move creates a threat (attacked piece)
      const threats = findHangingPieces(chess);
      if (threats.length > 0) {
        forcing.push({ move: move.san, reason: 'threat' });
      }
    }
    
    chess.undo();
  }
  
  return forcing;
}

/**
 * Check if position is tactically safe
 */
function isPositionSafe(chess: Chess): boolean {
  // Not safe if:
  // 1. We're in check
  // 2. Opponent has mate-in-1
  // 3. We have multiple hanging pieces
  
  if (chess.inCheck()) {
    return false;
  }
  
  const opponentMates = findOpponentMateIn1(chess);
  if (opponentMates.length > 0) {
    return false;
  }
  
  const hanging = findHangingPieces(chess);
  if (hanging.length > 1) {
    return false;
  }
  
  // Safe if we have minor hanging pieces (pawns)
  if (hanging.length === 1 && hanging[0].piece === 'p') {
    return true;
  }
  
  return hanging.length === 0;
}

/**
 * Identify urgent threats
 */
function identifyUrgentThreats(chess: Chess): string[] {
  const threats: string[] = [];
  
  if (chess.inCheck()) {
    threats.push('In check');
  }
  
  const opponentMates = findOpponentMateIn1(chess);
  if (opponentMates.length > 0) {
    threats.push(`Mate-in-1 threat: ${opponentMates[0]}`);
  }
  
  const hanging = findHangingPieces(chess);
  for (const piece of hanging) {
    if (piece.piece !== 'p') {
      threats.push(`${piece.piece.toUpperCase()} hanging on ${piece.square}`);
    }
  }
  
  return threats;
}

/**
 * Filter moves based on tactical safety
 * Returns only moves that don't allow immediate mate
 */
export function filterTacticallySafeMoves(fen: string, moves: Array<{ from: string; to: string }>): {
  safeMoves: Array<{ from: string; to: string }>;
  rejected: Array<{
    move: { from: string; to: string };
    reason: string;
  }>;
} {
  const chess = new Chess(fen);
  const safeMoves: Array<{ from: string; to: string }> = [];
  const rejected: Array<{
    move: { from: string; to: string };
    reason: string;
  }> = [];
  
  for (const move of moves) {
    try {
      const result = chess.move(move);
      
      if (!result) {
        rejected.push({
          move,
          reason: 'Illegal move'
        });
        continue;
      }
      
      // Check if opponent has mate-in-1
      const opponentMates = findOpponentMateIn1(chess);
      
      chess.undo();
      
      if (opponentMates.length > 0) {
        rejected.push({
          move,
          reason: `Allows mate: ${opponentMates[0]}`
        });
      } else {
        safeMoves.push(move);
      }
    } catch (e) {
      chess.undo();
      rejected.push({
        move,
        reason: 'Error checking move'
      });
    }
  }
  
  return { safeMoves, rejected };
}

/**
 * Get the best tactical move if one exists
 * Priority: Mate > Avoid mate > Capture hanging piece > Check
 */
export function getBestTacticalMove(fen: string): {
  move: { from: string; to: string } | null;
  reason: string;
} {
  const chess = new Chess(fen);
  
  // 1. Check for mate-in-1
  const mateMove = findMateIn1(chess);
  if (mateMove) {
    const moves = chess.moves({ verbose: true });
    const move = moves.find(m => m.san === mateMove);
    if (move) {
      return {
        move: { from: move.from, to: move.to },
        reason: 'Mate in 1'
      };
    }
  }
  
  // 2. Avoid opponent mate-in-1
  const allMoves = chess.moves({ verbose: true });
  const { safeMoves } = filterTacticallySafeMoves(fen, allMoves);
  
  if (safeMoves.length === 0 && allMoves.length > 0) {
    // All moves allow mate - return any legal move (we're already lost)
    return {
      move: { from: allMoves[0].from, to: allMoves[0].to },
      reason: 'All moves allow mate (position lost)'
    };
  }
  
  // 3. Capture hanging pieces
  for (const move of safeMoves) {
    const result = chess.move(move);
    if (result && result.captured) {
      const hanging = findHangingPieces(chess);
      chess.undo();
      
      // Check if captured piece was hanging
      if (hanging.some(h => h.square === move.to)) {
        return {
          move,
          reason: `Capture hanging ${result.captured}`
        };
      }
    }
    if (result) chess.undo();
  }
  
  // 4. Checks
  for (const move of safeMoves) {
    chess.move(move);
    if (chess.inCheck()) {
      chess.undo();
      return {
        move,
        reason: 'Check'
      };
    }
    chess.undo();
  }
  
  // No immediate tactical move
  return {
    move: null,
    reason: 'No tactical advantage'
  };
}
