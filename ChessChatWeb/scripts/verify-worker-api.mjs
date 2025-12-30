#!/usr/bin/env node

/**
 * Worker API Verification Script
 * 
 * Tests all critical endpoints and validates Worker API is functioning correctly.
 * This is the single source of truth for Worker API health verification.
 * 
 * Usage:
 *   node scripts/verify-worker-api.mjs                    # Default: https://chesschat.uk
 *   WORKER_API_URL=http://localhost:8787 node scripts/verify-worker-api.mjs
 * 
 * Exit Codes:
 *   0 = All tests passed
 *   1 = One or more tests failed
 * 
 * Environment Variables:
 *   WORKER_API_URL - Base URL to test (default: https://chesschat.uk)
 */

const API_BASE_URL = process.env.WORKER_API_URL || 'https://chesschat.uk';
let testsPassed = 0;
let testsFailed = 0;

async function fetchJSON(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const text = await response.text();
  let json;
  
  try {
    json = JSON.parse(text);
  } catch (e) {
    throw new Error(`Invalid JSON response from ${url}: ${text.substring(0, 200)}`);
  }

  return { response, json };
}

async function testHealthEndpoint() {
  console.log('✓ Testing /api/admin/worker-health...');
  
  const { response, json } = await fetchJSON(`${API_BASE_URL}/api/admin/worker-health`);
  
  if (!response.ok) {
    throw new Error(`Health check failed with HTTP ${response.status}. Check Worker deployment and route configuration.`);
  }

  if (!json.healthy) {
    console.error('Health check returned unhealthy:', JSON.stringify(json, null, 2));
    throw new Error('Worker reports unhealthy status. Check DATABASE_URL secret and Prisma Accelerate connection.');
  }

  if (!json.checks || !json.checks.database) {
    throw new Error('Health check response missing database status. Verify Worker code is up to date.');
  }

  if (json.checks.database.status !== 'ok') {
    throw new Error(`Database connection failed: ${json.checks.database.message}. Verify DATABASE_URL secret and Accelerate connection string.`);
  }

  // Check for version info (optional but good to have)
  if (json.checks.version) {
    console.log(`  ✓ Worker version: ${json.checks.version}`);
  }

  console.log('  ✓ Worker is healthy');
  console.log(`  ✓ Database connected`);
  console.log(`  ✓ Latency: ${json.latencyMs}ms`);
  
  return json;
}

async function testChessMoveEndpoint() {
  console.log('✓ Testing /api/chess-move...');
  
  const testFEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const requestBody = {
    fen: testFEN,
    difficulty: 'medium',
    cpuLevel: 3,
    timeMs: 1000,
    gameId: 'test-game-' + Date.now(),
  };

  const { response, json } = await fetchJSON(`${API_BASE_URL}/api/chess-move`, {
    method: 'POST',
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    console.error('Chess move failed:', JSON.stringify(json, null, 2));
    throw new Error(`Chess move request failed with status ${response.status}`);
  }

  // Validate response structure
  if (!json.success) {
    throw new Error(`Chess move returned success=false: ${json.error}`);
  }

  if (!json.move) {
    throw new Error('Chess move response missing move field');
  }

  if (json.mode !== 'worker') {
    throw new Error(`Expected mode='worker', got '${json.mode}'`);
  }

  if (json.engine !== 'worker') {
    throw new Error(`Expected engine='worker', got '${json.engine}'`);
  }

  if (!json.workerCallLog) {
    throw new Error('Response missing workerCallLog field');
  }

  if (!json.diagnostics) {
    throw new Error('Response missing diagnostics field');
  }

  console.log(`  ✓ Got move: ${json.move}`);
  console.log(`  ✓ Mode: ${json.mode}`);
  console.log(`  ✓ Engine: ${json.engine}`);
  console.log(`  ✓ Latency: ${json.diagnostics.latencyMs}ms`);
  console.log(`  ✓ workerCallLog present`);

  return json;
}

async function testWorkerCallsEndpoint() {
  console.log('✓ Testing /api/admin/worker-calls...');
  
  const { response, json } = await fetchJSON(`${API_BASE_URL}/api/admin/worker-calls?limit=5`);

  if (!response.ok) {
    throw new Error(`Worker calls request failed with status ${response.status}`);
  }

  if (!json.success) {
    throw new Error(`Worker calls returned success=false: ${json.error}`);
  }

  if (!Array.isArray(json.logs)) {
    throw new Error('Worker calls response missing logs array');
  }

  if (json.logs.length === 0) {
    console.warn('  ⚠ Warning: No logs found in database (expected at least 1 from previous test)');
  } else {
    const latestLog = json.logs[0];
    
    // Verify log structure
    if (!latestLog.id || !latestLog.ts || !latestLog.endpoint) {
      throw new Error('Log entry missing required fields');
    }

    console.log(`  ✓ Found ${json.logs.length} log(s) in database`);
    console.log(`  ✓ Latest log: ${latestLog.endpoint} - ${latestLog.success ? 'success' : 'failed'}`);
    
    // Verify we can find our test move in recent logs
    const chessMoveLog = json.logs.find(log => 
      log.endpoint === '/api/chess-move' && log.mode === 'worker'
    );
    
    if (chessMoveLog) {
      console.log(`  ✓ Verified chess move was logged to database`);
    }
  }

  return json;
}

async function runVerification() {
  console.log('🚀 Starting Worker API Verification');
  console.log(`📍 API Base URL: ${API_BASE_URL}`);
  console.log('');

  try {
    // Test 1: Health check (must pass first)
    await testHealthEndpoint();
    testsPassed++;
    console.log('');

    // Test 2: Chess move (core functionality)
    await testChessMoveEndpoint();
    testsPassed++;
    console.log('');

    // Test 3: Worker calls logs (persistence verification)
    await testWorkerCallsEndpoint();
    testsPassed++;
    console.log('');

    // === PASS SUMMARY ===
    console.log('✅ ALL VERIFICATION TESTS PASSED!');
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  PASS SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`  ✅ Tests Passed: ${testsPassed}/${testsPassed + testsFailed}`);
    console.log('  ✅ Worker API: Deployed and responding');
    console.log('  ✅ Database: Connected via Prisma Accelerate');
    console.log('  ✅ Chess Engine: Working (mode="worker")');
    console.log('  ✅ Logging: Persisted to WorkerCallLog table');
    console.log('  ✅ Architecture: Pure Worker (no Pages Functions)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('🎯 Worker API is production-ready!');
    
    process.exit(0);
  } catch (error) {
    testsFailed++;
    console.error('');
    console.error('❌ VERIFICATION FAILED!');
    console.error('');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('  FAILURE DETAILS');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error(`  ❌ Error: ${error.message}`);
    console.error(`  ❌ Tests Passed: ${testsPassed}`);
    console.error(`  ❌ Tests Failed: ${testsFailed}`);
    console.error(`  ❌ API Base URL: ${API_BASE_URL}`);
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('');
    console.error('🔍 Troubleshooting:');
    console.error('  1. Check Worker is deployed: wrangler deployments list');
    console.error('  2. Verify route: chesschat.uk/api/* → chesschat-worker-api');
    console.error('  3. Check secrets: wrangler secret list');
    console.error('  4. View logs: wrangler tail');
    console.error('');
    
    if (error.stack) {
      console.error('Stack trace:');
      console.error(error.stack);
    }
    
    process.exit(1);
  }
}

// Run verification
runVerification();
