/**
 * CPU Move Functionality Test
 * 
 * Tests CPU move generation with timeout handling and worker call logging
 */

// Test configuration
const TEST_SCENARIOS = [
  {
    name: 'Normal Move (Fast)',
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', // Starting position
    difficulty: 'beginner',
    expectedTime: '<1s'
  },
  {
    name: 'Complex Position (Intermediate)',
    fen: 'r1bqkb1r/pppp1ppp/2n2n2/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4', // Italian opening
    difficulty: 'intermediate',
    expectedTime: '1-3s'
  },
  {
    name: 'Late Game (Advanced)',
    fen: '4k3/8/8/8/8/8/4P3/4K3 w - - 0 1', // King and pawn endgame
    difficulty: 'advanced',
    expectedTime: '2-5s'
  },
  {
    name: 'Timeout Stress Test',
    fen: 'r1bqkb1r/pppp1ppp/2n5/4p3/2B1Pn2/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 5', // Complex middlegame
    difficulty: 'master',
    expectedTime: '5-10s (may timeout)'
  }
];

async function testCPUMove(scenario) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${scenario.name}`);
  console.log(`Expected: ${scenario.expectedTime}`);
  console.log('='.repeat(60));

  const startTime = Date.now();
  
  try {
    const response = await fetch('http://localhost:3001/api/chess-move', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fen: scenario.fen,
        pgn: '',
        difficulty: scenario.difficulty,
        gameId: `test_${Date.now()}`
      })
    });

    const data = await response.json();
    const elapsed = Date.now() - startTime;

    console.log(`\n✅ Response received in ${elapsed}ms`);
    console.log(`\nResponse Details:`);
    console.log(`  - Success: ${data.success}`);
    console.log(`  - Move: ${data.move || 'N/A'}`);
    console.log(`  - Engine: ${data.engine || 'N/A'}`);
    console.log(`  - Difficulty: ${data.difficulty || 'N/A'}`);
    console.log(`  - Latency: ${data.latencyMs || 'N/A'}ms`);

    // Check for worker call log
    if (data.workerCallLog) {
      console.log(`\n🔗 Worker Call Log:`);
      console.log(`  - Endpoint: ${data.workerCallLog.endpoint}`);
      console.log(`  - Method: ${data.workerCallLog.method}`);
      console.log(`  - Success: ${data.workerCallLog.success}`);
      console.log(`  - Latency: ${data.workerCallLog.latencyMs}ms`);
      if (data.workerCallLog.response) {
        console.log(`  - Move: ${data.workerCallLog.response.move || 'N/A'}`);
        console.log(`  - Depth: ${data.workerCallLog.response.depthReached || 'N/A'}`);
        console.log(`  - Eval: ${data.workerCallLog.response.evaluation || 'N/A'}`);
      }
    }

    // Check for debug metadata
    if (data.debug) {
      console.log(`\n🔬 Debug Metadata:`);
      console.log(`  - Depth Reached: ${data.debug.depthReached || 'N/A'}`);
      console.log(`  - Time: ${data.debug.timeMs || 'N/A'}ms`);
      console.log(`  - Complete: ${data.debug.complete ? '✓' : '⚠️ Timed Out'}`);
      console.log(`  - Source: ${data.debug.source || 'N/A'}`);
      if (data.debug.evaluation !== undefined) {
        console.log(`  - Evaluation: ${(data.debug.evaluation / 100).toFixed(2)}`);
      }
    }

    // Timeout detection
    if (elapsed > 10000) {
      console.log(`\n⚠️  WARNING: Response took > 10 seconds`);
    }

    return { success: true, elapsed, data };
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.log(`\n❌ Error after ${elapsed}ms: ${error.message}`);
    return { success: false, elapsed, error: error.message };
  }
}

async function runAllTests() {
  console.log('\n');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║   CPU Move Functionality & Timeout Test Suite            ║');
  console.log('║   Testing Wall-E Chess Engine with Worker Call Logging   ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');

  const results = [];

  for (const scenario of TEST_SCENARIOS) {
    const result = await testCPUMove(scenario);
    results.push({ scenario: scenario.name, ...result });
    
    // Pause between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Summary
  console.log('\n\n');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║                    TEST SUMMARY                           ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('');

  results.forEach((result, idx) => {
    const icon = result.success ? '✅' : '❌';
    const time = `${(result.elapsed / 1000).toFixed(2)}s`;
    console.log(`${icon} ${result.scenario.padEnd(35)} ${time}`);
  });

  const successCount = results.filter(r => r.success).length;
  const avgTime = results.reduce((sum, r) => sum + r.elapsed, 0) / results.length;

  console.log('');
  console.log(`Total Tests: ${results.length}`);
  console.log(`Passed: ${successCount}`);
  console.log(`Failed: ${results.length - successCount}`);
  console.log(`Average Time: ${(avgTime / 1000).toFixed(2)}s`);
  console.log('');

  // Check for timeouts
  const timeouts = results.filter(r => r.elapsed > 10000);
  if (timeouts.length > 0) {
    console.log(`⚠️  ${timeouts.length} test(s) exceeded 10-second threshold`);
  }

  console.log('\n💡 TIP: Open http://localhost:3001 and click the 🔧 debug icon');
  console.log('         to see worker call logs in the debug panel!');
  console.log('');
}

// Run tests
runAllTests().catch(error => {
  console.error('Test suite failed:', error);
  process.exit(1);
});
