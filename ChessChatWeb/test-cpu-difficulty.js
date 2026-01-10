/**
 * Test CPU Difficulty Variations
 * 
 * This script tests that different CPU levels produce different moves/strengths.
 * After the fix, Level 1 should play weaker than Level 8.
 */

const API_KEY = process.env.STOCKFISH_API_KEY || 'development-key-change-in-production';
const BASE_URL = process.env.STOCKFISH_SERVER_URL || 'http://localhost:3001';

// Test position: Italian Game after 1.e4 e5 2.Nf3 Nc6 3.Bc4
const TEST_FEN = 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3';

async function testLevel(level) {
  console.log(`\n[TEST] CPU Level ${level}`);
  console.log('═'.repeat(50));
  
  try {
    const startTime = Date.now();
    const response = await fetch(`${BASE_URL}/compute-move`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        fen: TEST_FEN,
        cpuLevel: level
      })
    });
    
    const duration = Date.now() - startTime;
    const data = await response.json();
    
    if (!data.success) {
      console.error(`✗ Level ${level} FAILED:`, data.error);
      return null;
    }
    
    const diagnostics = data.diagnostics || {};
    
    console.log('✓ Status:', response.status);
    console.log('✓ Move (UCI):', data.move);
    console.log('✓ Move (SAN):', data.san || 'N/A');
    console.log('✓ Skill Level:', diagnostics.skillLevel);
    console.log('✓ Search Depth:', diagnostics.depth);
    console.log('✓ Actual Depth:', diagnostics.actualDepth || 'N/A');
    console.log('✓ Evaluation (cp):', diagnostics.evalCp);
    console.log('✓ Nodes:', diagnostics.nodes?.toLocaleString() || 'N/A');
    console.log('✓ Engine Time:', diagnostics.engineMs + 'ms');
    console.log('✓ Total Time:', duration + 'ms');
    
    return {
      level,
      move: data.move,
      san: data.san,
      skillLevel: diagnostics.skillLevel,
      depth: diagnostics.depth,
      actualDepth: diagnostics.actualDepth,
      evalCp: diagnostics.evalCp,
      nodes: diagnostics.nodes,
      engineMs: diagnostics.engineMs,
      totalMs: duration
    };
  } catch (error) {
    console.error(`✗ Level ${level} FAILED:`, error.message);
    return null;
  }
}

async function compareAllLevels() {
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║      CPU Difficulty Variation Test - Post-Fix Verification      ║');
  console.log('╠══════════════════════════════════════════════════════════════════╣');
  console.log(`║  Server: ${BASE_URL.padEnd(55)} ║`);
  console.log(`║  Position: Italian Game (after 3.Bc4)                            ║`);
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  
  // Test key levels: 1 (weakest), 5 (medium), 8 (strongest)
  const levels = [1, 5, 8];
  const results = [];
  
  for (const level of levels) {
    const result = await testLevel(level);
    if (result) {
      results.push(result);
    }
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n╔══════════════════════════════════════════════════════════════════╗');
  console.log('║                        Comparison Table                          ║');
  console.log('╠══════════════════════════════════════════════════════════════════╣');
  console.log('║ Level │ Skill │ Depth │ Nodes      │ Time(ms) │ Move           ║');
  console.log('╠═══════╪═══════╪═══════╪════════════╪══════════╪════════════════╣');
  
  results.forEach(r => {
    const level = r.level.toString().padEnd(5);
    const skill = (r.skillLevel || 'N/A').toString().padEnd(5);
    const depth = (r.actualDepth || r.depth || 'N/A').toString().padEnd(5);
    const nodes = (r.nodes?.toLocaleString() || 'N/A').padEnd(10);
    const time = r.engineMs.toString().padEnd(8);
    const move = (r.san || r.move || 'N/A').padEnd(14);
    console.log(`║ ${level} │ ${skill} │ ${depth} │ ${nodes} │ ${time} │ ${move} ║`);
  });
  
  console.log('╚═══════╧═══════╧═══════╧════════════╧══════════╧════════════════╝');
  
  // Analysis
  console.log('\n╔══════════════════════════════════════════════════════════════════╗');
  console.log('║                          Analysis                                ║');
  console.log('╠══════════════════════════════════════════════════════════════════╣');
  
  if (results.length < 3) {
    console.log('║  ⚠️  INCOMPLETE: Not all levels tested successfully             ║');
    console.log('╚══════════════════════════════════════════════════════════════════╝');
    return false;
  }
  
  const [level1, level5, level8] = results;
  
  // Check 1: Different skill levels configured
  const skillLevelsUnique = new Set(results.map(r => r.skillLevel)).size === 3;
  console.log(`║  Skill Levels Differentiated: ${skillLevelsUnique ? '✓ YES' : '✗ NO'}                       ║`);
  
  // Check 2: Increasing computation (nodes/time)
  const nodesIncreasing = level1.nodes < level5.nodes && level5.nodes < level8.nodes;
  console.log(`║  Computation Increases (Lv1→8): ${nodesIncreasing ? '✓ YES' : '✗ NO'}                     ║`);
  
  // Check 3: Different moves (at least one difference)
  const movesSet = new Set(results.map(r => r.move));
  const movesDiffer = movesSet.size > 1;
  console.log(`║  Different Moves Produced: ${movesDiffer ? '✓ YES' : '✗ NO'}                          ║`);
  
  // Check 4: Depth scaling
  const depthIncreasing = level1.depth <= level5.depth && level5.depth <= level8.depth;
  console.log(`║  Depth Scales Appropriately: ${depthIncreasing ? '✓ YES' : '✗ NO'}                       ║`);
  
  console.log('╠══════════════════════════════════════════════════════════════════╣');
  
  const allPassed = skillLevelsUnique && nodesIncreasing && depthIncreasing;
  
  if (allPassed) {
    console.log('║                                                                  ║');
    console.log('║  ✅ FIX VERIFIED: CPU levels are properly differentiated!        ║');
    console.log('║                                                                  ║');
    console.log('║  • Each level uses its configured Skill Level                    ║');
    console.log('║  • Higher levels compute deeper and longer                       ║');
    console.log('║  • Difficulty progression is working correctly                   ║');
    console.log('║                                                                  ║');
  } else {
    console.log('║                                                                  ║');
    console.log('║  ⚠️  ISSUE DETECTED: Some tests failed                          ║');
    console.log('║                                                                  ║');
    if (!skillLevelsUnique) {
      console.log('║  • Skill levels not properly differentiated                      ║');
    }
    if (!nodesIncreasing) {
      console.log('║  • Computation not scaling with difficulty                       ║');
    }
    if (!depthIncreasing) {
      console.log('║  • Search depth not increasing properly                          ║');
    }
    console.log('║                                                                  ║');
  }
  
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  
  // Show expected vs actual
  console.log('\n╔══════════════════════════════════════════════════════════════════╗');
  console.log('║                    Expected Configuration                        ║');
  console.log('╠══════════════════════════════════════════════════════════════════╣');
  console.log('║  Level 1: Skill=0,  Depth=4,  Time=150ms  (~800 ELO, Beginner)  ║');
  console.log('║  Level 5: Skill=10, Depth=10, Time=700ms  (~1600 ELO, Medium)   ║');
  console.log('║  Level 8: Skill=17, Depth=16, Time=2000ms (~2200 ELO, Expert)   ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  
  return allPassed;
}

async function quickHealthCheck() {
  console.log('\n[PRE-CHECK] Testing server availability...');
  try {
    const response = await fetch(`${BASE_URL}/health`, { 
      signal: AbortSignal.timeout(5000) 
    });
    const data = await response.json();
    
    if (data.status === 'healthy') {
      console.log('✓ Server is healthy and ready');
      return true;
    } else {
      console.error('✗ Server returned unhealthy status');
      return false;
    }
  } catch (error) {
    console.error('✗ Server not reachable:', error.message);
    console.log('\nℹ️  If testing production server:');
    console.log('   1. Check Render.com deployment status');
    console.log('   2. Verify URL is correct');
    console.log('   3. Wait for cold start (~30-60s first request)');
    console.log('\nℹ️  If testing locally:');
    console.log('   1. Start server: cd stockfish-server && npm start');
    console.log('   2. Verify it\'s running on http://localhost:3001');
    return false;
  }
}

// Main execution
(async () => {
  const isHealthy = await quickHealthCheck();
  
  if (!isHealthy) {
    console.log('\n❌ Server health check failed. Cannot proceed with tests.');
    process.exit(1);
  }
  
  const success = await compareAllLevels();
  
  process.exit(success ? 0 : 1);
})().catch(error => {
  console.error('\n💥 Test suite crashed:', error);
  process.exit(1);
});
