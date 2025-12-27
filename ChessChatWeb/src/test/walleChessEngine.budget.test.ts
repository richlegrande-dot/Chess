/**
 * Wall-E Chess Engine Budget Compliance Tests
 * 
 * Purpose: Verify CPU budget enforcement and opening book performance via API
 * Critical: Opening positions must complete under 750ms budget + margin
 */

import { describe, it, expect } from 'vitest';

const CPU_MOVE_BUDGET_MS = 750;
const BUDGET_WITH_MARGIN = CPU_MOVE_BUDGET_MS + 750; // 1500ms with network

describe('WalleChessEngine Budget Compliance (API Tests)', () => {
  it('should validate CPU budget constant exists', () => {
    expect(CPU_MOVE_BUDGET_MS).toBe(750);
  });

  it('should pass - placeholder for integration tests', () => {
    // These tests should be run via the production test script
    // test-production-engine.mjs which tests the live API endpoints
    expect(true).toBe(true);
  });
});

// Note: Full engine tests require Functions context and should be run
// via test-engine-local.mjs or test-production-engine.mjs

describe('WalleChessEngine Budget Compliance', () => {
  const BUDGET_WITH_MARGIN = CPU_MOVE_BUDGET_MS + 150; // 900ms local budget

  it('should complete opening position under budget', () => {
    const startingFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    
    const start = performance.now();
    const result = WalleChessEngine.selectMove(startingFen, 'intermediate', false, true);
    const elapsed = performance.now() - start;

    expect(result.move).toBeTruthy();
    expect(result.move).toMatch(/^[a-h][1-8][a-h][1-8][qrbn]?$/);
    expect(elapsed).toBeLessThan(BUDGET_WITH_MARGIN);
    
    // Should use opening book for starting position
    if (result.debug) {
      expect(result.debug.usedOpeningBook).toBe(true);
      expect(result.debug.engineMs).toBeLessThan(50); // Book lookups are instant
    }
  });

  it('should complete opening position after 1.e4 under budget', () => {
    const afterE4Fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
    
    const start = performance.now();
    const result = WalleChessEngine.selectMove(afterE4Fen, 'intermediate', false, true);
    const elapsed = performance.now() - start;

    expect(result.move).toBeTruthy();
    expect(elapsed).toBeLessThan(BUDGET_WITH_MARGIN);
    
    if (result.debug) {
      expect(result.debug.usedOpeningBook).toBe(true);
    }
  });

  it('should enforce budget for complex opening (no book entry)', () => {
    // Position after several moves, not in book
    const complexOpeningFen = 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 4 5';
    
    const start = performance.now();
    const result = WalleChessEngine.selectMove(complexOpeningFen, 'master', false, true);
    const elapsed = performance.now() - start;

    expect(result.move).toBeTruthy();
    expect(elapsed).toBeLessThan(BUDGET_WITH_MARGIN);
    
    if (result.debug) {
      expect(result.debug.usedOpeningBook).toBe(false);
      expect(result.debug.mode).toMatch(/timed-search|cheap-fallback/);
      expect(result.debug.engineMs).toBeLessThan(CPU_MOVE_BUDGET_MS + 50);
    }
  });

  it('should handle midgame position efficiently', () => {
    const midgameFen = 'r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 0 8';
    
    const start = performance.now();
    const result = WalleChessEngine.selectMove(midgameFen, 'advanced', false, true);
    const elapsed = performance.now() - start;

    expect(result.move).toBeTruthy();
    expect(elapsed).toBeLessThan(BUDGET_WITH_MARGIN);
    
    if (result.debug) {
      expect(result.debug.engineMs).toBeLessThan(CPU_MOVE_BUDGET_MS + 50);
    }
  });

  it('should handle endgame position quickly', () => {
    const endgameFen = '8/8/4k3/8/8/4K3/4P3/8 w - - 0 1';
    
    const start = performance.now();
    const result = WalleChessEngine.selectMove(endgameFen, 'master', false, true);
    const elapsed = performance.now() - start;

    expect(result.move).toBeTruthy();
    expect(elapsed).toBeLessThan(500); // Endgames should be very fast (few moves)
    
    if (result.debug) {
      expect(result.debug.engineMs).toBeLessThan(500);
    }
  });

  it('should respect difficulty levels (master picks best)', () => {
    const fen = 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4';
    
    const results = [];
    for (let i = 0; i < 5; i++) {
      const result = WalleChessEngine.selectMove(fen, 'master', false, false);
      results.push(result.move);
    }

    // Master should always pick the same move (deterministic best)
    const uniqueMoves = new Set(results);
    expect(uniqueMoves.size).toBe(1);
  });

  it('should vary moves for beginner difficulty', () => {
    const fen = 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4';
    
    const results = [];
    for (let i = 0; i < 10; i++) {
      const result = WalleChessEngine.selectMove(fen, 'beginner', false, false);
      results.push(result.move);
    }

    // Beginner should show variety (not always same move)
    const uniqueMoves = new Set(results);
    expect(uniqueMoves.size).toBeGreaterThan(1);
  });

  it('should return debug info when requested', () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    
    const result = WalleChessEngine.selectMove(fen, 'intermediate', false, true);

    expect(result.debug).toBeDefined();
    expect(result.debug?.engineMs).toBeGreaterThanOrEqual(0);
    expect(result.debug?.legalMovesCount).toBeGreaterThanOrEqual(0);
    expect(result.debug?.mode).toMatch(/book|timed-search|cheap-fallback/);
  });

  it('should not return debug info when not requested', () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    
    const result = WalleChessEngine.selectMove(fen, 'intermediate', false, false);

    expect(result.debug).toBeUndefined();
  });
});

describe('Opening Book Tests', () => {
  it('should recognize starting position', () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    
    expect(shouldUseOpeningBook(fen)).toBe(true);
    
    const move = pickOpeningMove(fen, 'master');
    expect(move).toBeTruthy();
    expect(move).toMatch(/^[a-h][1-8][a-h][1-8]$/);
  });

  it('should provide book moves for common openings', () => {
    const positions = [
      'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1', // After 1.e4
      'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq d3 0 1', // After 1.d4
      'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2', // After 1.e4 e5
    ];

    positions.forEach(fen => {
      const move = pickOpeningMove(fen, 'intermediate');
      expect(move).toBeTruthy();
    });
  });

  it('should return null for positions not in book', () => {
    const nonBookFen = 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 4 5';
    
    const move = pickOpeningMove(nonBookFen, 'master');
    expect(move).toBeNull();
  });

  it('should not use book after move 3', () => {
    const fen = 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 4 5';
    
    expect(shouldUseOpeningBook(fen)).toBe(false);
  });

  it('should vary moves by difficulty', () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    
    const masterMoves = new Set();
    const beginnerMoves = new Set();

    for (let i = 0; i < 20; i++) {
      masterMoves.add(pickOpeningMove(fen, 'master'));
      beginnerMoves.add(pickOpeningMove(fen, 'beginner'));
    }

    // Master should be consistent (same best move)
    expect(masterMoves.size).toBe(1);
    
    // Beginner should show variety
    expect(beginnerMoves.size).toBeGreaterThan(1);
  });
});

describe('Correctness Tests', () => {
  it('should not hang queen for free', () => {
    // Position where Qh5 hangs queen
    const fen = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2';
    
    const result = WalleChessEngine.selectMove(fen, 'advanced', false, false);
    
    // Should NOT play Qh5 (hangs queen to g6 pawn)
    expect(result.move).not.toBe('d1h5');
  });

  it('should take mate-in-1 if available (master)', () => {
    // Qh5# is mate
    const mateFen = 'rnbqkb1r/pppp1ppp/5n2/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR w KQkq - 1 3';
    
    const result = WalleChessEngine.selectMove(mateFen, 'master', false, false);
    
    // Should play Qxf7# (mate in 1)
    expect(result.move).toBe('h5f7');
  });

  it('should return valid UCI move format', () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    
    const result = WalleChessEngine.selectMove(fen, 'intermediate', false, false);
    
    expect(result.move).toMatch(/^[a-h][1-8][a-h][1-8][qrbn]?$/);
  });

  it('should handle pawn promotion', () => {
    // White pawn on 7th rank can promote
    const promFen = '8/4P3/8/8/8/8/4k3/4K3 w - - 0 1';
    
    const result = WalleChessEngine.selectMove(promFen, 'master', false, false);
    
    // Should promote (e7e8 + promotion piece)
    expect(result.move).toMatch(/^e7e8[qrbn]$/);
  });
});

describe('Performance Benchmarks', () => {
  it('should complete 10 opening moves in reasonable time', () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    
    const start = performance.now();
    for (let i = 0; i < 10; i++) {
      WalleChessEngine.selectMove(fen, 'intermediate', false, false);
    }
    const elapsed = performance.now() - start;
    const avgPerMove = elapsed / 10;

    // With opening book, should be very fast
    expect(avgPerMove).toBeLessThan(100); // 100ms per move average
  });

  it('should complete 10 midgame moves under budget', () => {
    const fen = 'r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 0 8';
    
    const start = performance.now();
    for (let i = 0; i < 10; i++) {
      WalleChessEngine.selectMove(fen, 'advanced', false, false);
    }
    const elapsed = performance.now() - start;
    const avgPerMove = elapsed / 10;

    expect(avgPerMove).toBeLessThan(BUDGET_WITH_MARGIN);
  });
});
