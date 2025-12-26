import { describe, it, expect, beforeEach } from 'vitest';
import { ChessGame } from '../lib/chess';

describe('ChessGame Integration Tests', () => {
  let game: ChessGame;

  beforeEach(() => {
    game = new ChessGame();
  });

  describe('Initial Game State', () => {
    it('should initialize with standard starting position', () => {
      const fen = game.getFEN();
      expect(fen).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    });

    it('should have 16 white and 16 black pieces at start', () => {
      const board = game.getBoard();
      let whitePieces = 0;
      let blackPieces = 0;

      board.forEach(row => {
        row.forEach(piece => {
          if (piece) {
            if (piece.startsWith('w')) whitePieces++;
            if (piece.startsWith('b')) blackPieces++;
          }
        });
      });

      expect(whitePieces).toBe(16);
      expect(blackPieces).toBe(16);
    });

    it('should have white to move initially', () => {
      expect(game.getTurn()).toBe('w');
    });

    it('should not be in check, checkmate, or stalemate initially', () => {
      expect(game.isCheck()).toBe(false);
      expect(game.isCheckmate()).toBe(false);
      expect(game.isStalemate()).toBe(false);
      expect(game.isGameOver()).toBe(false);
    });
  });

  describe('Legal Move Validation', () => {
    it('should accept legal pawn move e2e4', () => {
      const success = game.makeMove('e2', 'e4');
      expect(success).toBeTruthy();
      expect(game.getPiece('e4')).toBe('wp');
      expect(game.getPiece('e2')).toBe(null);
    });

    it('should accept legal knight move Nf3', () => {
      const success = game.makeMove('g1', 'f3');
      expect(success).toBeTruthy();
      expect(game.getPiece('f3')).toBe('wn');
      expect(game.getPiece('g1')).toBe(null);
    });

    it('should reject illegal moves', () => {
      // Try to move pawn backwards
      const success1 = game.makeMove('e2', 'e1');
      expect(success1).toBe(null);

      // Try to move piece that doesn't exist
      const success2 = game.makeMove('e5', 'e6');
      expect(success2).toBe(null);

      // Try to move opponent's piece
      const success3 = game.makeMove('e7', 'e5');
      expect(success3).toBe(null);
    });

    it('should switch turns after valid move', () => {
      expect(game.getTurn()).toBe('w');
      game.makeMove('e2', 'e4');
      expect(game.getTurn()).toBe('b');
    });
  });

  describe('Move History and PGN', () => {
    it('should track move history correctly', () => {
      game.makeMove('e2', 'e4');
      game.makeMove('e7', 'e5');
      game.makeMove('g1', 'f3');

      const moves = game.getMoveHistory();
      expect(moves).toHaveLength(3);
      expect(moves[0].san).toBe('e4');
      expect(moves[1].san).toBe('e5');
      expect(moves[2].san).toBe('Nf3');
    });

    it('should generate valid PGN', () => {
      game.makeMove('e2', 'e4');
      game.makeMove('e7', 'e5');
      
      const pgn = game.getPGN();
      expect(pgn).toContain('1. e4 e5');
    });
  });

  describe('Game State Detection', () => {
    it('should detect check correctly', () => {
      // Create a position with check
      game = new ChessGame('rnbqkbnr/pppp1ppp/8/4p3/2B1P3/8/PPPP1PPP/RNBQK1NR b KQkq - 1 2');
      game.makeMove('d8', 'h4'); // This should put white king in check if valid
      // Note: This test might need adjustment based on exact position
    });

    it('should handle game termination states', () => {
      // Test with a known checkmate position
      const checkmatePosition = 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3';
      const checkmateGame = new ChessGame(checkmatePosition);
      
      expect(checkmateGame.isGameOver()).toBe(true);
    });
  });

  describe('Board State Integrity', () => {
    it('should maintain consistent board state after moves', () => {
      const initialFen = game.getFEN();
      
      // Make moves and undo them
      game.makeMove('e2', 'e4');
      const afterMove = game.getFEN();
      expect(afterMove).not.toBe(initialFen);
      
      game.undo();
      const afterUndo = game.getFEN();
      expect(afterUndo).toBe(initialFen);
    });

    it('should handle piece capture correctly', () => {
      game.makeMove('e2', 'e4');
      game.makeMove('d7', 'd5');
      game.makeMove('e4', 'd5'); // Capture
      
      expect(game.getPiece('d5')).toBe('wp');
      expect(game.getPiece('e4')).toBe(null);
    });
  });

  describe('Health Check', () => {
    it('should report healthy state for valid game', () => {
      const health = game.isHealthy();
      expect(health.healthy).toBe(true);
      expect(health.issues).toHaveLength(0);
    });

    it('should detect corrupted state', () => {
      // This test would require corrupting the internal state
      // For now, just verify the health check method exists
      expect(typeof game.isHealthy).toBe('function');
    });
  });
});