/**
 * CPU Move Regression Tests
 * Tests that CPU responds after every player move, especially move 2+
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChessGame } from '../lib/chess';
import { selectCPUMoveWithVault } from '../lib/knowledgeRetrieval';

describe('CPU Move - Regression Tests for Move 2+ Bug', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate legal CPU move after player move 1', async () => {
    const chess = new ChessGame();
    
    // Player makes move 1: e2-e4
    const playerMove = chess.makeMove('e2', 'e4');
    expect(playerMove).not.toBeNull();
    
    // Get all legal moves for CPU (Black)
    const legalMoves: Array<{from: string; to: string}> = [];
    for (let rank = 1; rank <= 8; rank++) {
      for (let file of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
        const square = `${file}${rank}`;
        const piece = chess.getPiece(square);
        if (piece && piece.startsWith('b')) {
          const moves = chess.getLegalMoves(square);
          moves.forEach(to => legalMoves.push({ from: square, to }));
        }
      }
    }

    expect(legalMoves.length).toBeGreaterThan(0);

    // Ensure CPU can select a move
    const result = await selectCPUMoveWithVault(
      chess.getFEN(),
      chess.getPGN(),
      1,
      legalMoves,
      4
    );

    expect(result).toBeDefined();
    expect(result.move).toBeDefined();
    expect(result.move.from).toBeTruthy();
    expect(result.move.to).toBeTruthy();
    expect(result.source).toBeDefined();
  });

  it('should generate legal CPU move after player move 2 (THE BUG)', async () => {
    const chess = new ChessGame();
    
    // Player move 1: e2-e4
    chess.makeMove('e2', 'e4');
    
    // CPU move 1: e7-e5
    chess.makeMove('e7', 'e5');
    
    // Player move 2: Ng1-f3 (THIS IS WHERE THE BUG OCCURRED)
    const playerMove2 = chess.makeMove('g1', 'f3');
    expect(playerMove2).not.toBeNull();
    
    // Get all legal moves for CPU (Black) - should still work after move 2!
    const legalMoves: Array<{from: string; to: string}> = [];
    for (let rank = 1; rank <= 8; rank++) {
      for (let file of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
        const square = `${file}${rank}`;
        const piece = chess.getPiece(square);
        if (piece && piece.startsWith('b')) {
          const moves = chess.getLegalMoves(square);
          moves.forEach(to => legalMoves.push({ from: square, to }));
        }
      }
    }

    expect(legalMoves.length).toBeGreaterThan(0);

    // CPU MUST be able to select move after player's 2nd move
    const result = await selectCPUMoveWithVault(
      chess.getFEN(),
      chess.getPGN(),
      3, // Ply count = 3 (e4, e5, Nf3)
      legalMoves,
      4
    );

    expect(result).toBeDefined();
    expect(result.move).toBeDefined();
    expect(result.move.from).toBeTruthy();
    expect(result.move.to).toBeTruthy();
    
    // Apply the CPU move - should be legal
    const cpuMove = chess.makeMove(result.move.from, result.move.to);
    expect(cpuMove).not.toBeNull();
  });

  it('should continue generating moves for full game (10+ moves)', async () => {
    const chess = new ChessGame();
    const maxMoves = 20;
    
    for (let i = 0; i < maxMoves; i++) {
      const currentTurn = chess.getTurn();
      
      // Get legal moves
      const legalMoves: Array<{from: string; to: string}> = [];
      for (let rank = 1; rank <= 8; rank++) {
        for (let file of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
          const square = `${file}${rank}`;
          const piece = chess.getPiece(square);
          if (piece && piece.startsWith(currentTurn)) {
            const moves = chess.getLegalMoves(square);
            moves.forEach(to => legalMoves.push({ from: square, to }));
          }
        }
      }

      if (legalMoves.length === 0) break; // Game over

      // Select and make move
      const result = await selectCPUMoveWithVault(
        chess.getFEN(),
        chess.getPGN(),
        i,
        legalMoves,
        4
      );

      expect(result).toBeDefined();
      const move = chess.makeMove(result.move.from, result.move.to);
      expect(move).not.toBeNull();

      // Should never get stuck
      expect(chess.getTurn()).toBe(currentTurn === 'w' ? 'b' : 'w');
    }

    // Should have made multiple moves successfully
    expect(chess.getMoveHistory().length).toBeGreaterThanOrEqual(4);
  });

  it('should return move source information', async () => {
    const chess = new ChessGame();
    chess.makeMove('e2', 'e4');
    
    const legalMoves: Array<{from: string; to: string}> = [];
    for (let rank = 1; rank <= 8; rank++) {
      for (let file of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
        const square = `${file}${rank}`;
        const piece = chess.getPiece(square);
        if (piece && piece.startsWith('b')) {
          const moves = chess.getLegalMoves(square);
          moves.forEach(to => legalMoves.push({ from: square, to }));
        }
      }
    }

    const result = await selectCPUMoveWithVault(
      chess.getFEN(),
      chess.getPGN(),
      1,
      legalMoves,
      4
    );

    // Verify source information is included
    expect(result.source).toBeDefined();
    expect(result.source.type).toMatch(/vault_opening|vault_heuristic|engine_fallback/);
    
    if (result.source.details) {
      expect(result.source.details).toBeDefined();
    }
  });

  it('should complete within 2500ms timeout', async () => {
    const chess = new ChessGame();
    chess.makeMove('e2', 'e4');
    
    const legalMoves: Array<{from: string; to: string}> = [];
    for (let rank = 1; rank <= 8; rank++) {
      for (let file of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
        const square = `${file}${rank}`;
        const piece = chess.getPiece(square);
        if (piece && piece.startsWith('b')) {
          const moves = chess.getLegalMoves(square);
          moves.forEach(to => legalMoves.push({ from: square, to }));
        }
      }
    }

    const startTime = Date.now();
    
    const result = await selectCPUMoveWithVault(
      chess.getFEN(),
      chess.getPGN(),
      1,
      legalMoves,
      4
    );

    const elapsed = Date.now() - startTime;
    
    expect(result).toBeDefined();
    expect(elapsed).toBeLessThan(2500); // Should complete before timeout
  }, 3000);
});
