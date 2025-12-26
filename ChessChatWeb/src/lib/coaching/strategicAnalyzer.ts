/**
 * Strategic Principle Analyzer
 * Checks for violations of fundamental chess principles
 */

import { Chess, Square, Color, PieceSymbol } from 'chess.js';
import { GameplayMetrics, StrategicViolation, GamePhase, ChessPrinciple } from './types';

interface PrincipleCheck {
  id: ChessPrinciple;
  phase: GamePhase;
  check: (chess: Chess, moveNumber: number) => boolean | null;
  violation: string;
  advice: string;
  severity: 'minor' | 'moderate' | 'major';
}

export class StrategicAnalyzer {
  private principles: PrincipleCheck[] = [
    // Opening Principles (moves 1-15)
    {
      id: 'center_control',
      phase: 'opening',
      check: (chess: Chess, moveNumber: number) => {
        if (moveNumber > 15) return null;
        return this.hascentrePawnControl(chess);
      },
      violation: 'Not controlling the center with pawns in the opening.',
      advice: 'Move central pawns (d4, e4, d5, e5) early to control key squares.',
      severity: 'major',
    },
    {
      id: 'piece_development',
      phase: 'opening',
      check: (chess: Chess, moveNumber: number) => {
        if (moveNumber > 15) return null;
        const developed = this.countDevelopedPieces(chess);
        const expected = Math.floor(moveNumber / 2);
        return developed >= expected - 1; // Allow 1 move leeway
      },
      violation: 'Not developing pieces quickly enough in the opening.',
      advice: 'Develop knights and bishops before moving the same piece twice or pushing side pawns.',
      severity: 'major',
    },
    {
      id: 'king_safety',
      phase: 'opening',
      check: (chess: Chess, moveNumber: number) => {
        if (moveNumber > 12) return null;
        if (moveNumber < 5) return null; // Too early to castle
        return this.isKingCastled(chess, chess.turn());
      },
      violation: 'King is still in the center after move 8.',
      advice: 'Castle early (before move 10) to protect your king and activate your rook.',
      severity: 'major',
    },
    // Middlegame Principles (moves 11-30)
    {
      id: 'pawn_structure',
      phase: 'middlegame',
      check: (chess: Chess, moveNumber: number) => {
        if (moveNumber <= 15 || moveNumber > 35) return null;
        const weaknesses = this.findPawnWeaknesses(chess);
        return weaknesses.length <= 2;
      },
      violation: 'Creating weak pawns (isolated, doubled, or backward).',
      advice: 'Avoid unnecessary pawn moves that create permanent weaknesses in your position.',
      severity: 'moderate',
    },
    {
      id: 'piece_activity',
      phase: 'middlegame',
      check: (chess: Chess, moveNumber: number) => {
        if (moveNumber <= 15 || moveNumber > 35) return null;
        const mobility = this.calculatePieceMobility(chess);
        return mobility >= 15; // Average moves available
      },
      violation: 'Pieces have limited mobility and activity.',
      advice: 'Place pieces on active squares where they control important areas and have options.',
      severity: 'moderate',
    },
    {
      id: 'piece_coordination',
      phase: 'middlegame',
      check: (chess: Chess, moveNumber: number) => {
        if (moveNumber <= 15 || moveNumber > 35) return null;
        return this.arePiecesCoordinated(chess);
      },
      violation: 'Pieces are not working together effectively.',
      advice: 'Coordinate your pieces to support each other and create threats together.',
      severity: 'moderate',
    },
    // Endgame Principles (moves 30+)
    {
      id: 'king_activity',
      phase: 'endgame',
      check: (chess: Chess, moveNumber: number) => {
        if (moveNumber < 30) return null;
        return this.isKingActive(chess, chess.turn());
      },
      violation: 'King is passive in the endgame.',
      advice: 'Activate your king in the endgame - it becomes a strong attacking piece.',
      severity: 'major',
    },
    {
      id: 'passed_pawns',
      phase: 'endgame',
      check: (chess: Chess, moveNumber: number) => {
        if (moveNumber < 30) return null;
        return this.hasPassedPawn(chess, chess.turn());
      },
      violation: 'Not creating or advancing passed pawns in the endgame.',
      advice: 'Create and push passed pawns in the endgame - they become very powerful.',
      severity: 'major',
    },
  ];

  /**
   * Analyze all strategic violations in a game
   */
  analyzeViolations(gameMetrics: GameplayMetrics[]): StrategicViolation[] {
    const violations: StrategicViolation[] = [];

    for (const metric of gameMetrics) {
      const chess = new Chess(metric.fen);
      const phase = this.getGamePhase(metric.moveNumber, chess);

      // Check all principles relevant to current phase
      for (const principle of this.principles) {
        if (principle.phase !== phase) continue;

        const passes = principle.check(chess, metric.moveNumber);
        if (passes === false) {
          violations.push({
            moveNumber: metric.moveNumber,
            principle: principle.id,
            phase: principle.phase,
            severity: principle.severity,
            explanation: principle.violation,
            advice: principle.advice,
          });
        }
      }
    }

    return violations;
  }

  /**
   * Determine game phase based on move number and material
   */
  private getGamePhase(moveNumber: number, chess: Chess): GamePhase {
    if (moveNumber <= 15) return 'opening';
    
    const materialCount = this.countTotalMaterial(chess);
    
    // Endgame if few pieces remain
    if (materialCount <= 20 || moveNumber >= 30) return 'endgame';
    
    return 'middlegame';
  }

  /**
   * Check if player controls the center with pawns
   */
  private hascentrePawnControl(chess: Chess): boolean {
    const board = chess.board();
    const turn = chess.turn();
    const centerSquares = [
      [3, 3], [3, 4], // d5, e5
      [4, 3], [4, 4], // d4, e4
    ];

    let controlledSquares = 0;
    for (const [rank, file] of centerSquares) {
      const piece = board[rank][file];
      if (piece && piece.type === 'p' && piece.color === turn) {
        controlledSquares++;
      }
    }

    return controlledSquares >= 1;
  }

  /**
   * Count developed pieces (knights and bishops off starting squares)
   */
  private countDevelopedPieces(chess: Chess): number {
    const board = chess.board();
    const turn = chess.turn();
    let developed = 0;

    // Starting positions for white/black pieces
    const startingRank = turn === 'w' ? 7 : 0;
    const knightFiles = [1, 6]; // b and g files
    const bishopFiles = [2, 5]; // c and f files

    // Check if knights moved
    for (const file of knightFiles) {
      const piece = board[startingRank][file];
      if (!piece || piece.type !== 'n' || piece.color !== turn) {
        developed++;
      }
    }

    // Check if bishops moved
    for (const file of bishopFiles) {
      const piece = board[startingRank][file];
      if (!piece || piece.type !== 'b' || piece.color !== turn) {
        developed++;
      }
    }

    return developed;
  }

  /**
   * Check if king has castled
   */
  private isKingCastled(chess: Chess, color: Color): boolean {
    // Check castling rights - if player lost all rights, they likely castled
    const castlingRights = chess.getCastlingRights(color);
    
    // If no castling rights, check if king moved (indicates castled or moved)
    if (!castlingRights.k && !castlingRights.q) {
      const board = chess.board();
      const kingRank = color === 'w' ? 7 : 0;
      const kingFile = 4; // e-file
      const piece = board[kingRank][kingFile];
      
      // King not on starting square
      return !piece || piece.type !== 'k';
    }

    return false;
  }

  /**
   * Find pawn weaknesses (isolated, doubled, backward)
   */
  private findPawnWeaknesses(chess: Chess): string[] {
    const board = chess.board();
    const turn = chess.turn();
    const weaknesses: string[] = [];

    // Check each file for pawn issues
    for (let file = 0; file < 8; file++) {
      let pawnCount = 0;
      const pawnsOnFile: number[] = [];

      for (let rank = 0; rank < 8; rank++) {
        const piece = board[rank][file];
        if (piece && piece.type === 'p' && piece.color === turn) {
          pawnCount++;
          pawnsOnFile.push(rank);
        }
      }

      // Doubled pawns
      if (pawnCount >= 2) {
        weaknesses.push(`doubled_pawn_${String.fromCharCode(97 + file)}`);
      }

      // Isolated pawns (no friendly pawns on adjacent files)
      if (pawnCount === 1) {
        const hasNeighbor = 
          (file > 0 && this.hasOwnPawnOnFile(board, file - 1, turn)) ||
          (file < 7 && this.hasOwnPawnOnFile(board, file + 1, turn));
        
        if (!hasNeighbor) {
          weaknesses.push(`isolated_pawn_${String.fromCharCode(97 + file)}`);
        }
      }
    }

    return weaknesses;
  }

  /**
   * Check if there's a pawn of given color on a file
   */
  private hasOwnPawnOnFile(board: ReturnType<Chess['board']>, file: number, color: Color): boolean {
    for (let rank = 0; rank < 8; rank++) {
      const piece = board[rank][file];
      if (piece && piece.type === 'p' && piece.color === color) {
        return true;
      }
    }
    return false;
  }

  /**
   * Calculate total piece mobility
   */
  private calculatePieceMobility(chess: Chess): number {
    const moves = chess.moves({ verbose: true });
    return moves.length;
  }

  /**
   * Check if pieces are coordinated (supporting each other)
   */
  private arePiecesCoordinated(chess: Chess): boolean {
    // Simple heuristic: check if pieces defend each other
    const board = chess.board();
    const turn = chess.turn();
    let defendedPieces = 0;
    let totalPieces = 0;

    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const piece = board[rank][file];
        if (piece && piece.color === turn && piece.type !== 'p') {
          totalPieces++;
          const square = this.coordsToSquare(file, rank);
          if (this.isDefended(chess, square, turn)) {
            defendedPieces++;
          }
        }
      }
    }

    // At least 50% of pieces should be defended
    return totalPieces === 0 || defendedPieces >= totalPieces * 0.5;
  }

  /**
   * Check if a square is defended by friendly pieces
   */
  private isDefended(chess: Chess, square: Square, color: Color): boolean {
    // Make a test move to see if square would be defended
    const testChess = new Chess(chess.fen());
    const moves = testChess.moves({ verbose: true });
    
    for (const move of moves) {
      if (move.to === square && move.color === color) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Check if king is active (centralized in endgame)
   */
  private isKingActive(chess: Chess, color: Color): boolean {
    const kingSquare = this.findKing(chess, color);
    if (!kingSquare) return false;

    const [file, rank] = this.squareToCoords(kingSquare);
    
    // King is active if in central 4x4 area
    return file >= 2 && file <= 5 && rank >= 2 && rank <= 5;
  }

  /**
   * Check if player has a passed pawn
   */
  private hasPassedPawn(chess: Chess, color: Color): boolean {
    const board = chess.board();
    const opponent: Color = color === 'w' ? 'b' : 'w';

    for (let file = 0; file < 8; file++) {
      for (let rank = 0; rank < 8; rank++) {
        const piece = board[rank][file];
        if (piece && piece.type === 'p' && piece.color === color) {
          // Check if this pawn is passed (no opponent pawns ahead)
          if (this.isPawnPassed(board, file, rank, color, opponent)) {
            return true;
          }
        }
      }
    }

    return false;
  }

  /**
   * Check if a pawn is passed
   */
  private isPawnPassed(
    board: ReturnType<Chess['board']>,
    file: number,
    rank: number,
    color: Color,
    opponent: Color
  ): boolean {
    const direction = color === 'w' ? -1 : 1;
    const startRank = rank + direction;
    const endRank = color === 'w' ? 0 : 7;

    // Check files: same file and adjacent files
    for (let checkFile = Math.max(0, file - 1); checkFile <= Math.min(7, file + 1); checkFile++) {
      for (let checkRank = startRank; direction === -1 ? checkRank >= endRank : checkRank <= endRank; checkRank += direction) {
        const piece = board[checkRank][checkFile];
        if (piece && piece.type === 'p' && piece.color === opponent) {
          return false; // Opponent pawn blocks
        }
      }
    }

    return true;
  }

  /**
   * Count total material on the board
   */
  private countTotalMaterial(chess: Chess): number {
    const board = chess.board();
    let material = 0;

    const pieceValues: Record<PieceSymbol, number> = {
      p: 1,
      n: 3,
      b: 3,
      r: 5,
      q: 9,
      k: 0,
    };

    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const piece = board[rank][file];
        if (piece) {
          material += pieceValues[piece.type];
        }
      }
    }

    return material;
  }

  /**
   * Find king position
   */
  private findKing(chess: Chess, color: Color): Square | null {
    const board = chess.board();
    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const piece = board[rank][file];
        if (piece && piece.type === 'k' && piece.color === color) {
          return this.coordsToSquare(file, rank);
        }
      }
    }
    return null;
  }

  /**
   * Convert coordinates to square notation
   */
  private coordsToSquare(file: number, rank: number): Square {
    const files = 'abcdefgh';
    return `${files[file]}${8 - rank}` as Square;
  }

  /**
   * Convert square notation to coordinates
   */
  private squareToCoords(square: Square): [number, number] {
    const file = square.charCodeAt(0) - 'a'.charCodeAt(0);
    const rank = 8 - parseInt(square[1]);
    return [file, rank];
  }
}
