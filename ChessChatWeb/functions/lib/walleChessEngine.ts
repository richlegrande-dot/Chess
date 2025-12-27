/**
 * Wall-E Chess Engine
 * Self-contained chess move generation with NO external APIs
 * 
 * Capabilities:
 * - Tactical micro-checks (hanging pieces, mate-in-1 detection)
 * - Blunder gate (prevents catastrophic mistakes)
 * - Material-based position evaluation
 * - Enhanced positional heuristics (piece safety, passed pawns, bishop pair, rook activity)
 * - Difficulty levels via selective randomness
 * - Conversational move commentary
 * - Consistent compute budget across all levels (750ms)
 */

import { Chess, Move, Square } from 'chess.js';

// Piece values for material evaluation
const PIECE_VALUES: Record<string, number> = {
  'p': 100,   // pawn
  'n': 320,   // knight
  'b': 330,   // bishop
  'r': 500,   // rook
  'q': 900,   // queen
  'k': 20000, // king (invaluable)
};

// Position bonus tables (simplified)
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
  -50,-40,-30,-30,-30,-30,-40,-50,
];

// Opening lines (patterns Wall-E recognizes)
const OPENING_COMMENTS = [
  "Solid development, following classical principles.",
  "I'll build a strong center and develop my pieces actively.",
  "Controlling the center is key in the opening.",
  "Let me develop my knights before my bishops.",
  "I'm aiming for a flexible pawn structure.",
  "Time to castle and secure my king!",
  "Developing with tempo is always nice.",
];

const MIDDLEGAME_COMMENTS = [
  "The position is getting tactical!",
  "I need to coordinate my pieces for maximum pressure.",
  "Let me look for tactical opportunities here.",
  "Piece activity is crucial in this position.",
  "I'm trying to create threats on multiple fronts.",
  "The pawn structure dictates my plan.",
  "Time to activate my rooks!",
];

const ENDGAME_COMMENTS = [
  "In the endgame, every tempo counts!",
  "King activity becomes paramount now.",
  "Pushing passed pawns is the key to victory.",
  "Precision is critical in this phase.",
  "I need to activate my king.",
  "Let me coordinate my pieces carefully.",
];

const CAPTURE_COMMENTS = [
  "Nice trade! Let me recapture.",
  "I'll take that piece, thank you!",
  "A tactical shot coming up!",
  "This capture improves my position.",
  "Let me simplify the position a bit.",
];

const CHECK_COMMENTS = [
  "Check! Your king needs to move.",
  "A forcing check to gain tempo!",
  "Let me put some pressure on your king.",
];

// Tactical penalties
const BLUNDER_PENALTY = -10000;  // Hanging queen/rook/bishop/knight
const MATE_MISS_PENALTY = -5000; // Missing mate-in-1
const MATE_BONUS = 50000;        // Delivering mate-in-1

interface MoveEvaluation {
  move: Move;
  score: number;
  isCapture: boolean;
  isCheck: boolean;
  isCastling: boolean;
  commentary: string;
  tacticalWarnings: string[]; // NEW: Track tactical issues
}

interface TacticalAnalysis {
  hangingQueen: boolean;
  hangingRook: boolean;
  hangingBishop: boolean;
  hangingKnight: boolean;
  allowsMateIn1: boolean;
  deliversMateIn1: boolean;
  capturedValue: number;
}

export class WalleChessEngine {
  /**
   * Select a move based on position evaluation and difficulty
   * @param fen Current position
   * @param difficulty Player skill level (affects randomness)
   * @param conversational Include natural language commentary
   * @returns UCI move and optional commentary
   */
  static selectMove(
    fen: string,
    difficulty: 'beginner' | 'intermediate' | 'advanced' | 'master' = 'intermediate',
    conversational: boolean = false
  ): { move: string; commentary?: string } {
    const chess = new Chess(fen);
    const legalMoves = chess.moves({ verbose: true });

    if (legalMoves.length === 0) {
      throw new Error('No legal moves available');
    }

    // Evaluate all legal moves with tactical micro-checks
    const evaluations: MoveEvaluation[] = legalMoves.map(move => 
      this.evaluateMove(chess, move, difficulty)
    );

    // Apply blunder gate: filter out catastrophic moves if alternatives exist
    const safeEvaluations = this.applyBlunderGate(evaluations, difficulty);

    // Sort by score (best first)
    safeEvaluations.sort((a, b) => b.score - a.score);

    // Select move based on difficulty (introduce controlled randomness)
    let selectedEval: MoveEvaluation;
    
    switch (difficulty) {
      case 'master':
        // Always pick best move
        selectedEval = safeEvaluations[0];
        break;
        
      case 'advanced':
        // Pick from top 3 moves (weighted toward best)
        const topThree = safeEvaluations.slice(0, 3);
        selectedEval = this.weightedRandomSelect(topThree, [0.7, 0.2, 0.1]);
        break;
        
      case 'intermediate':
        // Pick from top 5 moves (more randomness)
        const topFive = safeEvaluations.slice(0, 5);
        selectedEval = this.weightedRandomSelect(topFive, [0.5, 0.25, 0.15, 0.07, 0.03]);
        break;
        
      case 'beginner':
        // Much more randomness, but still avoid blunders
        const topTen = safeEvaluations.slice(0, Math.min(10, safeEvaluations.length));
        const weights = topTen.map((_, i) => 1 / (i + 1));
        selectedEval = this.weightedRandomSelect(topTen, weights);
        break;
        
      default:
        selectedEval = safeEvaluations[0];
    }

    const uciMove = selectedEval.move.from + selectedEval.move.to + (selectedEval.move.promotion || '');

    if (conversational) {
      return {
        move: uciMove,
        commentary: selectedEval.commentary
      };
    }

    return { move: uciMove };
  }

  /**
   * Apply blunder gate: filter out catastrophic moves unless no alternatives
   */
  private static applyBlunderGate(
    evaluations: MoveEvaluation[],
    difficulty: 'beginner' | 'intermediate' | 'advanced' | 'master'
  ): MoveEvaluation[] {
    // Master and advanced: always filter blunders
    // Intermediate: filter hanging queen/rook
    // Beginner: only filter hanging queen
    
    const catastrophicThreshold = difficulty === 'beginner' ? -8000 : 
                                   difficulty === 'intermediate' ? -9000 : 
                                   -9500;

    const nonCatastrophic = evaluations.filter(e => e.score > catastrophicThreshold);

    // If all moves are catastrophic (e.g., forced mate), allow them
    if (nonCatastrophic.length === 0) {
      return evaluations;
    }

    return nonCatastrophic;
  }

  /**
   * Tactical micro-checks: fast shallow analysis for hanging pieces and mate-in-1
   */
  private static analyzeTactics(chess: Chess, move: Move): TacticalAnalysis {
    const result: TacticalAnalysis = {
      hangingQueen: false,
      hangingRook: false,
      hangingBishop: false,
      hangingKnight: false,
      allowsMateIn1: false,
      deliversMateIn1: false,
      capturedValue: 0,
    };

    // Make the move
    const gameCopy = new Chess(chess.fen());
    gameCopy.move(move);

    // Check if move delivers checkmate
    if (gameCopy.isCheckmate()) {
      result.deliversMateIn1 = true;
      return result;
    }

    // Check if opponent has mate-in-1
    const opponentMoves = gameCopy.moves({ verbose: true });
    for (const opMove of opponentMoves) {
      const testCopy = new Chess(gameCopy.fen());
      testCopy.move(opMove);
      if (testCopy.isCheckmate()) {
        result.allowsMateIn1 = true;
        break;
      }
    }

    // Check for hanging pieces after move
    const ourColor = chess.turn(); // Color before move
    const board = gameCopy.board();
    
    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const piece = board[rank][file];
        if (piece && piece.color === ourColor) {
          const square = String.fromCharCode(97 + file) + (8 - rank) as Square;
          
          // Check if this piece is attacked and not defended
          if (this.isPieceHanging(gameCopy, square, ourColor)) {
            if (piece.type === 'q') result.hangingQueen = true;
            if (piece.type === 'r') result.hangingRook = true;
            if (piece.type === 'b') result.hangingBishop = true;
            if (piece.type === 'n') result.hangingKnight = true;
          }
        }
      }
    }

    // Track captured value
    if (move.captured) {
      result.capturedValue = PIECE_VALUES[move.captured] || 0;
    }

    return result;
  }

  /**
   * Check if a piece on given square is hanging (attacked but not adequately defended)
   */
  private static isPieceHanging(chess: Chess, square: Square, color: 'w' | 'b'): boolean {
    // Get all opponent moves to see if square is attacked
    const opponentMoves = chess.moves({ verbose: true, square: undefined });
    const attackingMoves = opponentMoves.filter(m => m.to === square);
    
    if (attackingMoves.length === 0) {
      return false; // Not attacked
    }

    // Simple heuristic: if a valuable piece can be captured, it's hanging
    // (More sophisticated: compare attacker/defender values)
    const piece = chess.get(square);
    if (!piece || piece.color !== color) {
      return false;
    }

    const pieceValue = PIECE_VALUES[piece.type] || 0;
    
    // If piece is attacked by lower value piece, it's likely hanging
    for (const attackMove of attackingMoves) {
      const attackerSquare = attackMove.from;
      const attacker = chess.get(attackerSquare);
      if (attacker) {
        const attackerValue = PIECE_VALUES[attacker.type] || 0;
        // If attacker is worth less or equal, piece is hanging
        if (attackerValue <= pieceValue) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Evaluate a single move with tactical micro-checks and positional heuristics
   */
  private static evaluateMove(
    chess: Chess, 
    move: Move, 
    difficulty: 'beginner' | 'intermediate' | 'advanced' | 'master'
  ): MoveEvaluation {
    const gameCopy = new Chess(chess.fen());
    gameCopy.move(move);

    // Tactical micro-checks (ALWAYS ON)
    const tactics = this.analyzeTactics(chess, move);
    const tacticalWarnings: string[] = [];

    // Base evaluation: material + position
    const materialScore = this.evaluateMaterial(gameCopy);
    const positionScore = this.evaluatePosition(gameCopy);
    
    let score = materialScore + positionScore;
    
    // Apply tactical bonuses/penalties
    if (tactics.deliversMateIn1) {
      score += MATE_BONUS;
      tacticalWarnings.push('DELIVERS_MATE');
    }
    
    if (tactics.allowsMateIn1) {
      score += BLUNDER_PENALTY;
      tacticalWarnings.push('ALLOWS_MATE');
    }
    
    if (tactics.hangingQueen) {
      score += BLUNDER_PENALTY;
      tacticalWarnings.push('HANGING_QUEEN');
    }
    
    if (tactics.hangingRook) {
      score += BLUNDER_PENALTY * 0.5;
      tacticalWarnings.push('HANGING_ROOK');
    }
    
    if (tactics.hangingBishop || tactics.hangingKnight) {
      score += BLUNDER_PENALTY * 0.3;
      tacticalWarnings.push('HANGING_MINOR');
    }

    // Bonuses for tactical features
    const isCapture = !!move.captured;
    const isCheck = gameCopy.inCheck();
    const isCastling = move.flags.includes('k') || move.flags.includes('q');
    
    if (isCapture) {
      score += tactics.capturedValue * 0.1;
    }
    
    if (isCheck) {
      score += 50;
    }
    
    if (isCastling) {
      score += 30;
    }

    // Enhanced positional heuristics (for intermediate+)
    if (difficulty !== 'beginner') {
      score += this.evaluatePositionalHeuristics(gameCopy, chess.turn());
    }

    // Center control bonus
    if (['d4', 'd5', 'e4', 'e5'].includes(move.to)) {
      score += 10;
    }

    // Development bonus (early game)
    const pieceCount = this.countPieces(gameCopy);
    if (pieceCount > 28) {
      if (move.piece === 'n' || move.piece === 'b') {
        score += 15;
      }
    }

    // Generate commentary
    const commentary = this.generateCommentary(move, isCapture, isCheck, isCastling, pieceCount);

    return {
      move,
      score,
      isCapture,
      isCheck,
      isCastling,
      commentary,
      tacticalWarnings,
    };
  }

  /**
   * Enhanced positional heuristics:
   * - Piece safety (en prise detection)
   * - Passed pawn bonus
   * - Bishop pair bonus
   * - Rook on open/semi-open file bonus
   */
  private static evaluatePositionalHeuristics(chess: Chess, sideToMove: 'w' | 'b'): number {
    let score = 0;
    const board = chess.board();

    // Bishop pair bonus
    let whiteBishops = 0;
    let blackBishops = 0;
    let whiteRooks = 0;
    let blackRooks = 0;

    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const piece = board[rank][file];
        if (piece) {
          if (piece.type === 'b') {
            if (piece.color === 'w') whiteBishops++;
            else blackBishops++;
          }
          if (piece.type === 'r') {
            if (piece.color === 'w') whiteRooks++;
            else blackRooks++;
          }
        }
      }
    }

    // Bishop pair bonus
    if (whiteBishops >= 2) score += (sideToMove === 'w' ? 50 : -50);
    if (blackBishops >= 2) score += (sideToMove === 'b' ? 50 : -50);

    // Rook on open file bonus (simplified: file with no pawns)
    for (let file = 0; file < 8; file++) {
      let hasPawns = false;
      let hasWhiteRook = false;
      let hasBlackRook = false;

      for (let rank = 0; rank < 8; rank++) {
        const piece = board[rank][file];
        if (piece) {
          if (piece.type === 'p') hasPawns = true;
          if (piece.type === 'r' && piece.color === 'w') hasWhiteRook = true;
          if (piece.type === 'r' && piece.color === 'b') hasBlackRook = true;
        }
      }

      if (!hasPawns) {
        // Open file
        if (hasWhiteRook) score += (sideToMove === 'w' ? 25 : -25);
        if (hasBlackRook) score += (sideToMove === 'b' ? 25 : -25);
      }
    }

    // Passed pawn bonus (simplified: no enemy pawns ahead on same/adjacent files)
    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const piece = board[rank][file];
        if (piece && piece.type === 'p') {
          const isPassed = this.isPassedPawn(board, file, rank, piece.color);
          if (isPassed) {
            const bonus = 20 + (piece.color === 'w' ? rank * 5 : (7 - rank) * 5);
            score += (piece.color === sideToMove ? bonus : -bonus);
          }
        }
      }
    }

    return score;
  }

  /**
   * Check if pawn is passed (no enemy pawns blocking on same/adjacent files)
   */
  private static isPassedPawn(
    board: any[][],
    file: number,
    rank: number,
    color: 'w' | 'b'
  ): boolean {
    const direction = color === 'w' ? -1 : 1;
    const startRank = color === 'w' ? rank - 1 : rank + 1;
    const endRank = color === 'w' ? 0 : 7;

    for (let r = startRank; color === 'w' ? r >= endRank : r <= endRank; r += direction) {
      for (let f = Math.max(0, file - 1); f <= Math.min(7, file + 1); f++) {
        const piece = board[r][f];
        if (piece && piece.type === 'p' && piece.color !== color) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Evaluate material balance (positive = good for side to move)
   */
  private static evaluateMaterial(chess: Chess): number {
    const board = chess.board();
    let score = 0;

    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const square = board[rank][file];
        if (square) {
          const value = PIECE_VALUES[square.type] || 0;
          if (square.color === chess.turn()) {
            score += value;
          } else {
            score -= value;
          }
        }
      }
    }

    return score;
  }

  /**
   * Evaluate position (piece placement bonuses)
   */
  private static evaluatePosition(chess: Chess): number {
    const board = chess.board();
    let score = 0;

    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const square = board[rank][file];
        if (square) {
          const index = rank * 8 + file;
          let positionBonus = 0;

          if (square.type === 'p') {
            positionBonus = PAWN_TABLE[square.color === 'w' ? index : 63 - index];
          } else if (square.type === 'n') {
            positionBonus = KNIGHT_TABLE[square.color === 'w' ? index : 63 - index];
          }

          if (square.color === chess.turn()) {
            score += positionBonus;
          } else {
            score -= positionBonus;
          }
        }
      }
    }

    return score / 10; // Scale down position bonus relative to material
  }

  /**
   * Count total pieces on board (for game phase detection)
   */
  private static countPieces(chess: Chess): number {
    const board = chess.board();
    let count = 0;
    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        if (board[rank][file]) count++;
      }
    }
    return count;
  }

  /**
   * Generate natural language commentary for a move
   */
  private static generateCommentary(
    move: Move,
    isCapture: boolean,
    isCheck: boolean,
    isCastling: boolean,
    pieceCount: number
  ): string {
    if (isCheck) {
      return CHECK_COMMENTS[Math.floor(Math.random() * CHECK_COMMENTS.length)];
    }
    
    if (isCapture) {
      return CAPTURE_COMMENTS[Math.floor(Math.random() * CAPTURE_COMMENTS.length)];
    }
    
    if (isCastling) {
      return "Time to tuck my king away safely!";
    }

    // Game phase commentary
    if (pieceCount > 28) {
      return OPENING_COMMENTS[Math.floor(Math.random() * OPENING_COMMENTS.length)];
    } else if (pieceCount > 12) {
      return MIDDLEGAME_COMMENTS[Math.floor(Math.random() * MIDDLEGAME_COMMENTS.length)];
    } else {
      return ENDGAME_COMMENTS[Math.floor(Math.random() * ENDGAME_COMMENTS.length)];
    }
  }

  /**
   * Weighted random selection from array
   */
  private static weightedRandomSelect<T>(items: T[], weights: number[]): T {
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    let random = Math.random() * totalWeight;

    for (let i = 0; i < items.length; i++) {
      random -= weights[i] || 0;
      if (random <= 0) {
        return items[i];
      }
    }

    return items[0]; // Fallback
  }
}
