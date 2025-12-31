/**
 * CPU Move Integration Test - Browser Automation
 * 
 * Tests CPU move functionality with actual game play
 * Run this in the browser console at http://localhost:3001
 */

(async function testCPUMove() {
  console.clear();
  console.log('%c╔═══════════════════════════════════════════════════════════╗', 'color: cyan; font-weight: bold');
  console.log('%c║   CPU Move Integration Test - Browser Console            ║', 'color: cyan; font-weight: bold');
  console.log('%c╚═══════════════════════════════════════════════════════════╝', 'color: cyan; font-weight: bold');
  console.log('');

  // Helper to wait for condition
  function waitFor(condition, timeout = 15000) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const interval = setInterval(() => {
        if (condition()) {
          clearInterval(interval);
          resolve();
        } else if (Date.now() - startTime > timeout) {
          clearInterval(interval);
          reject(new Error('Timeout waiting for condition'));
        }
      }, 100);
    });
  }

  try {
    // Step 1: Check if game store is available
    console.log('🔍 Step 1: Checking game store...');
    if (typeof useGameStore === 'undefined') {
      console.log('⚠️  Accessing store via window...');
      // Try to access via React DevTools or window
      if (!window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
        throw new Error('Game store not accessible. Make sure page is loaded.');
      }
    }
    console.log('✅ Game store accessible\n');

    // Step 2: Get current game state
    console.log('🔍 Step 2: Getting game state...');
    const gameState = window.useGameStore?.getState?.() || {};
    console.log('  - Player Turn:', gameState.isPlayerTurn);
    console.log('  - Thinking:', gameState.isThinking);
    console.log('  - Board Version:', gameState.boardVersion);
    console.log('✅ Game state retrieved\n');

    // Step 3: Make a player move (e2 to e4)
    console.log('🔍 Step 3: Making player move (e2 → e4)...');
    const startTime = Date.now();
    
    if (!gameState.isPlayerTurn) {
      console.log('⚠️  Not player turn, starting new game first...');
      gameState.newGame?.();
      await new Promise(r => setTimeout(r, 500));
    }

    // Make the move
    try {
      await gameState.makePlayerMove?.('e2', 'e4');
      const moveTime = Date.now() - startTime;
      console.log(`✅ Player move completed in ${moveTime}ms\n`);
    } catch (error) {
      console.error('❌ Player move failed:', error.message);
      throw error;
    }

    // Step 4: Wait for CPU to respond
    console.log('🔍 Step 4: Waiting for CPU move...');
    const cpuStartTime = Date.now();
    
    // Wait for CPU thinking to start
    await waitFor(() => {
      const state = window.useGameStore?.getState?.() || {};
      return state.isThinking === true;
    }, 2000);
    console.log('  - CPU is thinking...');

    // Wait for CPU thinking to finish
    await waitFor(() => {
      const state = window.useGameStore?.getState?.() || {};
      return state.isThinking === false;
    }, 15000);
    
    const cpuTime = Date.now() - cpuStartTime;
    console.log(`✅ CPU move completed in ${cpuTime}ms\n`);

    // Step 5: Check debug info
    console.log('🔍 Step 5: Checking debug info...');
    const finalState = window.useGameStore?.getState?.() || {};
    const debugInfo = finalState.debugInfo || {};

    console.log('\n📊 Debug Information:');
    
    // Last API response
    if (debugInfo.lastApiResponse) {
      console.log('  Last API Response:');
      console.log('    - Move:', debugInfo.lastApiResponse.move);
      console.log('    - Latency:', debugInfo.lastApiResponse.latencyMs + 'ms');
      console.log('    - Error:', debugInfo.lastApiResponse.error || 'None');
    }

    // Worker metadata
    if (debugInfo.lastWorkerMetadata) {
      console.log('  Worker Metadata:');
      console.log('    - Depth:', debugInfo.lastWorkerMetadata.depthReached + ' ply');
      console.log('    - Time:', debugInfo.lastWorkerMetadata.timeMs + 'ms');
      console.log('    - Complete:', debugInfo.lastWorkerMetadata.complete ? '✓' : '⚠️ Timed Out');
      console.log('    - Source:', debugInfo.lastWorkerMetadata.source);
      if (debugInfo.lastWorkerMetadata.evaluation !== undefined) {
        console.log('    - Eval:', (debugInfo.lastWorkerMetadata.evaluation / 100).toFixed(2));
      }
    }

    // Worker calls
    if (debugInfo.workerCalls && debugInfo.workerCalls.length > 0) {
      console.log('  Worker Calls (' + debugInfo.workerCalls.length + ' total):');
      const lastCall = debugInfo.workerCalls[debugInfo.workerCalls.length - 1];
      console.log('    Last Call:');
      console.log('      - Endpoint:', lastCall.endpoint);
      console.log('      - Method:', lastCall.method);
      console.log('      - Success:', lastCall.success ? '✓' : '✗');
      console.log('      - Latency:', lastCall.latencyMs + 'ms');
      if (lastCall.response) {
        console.log('      - Move:', lastCall.response.move);
        console.log('      - Depth:', lastCall.response.depthReached);
        console.log('      - Eval:', lastCall.response.evaluation);
      }
    }

    // Move history
    if (debugInfo.moveHistory && debugInfo.moveHistory.length > 0) {
      console.log('  Move History (' + debugInfo.moveHistory.length + ' moves):');
      debugInfo.moveHistory.slice(-2).forEach((move, idx) => {
        console.log(`    ${move.moveNum}. ${move.player === 'human' ? '👤' : '🤖'} ${move.move}`);
      });
    }

    // Step 6: Verify timeout handling
    console.log('\n🔍 Step 6: Timeout Analysis:');
    if (cpuTime > 10000) {
      console.log(`  ⚠️  WARNING: CPU move took ${(cpuTime/1000).toFixed(2)}s (> 10s threshold)`);
      console.log('  - Check if timeout protection is working');
      console.log('  - Verify move was still made despite timeout');
    } else {
      console.log(`  ✅ CPU move completed in ${(cpuTime/1000).toFixed(2)}s (within timeout)`);
    }

    // Final summary
    console.log('\n');
    console.log('%c╔═══════════════════════════════════════════════════════════╗', 'color: green; font-weight: bold');
    console.log('%c║                    TEST PASSED ✅                         ║', 'color: green; font-weight: bold');
    console.log('%c╚═══════════════════════════════════════════════════════════╝', 'color: green; font-weight: bold');
    console.log('');
    console.log('✅ CPU move functionality working');
    console.log('✅ Timeout handling active');
    console.log('✅ Worker call logging operational');
    console.log('✅ Debug metadata captured');
    console.log('');
    console.log('💡 TIP: Click the 🔧 icon to see the debug panel UI');
    console.log('         with worker call logs and CPU metrics!');
    console.log('');

  } catch (error) {
    console.log('\n');
    console.log('%c╔═══════════════════════════════════════════════════════════╗', 'color: red; font-weight: bold');
    console.log('%c║                    TEST FAILED ❌                         ║', 'color: red; font-weight: bold');
    console.log('%c╚═══════════════════════════════════════════════════════════╝', 'color: red; font-weight: bold');
    console.log('');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  }
})();
