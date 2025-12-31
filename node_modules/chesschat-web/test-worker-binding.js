/**
 * Automated Worker Binding Test
 * Tests CPU move worker calls on chesschat.uk production
 */

const PRODUCTION_URL = 'https://80bfba41.chesschat-web.pages.dev'; // Latest deployment
const TEST_TIMEOUT = 30000; // 30 seconds

// ANSI colors for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'cyan');
  console.log('='.repeat(60));
}

async function testWorkerBinding() {
  logSection('CHESSCHAT WORKER BINDING TEST');
  log(`Testing: ${PRODUCTION_URL}`, 'yellow');
  log(`Timeout: ${TEST_TIMEOUT}ms\n`, 'yellow');

  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    tests: []
  };

  try {
    // Test 1: Make CPU move request
    logSection('TEST 1: CPU Move Request');
    results.total++;
    
    const movePayload = {
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', // Starting position
      difficulty: 'medium',
      moveNumber: 1
    };

    log('Sending POST request to /api/chess-move...', 'yellow');
    const startTime = Date.now();
    
    const response = await fetch(`${PRODUCTION_URL}/api/chess-move`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(movePayload)
    });

    const responseTime = Date.now() - startTime;
    log(`Response received in ${responseTime}ms`, 'cyan');

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    log('✓ CPU move request successful', 'green');
    results.passed++;
    results.tests.push({ name: 'CPU Move Request', status: 'PASS' });

    // Test 2: Verify worker call log exists
    logSection('TEST 2: Worker Call Log Presence');
    results.total++;

    if (!data.workerCallLog) {
      throw new Error('workerCallLog missing from response');
    }

    log('✓ workerCallLog found in response', 'green');
    results.passed++;
    results.tests.push({ name: 'Worker Call Log Presence', status: 'PASS' });

    // Test 3: Verify worker source (NOT fallback)
    logSection('TEST 3: Worker Source Verification');
    results.total++;

    const workerLog = data.workerCallLog;
    log(`Worker Source: ${workerLog.source}`, 'yellow');

    if (workerLog.source === 'worker') {
      log('✓ Using REAL worker service binding', 'green');
      results.passed++;
      results.tests.push({ name: 'Worker Source', status: 'PASS', detail: 'Real worker binding active' });
    } else if (workerLog.source === 'fallback main_thread') {
      log('✗ Still using fallback (service binding not active)', 'red');
      results.failed++;
      results.tests.push({ name: 'Worker Source', status: 'FAIL', detail: 'Fallback instead of worker' });
    } else {
      log(`⚠ Unexpected source: ${workerLog.source}`, 'yellow');
      results.failed++;
      results.tests.push({ name: 'Worker Source', status: 'FAIL', detail: `Unknown source: ${workerLog.source}` });
    }

    // Test 4: Verify worker call metadata
    logSection('TEST 4: Worker Call Metadata');
    results.total++;

    const requiredFields = ['endpoint', 'method', 'success', 'latency', 'timestamp'];
    const missingFields = requiredFields.filter(field => !(field in workerLog));

    if (missingFields.length > 0) {
      log(`✗ Missing fields: ${missingFields.join(', ')}`, 'red');
      results.failed++;
      results.tests.push({ name: 'Worker Metadata', status: 'FAIL', detail: `Missing: ${missingFields.join(', ')}` });
    } else {
      log('✓ All required metadata fields present', 'green');
      log(`  Endpoint: ${workerLog.endpoint}`, 'cyan');
      log(`  Method: ${workerLog.method}`, 'cyan');
      log(`  Success: ${workerLog.success}`, 'cyan');
      log(`  Latency: ${workerLog.latency}ms`, 'cyan');
      results.passed++;
      results.tests.push({ name: 'Worker Metadata', status: 'PASS' });
    }

    // Test 5: Verify move metadata
    logSection('TEST 5: Move Metadata');
    results.total++;

    if (workerLog.request && workerLog.request.move) {
      log('✓ Move metadata present', 'green');
      log(`  Move: ${workerLog.request.move}`, 'cyan');
      if (workerLog.request.depthReached) {
        log(`  Depth: ${workerLog.request.depthReached}`, 'cyan');
      }
      if (workerLog.request.evaluation !== undefined) {
        log(`  Eval: ${workerLog.request.evaluation}`, 'cyan');
      }
      results.passed++;
      results.tests.push({ name: 'Move Metadata', status: 'PASS' });
    } else {
      log('✗ Move metadata missing', 'red');
      results.failed++;
      results.tests.push({ name: 'Move Metadata', status: 'FAIL' });
    }

    // Test 6: Verify actual move returned
    logSection('TEST 6: Move Generation');
    results.total++;

    if (data.move && data.move.from && data.move.to) {
      log('✓ Valid move returned', 'green');
      log(`  Move: ${data.move.from} → ${data.move.to}`, 'cyan');
      results.passed++;
      results.tests.push({ name: 'Move Generation', status: 'PASS' });
    } else {
      log('✗ Invalid move data', 'red');
      results.failed++;
      results.tests.push({ name: 'Move Generation', status: 'FAIL' });
    }

  } catch (error) {
    log(`\n✗ TEST FAILED: ${error.message}`, 'red');
    results.failed++;
    results.tests.push({ name: 'Error', status: 'FAIL', detail: error.message });
  }

  // Print summary
  logSection('TEST SUMMARY');
  results.tests.forEach(test => {
    const symbol = test.status === 'PASS' ? '✓' : '✗';
    const color = test.status === 'PASS' ? 'green' : 'red';
    const detail = test.detail ? ` (${test.detail})` : '';
    log(`${symbol} ${test.name}${detail}`, color);
  });

  console.log('\n' + '-'.repeat(60));
  log(`Total Tests: ${results.total}`, 'cyan');
  log(`Passed: ${results.passed}`, 'green');
  log(`Failed: ${results.failed}`, results.failed > 0 ? 'red' : 'green');
  
  const successRate = ((results.passed / results.total) * 100).toFixed(1);
  log(`Success Rate: ${successRate}%`, successRate === '100.0' ? 'green' : 'yellow');
  console.log('-'.repeat(60));

  // Final verdict
  console.log();
  if (results.failed === 0) {
    log('🎉 ALL TESTS PASSED - Worker binding is active!', 'green');
    process.exit(0);
  } else if (results.tests.some(t => t.name === 'Worker Source' && t.status === 'FAIL')) {
    log('⚠️  CRITICAL: Worker binding not active (still using fallback)', 'red');
    log('   → Check Cloudflare service binding configuration', 'yellow');
    process.exit(1);
  } else {
    log('⚠️  SOME TESTS FAILED - Review results above', 'yellow');
    process.exit(1);
  }
}

// Run the test
log('Starting worker binding test...', 'magenta');
setTimeout(() => {
  log('\n✗ TEST TIMEOUT - No response within 30 seconds', 'red');
  process.exit(1);
}, TEST_TIMEOUT);

testWorkerBinding().catch(error => {
  log(`\n✗ FATAL ERROR: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
