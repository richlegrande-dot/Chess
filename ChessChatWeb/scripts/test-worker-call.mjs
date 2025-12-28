#!/usr/bin/env node
/**
 * Worker Diagnostic Test Script
 * 
 * Makes direct HTTP calls to test Worker and Pages Function endpoints
 * Shows detailed request/response information to diagnose failures
 * 
 * Usage:
 *   node scripts/test-worker-call.mjs
 *   node scripts/test-worker-call.mjs --production
 *   node scripts/test-worker-call.mjs --endpoint https://custom.domain.com
 */

import https from 'https';
import http from 'http';

// Configuration
const args = process.argv.slice(2);
const useProduction = args.includes('--production');
const customEndpoint = args.find(arg => arg.startsWith('--endpoint='))?.split('=')[1];

const BASE_URL = customEndpoint || (useProduction ? 'https://chesschat.uk' : 'http://localhost:8788');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin'; // Default for local dev

// Test FEN (starting position)
const TEST_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const TEST_DIFFICULTY = 'beginner';

console.log('🔬 Worker Diagnostic Test\n');
console.log('Configuration:');
console.log(`  Base URL: ${BASE_URL}`);
console.log(`  Mode: ${useProduction ? 'Production' : 'Local Dev'}`);
console.log(`  Admin Password: ${ADMIN_PASSWORD ? '***' : 'Not Set'}\n`);

// Helper to make HTTP requests with full details
function makeRequest(url, options, body) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const isHttps = parsedUrl.protocol === 'https:';
    const lib = isHttps ? https : http;
    
    const requestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };
    
    const startTime = Date.now();
    
    const req = lib.request(requestOptions, (res) => {
      const latency = Date.now() - startTime;
      let responseBody = '';
      
      res.on('data', (chunk) => {
        responseBody += chunk;
      });
      
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          statusMessage: res.statusMessage,
          headers: res.headers,
          body: responseBody,
          latency
        });
      });
    });
    
    req.on('error', (error) => {
      const latency = Date.now() - startTime;
      reject({
        error: error.message,
        latency
      });
    });
    
    if (body) {
      req.write(body);
    }
    
    req.end();
  });
}

// Test 1: Worker Health Check
async function testWorkerHealth() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('TEST 1: Worker Health Check');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const url = `${BASE_URL}/api/admin/worker-health?password=${ADMIN_PASSWORD}`;
  
  console.log(`🔗 Endpoint: GET ${url}`);
  console.log('📤 Request Headers:');
  console.log('   Accept: application/json\n');
  
  try {
    const response = await makeRequest(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    console.log(`📥 Response: ${response.statusCode} ${response.statusMessage}`);
    console.log(`⏱️  Latency: ${response.latency}ms`);
    console.log('📋 Response Headers:');
    Object.entries(response.headers).forEach(([key, value]) => {
      console.log(`   ${key}: ${value}`);
    });
    console.log('\n📄 Response Body:');
    
    try {
      const data = JSON.parse(response.body);
      console.log(JSON.stringify(data, null, 2));
      
      console.log('\n📊 Analysis:');
      if (data.success) {
        console.log('   ✅ Worker health check PASSED');
        console.log(`   ✅ Service binding present: ${data.bindingPresent}`);
        console.log(`   ✅ Worker HTTP status: ${data.workerHttpStatus}`);
        console.log(`   ✅ JSON parsing: ${data.parsedJsonOk}`);
        console.log(`   ✅ Worker latency: ${data.latencyMs}ms`);
        if (data.workerMode) console.log(`   ✅ Worker mode: ${data.workerMode}`);
        if (data.workerEngine) console.log(`   ✅ Worker engine: ${data.workerEngine}`);
      } else {
        console.log('   ❌ Worker health check FAILED');
        console.log(`   ❌ Binding present: ${data.bindingPresent}`);
        if (data.error) console.log(`   ❌ Error: ${data.error}`);
        if (data.troubleshooting) {
          console.log('   ⚠️  Troubleshooting:');
          data.troubleshooting.forEach(tip => console.log(`      - ${tip}`));
        }
      }
      
      return data.success;
    } catch (e) {
      console.log(response.body);
      console.log('\n❌ Failed to parse response as JSON');
      return false;
    }
  } catch (error) {
    console.log(`\n❌ Request Failed:`);
    console.log(`   Error: ${error.error}`);
    console.log(`   Latency: ${error.latency}ms`);
    return false;
  }
}

// Test 2: Chess Move API Call
async function testChessMoveAPI() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('TEST 2: Chess Move API Call');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const url = `${BASE_URL}/api/chess-move`;
  const requestBody = {
    fen: TEST_FEN,
    difficulty: TEST_DIFFICULTY,
    gameId: 'test-diagnostic-' + Date.now()
  };
  
  console.log(`🔗 Endpoint: POST ${url}`);
  console.log('📤 Request Headers:');
  console.log('   Content-Type: application/json');
  console.log('   Accept: application/json\n');
  console.log('📤 Request Body:');
  console.log(JSON.stringify(requestBody, null, 2));
  console.log('');
  
  try {
    const response = await makeRequest(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    }, JSON.stringify(requestBody));
    
    console.log(`📥 Response: ${response.statusCode} ${response.statusMessage}`);
    console.log(`⏱️  Latency: ${response.latency}ms`);
    console.log('📋 Response Headers:');
    Object.entries(response.headers).forEach(([key, value]) => {
      console.log(`   ${key}: ${value}`);
    });
    console.log('\n📄 Response Body:');
    
    try {
      const data = JSON.parse(response.body);
      console.log(JSON.stringify(data, null, 2));
      
      console.log('\n📊 Analysis:');
      if (data.success) {
        console.log('   ✅ Chess move API call SUCCEEDED');
        console.log(`   ✅ Move: ${data.move}`);
        console.log(`   ✅ Engine: ${data.engine}`);
        console.log(`   ✅ Mode: ${data.mode}`);
        console.log(`   ✅ Latency: ${data.latencyMs}ms`);
        
        if (data.workerCallLog) {
          console.log('\n   🔗 Worker Call Log:');
          console.log(`      Endpoint: ${data.workerCallLog.endpoint}`);
          console.log(`      Success: ${data.workerCallLog.success}`);
          console.log(`      Latency: ${data.workerCallLog.latencyMs}ms`);
          if (data.workerCallLog.error) {
            console.log(`      Error: ${data.workerCallLog.error}`);
          }
          if (data.workerCallLog.response) {
            console.log(`      Response Mode: ${data.workerCallLog.response.mode || 'N/A'}`);
            console.log(`      Response Engine: ${data.workerCallLog.response.engine || 'N/A'}`);
          }
        }
        
        // Check if it's using fallback
        if (data.mode === 'local-fallback') {
          console.log('\n   ⚠️  WARNING: Using local fallback engine!');
          console.log('   ⚠️  Worker is not being used - this is the problem!');
        } else if (data.mode === 'service-binding') {
          console.log('\n   ✅ EXCELLENT: Using Worker via service binding!');
        }
      } else {
        console.log('   ❌ Chess move API call FAILED');
        console.log(`   ❌ Error: ${data.error}`);
        console.log(`   ❌ Error Code: ${data.errorCode}`);
        console.log(`   ❌ Mode: ${data.mode}`);
        
        if (data.workerCallLog) {
          console.log('\n   🔗 Worker Call Log:');
          console.log(`      Endpoint: ${data.workerCallLog.endpoint}`);
          console.log(`      Success: ${data.workerCallLog.success}`);
          console.log(`      Latency: ${data.workerCallLog.latencyMs}ms`);
          console.log(`      Error: ${data.workerCallLog.error}`);
        }
        
        // Diagnose error code
        if (data.errorCode === 'NO_WORKER_BINDING') {
          console.log('\n   🔍 DIAGNOSIS: Service binding not configured');
          console.log('   💡 FIX: Configure WALLE_ASSISTANT binding in Cloudflare Dashboard');
        } else if (data.errorCode === 'WORKER_FETCH_FAILED') {
          console.log('\n   🔍 DIAGNOSIS: Worker unreachable or timeout');
          console.log('   💡 FIX: Check Worker deployment and logs');
        } else if (data.errorCode === 'WORKER_ERROR_STATUS') {
          console.log('\n   🔍 DIAGNOSIS: Worker returned non-200 status');
          console.log('   💡 FIX: Check Worker logs for errors');
        } else if (data.errorCode === 'WORKER_INVALID_JSON') {
          console.log('\n   🔍 DIAGNOSIS: Worker response is not JSON');
          console.log('   💡 FIX: Worker may be returning HTML error page');
        }
      }
      
      return data.success && data.mode !== 'local-fallback';
    } catch (e) {
      console.log(response.body);
      console.log('\n❌ Failed to parse response as JSON');
      console.log('   This usually means the server returned an HTML error page');
      return false;
    }
  } catch (error) {
    console.log(`\n❌ Request Failed:`);
    console.log(`   Error: ${error.error}`);
    console.log(`   Latency: ${error.latency}ms`);
    return false;
  }
}

// Test 3: Multiple Chess Move Calls (stress test)
async function testMultipleChessMoves(count = 3) {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`TEST 3: Multiple Chess Move Calls (${count} requests)`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const results = [];
  
  for (let i = 1; i <= count; i++) {
    console.log(`\n📍 Request ${i}/${count}...`);
    
    const url = `${BASE_URL}/api/chess-move`;
    const requestBody = {
      fen: TEST_FEN,
      difficulty: TEST_DIFFICULTY,
      gameId: `test-stress-${Date.now()}-${i}`
    };
    
    try {
      const response = await makeRequest(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }, JSON.stringify(requestBody));
      
      const data = JSON.parse(response.body);
      
      results.push({
        index: i,
        success: data.success,
        statusCode: response.statusCode,
        latency: response.latency,
        mode: data.mode,
        engine: data.engine,
        move: data.move,
        error: data.error,
        workerSuccess: data.workerCallLog?.success
      });
      
      console.log(`   Status: ${response.statusCode}`);
      console.log(`   Success: ${data.success}`);
      console.log(`   Mode: ${data.mode}`);
      console.log(`   Latency: ${response.latency}ms`);
      if (data.move) console.log(`   Move: ${data.move}`);
      if (data.error) console.log(`   Error: ${data.error}`);
      
      // Add small delay between requests
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      results.push({
        index: i,
        success: false,
        error: error.error,
        latency: error.latency
      });
      console.log(`   ❌ Request failed: ${error.error}`);
    }
  }
  
  // Summary
  console.log('\n📊 Stress Test Summary:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const successful = results.filter(r => r.success).length;
  const fallbackUsed = results.filter(r => r.mode === 'local-fallback').length;
  const workerUsed = results.filter(r => r.mode === 'service-binding').length;
  const avgLatency = results.reduce((sum, r) => sum + r.latency, 0) / results.length;
  
  console.log(`Total Requests: ${count}`);
  console.log(`Successful: ${successful}/${count} (${(successful/count*100).toFixed(1)}%)`);
  console.log(`Failed: ${count - successful}/${count}`);
  console.log(`Average Latency: ${avgLatency.toFixed(0)}ms`);
  console.log(`\nMode Distribution:`);
  console.log(`  Service Binding: ${workerUsed}`);
  console.log(`  Local Fallback: ${fallbackUsed}`);
  console.log(`  Error: ${count - workerUsed - fallbackUsed}`);
  
  if (fallbackUsed > 0) {
    console.log('\n⚠️  WARNING: Some requests used fallback engine!');
    console.log('   This indicates Worker is not responding properly.');
  }
  
  if (workerUsed === count) {
    console.log('\n✅ EXCELLENT: All requests used Worker successfully!');
  }
  
  return workerUsed === count;
}

// Main test runner
async function runDiagnostics() {
  console.log('Starting diagnostic tests...\n');
  
  const results = {
    healthCheck: false,
    chessMove: false,
    stressTest: false
  };
  
  try {
    // Test 1: Health Check
    results.healthCheck = await testWorkerHealth();
    
    // Test 2: Single Chess Move
    results.chessMove = await testChessMoveAPI();
    
    // Test 3: Multiple Moves (only if single move succeeded)
    if (results.chessMove) {
      results.stressTest = await testMultipleChessMoves(3);
    } else {
      console.log('\n⚠️  Skipping stress test (single move failed)\n');
    }
    
  } catch (error) {
    console.error('\n❌ Diagnostic test failed with error:', error);
  }
  
  // Final Summary
  console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('FINAL DIAGNOSTIC SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log(`Health Check:     ${results.healthCheck ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Chess Move API:   ${results.chessMove ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Stress Test:      ${results.stressTest ? '✅ PASS' : results.chessMove ? '❌ FAIL' : '⊘ SKIPPED'}`);
  
  console.log('\n🔍 Diagnostic Conclusion:');
  if (results.healthCheck && results.chessMove && results.stressTest) {
    console.log('   ✅ All systems operational!');
    console.log('   ✅ Worker is responding correctly via service binding.');
    console.log('\n   If the website still shows issues, check:');
    console.log('   - Frontend code is calling the correct endpoint');
    console.log('   - Browser cache (try hard refresh)');
    console.log('   - Custom domain DNS/caching issues');
  } else if (!results.healthCheck) {
    console.log('   ❌ CRITICAL: Worker health check failed');
    console.log('   ❌ Service binding may not be configured');
    console.log('\n   ACTION REQUIRED:');
    console.log('   1. Check Cloudflare Dashboard → Pages → Settings → Functions');
    console.log('   2. Verify WALLE_ASSISTANT service binding exists');
    console.log('   3. Verify Worker is deployed and not crashing');
  } else if (!results.chessMove) {
    console.log('   ❌ PROBLEM: Chess move API is not using Worker');
    console.log('   ❌ Likely using fallback or returning errors');
    console.log('\n   ACTION REQUIRED:');
    console.log('   1. Check Worker logs in Cloudflare Dashboard');
    console.log('   2. Verify Worker route /assist/chess-move exists');
    console.log('   3. Test Worker deployment directly');
  } else {
    console.log('   ⚠️  Inconsistent results - may be intermittent issue');
    console.log('\n   ACTION REQUIRED:');
    console.log('   1. Check Worker metrics for error rate');
    console.log('   2. Monitor Worker CPU time (should not be 0ms)');
    console.log('   3. Review Worker logs for patterns');
  }
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // Exit code
  const allPassed = results.healthCheck && results.chessMove;
  process.exit(allPassed ? 0 : 1);
}

// Run diagnostics
runDiagnostics().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
