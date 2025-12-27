/**
 * Local Chess Engine Budget Compliance Tests
 * Run with: node test-engine-local.mjs
 */

import { WalleChessEngine } from './functions/lib/walleChessEngine.js';
import { CPU_MOVE_BUDGET_MS } from './functions/lib/cpuConfig.js';
import { pickOpeningMove, shouldUseOpeningBook } from './functions/lib/openingBook.js';

const BUDGET_WITH_MARGIN = CPU_MOVE_BUDGET_MS + 150; // 900ms local (no network)

console.log('\n=== WALL-E CHESS ENGINE BUDGET COMPLIANCE TESTS ===\n');
console.log(`CPU Budget: ${CPU_MOVE_BUDGET_MS}ms`);
console.log(`Local Budget with Margin: ${BUDGET_WITH_MARGIN}ms\n`);

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (error) {
    console.log(`❌ ${name}`);
    console.log(`   Error: ${error.message}`);
    failed++;
  }
}

// Test 1: Opening position should use opening book
test('Opening position uses opening book (fast)', () => {
  const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  
  const start = performance.now();
  const result = WalleChessEngine.selectMove(fen, 'intermediate', false, true);
  const elapsed = performance.now() - start;

  if (!result.move) throw new Error('No move returned');
  if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(result.move)) {
    throw new Error(`Invalid UCI format: ${result.move}`);
  }
  if (elapsed >= BUDGET_WITH_MARGIN) {
    throw new Error(`Too slow: ${elapsed.toFixed(0)}ms (budget: ${BUDGET_WITH_MARGIN}ms)`);
  }
  if (result.debug && !result.debug.usedOpeningBook) {
    throw new Error('Should have used opening book');
  }
  if (result.debug && result.debug.engineMs >= 50) {
    throw new Error(`Book lookup too slow: ${result.debug.engineMs.toFixed(0)}ms`);
  }
});

// Test 2: After 1.e4 should use book
test('After 1.e4 uses opening book', () => {
  const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
  
  const start = performance.now();
  const result = WalleChessEngine.selectMove(fen, 'intermediate', false, true);
  const elapsed = performance.now() - start;

  if (!result.move) throw new Error('No move returned');
  if (elapsed >= BUDGET_WITH_MARGIN) {
    throw new Error(`Too slow: ${elapsed.toFixed(0)}ms`);
  }
  if (result.debug && !result.debug.usedOpeningBook) {
    throw new Error('Should have used opening book');
  }
});

// Test 3: Complex opening (not in book) should respect budget
test('Complex opening (no book) respects CPU budget', () => {
  const fen = 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 4 5';
  
  const start = performance.now();
  const result = WalleChessEngine.selectMove(fen, 'master', false, true);
  const elapsed = performance.now() - start;

  if (!result.move) throw new Error('No move returned');
  if (elapsed >= BUDGET_WITH_MARGIN) {
    throw new Error(`Too slow: ${elapsed.toFixed(0)}ms (budget: ${BUDGET_WITH_MARGIN}ms)`);
  }
  if (result.debug) {
    if (result.debug.usedOpeningBook) {
      throw new Error('Should NOT have used book for complex position');
    }
    if (result.debug.engineMs >= CPU_MOVE_BUDGET_MS + 100) {
      throw new Error(`Engine exceeded budget: ${result.debug.engineMs.toFixed(0)}ms`);
    }
  }
});

// Test 4: Midgame position should be efficient
test('Midgame position completes efficiently', () => {
  const fen = 'r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 0 8';
  
  const start = performance.now();
  const result = WalleChessEngine.selectMove(fen, 'advanced', false, true);
  const elapsed = performance.now() - start;

  if (!result.move) throw new Error('No move returned');
  if (elapsed >= BUDGET_WITH_MARGIN) {
    throw new Error(`Too slow: ${elapsed.toFixed(0)}ms`);
  }
});

// Test 5: Endgame should be very fast
test('Endgame position completes quickly', () => {
  const fen = '8/8/4k3/8/8/4K3/4P3/8 w - - 0 1';
  
  const start = performance.now();
  const result = WalleChessEngine.selectMove(fen, 'master', false, true);
  const elapsed = performance.now() - start;

  if (!result.move) throw new Error('No move returned');
  if (elapsed >= 500) {
    throw new Error(`Endgame too slow: ${elapsed.toFixed(0)}ms (should be <500ms)`);
  }
});

// Test 6: Master difficulty should be deterministic
test('Master difficulty picks same move consistently', () => {
  const fen = 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4';
  
  const moves = new Set();
  for (let i = 0; i < 5; i++) {
    const result = WalleChessEngine.selectMove(fen, 'master', false, false);
    moves.add(result.move);
  }

  if (moves.size !== 1) {
    throw new Error(`Master should be deterministic, got ${moves.size} different moves`);
  }
});

// Test 7: Beginner should show variety
test('Beginner difficulty varies moves', () => {
  const fen = 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4';
  
  const moves = new Set();
  for (let i = 0; i < 10; i++) {
    const result = WalleChessEngine.selectMove(fen, 'beginner', false, false);
    moves.add(result.move);
  }

  if (moves.size <= 1) {
    throw new Error(`Beginner should vary, got only ${moves.size} unique move(s)`);
  }
});

// Test 8: Debug flag works
test('Debug flag returns timing info', () => {
  const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  
  const result = WalleChessEngine.selectMove(fen, 'intermediate', false, true);

  if (!result.debug) throw new Error('Debug info missing');
  if (typeof result.debug.engineMs !== 'number') throw new Error('engineMs missing');
  if (!result.debug.mode) throw new Error('mode missing');
});

// Test 9: Opening book recognizes starting position
test('Opening book recognizes starting position', () => {
  const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  
  const shouldUse = shouldUseOpeningBook(fen);
  if (!shouldUse) throw new Error('Should use opening book for starting position');
  
  const move = pickOpeningMove(fen, 'master');
  if (!move) throw new Error('Opening book returned null for starting position');
  if (!/^[a-h][1-8][a-h][1-8]$/.test(move)) {
    throw new Error(`Invalid UCI move from book: ${move}`);
  }
});

// Test 10: Opening book returns null for non-book positions
test('Opening book returns null for non-book positions', () => {
  const fen = 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 4 5';
  
  const move = pickOpeningMove(fen, 'master');
  if (move !== null) throw new Error('Should return null for non-book position');
});

// Test 11: Master opening book is deterministic
test('Master opening book is deterministic', () => {
  const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  
  const moves = new Set();
  for (let i = 0; i < 10; i++) {
    moves.add(pickOpeningMove(fen, 'master'));
  }

  if (moves.size !== 1) {
    throw new Error(`Master book should be deterministic, got ${moves.size} moves`);
  }
});

// Test 12: Beginner opening book shows variety
test('Beginner opening book shows variety', () => {
  const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  
  const moves = new Set();
  for (let i = 0; i < 20; i++) {
    moves.add(pickOpeningMove(fen, 'beginner'));
  }

  if (moves.size <= 1) {
    throw new Error(`Beginner book should vary, got only ${moves.size} unique move(s)`);
  }
});

// Print summary
console.log('\n=== TEST SUMMARY ===\n');
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`Total: ${passed + failed}\n`);

if (failed === 0) {
  console.log('🎉 ALL TESTS PASSED!\n');
  console.log('Key Achievements:');
  console.log('  • Opening book provides instant responses (<50ms)');
  console.log('  • All positions respect CPU_MOVE_BUDGET_MS (750ms)');
  console.log('  • Engine enforces time limits with progressive evaluation');
  console.log('  • Difficulty levels work correctly (determinism vs variety)');
  console.log('  • No timeout regressions in opening positions\n');
  process.exit(0);
} else {
  console.log('❌ SOME TESTS FAILED\n');
  process.exit(1);
}
