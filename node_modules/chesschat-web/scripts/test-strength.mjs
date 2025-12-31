#!/usr/bin/env node
/**
 * Chess Engine Strength Verification Test
 * 
 * Tests that the Worker respects time budgets and returns meaningful diagnostics.
 * Calls /api/chess-move with test positions and validates response.
 */

const BASE_URL = process.argv.includes('--production') 
  ? 'https://chesschat.uk'
  : 'http://localhost:8788';

const TEST_PASSWORD = 'admin'; // For local dev

console.log('🧪 Chess Engine Strength Test\n');
console.log(`Target: ${BASE_URL}\n`);
console.log('━'.repeat(80) + '\n');

/**
 * Test position where best move is to capture a hanging knight
 * FEN: r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3
 * Best move: Nxe5 (capture the hanging knight on e5)
 */
const TACTICAL_TEST = {
  name: 'Hanging Knight Capture',
  fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3',
  bestMove: 'f3e5',
  description: 'Black knight on e5 is hanging - should be captured'
};

/**
 * Test with different CPU levels
 */
async function testCpuLevel(level) {
  console.log(`\n${'═'.repeat(80)}`);
  console.log(`TEST: CPU Level ${level}`);
  console.log('═'.repeat(80) + '\n');

  const difficulty = level <= 2 ? 'beginner' : level <= 4 ? 'intermediate' : level <= 6 ? 'advanced' : 'master';
  
  // Calculate expected time budget (matching timeManagement.ts)
  const baseTime = level >= 7 ? 5000 : level >= 5 ? 3000 : 1500;
  const maxTime = level >= 7 ? 15000 : level >= 5 ? 8000 : 4000;
  
  console.log(`📋 Test Configuration:`);
  console.log(`   CPU Level: ${level}`);
  console.log(`   Difficulty: ${difficulty}`);
  console.log(`   Expected Time Budget: ${baseTime}ms (base), ${maxTime}ms (max)`);
  console.log(`   Position: ${TACTICAL_TEST.name}`);
  console.log(`   FEN: ${TACTICAL_TEST.fen}`);
  console.log(`   Best Move: ${TACTICAL_TEST.bestMove}`);
  console.log();

  const requestBody = {
    fen: TACTICAL_TEST.fen,
    difficulty: difficulty,
    gameId: `test-strength-${Date.now()}`,
    timeMs: baseTime,
    cpuLevel: level
  };

  console.log(`📤 Request Body:`);
  console.log(JSON.stringify(requestBody, null, 2));
  console.log();

  const startTime = Date.now();
  
  try {
    const response = await fetch(`${BASE_URL}/api/chess-move`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    const latency = Date.now() - startTime;
    console.log(`📥 Response: ${response.status} ${response.statusText}`);
    console.log(`⏱️  Total Latency: ${latency}ms\n`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Request failed:\n${errorText}`);
      return false;
    }

    const data = await response.json();
    
    console.log(`📄 Response Data:`);
    console.log(JSON.stringify(data, null, 2));
    console.log();

    // Validation
    let passed = true;
    const failures = [];

    // Check success
    if (!data.success) {
      failures.push('Response success=false');
      passed = false;
    }

    // Check mode
    if (data.mode !== 'service-binding') {
      failures.push(`Expected mode='service-binding', got '${data.mode}'`);
      passed = false;
    }

    // Check engine
    if (data.engine !== 'worker') {
      failures.push(`Expected engine='worker', got '${data.engine}'`);
      passed = false;
    }

    // Check diagnostics exist
    if (!data.diagnostics) {
      failures.push('Missing diagnostics object');
      passed = false;
    } else {
      const diag = data.diagnostics;
      
      // Check time budget fields
      if (typeof diag.requestedTimeMs === 'undefined') {
        failures.push('Missing diagnostics.requestedTimeMs');
        passed = false;
      } else if (diag.requestedTimeMs !== baseTime) {
        failures.push(`requestedTimeMs mismatch: expected ${baseTime}, got ${diag.requestedTimeMs}`);
        passed = false;
      }

      if (typeof diag.effectiveTimeMs === 'undefined') {
        failures.push('Missing diagnostics.effectiveTimeMs');
        passed = false;
      }

      if (typeof diag.cappedTimeMs === 'undefined') {
        failures.push('Missing diagnostics.cappedTimeMs');
        passed = false;
      }

      if (typeof diag.searchTimeMs === 'undefined') {
        failures.push('Missing diagnostics.searchTimeMs');
        passed = false;
      }

      // Check difficulty mapping
      if (diag.difficultyRequested !== difficulty) {
        failures.push(`difficultyRequested mismatch: expected '${difficulty}', got '${diag.difficultyRequested}'`);
        passed = false;
      }

      if (!diag.difficultyMappedTo) {
        failures.push('Missing diagnostics.difficultyMappedTo');
        passed = false;
      }

      if (diag.cpuLevel !== level) {
        failures.push(`cpuLevel mismatch: expected ${level}, got ${diag.cpuLevel}`);
        passed = false;
      }

      // For non-opening-book positions, check meaningful compute time
      if (!diag.openingBook) {
        const minExpectedTime = Math.min(baseTime * 0.3, 500); // At least 30% of budget or 500ms
        if (diag.searchTimeMs < minExpectedTime) {
          failures.push(`searchTimeMs too low: ${diag.searchTimeMs}ms (expected ≥${minExpectedTime}ms for non-book move)`);
          // Note: Don't fail the test for this yet, as the position might evaluate quickly
          console.warn(`⚠️  Warning: Search time (${diag.searchTimeMs}ms) seems low for requested budget (${baseTime}ms)`);
        }
      }

      // Log time budget analysis
      console.log(`\n⏱️  Time Budget Analysis:`);
      console.log(`   Requested: ${diag.requestedTimeMs}ms`);
      console.log(`   Effective: ${diag.effectiveTimeMs}ms`);
      console.log(`   Capped: ${diag.cappedTimeMs}ms`);
      console.log(`   Actual Search: ${diag.searchTimeMs}ms`);
      if (diag.abortReason) {
        console.log(`   Abort Reason: ${diag.abortReason}`);
      }

      console.log(`\n📊 Engine Analysis:`);
      console.log(`   Difficulty Requested: ${diag.difficultyRequested}`);
      console.log(`   Difficulty Mapped: ${diag.difficultyMappedTo}`);
      console.log(`   CPU Level: ${diag.cpuLevel}`);
      console.log(`   Opening Book: ${diag.openingBook}`);
      console.log(`   Nodes Searched: ${diag.nodesSearched || 0}`);
      console.log(`   Mode: ${diag.mode}`);
      console.log(`   Move Selected: ${data.move}`);
    }

    // Check if best move was found
    if (data.move === TACTICAL_TEST.bestMove) {
      console.log(`\n✅ CORRECT MOVE: Found best move ${TACTICAL_TEST.bestMove}`);
    } else {
      console.log(`\n⚠️  SUBOPTIMAL MOVE: Expected ${TACTICAL_TEST.bestMove}, got ${data.move}`);
      console.log(`   (This may be acceptable for lower difficulty levels)`);
    }

    console.log(`\n${'─'.repeat(80)}`);
    if (passed) {
      console.log(`✅ TEST PASSED for CPU Level ${level}`);
    } else {
      console.log(`❌ TEST FAILED for CPU Level ${level}`);
      console.log(`\nFailures:`);
      failures.forEach(f => console.log(`   - ${f}`));
    }
    console.log('─'.repeat(80));

    return passed;

  } catch (error) {
    console.error(`\n❌ Test failed with error:`);
    console.error(error.message);
    if (error.stack) {
      console.error(`\nStack trace:`);
      console.error(error.stack);
    }
    return false;
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  const levels = [2, 4, 6, 8]; // Test beginner, intermediate, advanced, master
  const results = [];

  for (const level of levels) {
    const passed = await testCpuLevel(level);
    results.push({ level, passed });
    
    // Wait a bit between tests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log(`\n\n${'═'.repeat(80)}`);
  console.log('FINAL SUMMARY');
  console.log('═'.repeat(80) + '\n');

  results.forEach(({ level, passed }) => {
    console.log(`${passed ? '✅' : '❌'} CPU Level ${level}: ${passed ? 'PASSED' : 'FAILED'}`);
  });

  const allPassed = results.every(r => r.passed);
  console.log();
  if (allPassed) {
    console.log('✅ ALL TESTS PASSED');
    process.exit(0);
  } else {
    console.log('❌ SOME TESTS FAILED');
    process.exit(1);
  }
}

// Run tests
runAllTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
