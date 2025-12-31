/**
 * test-learning-e2e.js
 * 
 * End-to-end tests for Learning Layer V3.
 * 
 * Usage:
 *   node test-learning-e2e.js [BASE_URL] [ADMIN_PASSWORD]
 * 
 * Example:
 *   node test-learning-e2e.js https://chesschat.uk mypassword
 */

const BASE_URL = process.argv[2] || 'http://localhost:8787';
const ADMIN_PASSWORD = process.argv[3] || process.env.ADMIN_PASSWORD || 'test-password';

const TEST_USER = 'e2e-test-user-' + Date.now();
const TEST_GAME_ID = 'e2e-game-' + Date.now();

// Test PGN
const TEST_PGN = `[Event "E2E Test"]
[Site "Test"]
[Date "2025.12.30"]
[White "Player"]
[Black "Opponent"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. b4 Bxb4 5. c3 Ba5 6. d4 exd4 7. O-O dxc3 8. Qb3 Qe7 9. Nxc3 Nf6 10. Nd5 Nxd5 11. exd5 Ne5 12. Nxe5 Qxe5 13. Bb2 Qg5 14. h4 Qxh4 15. Bxg7 Rg8 16. Rfe1+ Kd8 17. Qf7 1-0`;

let testResults = [];

function pass(test, message) {
  testResults.push({ test, status: 'PASS', message });
  console.log(`✅ ${test}: ${message}`);
}

function fail(test, message) {
  testResults.push({ test, status: 'FAIL', message });
  console.error(`❌ ${test}: ${message}`);
}

function info(message) {
  console.log(`ℹ️  ${message}`);
}

// Test 1: Health Check
async function testHealthCheck() {
  info('\n=== Test 1: Health Check ===');
  
  try {
    const response = await fetch(`${BASE_URL}/api/admin/learning-health`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${ADMIN_PASSWORD}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.status === 401) {
      fail('Health Check', 'Unauthorized - check ADMIN_PASSWORD');
      return false;
    }

    const data = await response.json();

    if (!response.ok) {
      fail('Health Check', `HTTP ${response.status}: ${data.error || 'Unknown error'}`);
      return false;
    }

    if (!data.success) {
      fail('Health Check', 'Response success=false');
      return false;
    }

    if (typeof data.tables !== 'object') {
      fail('Health Check', 'Missing tables object');
      return false;
    }

    pass('Health Check', `Status: ${data.status}, Tables accessible`);
    info(`  Config: enabled=${data.config.enabled}, readonly=${data.config.readonly}, shadow=${data.config.shadowMode}`);
    return true;

  } catch (error) {
    fail('Health Check', error.message);
    return false;
  }
}

// Test 2: Game Ingestion
async function testGameIngestion() {
  info('\n=== Test 2: Game Ingestion ===');
  
  try {
    const response = await fetch(`${BASE_URL}/api/learning/ingest-game`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: TEST_USER,
        gameId: TEST_GAME_ID,
        pgn: TEST_PGN,
      }),
    });

    const data = await response.json();

    // Handle disabled state
    if (response.status === 503 && data.disabled) {
      info('  System is disabled (expected if not yet enabled)');
      pass('Game Ingestion', 'Correctly returns disabled response');
      return 'disabled';
    }

    // Handle read-only state
    if (response.status === 403 && data.readonly) {
      info('  System is read-only');
      pass('Game Ingestion', 'Correctly blocks writes in read-only mode');
      return 'readonly';
    }

    // Handle partial response
    if (response.status === 202 && data.partial) {
      info('  Partial ingestion (timeout/error)');
      pass('Game Ingestion', 'Partial response handled');
      return 'partial';
    }

    if (!response.ok) {
      fail('Game Ingestion', `HTTP ${response.status}: ${data.error || 'Unknown error'}`);
      return false;
    }

    if (!data.requestId) {
      fail('Game Ingestion', 'Missing requestId');
      return false;
    }

    pass('Game Ingestion', `Success, ${data.conceptsUpdated?.length || 0} concepts updated`);
    info(`  Request ID: ${data.requestId}`);
    info(`  Shadow mode: ${data.shadowMode}`);
    return 'success';

  } catch (error) {
    fail('Game Ingestion', error.message);
    return false;
  }
}

// Test 3: Practice Plan
async function testPracticePlan() {
  info('\n=== Test 3: Practice Plan ===');
  
  try {
    const response = await fetch(`${BASE_URL}/api/learning/plan?userId=${encodeURIComponent(TEST_USER)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    // Handle disabled state
    if (response.status === 503 && data.disabled) {
      info('  System is disabled');
      pass('Practice Plan', 'Correctly returns disabled response');
      return 'disabled';
    }

    if (!response.ok) {
      fail('Practice Plan', `HTTP ${response.status}: ${data.error || 'Unknown error'}`);
      return false;
    }

    if (!data.requestId) {
      fail('Practice Plan', 'Missing requestId');
      return false;
    }

    if (!data.plan) {
      fail('Practice Plan', 'Missing plan object');
      return false;
    }

    const targetCount = data.plan.targets?.length || 0;
    pass('Practice Plan', `Retrieved plan with ${targetCount} targets`);
    
    if (targetCount > 0) {
      info(`  Sample target: ${data.plan.targets[0].conceptId}`);
    } else {
      info('  No targets (user may be new or in shadow mode)');
    }
    
    return 'success';

  } catch (error) {
    fail('Practice Plan', error.message);
    return false;
  }
}

// Test 4: Postgame Narrative
async function testPostgameNarrative() {
  info('\n=== Test 4: Postgame Narrative ===');
  
  try {
    const response = await fetch(`${BASE_URL}/api/walle/postgame`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: TEST_USER,
        gameId: TEST_GAME_ID,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      fail('Postgame Narrative', `HTTP ${response.status}: ${data.error || 'Unknown error'}`);
      return false;
    }

    if (!data.narrative) {
      fail('Postgame Narrative', 'Missing narrative');
      return false;
    }

    if (typeof data.narrative !== 'string' || data.narrative.length === 0) {
      fail('Postgame Narrative', 'Invalid narrative');
      return false;
    }

    pass('Postgame Narrative', `Received narrative (${data.narrative.length} chars)`);
    
    if (data.fallback) {
      info('  Using fallback mode (system disabled)');
    }
    
    if (data.insufficientHistory) {
      info('  Insufficient history disclaimer');
    }
    
    return 'success';

  } catch (error) {
    fail('Postgame Narrative', error.message);
    return false;
  }
}

// Main test runner
async function runAllTests() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║       Learning Layer V3 - E2E Test Suite              ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log(`\nBase URL: ${BASE_URL}`);
  console.log(`Test User: ${TEST_USER}\n`);

  const results = {
    healthCheck: await testHealthCheck(),
    gameIngestion: await testGameIngestion(),
    practicePlan: await testPracticePlan(),
    postgameNarrative: await testPostgameNarrative(),
  };

  // Summary
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║                    TEST SUMMARY                        ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  const passed = testResults.filter(r => r.status === 'PASS').length;
  const failed = testResults.filter(r => r.status === 'FAIL').length;
  const total = testResults.length;

  testResults.forEach(result => {
    const icon = result.status === 'PASS' ? '✅' : '❌';
    console.log(`${icon} ${result.test}`);
  });

  console.log(`\nTotal: ${total} tests`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) {
    console.log('\n❌ Some tests failed');
    process.exit(1);
  } else {
    console.log('\n✅ All tests passed');
    process.exit(0);
  }
}

// Run tests
runAllTests().catch(error => {
  console.error('\n❌ Test suite crashed:', error.message);
  process.exit(1);
});
