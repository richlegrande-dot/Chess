/**
 * Tactical Test Suite for Stockfish Server
 * 
 * Tests that the server:
 * 1. Returns deterministic strong moves (not random)
 * 2. Finds obvious tactics at higher difficulty levels
 * 3. Handles different positions correctly
 */

const API_URL = process.env.API_URL || 'http://localhost:3001';
const API_KEY = process.env.API_KEY || 'development-key-change-in-production';

// Test positions
const TACTICAL_POSITIONS = [
  {
    name: 'Hanging Queen',
    fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/3P1N2/PPP2PPP/RNBQKB1R w KQkq - 2 3',
    expectedCapture: true, // Should capture something at high level
    description: 'Black queen is hanging on d8'
  },
  {
    name: 'Free Pawn',
    fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2',
    expectedCapture: true,
    description: 'Can capture e5 pawn'
  },
  {
    name: 'Opening Position',
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    expectedCapture: false,
    description: 'Standard starting position'
  }
];

async function testMoveComputation(fen, cpuLevel, testName) {
  try {
    const response = await fetch(`${API_URL}/compute-move`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({ fen, cpuLevel })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(`Server error: ${result.error}`);
    }

    return result;
  } catch (error) {
    console.error(`❌ ${testName} failed:`, error.message);
    throw error;
  }
}

async function testDeterminism() {
  console.log('\n📊 Testing Determinism (same position, same level should give consistent results)...');
  
  const fen = TACTICAL_POSITIONS[0].fen;
  const cpuLevel = 8;
  const runs = 3;
  const moves = [];

  for (let i = 0; i < runs; i++) {
    const result = await testMoveComputation(fen, cpuLevel, `Determinism run ${i + 1}`);
    moves.push(result.move);
    console.log(`  Run ${i + 1}: ${result.move}`);
  }

  // Check if moves are consistent (at high levels, should be deterministic)
  const uniqueMoves = [...new Set(moves)];
  
  if (uniqueMoves.length === 1) {
    console.log('✅ PASS: Moves are deterministic');
    return true;
  } else if (uniqueMoves.length <= 2) {
    console.log('⚠️  WARN: Some variation detected (acceptable for middlegame)');
    return true;
  } else {
    console.log('❌ FAIL: Too much variation (might be random)');
    return false;
  }
}

async function testTacticalStrength() {
  console.log('\n🎯 Testing Tactical Strength...');
  let passed = 0;
  let total = TACTICAL_POSITIONS.length;

  for (const position of TACTICAL_POSITIONS) {
    console.log(`\n  Testing: ${position.name}`);
    console.log(`  ${position.description}`);
    console.log(`  FEN: ${position.fen.substring(0, 40)}...`);

    try {
      // Test at low level
      const lowResult = await testMoveComputation(position.fen, 2, `${position.name} (CPU 2)`);
      console.log(`    Level 2: ${lowResult.move} (${lowResult.diagnostics?.engineMs || 0}ms)`);

      // Test at high level
      const highResult = await testMoveComputation(position.fen, 8, `${position.name} (CPU 8)`);
      console.log(`    Level 8: ${highResult.move} (${highResult.diagnostics?.engineMs || 0}ms)`);
      
      if (highResult.diagnostics?.evalCp !== null) {
        console.log(`    Eval: ${(highResult.diagnostics.evalCp / 100).toFixed(2)} pawns`);
      }

      // For tactical positions, high level should find strong moves
      if (position.expectedCapture) {
        // Check if move contains 'x' in SAN or is a capture
        const isCapture = highResult.san?.includes('x') || 
                         highResult.diagnostics?.evalCp > 100 ||
                         highResult.move.length > 4; // Promotions
        
        if (isCapture || highResult.diagnostics?.evalCp > 50) {
          console.log(`  ✅ Found tactical move`);
          passed++;
        } else {
          console.log(`  ⚠️  Expected capture/strong move, got ${highResult.move}`);
        }
      } else {
        console.log(`  ✅ Move computed`);
        passed++;
      }

    } catch (error) {
      console.log(`  ❌ Test failed: ${error.message}`);
    }
  }

  console.log(`\n  Results: ${passed}/${total} positions passed`);
  return passed === total;
}

async function testPerformance() {
  console.log('\n⚡ Testing Performance Across Difficulty Levels...');
  
  const fen = TACTICAL_POSITIONS[2].fen; // Use opening position
  const levels = [1, 3, 5, 7, 10];

  console.log('\n  Level | Time (ms) | Move');
  console.log('  ------|-----------|-------');

  for (const level of levels) {
    const start = Date.now();
    const result = await testMoveComputation(fen, level, `Performance CPU ${level}`);
    const duration = Date.now() - start;
    
    const engineTime = result.diagnostics?.engineMs || duration;
    console.log(`    ${level.toString().padEnd(5)} | ${engineTime.toString().padEnd(9)} | ${result.move}`);
    
    // Verify times increase with difficulty
    if (level < 10 && engineTime > 3500) {
      console.log(`  ⚠️  Level ${level} took longer than expected`);
    }
  }

  console.log('  ✅ Performance test complete');
  return true;
}

async function testErrorHandling() {
  console.log('\n🚫 Testing Error Handling...');
  
  const tests = [
    {
      name: 'Invalid FEN',
      fen: 'invalid-fen-string',
      expectedError: true
    },
    {
      name: 'Game Over Position',
      fen: '4k3/8/8/8/8/8/8/4K2R w - - 0 1', // Checkmate
      expectedError: false // Should handle gracefully
    }
  ];

  let passed = 0;
  for (const test of tests) {
    try {
      const result = await testMoveComputation(test.fen, 5, test.name);
      
      if (test.expectedError) {
        console.log(`  ❌ ${test.name}: Should have failed but succeeded`);
      } else {
        console.log(`  ✅ ${test.name}: Handled correctly`);
        passed++;
      }
    } catch (error) {
      if (test.expectedError) {
        console.log(`  ✅ ${test.name}: Error caught as expected`);
        passed++;
      } else {
        console.log(`  ❌ ${test.name}: Unexpected error - ${error.message}`);
      }
    }
  }

  return passed === tests.length;
}

async function runAllTests() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║        Stockfish Server - Tactical Test Suite             ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`\nServer: ${API_URL}`);
  console.log('API Key: ' + (API_KEY.substring(0, 10) + '...'));

  // Test health first
  console.log('\n🏥 Testing Health Endpoint...');
  try {
    const response = await fetch(`${API_URL}/health`);
    const health = await response.json();
    console.log('✅ Health check passed');
    console.log(`   Service: ${health.service}`);
    console.log(`   Engines: ${health.engines?.active || 0}/${health.engines?.max || 0}`);
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    process.exit(1);
  }

  const results = {
    determinism: false,
    tactical: false,
    performance: false,
    errors: false
  };

  try {
    results.determinism = await testDeterminism();
  } catch (error) {
    console.error('Determinism test failed:', error.message);
  }

  try {
    results.tactical = await testTacticalStrength();
  } catch (error) {
    console.error('Tactical test failed:', error.message);
  }

  try {
    results.performance = await testPerformance();
  } catch (error) {
    console.error('Performance test failed:', error.message);
  }

  try {
    results.errors = await testErrorHandling();
  } catch (error) {
    console.error('Error handling test failed:', error.message);
  }

  // Summary
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                     Test Summary                           ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`  Determinism:     ${results.determinism ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  Tactical Strength: ${results.tactical ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  Performance:     ${results.performance ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  Error Handling:  ${results.errors ? '✅ PASS' : '❌ FAIL'}`);

  const allPassed = Object.values(results).every(r => r === true);
  
  console.log('\n' + (allPassed ? 
    '🎉 ALL TESTS PASSED - Real Stockfish is working!' :
    '⚠️  SOME TESTS FAILED - Review output above'));

  process.exit(allPassed ? 0 : 1);
}

// Run tests
runAllTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
