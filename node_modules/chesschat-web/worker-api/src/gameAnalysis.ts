/**
 * Game Analysis with Stockfish + Concept Detection
 * 
 * Analyzes games using Stockfish evaluations and tags mistakes with chess concepts.
 */

import { Chess } from 'chess.js';
import { getStockfishEngine } from './stockfish';
import type { MistakeEvent } from './learningCore';
import { classifyGamePhase } from './learningCore';

// ============================================================================
// TYPES
// ============================================================================

export interface PositionAnalysis {
  moveNumber: number;
  side: 'white' | 'black';
  fen: string;
  moveUCI: string;
  moveSAN: string;
  evalBefore: number;
  evalAfter: number;
  bestMove: string;
  delta: number;
}

export interface GameAnalysisResult {
  id: string;
  gameId: string;
  evaluations: PositionAnalysis[];
  mistakes: MistakeEvent[];
  avgCentipawnLoss: number;
  accuracyScore: number;
  conceptsEncountered: { [conceptId: string]: number };
}

// ============================================================================
// STOCKFISH ANALYSIS
// ============================================================================

/**
 * Analyze complete game with Stockfish
 */
export async function analyzeGameWithStockfish(
  pgn: string,
  gameId: string,
  depth: number = 18
): Promise<GameAnalysisResult> {
  const chess = new Chess();
  chess.loadPgn(pgn);
  
  const moves = chess.history({ verbose: true });
  const evaluations: PositionAnalysis[] = [];
  const mistakes: MistakeEvent[] = [];
  
  // Reset to starting position
  chess.reset();
  
  let totalCentipawnLoss = 0;
  let totalMoves = 0;
  
  // Analyze each move
  for (let i = 0; i < moves.length; i++) {
    const move = moves[i];
    const fenBefore = chess.fen();
    
    // Get Stockfish evaluation before move
    const evalBefore = await evaluatePosition(fenBefore, depth);
    
    // Make the move
    chess.move(move);
    const fenAfter = chess.fen();
    
    // Get Stockfish evaluation after move
    const evalAfter = await evaluatePosition(fenAfter, depth);
    
    // Calculate centipawn delta (from moving side's perspective)
    const delta = move.color === 'w' 
      ? evalAfter.score - evalBefore.score
      : evalBefore.score - evalAfter.score;
    
    // Store position analysis
    const posAnalysis: PositionAnalysis = {
      moveNumber: Math.floor(i / 2) + 1,
      side: move.color === 'w' ? 'white' : 'black',
      fen: fenBefore,
      moveUCI: move.from + move.to + (move.promotion || ''),
      moveSAN: move.san,
      evalBefore: evalBefore.score,
      evalAfter: evalAfter.score,
      bestMove: evalBefore.bestMove,
      delta
    };
    
    evaluations.push(posAnalysis);
    
    // Classify mistakes
    if (delta <= -50) {
      const severity = delta <= -300 ? 'blunder' : delta <= -150 ? 'mistake' : 'inaccuracy';
      
      // Determine game phase
      const materialCount = countMaterial(chess);
      const phase = classifyGamePhase(posAnalysis.moveNumber, materialCount);
      
      // Detect concepts
      const concepts = detectMistakeConcepts(chess, move, delta, phase);
      
      const mistakeEvent: MistakeEvent = {
        moveNumber: posAnalysis.moveNumber,
        side: posAnalysis.side,
        moveUCI: posAnalysis.moveUCI,
        moveSAN: posAnalysis.moveSAN,
        fen: fenBefore,
        evalBefore: evalBefore.score,
        evalAfter: evalAfter.score,
        delta,
        severity,
        concepts,
        phase,
        moveType: getMoveType(move)
      };
      
      mistakes.push(mistakeEvent);
      
      // Accumulate centipawn loss (only for moving side's mistakes)
      totalCentipawnLoss += Math.abs(delta);
      totalMoves++;
    }
  }
  
  // Calculate aggregate metrics
  const avgCentipawnLoss = totalMoves > 0 ? totalCentipawnLoss / totalMoves : 0;
  const accuracyScore = calculateAccuracyScore(avgCentipawnLoss);
  
  // Count concepts
  const conceptCounts: { [conceptId: string]: number } = {};
  for (const mistake of mistakes) {
    for (const conceptId of mistake.concepts) {
      conceptCounts[conceptId] = (conceptCounts[conceptId] || 0) + 1;
    }
  }
  
  return {
    id: crypto.randomUUID(),
    gameId,
    evaluations,
    mistakes,
    avgCentipawnLoss,
    accuracyScore,
    conceptsEncountered: conceptCounts
  };
}

/**
 * Evaluate position with Stockfish
 */
async function evaluatePosition(
  fen: string,
  depth: number
): Promise<{ score: number; bestMove: string; mate: number | null }> {
  try {
    const stockfish = getStockfishEngine();
    const result = await stockfish.getBestMove(fen, depth, 1000);
    
    return {
      score: result.mate !== null ? (result.mate > 0 ? 10000 : -10000) : result.evaluation,
      bestMove: result.move,
      mate: result.mate
    };
  } catch (error) {
    console.error('[GameAnalysis] Stockfish evaluation error:', error);
    return { score: 0, bestMove: 'e2e4', mate: null };
  }
}

// ============================================================================
// CONCEPT DETECTION
// ============================================================================

/**
 * Detect which concepts are related to this mistake
 */
function detectMistakeConcepts(
  chess: Chess,
  move: any,
  delta: number,
  phase: 'opening' | 'middlegame' | 'endgame'
): string[] {
  const concepts: string[] = [];
  
  // Undo move to analyze position before
  const moveObj = chess.undo();
  if (!moveObj) return ['tactical_awareness']; // Fallback
  
  // Run detectors
  if (detectHangingPiece(chess, move)) {
    concepts.push('hanging_pieces');
  }
  
  if (detectBackRankMate(chess, move)) {
    concepts.push('back_rank_mate');
  }
  
  if (detectForkOpportunity(chess, move)) {
    concepts.push('tactical_forks');
  }
  
  if (detectKingSafetyIssue(chess, move, phase)) {
    if (phase === 'opening') {
      concepts.push('king_safety_opening');
    } else {
      concepts.push('king_safety_middlegame');
    }
  }
  
  if (detectPinOrSkewer(chess, move)) {
    concepts.push('pins_skewers');
  }
  
  // Re-make the move
  chess.move(move);
  
  // If no specific concept detected, use phase-based generic tags
  if (concepts.length === 0) {
    if (delta <= -300) {
      concepts.push('blunder_checking'); // Should have done final check
    }
    
    if (phase === 'opening') {
      concepts.push('opening_principles');
    } else if (phase === 'endgame') {
      concepts.push('king_activity_endgame');
    } else {
      concepts.push('tactical_awareness');
    }
  }
  
  return concepts;
}

/**
 * Detect if move leaves a piece hanging
 */
function detectHangingPiece(chess: Chess, move: any): boolean {
  try {
    // Make the move
    const result = chess.move(move);
    if (!result) return false;
    
    // Check all our pieces
    const board = chess.board();
    const movingColor = result.color;
    
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (!piece || piece.color !== movingColor) continue;
        
        const square = String.fromCharCode(97 + col) + (8 - row);
        
        // Check if piece is attacked
        if (isSquareAttacked(chess, square, movingColor)) {
          // Check if piece is defended
          if (!isSquareDefended(chess, square, movingColor)) {
            chess.undo();
            return true; // Piece is hanging
          }
        }
      }
    }
    
    chess.undo();
    return false;
  } catch {
    return false;
  }
}

/**
 * Detect back rank mate threat
 */
function detectBackRankMate(chess: Chess, move: any): boolean {
  try {
    chess.move(move);
    
    // Find king position
    const board = chess.board();
    const movingColor = move.color;
    const backRank = movingColor === 'w' ? 7 : 0;
    
    let kingSquare: string | null = null;
    for (let col = 0; col < 8; col++) {
      const piece = board[backRank][col];
      if (piece && piece.type === 'k' && piece.color === movingColor) {
        kingSquare = String.fromCharCode(97 + col) + (movingColor === 'w' ? '1' : '8');
        break;
      }
    }
    
    if (!kingSquare) {
      chess.undo();
      return false;
    }
    
    // Check if king is on back rank
    const rank = kingSquare[1];
    if ((movingColor === 'w' && rank !== '1') || (movingColor === 'b' && rank !== '8')) {
      chess.undo();
      return false;
    }
    
    // Check if escape squares are blocked
    const file = kingSquare.charCodeAt(0) - 97;
    const escapeSquares = [
      String.fromCharCode(96 + file) + (movingColor === 'w' ? '2' : '7'),
      String.fromCharCode(97 + file) + (movingColor === 'w' ? '2' : '7'),
      String.fromCharCode(98 + file) + (movingColor === 'w' ? '2' : '7'),
    ].filter(sq => sq[0] >= 'a' && sq[0] <= 'h');
    
    let blockedCount = 0;
    for (const sq of escapeSquares) {
      const piece = chess.get(sq);
      if (piece && piece.color === movingColor) {
        blockedCount++;
      }
    }
    
    // If 2+ escape squares blocked and there's a rook/queen attack, it's vulnerable
    if (blockedCount >= 2) {
      if (isSquareAttacked(chess, kingSquare, movingColor)) {
        chess.undo();
        return true;
      }
    }
    
    chess.undo();
    return false;
  } catch {
    return false;
  }
}

/**
 * Detect if move allows opponent fork
 */
function detectForkOpportunity(chess: Chess, move: any): boolean {
  try {
    chess.move(move);
    
    const opponentColor = move.color === 'w' ? 'b' : 'w';
    const opponentMoves = chess.moves({ verbose: true });
    
    // Check if any opponent move attacks 2+ valuable pieces
    for (const oppMove of opponentMoves) {
      const toSquare = oppMove.to;
      
      // Count valuable pieces attacked from this square
      let attackedValue = 0;
      const board = chess.board();
      
      for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
          const piece = board[row][col];
          if (!piece || piece.color === opponentColor) continue;
          
          const targetSquare = String.fromCharCode(97 + col) + (8 - row);
          if (targetSquare === toSquare) continue;
          
          // Check if moving to toSquare attacks this piece
          chess.move(oppMove);
          const isAttacked = isSquareAttacked(chess, targetSquare, piece.color);
          chess.undo();
          
          if (isAttacked) {
            attackedValue += getPieceValue(piece.type);
          }
        }
      }
      
      // If fork attacks 6+ points of material (e.g., two minor pieces), it's significant
      if (attackedValue >= 6) {
        chess.undo();
        return true;
      }
    }
    
    chess.undo();
    return false;
  } catch {
    return false;
  }
}

/**
 * Detect king safety issue
 */
function detectKingSafetyIssue(
  chess: Chess,
  move: any,
  phase: 'opening' | 'middlegame' | 'endgame'
): boolean {
  if (phase === 'endgame') return false; // King should be active in endgame
  
  try {
    chess.move(move);
    
    // Find king
    const board = chess.board();
    const movingColor = move.color;
    let kingSquare: string | null = null;
    
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (piece && piece.type === 'k' && piece.color === movingColor) {
          kingSquare = String.fromCharCode(97 + col) + (8 - row);
          break;
        }
      }
    }
    
    if (!kingSquare) {
      chess.undo();
      return false;
    }
    
    // Check if king is attacked by 2+ pieces
    const attackers = countAttackers(chess, kingSquare, movingColor);
    
    // Check pawn shield
    const pawnShield = countPawnShield(chess, kingSquare, movingColor);
    
    // King safety issue if: multiple attackers OR weak pawn shield in opening/middlegame
    const unsafe = (attackers >= 2) || (phase === 'opening' && pawnShield < 2);
    
    chess.undo();
    return unsafe;
  } catch {
    return false;
  }
}

/**
 * Detect pin or skewer
 */
function detectPinOrSkewer(chess: Chess, move: any): boolean {
  try {
    chess.move(move);
    
    // Simplified detection: check if a piece moved away from a line
    // creating a pin/skewer situation (complex - simplified for MVP)
    
    chess.undo();
    return false; // Placeholder for now
  } catch {
    return false;
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function isSquareAttacked(chess: Chess, square: string, color: string): boolean {
  // Get all opponent moves and see if any target this square
  const opponentColor = color === 'w' ? 'b' : 'w';
  
  // Temporarily switch turn to check attacks
  const fen = chess.fen();
  const parts = fen.split(' ');
  parts[1] = opponentColor;
  const tempFen = parts.join(' ');
  
  try {
    const tempChess = new Chess(tempFen);
    const moves = tempChess.moves({ verbose: true });
    return moves.some(m => m.to === square);
  } catch {
    return false;
  }
}

function isSquareDefended(chess: Chess, square: string, color: string): boolean {
  // Check if friendly pieces defend this square
  const moves = chess.moves({ verbose: true });
  return moves.some(m => m.to === square);
}

function countAttackers(chess: Chess, square: string, defendingColor: string): number {
  const opponentColor = defendingColor === 'w' ? 'b' : 'w';
  
  const fen = chess.fen();
  const parts = fen.split(' ');
  parts[1] = opponentColor;
  const tempFen = parts.join(' ');
  
  try {
    const tempChess = new Chess(tempFen);
    const moves = tempChess.moves({ verbose: true });
    return moves.filter(m => m.to === square).length;
  } catch {
    return 0;
  }
}

function countPawnShield(chess: Chess, kingSquare: string, color: string): number {
  const file = kingSquare.charCodeAt(0) - 97;
  const rank = parseInt(kingSquare[1]);
  
  const direction = color === 'w' ? 1 : -1;
  const shieldRank = rank + direction;
  
  let pawnCount = 0;
  for (let f = file - 1; f <= file + 1; f++) {
    if (f < 0 || f > 7) continue;
    
    const sq = String.fromCharCode(97 + f) + shieldRank;
    const piece = chess.get(sq);
    
    if (piece && piece.type === 'p' && piece.color === color) {
      pawnCount++;
    }
  }
  
  return pawnCount;
}

function getPieceValue(pieceType: string): number {
  const values: { [key: string]: number } = {
    'p': 1,
    'n': 3,
    'b': 3,
    'r': 5,
    'q': 9,
    'k': 0
  };
  return values[pieceType] || 0;
}

function countMaterial(chess: Chess): number {
  const board = chess.board();
  let count = 0;
  
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      if (board[row][col]) count++;
    }
  }
  
  return count;
}

function getMoveType(move: any): string {
  if (move.flags.includes('c')) return 'capture';
  if (move.flags.includes('k') || move.flags.includes('q')) return 'castle';
  if (move.flags.includes('e')) return 'en_passant';
  if (move.flags.includes('p')) return 'promotion';
  if (move.san.includes('+')) return 'check';
  return 'quiet';
}

function calculateAccuracyScore(avgCentipawnLoss: number): number {
  // Accuracy formula: 100 - (avgCentipawnLoss / 10)
  // Clamped to [0, 100]
  return Math.max(0, Math.min(100, 100 - avgCentipawnLoss / 10));
}
