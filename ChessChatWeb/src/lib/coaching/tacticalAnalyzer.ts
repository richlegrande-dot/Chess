/**
 * Tactical Mistake Analyzer
 * Detects blunders, mistakes, and missed tactical opportunities
 */

import { Chess, Square, PieceSymbol, Color } from 'chess.js';
import { GameplayMetrics, TacticalMistake, TacticalPattern } from './types';

export class TacticalAnalyzer {
  /**
   * Analyze all tactical mistakes in a game
   */
  analyzeMistakes(gameMetrics: GameplayMetrics[]): TacticalMistake[] {
    const mistakes: TacticalMistake[] = [];

    for (let i = 0; i < gameMetrics.length; i++) {
      const metric = gameMetrics[i];
      const evalDrop = i > 0 ? gameMetrics[i - 1].evaluation - metric.evaluation : 0;
      
      // Blunder: Lost 3+ pawns worth of material
      if (Math.abs(evalDrop) >= 3.0) {
        mistakes.push({
          moveNumber: metric.moveNumber,
          move: metric.move,
          fen: metric.fen,
          type: 'blunder',
          evaluation: Math.abs(evalDrop),
          explanation: this.explainBlunder(metric, evalDrop, i > 0 ? gameMetrics[i - 1].fen : null),
        });
      }
      // Mistake: Lost 1.5-3 pawns
      else if (Math.abs(evalDrop) >= 1.5) {
        mistakes.push({
          moveNumber: metric.moveNumber,
          move: metric.move,
          fen: metric.fen,
          type: 'mistake',
          evaluation: Math.abs(evalDrop),
          explanation: this.explainMistake(metric, evalDrop),
        });
      }
      // Inaccuracy: Lost 0.5-1.5 pawns
      else if (Math.abs(evalDrop) >= 0.5) {
        mistakes.push({
          moveNumber: metric.moveNumber,
          move: metric.move,
          fen: metric.fen,
          type: 'inaccuracy',
          evaluation: Math.abs(evalDrop),
          explanation: `Slightly inaccurate move that loses ${Math.abs(evalDrop).toFixed(1)} pawns worth of advantage.`,
        });
      }

      // Check for missed tactics
      if (metric.isMissedTactic) {
        const pattern = this.detectTacticalPattern(metric.fen);
        mistakes.push({
          moveNumber: metric.moveNumber,
          move: metric.move,
          fen: metric.fen,
          type: 'missed_win',
          evaluation: 0,
          explanation: this.explainMissedTactic(pattern),
          pattern: pattern || undefined,
        });
      }
    }

    return mistakes;
  }

  /**
   * Explain what caused a blunder
   */
  private explainBlunder(metric: GameplayMetrics, evalDrop: number, previousFen: string | null): string {
    const chess = new Chess(metric.fen);
    const prevChess = previousFen ? new Chess(previousFen) : null;
    
    // Check common blunder patterns
    if (prevChess) {
      // Check if a piece is now hanging
      const hangingPiece = this.findHangingPiece(chess);
      if (hangingPiece) {
        const pieceName = this.getPieceName(hangingPiece.piece);
        return `${pieceName} on ${hangingPiece.square} is undefended and can be captured for free.`;
      }

      // Check for back-rank mate
      if (this.allowsBackRankMate(chess)) {
        return `This move allows a back-rank checkmate. Your king needs an escape square.`;
      }

      // Check for fork
      if (this.allowsFork(chess)) {
        return `This move allows an opponent fork, attacking multiple pieces simultaneously.`;
      }
    }

    return `This move loses significant material (${Math.abs(evalDrop).toFixed(1)} pawns). Double-check for hanging pieces before moving.`;
  }

  /**
   * Explain what caused a mistake
   */
  private explainMistake(metric: GameplayMetrics, evalDrop: number): string {
    const chess = new Chess(metric.fen);
    
    // Check for weakened king position
    if (this.isKingExposed(chess)) {
      return `This move weakens your king's safety, allowing opponent threats.`;
    }

    // Check for bad piece placement
    const badPlacement = this.findBadPiecePlacement(chess);
    if (badPlacement) {
      return `${badPlacement.piece} on ${badPlacement.square} is poorly placed and vulnerable.`;
    }

    return `This move loses material (${Math.abs(evalDrop).toFixed(1)} pawns). Look for better alternatives.`;
  }

  /**
   * Explain a missed tactical opportunity
   */
  private explainMissedTactic(pattern: TacticalPattern | null): string {
    switch (pattern) {
      case 'fork':
        return `There was a knight/queen fork available that attacks two pieces at once.`;
      case 'pin':
        return `You could pin an opponent's piece to their king or more valuable piece.`;
      case 'skewer':
        return `A skewer was available to force the opponent to move a valuable piece.`;
      case 'discovered_attack':
        return `Moving one piece would reveal a powerful attack from another piece.`;
      case 'mate_in_2':
        return `There was a forced checkmate sequence in 2 moves.`;
      case 'mate_in_3':
        return `There was a forced checkmate sequence in 3 moves.`;
      case 'back_rank_mate':
        return `A back-rank checkmate pattern was available.`;
      case 'hanging_piece':
        return `An opponent's piece was hanging and could be captured for free.`;
      default:
        return `There was a strong tactical opportunity to gain material.`;
    }
  }

  /**
   * Detect tactical pattern in position
   */
  detectTacticalPattern(fen: string): TacticalPattern | null {
    const chess = new Chess(fen);
    const turn = chess.turn();
    
    // Check for hanging pieces
    if (this.hasHangingPiece(chess, turn === 'w' ? 'b' : 'w')) {
      return 'hanging_piece';
    }

    // Check for fork opportunities
    if (this.hasForkOpportunity(chess)) {
      return 'fork';
    }

    // Check for back-rank mate
    if (this.hasBackRankMate(chess)) {
      return 'back_rank_mate';
    }

    // Check for pin opportunities
    if (this.hasPinOpportunity(chess)) {
      return 'pin';
    }

    return null;
  }

  /**
   * Check if a piece is hanging (undefended)
   */
  private findHangingPiece(chess: Chess): { square: Square; piece: PieceSymbol } | null {
    const board = chess.board();
    const turn = chess.turn();

    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const piece = board[rank][file];
        if (piece && piece.color === turn) {
          const square = this.coordsToSquare(file, rank);
          if (this.isHanging(chess, square, turn)) {
            return { square, piece: piece.type };
          }
        }
      }
    }

    return null;
  }

  /**
   * Check if a square is hanging (attacked more than defended)
   */
  private isHanging(chess: Chess, square: Square, color: Color): boolean {
    const attackers = this.countAttackers(chess, square, color === 'w' ? 'b' : 'w');
    const defenders = this.countAttackers(chess, square, color);
    return attackers > defenders;
  }

  /**
   * Count how many pieces attack a square
   */
  private countAttackers(chess: Chess, square: Square, color: Color): number {
    let count = 0;
    const moves = chess.moves({ verbose: true });
    
    for (const move of moves) {
      if (move.to === square && move.color === color) {
        count++;
      }
    }
    
    return count;
  }

  /**
   * Check if position allows back-rank mate
   */
  private allowsBackRankMate(chess: Chess): boolean {
    const turn = chess.turn();
    const kingSquare = this.findKing(chess, turn);
    if (!kingSquare) return false;

    const [, rank] = this.squareToCoords(kingSquare);
    const backRank = turn === 'w' ? 0 : 7;

    // King on back rank with no escape squares
    if (rank === backRank) {
      const escapeSquares = this.getEscapeSquares(chess, kingSquare);
      return escapeSquares.length === 0;
    }

    return false;
  }

  /**
   * Check if position allows a fork
   */
  private allowsFork(chess: Chess): boolean {
    // Simple heuristic: check if opponent has knight/queen attacking 2+ pieces
    const turn = chess.turn();
    const opponent: Color = turn === 'w' ? 'b' : 'w';
    const moves = chess.moves({ verbose: true });

    const attackedSquares = new Map<Square, number>();
    for (const move of moves) {
      if (move.color === opponent && (move.piece === 'n' || move.piece === 'q')) {
        attackedSquares.set(move.to, (attackedSquares.get(move.to) || 0) + 1);
      }
    }

    // Check if any move attacks 2+ of our pieces
    for (const count of attackedSquares.values()) {
      if (count >= 2) return true;
    }

    return false;
  }

  /**
   * Check if king is exposed
   */
  private isKingExposed(chess: Chess): boolean {
    const turn = chess.turn();
    const kingSquare = this.findKing(chess, turn);
    if (!kingSquare) return false;

    const attackers = this.countAttackers(chess, kingSquare, turn === 'w' ? 'b' : 'w');
    return attackers >= 2;
  }

  /**
   * Find badly placed pieces
   */
  private findBadPiecePlacement(chess: Chess): { square: Square; piece: string } | null {
    // Simple heuristic: pieces on the edge with limited mobility
    const board = chess.board();
    const turn = chess.turn();

    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const piece = board[rank][file];
        if (piece && piece.color === turn && piece.type !== 'p') {
          const square = this.coordsToSquare(file, rank);
          const mobility = this.getPieceMobility(chess, square);
          
          // Edge pieces with low mobility
          if ((file === 0 || file === 7 || rank === 0 || rank === 7) && mobility < 2) {
            return { square, piece: this.getPieceName(piece.type) };
          }
        }
      }
    }

    return null;
  }

  /**
   * Check if there's a hanging piece
   */
  private hasHangingPiece(chess: Chess, color: Color): boolean {
    const board = chess.board();
    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const piece = board[rank][file];
        if (piece && piece.color === color) {
          const square = this.coordsToSquare(file, rank);
          if (this.isHanging(chess, square, color)) {
            return true;
          }
        }
      }
    }
    return false;
  }

  /**
   * Check for fork opportunity
   */
  private hasForkOpportunity(chess: Chess): boolean {
    const moves = chess.moves({ verbose: true });
    const turn = chess.turn();

    for (const move of moves) {
      if (move.piece === 'n' || move.piece === 'q') {
        // Make the move temporarily
        const testChess = new Chess(chess.fen());
        testChess.move(move);
        
        // Check if this move attacks 2+ opponent pieces
        const attacks = this.countPieceAttacks(testChess, move.to, turn === 'w' ? 'b' : 'w');
        if (attacks >= 2) return true;
      }
    }

    return false;
  }

  /**
   * Check for back-rank mate opportunity
   */
  private hasBackRankMate(chess: Chess): boolean {
    const turn = chess.turn();
    const opponent: Color = turn === 'w' ? 'b' : 'w';
    const oppKingSquare = this.findKing(chess, opponent);
    if (!oppKingSquare) return false;

    const [, rank] = this.squareToCoords(oppKingSquare);
    const backRank = opponent === 'w' ? 0 : 7;

    if (rank === backRank) {
      const escapeSquares = this.getEscapeSquares(chess, oppKingSquare);
      const attackers = this.countAttackers(chess, oppKingSquare, turn);
      return escapeSquares.length === 0 && attackers > 0;
    }

    return false;
  }

  /**
   * Check for pin opportunity
   */
  private hasPinOpportunity(chess: Chess): boolean {
    // Simplified: check for rook/bishop/queen pinning opportunities
    const moves = chess.moves({ verbose: true });
    const turn = chess.turn();

    for (const move of moves) {
      if (move.piece === 'r' || move.piece === 'b' || move.piece === 'q') {
        const testChess = new Chess(chess.fen());
        testChess.move(move);
        
        // Check if this creates a pin (aligned piece + king)
        if (this.createsPin(testChess, move.to, turn)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Check if a move creates a pin
   */
  private createsPin(_chess: Chess, _square: Square, _color: Color): boolean {
    // Simplified pin detection - placeholder for future implementation
    // Full implementation would check if piece, opponent piece, and king are aligned
    return false; // Placeholder for future tactical enhancement
  }

  /**
   * Count how many opponent pieces a square attacks
   */
  private countPieceAttacks(chess: Chess, square: Square, targetColor: Color): number {
    let count = 0;
    const moves = chess.moves({ verbose: true, square });
    
    for (const move of moves) {
      const targetPiece = chess.get(move.to as Square);
      if (targetPiece && targetPiece.color === targetColor) {
        count++;
      }
    }
    
    return count;
  }

  /**
   * Get piece mobility (number of legal moves)
   */
  private getPieceMobility(chess: Chess, square: Square): number {
    const moves = chess.moves({ verbose: true, square });
    return moves.length;
  }

  /**
   * Get escape squares for king
   */
  private getEscapeSquares(chess: Chess, kingSquare: Square): Square[] {
    const [file, rank] = this.squareToCoords(kingSquare);
    const escapeSquares: Square[] = [];

    for (let df = -1; df <= 1; df++) {
      for (let dr = -1; dr <= 1; dr++) {
        if (df === 0 && dr === 0) continue;
        const newFile = file + df;
        const newRank = rank + dr;
        if (newFile >= 0 && newFile < 8 && newRank >= 0 && newRank < 8) {
          const square = this.coordsToSquare(newFile, newRank);
          // Check if this square is safe
          const testChess = new Chess(chess.fen());
          try {
            testChess.move({ from: kingSquare, to: square });
            escapeSquares.push(square);
          } catch {
            // Move not legal
          }
        }
      }
    }

    return escapeSquares;
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

  /**
   * Get human-readable piece name
   */
  private getPieceName(piece: PieceSymbol): string {
    const names: Record<PieceSymbol, string> = {
      p: 'Pawn',
      n: 'Knight',
      b: 'Bishop',
      r: 'Rook',
      q: 'Queen',
      k: 'King',
    };
    return names[piece];
  }
}
