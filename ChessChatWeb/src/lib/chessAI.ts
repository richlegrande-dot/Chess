/**
 * Chess AI using Minimax with Alpha-Beta Pruning
 * Based on: https://www.freecodecamp.org/news/simple-chess-ai-step-by-step-1d55a9266977/
 * 
 * Enhanced with Learning Engine for levels 7-8
 */

import { Square } from 'chess.js';
import { ChessGame } from './chess';
import { getLearningEngine } from './learningEngine';

// Piece values for material evaluation (tuned for stronger play)
const PIECE_VALUES: { [key: string]: number } = {
  'p': 100,
  'n': 320,
  'b': 340,  // Bishop slightly more valuable (especially pair)
  'r': 500,
  'q': 950,  // Queen slightly more valuable
  'k': 20000
};

// Piece-Square Tables for positional evaluation
// Higher values mean better positions for that piece type
const PAWN_TABLE = [
  0,  0,  0,  0,  0,  0,  0,  0,
  50, 50, 50, 50, 50, 50, 50, 50,
  10, 10, 20, 30, 30, 20, 10, 10,
  5,  5, 10, 25, 25, 10,  5,  5,
  0,  0,  0, 20, 20,  0,  0,  0,
  5, -5,-10,  0,  0,-10, -5,  5,
  5, 10, 10,-20,-20, 10, 10,  5,
  0,  0,  0,  0,  0,  0,  0,  0
];

const KNIGHT_TABLE = [
  -50,-40,-30,-30,-30,-30,-40,-50,
  -40,-20,  0,  0,  0,  0,-20,-40,
  -30,  0, 10, 15, 15, 10,  0,-30,
  -30,  5, 15, 20, 20, 15,  5,-30,
  -30,  0, 15, 20, 20, 15,  0,-30,
  -30,  5, 10, 15, 15, 10,  5,-30,
  -40,-20,  0,  5,  5,  0,-20,-40,
  -50,-40,-30,-30,-30,-30,-40,-50
];

const BISHOP_TABLE = [
  -20,-10,-10,-10,-10,-10,-10,-20,
  -10,  0,  0,  0,  0,  0,  0,-10,
  -10,  0,  5, 10, 10,  5,  0,-10,
  -10,  5,  5, 10, 10,  5,  5,-10,
  -10,  0, 10, 10, 10, 10,  0,-10,
  -10, 10, 10, 10, 10, 10, 10,-10,
  -10,  5,  0,  0,  0,  0,  5,-10,
  -20,-10,-10,-10,-10,-10,-10,-20
];

const ROOK_TABLE = [
  0,  0,  0,  0,  0,  0,  0,  0,
  5, 10, 10, 10, 10, 10, 10,  5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  0,  0,  0,  5,  5,  0,  0,  0
];

const QUEEN_TABLE = [
  -20,-10,-10, -5, -5,-10,-10,-20,
  -10,  0,  0,  0,  0,  0,  0,-10,
  -10,  0,  5,  5,  5,  5,  0,-10,
  -5,  0,  5,  5,  5,  5,  0, -5,
  0,  0,  5,  5,  5,  5,  0, -5,
  -10,  5,  5,  5,  5,  5,  0,-10,
  -10,  0,  5,  0,  0,  0,  0,-10,
  -20,-10,-10, -5, -5,-10,-10,-20
];

const KING_MIDDLE_GAME_TABLE = [
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -20,-30,-30,-40,-40,-30,-30,-20,
  -10,-20,-20,-20,-20,-20,-20,-10,
  20, 20,  0,  0,  0,  0, 20, 20,
  20, 30, 10,  0,  0, 10, 30, 20
];

const KING_END_GAME_TABLE = [
  -50,-40,-30,-20,-20,-30,-40,-50,
  -30,-20,-10,  0,  0,-10,-20,-30,
  -30,-10, 20, 30, 30, 20,-10,-30,
  -30,-10, 30, 40, 40, 30,-10,-30,
  -30,-10, 30, 40, 40, 30,-10,-30,
  -30,-10, 20, 30, 30, 20,-10,-30,
  -30,-30,  0,  0,  0,  0,-30,-30,
  -50,-30,-30,-30,-30,-30,-30,-50
];

/**
 * Get all pieces of a given color that can attack a square
 * Uses pseudo-legal moves (ignores whose turn it is) to detect hanging pieces
 */
function getAttackers(chess: ChessGame, square: Square, color: 'w' | 'b'): Square[] {
  const attackers: Square[] = [];
  
  // Create a temporary position to check
  const tempChess = chess.clone();
  
  // Check all squares for pieces that can attack the target
  for (let rank = 1; rank <= 8; rank++) {
    for (let file of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
      const from = `${file}${rank}` as Square;
      const piece = tempChess.getPiece(from);
      
      if (piece && piece.charAt(0) === color) {
        // Check if this piece can attack the target square
        const canAttack = canPieceAttackSquare(tempChess, from, square, piece);
        if (canAttack) {
          attackers.push(from);
        }
      }
    }
  }
  
  return attackers;
}

/**
 * Check if a piece can attack a square (ignoring turn, but respecting piece movement rules)
 */
function canPieceAttackSquare(chess: ChessGame, from: Square, to: Square, piece: string): boolean {
  const pieceType = piece.charAt(1).toLowerCase();
  const fromFile = from.charCodeAt(0) - 97; // a=0, b=1, etc
  const fromRank = parseInt(from[1]);
  const toFile = to.charCodeAt(0) - 97;
  const toRank = parseInt(to[1]);
  const fileDiff = Math.abs(toFile - fromFile);
  const rankDiff = Math.abs(toRank - fromRank);
  
  // Check basic piece movement patterns
  switch (pieceType) {
    case 'p': {
      // Pawns attack diagonally one square
      const direction = piece.charAt(0) === 'w' ? 1 : -1;
      return fileDiff === 1 && (toRank - fromRank) === direction;
    }
    case 'n': {
      // Knights move in L shape
      return (fileDiff === 2 && rankDiff === 1) || (fileDiff === 1 && rankDiff === 2);
    }
    case 'b': {
      // Bishops move diagonally
      if (fileDiff !== rankDiff) return false;
      return isPathClear(chess, from, to);
    }
    case 'r': {
      // Rooks move horizontally or vertically
      if (fromFile !== toFile && fromRank !== toRank) return false;
      return isPathClear(chess, from, to);
    }
    case 'q': {
      // Queens move like rooks or bishops
      const isDiagonal = fileDiff === rankDiff;
      const isStraight = fromFile === toFile || fromRank === toRank;
      if (!isDiagonal && !isStraight) return false;
      return isPathClear(chess, from, to);
    }
    case 'k': {
      // Kings move one square in any direction
      return fileDiff <= 1 && rankDiff <= 1;
    }
    default:
      return false;
  }
}

/**
 * Check if path between two squares is clear (no pieces blocking)
 */
function isPathClear(chess: ChessGame, from: Square, to: Square): boolean {
  const fromFile = from.charCodeAt(0) - 97;
  const fromRank = parseInt(from[1]);
  const toFile = to.charCodeAt(0) - 97;
  const toRank = parseInt(to[1]);
  
  const fileStep = toFile === fromFile ? 0 : (toFile > fromFile ? 1 : -1);
  const rankStep = toRank === fromRank ? 0 : (toRank > fromRank ? 1 : -1);
  
  let currentFile = fromFile + fileStep;
  let currentRank = fromRank + rankStep;
  
  // Check each square along the path (excluding start and end)
  while (currentFile !== toFile || currentRank !== toRank) {
    const square = `${String.fromCharCode(97 + currentFile)}${currentRank}` as Square;
    if (chess.getPiece(square)) {
      return false; // Path is blocked
    }
    currentFile += fileStep;
    currentRank += rankStep;
  }
  
  return true;
}

/**
 * Convert chess square notation to array index
 * a8=0, b8=1, ..., h1=63
 */
function squareToIndex(square: string): number {
  const file = square.charCodeAt(0) - 97; // a=0, b=1, etc.
  const rank = 8 - parseInt(square[1]); // 8=0, 7=1, ..., 1=7
  return rank * 8 + file;
}

/**
 * Get piece-square table value for a piece at a square
 */
function getPieceSquareValue(piece: string, square: string, isEndGame: boolean): number {
  const pieceType = piece.charAt(1).toLowerCase();
  const color = piece.charAt(0);
  const index = squareToIndex(square);
  
  // Flip index for black pieces (they view board upside down)
  const tableIndex = color === 'w' ? index : 63 - index;
  
  let value = 0;
  switch (pieceType) {
    case 'p': value = PAWN_TABLE[tableIndex]; break;
    case 'n': value = KNIGHT_TABLE[tableIndex]; break;
    case 'b': value = BISHOP_TABLE[tableIndex]; break;
    case 'r': value = ROOK_TABLE[tableIndex]; break;
    case 'q': value = QUEEN_TABLE[tableIndex]; break;
    case 'k': value = isEndGame ? KING_END_GAME_TABLE[tableIndex] : KING_MIDDLE_GAME_TABLE[tableIndex]; break;
  }
  
  return value;
}

/**
 * Evaluate board position from white's perspective
 * Positive = good for white, Negative = good for black
 */
export function evaluateBoard(chess: ChessGame): number {
  let score = 0;
  
  // Count total material to determine if endgame
  let totalMaterial = 0;
  let whiteKingSquare: Square | null = null;
  let blackKingSquare: Square | null = null;
  
  // Iterate over all squares
  for (let rank = 1; rank <= 8; rank++) {
    for (let file of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
      const square = `${file}${rank}` as Square;
      const piece = chess.getPiece(square);
      
      if (piece) {
        const pieceType = piece.charAt(1).toLowerCase();
        const color = piece.charAt(0);
        const pieceValue = PIECE_VALUES[pieceType] || 0;
        
        totalMaterial += pieceValue;
        
        // Track king positions
        if (pieceType === 'k') {
          if (color === 'w') whiteKingSquare = square;
          else blackKingSquare = square;
        }
        
        // Add piece value
        const materialValue = color === 'w' ? pieceValue : -pieceValue;
        
        // Add positional value
        const isEndGame = totalMaterial < 2500; // Rough endgame threshold
        const positionValue = getPieceSquareValue(piece, square, isEndGame);
        const adjustedPositionValue = color === 'w' ? positionValue : -positionValue;
        
        score += materialValue + adjustedPositionValue;
      }
    }
  }
  
  // KING SAFETY: Penalize exposed kings heavily in middlegame
  if (totalMaterial > 2500) { // Not endgame
    // Check if kings are in dangerous positions (away from back rank)
    if (whiteKingSquare) {
      const whiteKingRank = parseInt(whiteKingSquare[1]);
      if (whiteKingRank > 3) { // King moved forward
        score -= (whiteKingRank - 1) * 200; // Heavier penalty for king exposure
      }
      // Bonus for castled position
      const whiteKingFile = whiteKingSquare[0];
      if ((whiteKingFile === 'g' || whiteKingFile === 'c') && whiteKingRank === 1) {
        score += 50; // Reward castling
      }
    }
    
    if (blackKingSquare) {
      const blackKingRank = parseInt(blackKingSquare[1]);
      if (blackKingRank < 6) { // King moved forward
        score += (8 - blackKingRank) * 200; // Heavier penalty for black king exposure
      }
      // Bonus for castled position
      const blackKingFile = blackKingSquare[0];
      if ((blackKingFile === 'g' || blackKingFile === 'c') && blackKingRank === 8) {
        score -= 50; // Reward castling for black
      }
    }
  }
  
  // CENTER CONTROL: Reward controlling central squares
  const centralSquares = ['d4', 'd5', 'e4', 'e5'] as Square[];
  centralSquares.forEach(sq => {
    const piece = chess.getPiece(sq);
    if (piece) {
      const color = piece.charAt(0);
      const bonus = 25; // Bonus for occupying center
      score += color === 'w' ? bonus : -bonus;
    }
  });
  
  // DEVELOPMENT: Reward developed pieces in opening/middlegame
  if (totalMaterial > 2500) {
    // Check if pieces are off back rank
    ['b', 'c', 'f', 'g'].forEach(file => {
      const whitePiece = chess.getPiece(`${file}1` as Square);
      const blackPiece = chess.getPiece(`${file}8` as Square);
      
      // Penalty for pieces still on back rank after move 10
      if (whitePiece && (whitePiece.includes('n') || whitePiece.includes('b'))) {
        score -= 15; // Undeveloped piece penalty
      }
      if (blackPiece && (blackPiece.includes('n') || blackPiece.includes('b'))) {
        score += 15; // Undeveloped piece penalty for black
      }
    });
    
    // KNIGHTS ON THE RIM: Heavy penalty for knights on edge squares
    const rimKnightSquares: Square[] = ['a3', 'a6', 'h3', 'h6', 'a4', 'a5', 'h4', 'h5'];
    rimKnightSquares.forEach(sq => {
      const piece = chess.getPiece(sq);
      if (piece && piece.charAt(1) === 'n') {
        const penalty = 80; // "Knights on the rim are dim"
        score += piece.charAt(0) === 'w' ? -penalty : penalty;
      }
    });
  }
  
  // Bonus for having check threats
  if (chess.isCheck()) {
    score += chess.getTurn() === 'w' ? -500 : 500; // Being in check is bad
  }
  
  // QUEEN TRADES: Discourage early queen trades (reduces attacking chances)
  // Count material excluding queens
  let materialWithoutQueens = 0;
  let whiteHasQueen = false;
  let blackHasQueen = false;
  
  for (let rank = 1; rank <= 8; rank++) {
    for (let file of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
      const square = `${file}${rank}` as Square;
      const piece = chess.getPiece(square);
      if (piece) {
        const pieceType = piece.charAt(1).toLowerCase();
        if (pieceType === 'q') {
          if (piece.charAt(0) === 'w') whiteHasQueen = true;
          else blackHasQueen = true;
        } else {
          materialWithoutQueens += PIECE_VALUES[pieceType] || 0;
        }
      }
    }
  }
  
  // If in opening/middlegame and one side lost queen, penalize that side
  if (materialWithoutQueens > 2000) { // Still in opening/middlegame
    if (!whiteHasQueen && blackHasQueen) {
      score -= 200; // White lost queen early - bad
    } else if (whiteHasQueen && !blackHasQueen) {
      score += 200; // Black lost queen early - bad for black
    }
  }
  
  // LEARNING: Apply learned evaluation bias from previous games
  try {
    const learningEngine = getLearningEngine();
    const fen = chess.getFEN();
    const learningBias = learningEngine.getPositionBias(fen);
    
    if (learningBias !== 0) {
      // Apply bias from white's perspective (same as score)
      score += learningBias;
      // Subtle log to track learning impact
      if (Math.abs(learningBias) > 10) {
        console.log('[Learning] Applied bias:', learningBias, 'to position');
      }
    }
  } catch (error) {
    // Silently fail if learning engine unavailable
  }
  
  return score;
}

/**
 * Get forcing moves (captures, checks, promotions) for quiescence search
 */
function getForcingMoves(chess: ChessGame): { from: Square; to: Square }[] {
  const forcingMoves: { from: Square; to: Square }[] = [];
  
  for (let rank = 1; rank <= 8; rank++) {
    for (let file of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
      const square = `${file}${rank}` as Square;
      const piece = chess.getPiece(square);
      
      if (piece && piece.charAt(0) === chess.getTurn()) {
        const moves = chess.getLegalMoves(square);
        
        for (const to of moves) {
          const targetPiece = chess.getPiece(to);
          const movingPiece = chess.getPiece(square);
          
          // Include captures
          if (targetPiece) {
            forcingMoves.push({ from: square, to });
            continue;
          }
          
          // Include promotions (pawn reaching back rank)
          if (movingPiece?.charAt(1) === 'p') {
            const toRank = parseInt(to[1]);
            if (toRank === 1 || toRank === 8) {
              forcingMoves.push({ from: square, to });
              continue;
            }
          }
          
          // Include checks
          const chessCopy = chess.clone();
          chessCopy.makeMove(square, to);
          if (chessCopy.isCheck()) {
            forcingMoves.push({ from: square, to });
          }
        }
      }
    }
  }
  
  return forcingMoves;
}

/**
 * Quiescence search - extend search for tactical sequences
 * Prevents horizon effect by searching forcing moves until position is "quiet"
 * 
 * @param chess - Current position
 * @param alpha - Lower bound
 * @param beta - Upper bound
 * @param depth - Current quiescence depth
 * @param maxDepth - Maximum quiescence depth allowed
 * @returns Evaluation score
 */
function quiescence(
  chess: ChessGame,
  alpha: number,
  beta: number,
  depth: number,
  maxDepth: number
): number {
  // Check time budget
  if (Date.now() - searchStartTime > maxSearchTimeMs) {
    searchTimedOut = true;
    return 0;
  }
  
  // Stand pat: current position evaluation
  const standPat = evaluateBoard(chess);
  
  // Beta cutoff - position is too good for opponent, they won't allow it
  if (standPat >= beta) {
    return beta;
  }
  
  // Update alpha
  if (standPat > alpha) {
    alpha = standPat;
  }
  
  // Maximum quiescence depth reached - return stand pat
  if (depth >= maxDepth) {
    return standPat;
  }
  
  // Get only forcing moves (captures, checks, promotions)
  const forcingMoves = getForcingMoves(chess);
  
  // No forcing moves - position is quiet
  if (forcingMoves.length === 0) {
    return standPat;
  }
  
  // Order forcing moves by MVV-LVA (Most Valuable Victim - Least Valuable Attacker)
  const orderedMoves = forcingMoves.map(move => {
    const targetPiece = chess.getPiece(move.to);
    const movingPiece = chess.getPiece(move.from);
    
    let score = 0;
    if (targetPiece) {
      const victimValue = PIECE_VALUES[targetPiece.charAt(1).toLowerCase()] || 0;
      const attackerValue = PIECE_VALUES[movingPiece?.charAt(1).toLowerCase() || 'p'] || 100;
      score = victimValue * 10 - attackerValue / 10;
    }
    
    return { move, score };
  }).sort((a, b) => b.score - a.score);
  
  // Search forcing moves
  for (const { move } of orderedMoves) {
    const chessCopy = chess.clone();
    chessCopy.makeMove(move.from, move.to);
    
    const score = -quiescence(chessCopy, -beta, -alpha, depth + 1, maxDepth);
    
    if (score >= beta) {
      return beta; // Beta cutoff
    }
    
    if (score > alpha) {
      alpha = score;
    }
  }
  
  return alpha;
}

/**
 * Minimax algorithm with alpha-beta pruning
 * @param chess - Current chess game state
 * @param depth - How many moves to look ahead
 * @param alpha - Best value for maximizing player
 * @param beta - Best value for minimizing player
 * @param isMaximizingPlayer - True if white's turn, false if black's turn
 * @param useQuiescence - Whether to use quiescence search at leaf nodes
 * @param quiescenceDepth - Maximum depth for quiescence search
 * @returns Best evaluation score
 */
function minimax(
  chess: ChessGame,
  depth: number,
  alpha: number,
  beta: number,
  isMaximizingPlayer: boolean,
  useQuiescence: boolean = false,
  quiescenceDepth: number = 0
): number {
  // Check time budget - abort search if exceeded
  if (Date.now() - searchStartTime > maxSearchTimeMs) {
    searchTimedOut = true;
    return 0; // Return neutral evaluation to stop search
  }
  
  // Check for game over first
  const gameResult = chess.getGameResult();
  if (gameResult) {
    // Checkmate is evaluated based on depth (faster checkmate = better)
    if (gameResult.includes('Checkmate')) {
      const checkmateValue = 100000 + depth * 1000; // Prefer faster checkmate
      return gameResult.includes('White') ? checkmateValue : -checkmateValue;
    }
    // Stalemate or draw
    return 0;
  }
  
  // Base case: reached max depth
  if (depth === 0) {
    // Use quiescence search if enabled (extends for tactical sequences)
    if (useQuiescence && quiescenceDepth > 0) {
      return quiescence(chess, alpha, beta, 0, quiescenceDepth);
    }
    return evaluateBoard(chess);
  }
  
  // Get all legal moves
  const allMoves: { from: Square; to: Square }[] = [];
  for (let rank = 1; rank <= 8; rank++) {
    for (let file of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
      const square = `${file}${rank}` as Square;
      const piece = chess.getPiece(square);
      if (piece) {
        const moves = chess.getLegalMoves(square);
        moves.forEach(to => allMoves.push({ from: square, to }));
      }
    }
  }
  
  // Game over - return extreme values
  if (allMoves.length === 0) {
    const result = chess.getGameResult();
    if (result?.includes('checkmate')) {
      return isMaximizingPlayer ? -999999 : 999999;
    }
    return 0; // Stalemate
  }
  
  // Order moves for better alpha-beta pruning (captures, checks, center moves first)
  const orderedMoves = allMoves.map(move => {
    let priority = 0;
    const targetPiece = chess.getPiece(move.to);
    const movingPiece = chess.getPiece(move.from);
    
    // 1. HIGHEST PRIORITY: Captures (MVV-LVA)
    if (targetPiece) {
      const victimValue = PIECE_VALUES[targetPiece.charAt(1).toLowerCase()] || 0;
      const attackerValue = PIECE_VALUES[movingPiece?.charAt(1).toLowerCase() || 'p'] || 100;
      priority += 10000 + victimValue * 10 - attackerValue / 10; // Prefer capturing high value with low value
    }
    
    // 2. Check if this move gives check (but don't over-prioritize - checks that hang pieces are bad)
    const chessCopy = chess.clone();
    chessCopy.makeMove(move.from, move.to);
    const givesCheck = chessCopy.isCheck();
    if (givesCheck) {
      priority += 300; // Checks are useful but captures should come first
    }
    
    // 2.5. CRITICAL: Detect if moved piece is now hanging (undefended)
    // This prevents blunders like Qxd7+ where the queen hangs
    // OPTIMIZATION: Only check for captures and checks (most likely to hang pieces)
    if (targetPiece || givesCheck) {
      const movedPieceAfter = chessCopy.getPiece(move.to);
      if (movedPieceAfter && movedPieceAfter.charAt(0) === chess.getTurn()) {
        const attackers = getAttackers(chessCopy, move.to, chess.getTurn() === 'w' ? 'b' : 'w');
        const defenders = getAttackers(chessCopy, move.to, chess.getTurn());
        
        if (attackers.length > 0 && attackers.length > defenders.length) {
          // Piece is hanging! Heavily penalize
          const pieceValue = PIECE_VALUES[movedPieceAfter.charAt(1).toLowerCase()] || 0;
          priority -= pieceValue * 20; // Massive penalty - losing queen = -19000 priority
        }
      }
    }
    
    // 3. Center control (d4, d5, e4, e5)
    const centralSquares = ['d4', 'd5', 'e4', 'e5'];
    if (centralSquares.includes(move.to)) {
      priority += 200;
    }
    
    // 4. Piece development (knights and bishops moving off back rank)
    if (movingPiece && (movingPiece.includes('n') || movingPiece.includes('b'))) {
      const fromRank = parseInt(move.from[1]);
      if (fromRank === 1 || fromRank === 8) {
        priority += 100; // Reward developing pieces
      }
    }
    
    // 5. Castling moves (king to g1/c1 or g8/c8)
    if (movingPiece?.includes('k')) {
      const castleSquares = ['g1', 'c1', 'g8', 'c8'];
      if (castleSquares.includes(move.to)) {
        priority += 300; // Castling is important
      }
    }
    
    return { move, priority };
  }).sort((a, b) => b.priority - a.priority);
  
  if (isMaximizingPlayer) {
    let maxEval = -Infinity;
    
    for (const { move } of orderedMoves) {
      // Make move
      const chessCopy = chess.clone();
      chessCopy.makeMove(move.from, move.to);
      
      // Recursive call with quiescence parameters
      const evaluation = minimax(chessCopy, depth - 1, alpha, beta, false, useQuiescence, quiescenceDepth);
      maxEval = Math.max(maxEval, evaluation);
      
      // Alpha-beta pruning
      alpha = Math.max(alpha, evaluation);
      if (beta <= alpha) {
        break; // Beta cutoff
      }
    }
    
    return maxEval;
  } else {
    let minEval = Infinity;
    
    for (const { move } of orderedMoves) {
      // Make move
      const chessCopy = chess.clone();
      chessCopy.makeMove(move.from, move.to);
      
      // Recursive call with quiescence parameters
      const evaluation = minimax(chessCopy, depth - 1, alpha, beta, true, useQuiescence, quiescenceDepth);
      minEval = Math.min(minEval, evaluation);
      
      // Alpha-beta pruning
      beta = Math.min(beta, evaluation);
      if (beta <= alpha) {
        break; // Alpha cutoff
      }
    }
    
    return minEval;
  }
}

// Time budget tracking for search
let searchStartTime = 0;
let maxSearchTimeMs = 0;
let searchTimedOut = false;

/**
 * Find the best move using minimax with alpha-beta pruning
 * @param chess - Current game state
 * @param depth - Search depth (1-5 recommended, higher = slower but smarter)
 * @param maxTimeMs - Maximum time in milliseconds (default 5000ms = 5 seconds)
 * @param useQuiescence - Whether to use quiescence search (prevents horizon effect)
 * @param quiescenceDepth - Maximum depth for quiescence search
 * @param beamWidth - Number of top moves to search (0 = all moves)
 * @param useAspiration - Whether to use aspiration windows (narrow window search)
 * @param aspirationWindow - Window size in centipawns (default 50)
 * @returns Best move found
 */
export function findBestMove(
  chess: ChessGame,
  depth: number = 3,
  maxTimeMs: number = 5000,
  useQuiescence: boolean = false,
  quiescenceDepth: number = 0,
  beamWidth: number = 0,
  useAspiration: boolean = false,
  aspirationWindow: number = 50
): { from: Square; to: Square } | null {
  // Initialize time budget
  searchStartTime = Date.now();
  maxSearchTimeMs = maxTimeMs;
  searchTimedOut = false;
  
  const isMaximizingPlayer = chess.getTurn() === 'w';
  let bestMove: { from: Square; to: Square } | null = null;
  let bestValue = isMaximizingPlayer ? -Infinity : Infinity;
  
  // Track previous evaluation for aspiration windows
  let previousEval = 0;
  
  console.log(`[Minimax AI] Searching depth ${depth}, ${isMaximizingPlayer ? 'White' : 'Black'} to move, max time: ${maxTimeMs}ms`);
  
  // Get all legal moves
  const allMoves: { from: Square; to: Square }[] = [];
  for (let rank = 1; rank <= 8; rank++) {
    for (let file of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
      const square = `${file}${rank}` as Square;
      const piece = chess.getPiece(square);
      if (piece && piece.charAt(0) === chess.getTurn()) {
        const moves = chess.getLegalMoves(square);
        moves.forEach(to => allMoves.push({ from: square, to }));
      }
    }
  }
  
  console.log(`[Minimax AI] Evaluating ${allMoves.length} possible moves`);
  
  // PHASE 1: Quick ordering using simple heuristics (no cloning/move making)
  const quickOrderedMoves = allMoves.map(move => {
    const targetPiece = chess.getPiece(move.to);
    const movingPiece = chess.getPiece(move.from);
    
    let priority = 0;
    
    // 1. Prioritize captures (MVV-LVA: Most Valuable Victim - Least Valuable Attacker)
    if (targetPiece) {
      const victimValue = PIECE_VALUES[targetPiece.charAt(1).toLowerCase()] || 0;
      const attackerValue = PIECE_VALUES[movingPiece?.charAt(1).toLowerCase() || 'p'] || 100;
      priority += 10000 + victimValue * 10 - attackerValue / 10;
    }
    
    // 2. Prioritize center control
    const centerSquares = ['e4', 'e5', 'd4', 'd5'];
    if (centerSquares.includes(move.to)) {
      priority += 200;
    }
    
    // 3. Prioritize piece development
    if (movingPiece && (movingPiece.includes('n') || movingPiece.includes('b'))) {
      const fromRank = parseInt(move.from[1]);
      if (fromRank === 1 || fromRank === 8) {
        priority += 150;
      }
    }
    
    // 4. Castling bonus
    if (movingPiece?.includes('k')) {
      const castleSquares = ['g1', 'c1', 'g8', 'c8'];
      if (castleSquares.includes(move.to)) {
        priority += 400;
      }
    }
    
    return { move, priority };
  }).sort((a, b) => b.priority - a.priority);
  
  // Apply beam search EARLY: only keep top N moves
  const candidateMoves = beamWidth > 0 && beamWidth < quickOrderedMoves.length
    ? quickOrderedMoves.slice(0, beamWidth)
    : quickOrderedMoves;
  
  // PHASE 2: Expensive checks only on candidate moves (post-beam-search)
  const orderedMoves = candidateMoves.map(({ move, priority }) => {
    const chessCopy = chess.clone();
    const targetPiece = chessCopy.getPiece(move.to);
    const movingPiece = chess.getPiece(move.from);
    chessCopy.makeMove(move.from, move.to);
    
    // Check for checks
    const givesCheck = chessCopy.isCheck();
    if (givesCheck) {
      priority += 300;
    }
    
    // CRITICAL: Penalize hanging pieces (only for captures/checks)
    if (targetPiece || givesCheck) {
      const movedPieceAfter = chessCopy.getPiece(move.to);
      if (movedPieceAfter && movedPieceAfter.charAt(0) === chess.getTurn()) {
        const attackers = getAttackers(chessCopy, move.to, chess.getTurn() === 'w' ? 'b' : 'w');
        const defenders = getAttackers(chessCopy, move.to, chess.getTurn());
        
        if (attackers.length > 0 && attackers.length > defenders.length) {
          // Piece is hanging! Heavily penalize
          const pieceValue = PIECE_VALUES[movedPieceAfter.charAt(1).toLowerCase()] || 0;
          priority -= pieceValue * 20; // Massive penalty
        }
      }
    }
    
    return { move, priority };
  }).sort((a, b) => b.priority - a.priority);
  
  const movesToSearch = orderedMoves;
  
  if (beamWidth > 0 && movesToSearch.length < orderedMoves.length) {
    console.log(`[Minimax AI] 🎯 Beam search: evaluating top ${movesToSearch.length} of ${orderedMoves.length} moves`);
  }
  
  // Aspiration window: try narrow window first, then full window if needed
  let alpha = -Infinity;
  let beta = Infinity;
  let aspirationAttempt = 1;
  let failedHigh = false;
  let failedLow = false;
  
  // If using aspiration and we have a previous eval, start with narrow window
  if (useAspiration && depth > 3) {
    alpha = previousEval - aspirationWindow;
    beta = previousEval + aspirationWindow;
    console.log(`[Minimax AI] 🎯 Aspiration window: [${alpha}, ${beta}] (±${aspirationWindow})`);
  }
  
  // Main search loop with aspiration window retry logic
  while (true) {
    let currentBestMove: { from: Square; to: Square } | null = null;
    let currentBestValue = isMaximizingPlayer ? -Infinity : Infinity;
    
    for (const { move } of movesToSearch) {
      // Check time budget before evaluating each root move
      if (Date.now() - searchStartTime > maxSearchTimeMs) {
        console.log(`[Minimax AI] ⏱️ Time limit reached (${maxSearchTimeMs}ms), returning best move so far`);
        searchTimedOut = true;
        break;
      }
      
      const chessCopy = chess.clone();
      chessCopy.makeMove(move.from, move.to);
      
      const evaluation = minimax(
        chessCopy,
        depth - 1,
        alpha,
        beta,
        !isMaximizingPlayer,
        useQuiescence,
        quiescenceDepth
      );
      
      // Skip this move if search was aborted
      if (searchTimedOut && !currentBestMove) {
        // No best move yet, use this one
        currentBestMove = move;
        currentBestValue = evaluation;
        break;
      } else if (searchTimedOut) {
        // Already have a best move, stop searching
        break;
      }
      
      // Update best move
      if (isMaximizingPlayer) {
        if (evaluation > currentBestValue) {
          currentBestValue = evaluation;
          currentBestMove = move;
        }
        alpha = Math.max(alpha, evaluation);
      } else {
        if (evaluation < currentBestValue) {
          currentBestValue = evaluation;
          currentBestMove = move;
        }
        beta = Math.min(beta, evaluation);
      }
      
      // Alpha-beta pruning at root
      if (beta <= alpha) {
        break;
      }
    }
    
    // Check if we failed high/low with aspiration window
    if (useAspiration && aspirationAttempt === 1 && !searchTimedOut) {
      if (isMaximizingPlayer && currentBestValue >= beta) {
        // Failed high - score is higher than window
        failedHigh = true;
        alpha = currentBestValue - aspirationWindow;
        beta = Infinity;
        aspirationAttempt++;
        console.log(`[Minimax AI] ⬆️ Aspiration failed high (${currentBestValue} >= ${beta}), re-searching with [${alpha}, Inf]`);
        continue;
      } else if (!isMaximizingPlayer && currentBestValue <= alpha) {
        // Failed low - score is lower than window
        failedLow = true;
        alpha = -Infinity;
        beta = currentBestValue + aspirationWindow;
        aspirationAttempt++;
        console.log(`[Minimax AI] ⬇️ Aspiration failed low (${currentBestValue} <= ${alpha}), re-searching with [-Inf, ${beta}]`);
        continue;
      }
    }
    
    // Search complete
    bestMove = currentBestMove;
    bestValue = currentBestValue;
    previousEval = currentBestValue;
    break;
  }
  
  const elapsed = Date.now() - searchStartTime;
  const aspirationStatus = useAspiration && aspirationAttempt > 1 
    ? ` (aspiration: ${failedHigh ? 'failed high' : failedLow ? 'failed low' : 'ok'})` 
    : '';
  console.log(`[Minimax AI] Best move: ${bestMove?.from}→${bestMove?.to} (eval: ${bestValue}, time: ${elapsed}ms${searchTimedOut ? ', TIMED OUT' : ''}${aspirationStatus})`);
  
  return bestMove;
}
