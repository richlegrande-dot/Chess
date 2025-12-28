/**
 * Simple Worker Binding Test
 * Tests if CPU moves are using worker service vs local fallback
 * by measuring response times and checking for service binding indicators
 */

const PRODUCTION_URL = 'https://chesschat.uk';

async function testWorkerBinding() {
  console.log('\n='.repeat(60));
  console.log('SIMPLE WORKER BINDING TEST');
  console.log('='.repeat(60));
  console.log(`Testing: ${PRODUCTION_URL}`);
  console.log(`Time: ${new Date().toLocaleTimeString()}\n`);

  const results = [];

  try {
    // Test with 3 different positions to get average timing
    const testPositions = [
      { name: 'Opening', fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' },
      { name: 'Mid-game', fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3' },
      { name: 'Late-game', fen: 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1' }
    ];

    for (const test of testPositions) {
      console.log(`\n📍 Testing ${test.name} position...`);
      
      const startTime = Date.now();
      const response = await fetch(`${PRODUCTION_URL}/api/chess-move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fen: test.name,
          difficulty: 'medium',
          moveNumber: 1
        })
      });

      const latency = Date.now() - startTime;
      const data = await response.json();

      if (data.success) {
        console.log(`  ✓ Move: ${data.move}`);
        console.log(`  ⏱️  Latency: ${latency}ms`);
        console.log(`  🔧 Engine: ${data.engine}`);
        
        // Check for service binding indicators
        if (data.mode) console.log(`  🔗 Mode: ${data.mode}`);
        if (data.workerCallLog) console.log(`  📊 Worker Log: PRESENT`);
        
        results.push({
          position: test.name,
          latency,
          success: true,
          mode: data.mode || 'unknown'
        });
      } else {
        console.log(`  ✗ Failed: ${data.error}`);
        results.push({ position: test.name, latency, success: false });
      }
    }

    // Analysis
    console.log('\n' + '='.repeat(60));
    console.log('ANALYSIS');
    console.log('='.repeat(60));

    const avgLatency = results.reduce((sum, r) => sum + r.latency, 0) / results.length;
    console.log(`\nAverage Response Time: ${avgLatency.toFixed(0)}ms`);

    // Interpret timing (worker should be < 500ms, local fallback typically > 1000ms)
    if (avgLatency < 500) {
      console.log('✅ LIKELY USING WORKER SERVICE BINDING (fast response)');
    } else if (avgLatency < 2000) {
      console.log('⚠️  UNCLEAR - Could be either worker or optimized fallback');
    } else {
      console.log('❌ LIKELY USING LOCAL FALLBACK (slow response)');
    }

    // Check for explicit mode indicator
    const modes = results.map(r => r.mode).filter(m => m !== 'unknown');
    if (modes.length > 0) {
      console.log(`\nMode indicators found: ${modes.join(', ')}`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('RECOMMENDATION');
    console.log('='.repeat(60));
    console.log('\nTo definitively verify worker binding:');
    console.log('1. Open https://chesschat.uk');
    console.log('2. Start a game vs CPU (any difficulty)');
    console.log('3. Make a move');
    console.log('4. Open browser DevTools (F12) → Network tab');
    console.log('5. Find the "/api/chess-move" request');
    console.log('6. Check response for "mode" or "workerCallLog" fields');
    console.log('');

  } catch (error) {
    console.error(`\n❌ ERROR: ${error.message}`);
    process.exit(1);
  }
}

testWorkerBinding();
