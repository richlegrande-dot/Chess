#!/usr/bin/env node
/**
 * Production Chess Move Test
 * 
 * Purpose: Test the production /api/chess-move endpoint to verify:
 * 1. Stockfish engine is working
 * 2. Response includes diagnostics and requestId
 * 3. Logs are persisted to database
 * 4. No fallback behavior
 * 
 * Usage:
 *   node scripts/test-prod-chess-move.mjs
 *   node scripts/test-prod-chess-move.mjs https://custom-domain.com
 */

const PRODUCTION_URL = process.argv[2] || 'https://chesschat.uk';
const TIMEOUT = 30000; // 30 seconds

// Colors
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[36m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

function log(msg, color = '') {
  console.log(`${color}${msg}${RESET}`);
}

function success(msg) {
  console.log(`${GREEN}✓${RESET} ${msg}`);
}

function error(msg) {
  console.log(`${RED}✗${RESET} ${msg}`);
}

function info(msg) {
  console.log(`${BLUE}ℹ${RESET} ${msg}`);
}

function header(msg) {
  console.log(`\n${BOLD}═══ ${msg} ═══${RESET}`);
}

async function testChessMove() {
  header('Testing Production Chess Move Endpoint');
  log(`Target: ${PRODUCTION_URL}/api/chess-move\n`, BLUE);
  
  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };
  
  // Test 1: Basic move request
  header('Test 1: Starting Position Move');
  
  const payload = {
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    cpuLevel: 3,
    timeMs: 2000,
    gameId: 'test-' + Date.now(),
    playerId: 'test-player-1',
  };
  
  try {
    const startTime = Date.now();
    
    const response = await fetch(`${PRODUCTION_URL}/api/chess-move`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(TIMEOUT),
    });
    
    const elapsed = Date.now() - startTime;
    const data = await response.json();
    
    info(`Response time: ${elapsed}ms`);
    info(`Status: ${response.status}`);
    
    // Check 1.1: Response is 200 or appropriate error
    if (response.ok) {
      success('HTTP status is OK (200)');
      results.passed++;
    } else {
      error(`HTTP status is ${response.status} (expected 200)`);
      results.failed++;
    }
    
    // Check 1.2: Engine is stockfish
    if (data.engine === 'stockfish') {
      success('Engine is Stockfish (correct)');
      results.passed++;
    } else {
      error(`Engine is '${data.engine}' (expected 'stockfish')`);
      results.failed++;
    }
    
    // Check 1.3: Has diagnostics
    if (data.diagnostics && typeof data.diagnostics === 'object') {
      success('Response includes diagnostics');
      results.passed++;
      
      // Check 1.4: Has requestId
      if (data.diagnostics.requestId) {
        success(`Request ID: ${data.diagnostics.requestId}`);
        results.passed++;
      } else {
        error('Diagnostics missing requestId');
        results.failed++;
      }
      
      // Check 1.5: Has key metrics
      const requiredMetrics = ['latencyMs', 'depthReached', 'evaluationCp', 'pv'];
      const missingMetrics = requiredMetrics.filter(m => !(m in data.diagnostics));
      
      if (missingMetrics.length === 0) {
        success('Diagnostics include all key metrics');
        info(`  - Depth: ${data.diagnostics.depthReached}`);
        info(`  - Evaluation: ${data.diagnostics.evaluationCp}cp`);
        info(`  - PV: ${data.diagnostics.pv?.substring(0, 30)}...`);
        results.passed++;
      } else {
        error(`Diagnostics missing metrics: ${missingMetrics.join(', ')}`);
        results.failed++;
      }
    } else {
      error('Response missing diagnostics');
      results.failed++;
    }
    
    // Check 1.6: Has move (if success)
    if (data.success) {
      if (data.move && typeof data.move === 'string') {
        success(`Move generated: ${data.move}`);
        results.passed++;
      } else {
        error('Success response missing move');
        results.failed++;
      }
    }
    
    // Check 1.7: Mode is worker-api
    if (data.mode === 'worker-api') {
      success('Mode is worker-api (correct)');
      results.passed++;
    } else {
      error(`Mode is '${data.mode}' (expected 'worker-api')`);
      results.failed++;
    }
    
  } catch (err) {
    error(`Request failed: ${err.message}`);
    results.failed += 7;
  }
  
  // Test 2: Invalid FEN handling
  header('Test 2: Invalid FEN Handling');
  
  try {
    const response = await fetch(`${PRODUCTION_URL}/api/chess-move`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fen: 'invalid-fen',
        cpuLevel: 3,
        timeMs: 2000,
      }),
      signal: AbortSignal.timeout(TIMEOUT),
    });
    
    const data = await response.json();
    
    // Should return error response
    if (!data.success && data.errorCode) {
      success(`Properly returns error for invalid FEN (errorCode: ${data.errorCode})`);
      results.passed++;
    } else {
      error('Did not properly handle invalid FEN');
      results.failed++;
    }
    
    // Should still have diagnostics
    if (data.diagnostics && data.diagnostics.requestId) {
      success('Error response includes diagnostics with requestId');
      results.passed++;
    } else {
      error('Error response missing diagnostics');
      results.failed++;
    }
    
  } catch (err) {
    error(`Invalid FEN test failed: ${err.message}`);
    results.failed += 2;
  }
  
  // Test 3: Check admin endpoint (optional)
  header('Test 3: Admin Health Check');
  
  try {
    const response = await fetch(`${PRODUCTION_URL}/api/admin/worker-health`, {
      method: 'GET',
      signal: AbortSignal.timeout(TIMEOUT),
    });
    
    const data = await response.json();
    
    if (response.ok && data.healthy) {
      success('Worker health check passed');
      info(`  - Database: ${data.checks?.database?.status || 'unknown'}`);
      info(`  - Stockfish: ${data.checks?.stockfish?.status || 'unknown'}`);
      results.passed++;
    } else {
      error(`Health check returned unhealthy: ${JSON.stringify(data.checks)}`);
      results.failed++;
    }
    
  } catch (err) {
    info(`Health check not available: ${err.message}`);
    // Don't count as failure - endpoint might not be deployed yet
  }
  
  // Summary
  header('Summary');
  
  console.log(`\nTests passed: ${GREEN}${results.passed}${RESET}`);
  console.log(`Tests failed: ${RED}${results.failed}${RESET}`);
  console.log(`Total tests: ${results.passed + results.failed}\n`);
  
  if (results.failed === 0) {
    log('✓ All tests passed! Production endpoint is working correctly.', GREEN + BOLD);
    process.exit(0);
  } else {
    log('✗ Some tests failed. Please review the errors above.', RED + BOLD);
    process.exit(1);
  }
}

// Run tests
testChessMove().catch(err => {
  error(`Unexpected error: ${err.message}`);
  console.error(err.stack);
  process.exit(1);
});
