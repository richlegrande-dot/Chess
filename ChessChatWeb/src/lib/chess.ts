// Chess utility functions

import { Chess, Move, Square } from 'chess.js';

export class ChessGame {
  private chess: Chess;

  constructor(fen?: string) {
    this.chess = new Chess(fen);
  }

  // Get current FEN
  getFEN(): string {
    return this.chess.fen();
  }

  // Get PGN history
  getPGN(): string {
    return this.chess.pgn();
  }

  // Get ASCII representation (for debugging)
  getASCII(): string {
    return this.chess.ascii();
  }

  // Make a move (SAN or UCI format)
  makeMove(from: Square, to: Square, promotion?: string): Move | null {
    try {
      return this.chess.move({
        from,
        to,
        promotion: promotion as 'q' | 'r' | 'b' | 'n' | undefined,
      });
    } catch {
      return null;
    }
  }

  // Make a move from UCI format (e.g., "e2e4")
  makeMoveUCI(uci: string): Move | null {
    if (uci.length < 4) return null;

    const from = uci.substring(0, 2) as Square;
    const to = uci.substring(2, 4) as Square;
    const promotion = uci.length === 5 ? uci[4] : undefined;

    return this.makeMove(from, to, promotion);
  }

  // Validate if a move is legal
  isLegalMove(from: Square, to: Square): boolean {
    const moves = this.chess.moves({ square: from, verbose: true });
    return moves.some((move) => move.to === to);
  }

  // Get all legal moves for a square
  getLegalMoves(square: Square): Square[] {
    const moves = this.chess.moves({ square, verbose: true });
    return moves.map((move) => move.to as Square);
  }

  // Check if a move is a pawn promotion
  isPromotionMove(from: Square, to: Square): boolean {
    const piece = this.getPiece(from);
    if (!piece || piece[1] !== 'p') return false; // Not a pawn
    
    const toRank = parseInt(to[1]);
    const isWhitePawn = piece[0] === 'w';
    const isBlackPawn = piece[0] === 'b';
    
    // White pawn reaching rank 8 or black pawn reaching rank 1
    return (isWhitePawn && toRank === 8) || (isBlackPawn && toRank === 1);
  }

  // Check if game is over
  isGameOver(): boolean {
    return this.chess.isGameOver();
  }

  // Check if in checkmate
  isCheckmate(): boolean {
    return this.chess.isCheckmate();
  }

  // Check if in stalemate
  isStalemate(): boolean {
    return this.chess.isStalemate();
  }

  // Check if in draw
  isDraw(): boolean {
    return this.chess.isDraw();
  }

  // Check if in check
  isCheck(): boolean {
    return this.chess.inCheck();
  }

  // Check if insufficient material
  isInsufficientMaterial(): boolean {
    return this.chess.isInsufficientMaterial();
  }

  // Check if threefold repetition
  isThreefoldRepetition(): boolean {
    return this.chess.isThreefoldRepetition();
  }

  // Get current turn
  getTurn(): 'w' | 'b' {
    return this.chess.turn();
  }

  // Get king square for specified color
  getKingSquare(color: 'w' | 'b'): Square {
    const board = this.chess.board();
    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const piece = board[rank][file];
        if (piece && piece.type === 'k' && piece.color === color) {
          return toSquare(file, 7 - rank);
        }
      }
    }
    throw new Error(`King not found for color ${color}`);
  }

  // Get game result
  getGameResult(): string | null {
    if (!this.isGameOver()) return null;

    if (this.isCheckmate()) {
      return this.getTurn() === 'w'
        ? 'Checkmate - Black wins'
        : 'Checkmate - White wins';
    }
    if (this.isStalemate()) return 'Stalemate - Draw';
    if (this.isInsufficientMaterial()) return 'Insufficient material - Draw';
    if (this.isThreefoldRepetition()) return 'Threefold repetition - Draw';
    if (this.isDraw()) return 'Draw';

    return 'Game over';
  }

  // Get board state as 2D array
  getBoard(): (string | null)[][] {
    const board = this.chess.board();
    return board.map((row) =>
      row.map((piece) => (piece ? `${piece.color}${piece.type}` : null))
    );
  }

  // Get piece at square
  getPiece(square: Square): string | null {
    const piece = this.chess.get(square);
    if (!piece) return null;
    return `${piece.color}${piece.type}`;
  }

  // Undo last move
  undo(): Move | null {
    return this.chess.undo();
  }

  // Reset game
  reset(): void {
    this.chess.reset();
  }

  // Health check for chess state corruption
  isHealthy(): { healthy: boolean; issues: string[] } {
    const issues: string[] = [];
    
    try {
      const fen = this.chess.fen();
      const pgn = this.chess.pgn();
      
      // Check FEN validity
      if (!fen || fen.split(' ').length < 4) {
        issues.push('Invalid FEN format');
      }
      
      // Check if position is reachable
      const testGame = new Chess();
      if (pgn && pgn.trim()) {
        try {
          testGame.loadPgn(pgn);
          if (testGame.fen() !== fen) {
            issues.push('PGN does not match current FEN');
          }
        } catch {
          issues.push('PGN is corrupted or invalid');
        }
      }
      
      // Check for impossible piece counts
      const board = this.chess.board();
      let whitePawns = 0, blackPawns = 0;
      let whiteKings = 0, blackKings = 0;
      
      for (const row of board) {
        for (const square of row) {
          if (square?.type === 'p') {
            if (square.color === 'w') whitePawns++;
            else blackPawns++;
          }
          if (square?.type === 'k') {
            if (square.color === 'w') whiteKings++;
            else blackKings++;
          }
        }
      }
      
      if (whitePawns > 8) issues.push('Too many white pawns');
      if (blackPawns > 8) issues.push('Too many black pawns');
      if (whiteKings !== 1) issues.push('Invalid white king count');
      if (blackKings !== 1) issues.push('Invalid black king count');
      
    } catch (error) {
      issues.push(`Chess engine error: ${error}`);
    }
    
    return { healthy: issues.length === 0, issues };
  }

  // Attempt to recover from a corrupted state
  recover(moveHistory: Array<{ move: string; player: 'human' | 'ai' }>): boolean {
    try {
      console.log('[Chess Recovery] Attempting to rebuild game state');
      
      // Start fresh
      this.chess.reset();
      
      // Replay only the moves that work
      const validMoves: string[] = [];
      
      for (const entry of moveHistory) {
        try {
          const result = this.makeMoveUCI(entry.move);
          if (result) {
            validMoves.push(entry.move);
            console.log(`[Chess Recovery] Applied move: ${entry.move}`);
          } else {
            console.warn(`[Chess Recovery] Skipping invalid move: ${entry.move}`);
            break; // Stop at first invalid move
          }
        } catch {
          console.warn(`[Chess Recovery] Failed to apply move: ${entry.move}`);
          break;
        }
      }
      
      const health = this.isHealthy();
      if (health.healthy) {
        console.log(`[Chess Recovery] Successfully recovered with ${validMoves.length} moves`);
        return true;
      } else {
        console.error('[Chess Recovery] Recovery failed, health check failed:', health.issues);
        return false;
      }
      
    } catch (error) {
      console.error('[Chess Recovery] Recovery attempt failed:', error);
      return false;
    }
  }

  // Clone the game state (creates new instance with same position and history)
  clone(): ChessGame {
    const cloned = new ChessGame();
    const pgn = this.chess.pgn();
    const fen = this.chess.fen();
    
    if (pgn && pgn.trim()) {
      // Use PGN if available
      try {
        cloned.loadPGN(pgn);
        
        // Validate that PGN and FEN match
        if (cloned.getFEN() !== fen) {
          console.warn(`[Chess Clone] PGN/FEN mismatch detected. PGN FEN: ${cloned.getFEN()}, Expected: ${fen}`);
          // Fallback to FEN
          cloned.loadFEN(fen);
        }
      } catch (error) {
        console.warn(`[Chess Clone] PGN load failed: ${error}. Using FEN.`);
        // Fallback to FEN if PGN fails
        cloned.loadFEN(fen);
      }
    } else {
      // No moves yet, use FEN to preserve exact position
      cloned.loadFEN(fen);
    }
    
    // Health check the clone
    const health = cloned.isHealthy();
    if (!health.healthy) {
      console.error('[Chess Clone] Cloned instance is unhealthy:', health.issues);
    }
    
    return cloned;
  }

  // Load from FEN
  loadFEN(fen: string): boolean {
    try {
      this.chess.load(fen);
      return true;
    } catch {
      return false;
    }
  }

  // Load from PGN
  loadPGN(pgn: string): boolean {
    try {
      this.chess.loadPgn(pgn);
      return true;
    } catch {
      return false;
    }
  }

  // Get move history
  getMoveHistory(): Move[] {
    return this.chess.history({ verbose: true });
  }

  // Validate UCI move format
  static isValidUCI(move: string): boolean {
    const pattern = /^[a-h][1-8][a-h][1-8][qrbn]?$/;
    return pattern.test(move);
  }
}

// Helper: Convert piece notation to Unicode symbol
export function getPieceSymbol(piece: string | null): string {
  if (!piece) return '';

  const symbols: Record<string, string> = {
    wp: '♙',
    wn: '♘',
    wb: '♗',
    wr: '♖',
    wq: '♕',
    wk: '♔',
    bp: '♟',
    bn: '♞',
    bb: '♝',
    br: '♜',
    bq: '♛',
    bk: '♚',
  };

  return symbols[piece] || '';
}

// Helper: Get square color
export function getSquareColor(square: Square): 'light' | 'dark' {
  const file = square.charCodeAt(0) - 97; // a=0, b=1, ...
  const rank = parseInt(square[1]) - 1; // 1=0, 2=1, ...
  return (file + rank) % 2 === 0 ? 'dark' : 'light';
}

// Helper: Convert row/col to square notation
export function toSquare(row: number, col: number): Square {
  const file = String.fromCharCode(97 + col); // 0=a, 1=b, ...
  const rank = 8 - row; // 0=8, 1=7, ...
  return `${file}${rank}` as Square;
}

// Helper: Convert square to row/col
export function fromSquare(square: Square): [number, number] {
  const file = square.charCodeAt(0) - 97; // a=0, b=1, ...
  const rank = parseInt(square[1]); // 1, 2, ..., 8
  const row = 8 - rank; // 8=0, 7=1, ..., 1=7
  return [row, file];
}
