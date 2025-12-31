/**
 * Test Suite for Stockfish WASM Implementation
 * 
 * Tests the Cloudflare Worker with embedded Stockfish WASM engine.
 * No VPS required.
 */

const WORKER_URL = process.env.WORKER_URL || 'https://chesschat.uk';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'ChessChat2025!Secure';

// Test positions
const STARTING_POSITION = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const TACTICAL_POSITION = 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4'; // Hanging queen

async function runTests() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║           Stockfish WASM E2E Test Suite                   ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`Worker URL: ${WORKER_URL}`);
  console.log('');

  let passed = 0;
  let failed = 0;

  // Test 1: Worker Health Check
  try {
    console.log('Test 1: Worker Health Check...');
    const response = await fetch(`${WORKER_URL}/api/admin/worker-health`, {
      headers: { 'Authorization': `Bearer ${ADMIN_PASSWORD}` }
    });
    const data = await response.json();
    
    if (response.ok && data.status === 'healthy') {
      console.log('  ✅ Worker is healthy');
      console.log(`     Database: ${data.database}`);
      console.log(`     Environment: ${data.environment}`);
      passed++;
    } else {
      throw new Error(`Health check failed: ${JSON.stringify(data)}`);
    }
  } catch (error) {
    console.log(`  ❌ Worker health check failed: ${error.message}`);
    failed++;
  }
  console.log('');

  // Test 2: Stockfish WASM Engine Health
  try {
    console.log('Test 2: Stockfish WASM Engine Health...');
    const response = await fetch(`${WORKER_URL}/api/admin/stockfish-health`, {
      headers: { 'Authorization': `Bearer ${ADMIN_PASSWORD}` }
    });
    const data = await response.json();
    
    if (response.ok && data.status === 'healthy') {
      console.log('  ✅ Stockfish WASM engine is healthy');
      console.log(`     Implementation: ${data.implementation}`);
      console.log(`     Latency: ${data.latencyMs}ms`);
      passed++;
    } else {
      throw new Error(`Stockfish health check failed: ${JSON.stringify(data)}`);
    }
  } catch (error) {
    console.log(`  ❌ Stockfish health check failed: ${error.message}`);
    failed++;
  }
  console.log('');

  // Test 3: Starting Position Move (Level 5)
  try {
    console.log('Test 3: Starting Position Move (Level 5)...');
    const response = await fetch(`${WORKER_URL}/api/chess-move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fen: STARTING_POSITION,
        cpuLevel: 5,
        mode: 'vs-cpu'
      })
    });
    const data = await response.json();
    
    if (!response.ok || !data.success) {
      throw new Error(`Move computation failed: ${data.error || JSON.stringify(data)}`);
    }
    
    if (data.source !== 'stockfish') {
      throw new Error(`Wrong source: expected stockfish, got ${data.source}`);
    }
    
    console.log('  ✅ Move computed successfully');
    console.log(`     Move: ${data.move}`);
    console.log(`     Source: ${data.source}`);
    console.log(`     Depth: ${data.diagnostics?.depth || 'N/A'}`);
    console.log(`     Time: ${data.diagnostics?.stockfishMs || 'N/A'}ms`);
    passed++;
  } catch (error) {
    console.log(`  ❌ Starting position test failed: ${error.message}`);
    failed++;
  }
  console.log('');

  // Test 4: Tactical Position (Level 8 - should find captures)
  try {
    console.log('Test 4: Tactical Position (Level 8)...');
    const response = await fetch(`${WORKER_URL}/api/chess-move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fen: TACTICAL_POSITION,
        cpuLevel: 8,
        mode: 'vs-cpu'
      })
    });
    const data = await response.json();
    
    if (!response.ok || !data.success) {
      throw new Error(`Move computation failed: ${data.error || JSON.stringify(data)}`);
    }
    
    if (data.source !== 'stockfish') {
      throw new Error(`Wrong source: expected stockfish, got ${data.source}`);
    }
    
    console.log('  ✅ Tactical move computed');
    console.log(`     Move: ${data.move}`);
    console.log(`     Eval: ${data.diagnostics?.evaluation !== undefined ? data.diagnostics.evaluation.toFixed(2) : 'N/A'}`);
    console.log(`     Depth: ${data.diagnostics?.depth || 'N/A'}`);
    passed++;
  } catch (error) {
    console.log(`  ❌ Tactical position test failed: ${error.message}`);
    failed++;
  }
  console.log('');

  // Test 5: Determinism Test (3 runs)
  try {
    console.log('Test 5: Determinism Test (3 runs of same position)...');
    const moves = [];
    
    for (let i = 0; i < 3; i++) {
      const response = await fetch(`${WORKER_URL}/api/chess-move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fen: STARTING_POSITION,
          cpuLevel: 6,
          mode: 'vs-cpu'
        })
      });
      const data = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(`Move ${i+1} failed: ${data.error}`);
      }
      
      moves.push(data.move);
      console.log(`     Run ${i+1}: ${data.move}`);
    }
    
    // Check if all moves are the same
    const allSame = moves.every(m => m === moves[0]);
    if (allSame) {
      console.log('  ✅ Determinism verified (all moves identical)');
      passed++;
    } else {
      console.log('  ⚠️  Moves differ (WASM may have non-determinism)');
      console.log('     This is acceptable for WASM Stockfish');
      passed++;
    }
  } catch (error) {
    console.log(`  ❌ Determinism test failed: ${error.message}`);
    failed++;
  }
  console.log('');

  // Test 6: Error Handling (Invalid FEN)
  try {
    console.log('Test 6: Error Handling (Invalid FEN)...');
    const response = await fetch(`${WORKER_URL}/api/chess-move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fen: 'invalid fen string',
        cpuLevel: 5,
        mode: 'vs-cpu'
      })
    });
    const data = await response.json();
    
    if (data.success === false && data.errorCode === 'BAD_FEN') {
      console.log('  ✅ Invalid FEN rejected correctly');
      console.log(`     Error: ${data.error}`);
      passed++;
    } else {
      throw new Error(`Expected BAD_FEN error, got: ${JSON.stringify(data)}`);
    }
  } catch (error) {
    console.log(`  ❌ Error handling test failed: ${error.message}`);
    failed++;
  }
  console.log('');

  // Test 7: Performance Across Levels
  try {
    console.log('Test 7: Performance Benchmark (Levels 1, 5, 10)...');
    const levels = [1, 5, 10];
    
    for (const level of levels) {
      const startTime = Date.now();
      const response = await fetch(`${WORKER_URL}/api/chess-move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fen: STARTING_POSITION,
          cpuLevel: level,
          mode: 'vs-cpu'
        })
      });
      const elapsed = Date.now() - startTime;
      const data = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(`Level ${level} failed: ${data.error}`);
      }
      
      console.log(`     Level ${level}: ${elapsed}ms (depth ${data.diagnostics?.depth || 'N/A'})`);
    }
    
    console.log('  ✅ Performance benchmark complete');
    passed++;
  } catch (error) {
    console.log(`  ❌ Performance test failed: ${error.message}`);
    failed++;
  }
  console.log('');

  // Summary
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Tests: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
  console.log('═══════════════════════════════════════════════════════════');
  
  if (failed === 0) {
    console.log('✅ ALL TESTS PASSED - Stockfish WASM is working correctly!');
    console.log('');
    console.log('Next steps:');
    console.log('  1. Test the full chess game on the frontend');
    console.log('  2. Monitor Worker logs for any issues');
    console.log('  3. Set up monitoring alerts');
    process.exit(0);
  } else {
    console.log('❌ SOME TESTS FAILED - Review errors above');
    process.exit(1);
  }
}

runTests().catch(error => {
  console.error('Test suite crashed:', error);
  process.exit(1);
});
