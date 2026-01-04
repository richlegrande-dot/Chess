#!/usr/bin/env node
/**
 * Pre-Manual Test Script for Wall-E Learning Diagnostics Deployment
 * Verifies endpoints and basic functionality before manual testing
 */

import https from 'https';
import http from 'http';

const BASE_URL = process.env.BASE_URL || 'https://chesschat.uk';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const protocol = parsedUrl.protocol === 'https:' ? https : http;
    
    const reqOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout: 10000,
    };

    const req = protocol.request(reqOptions, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: data,
        });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (options.body) {
      req.write(options.body);
    }

    req.end();
  });
}

async function testEndpoint(name, url, expectedStatus, options = {}) {
  try {
    log(`\n🔍 Testing: ${name}`, 'cyan');
    log(`   URL: ${url}`, 'blue');
    
    const startTime = Date.now();
    const response = await makeRequest(url, options);
    const duration = Date.now() - startTime;
    
    const statusMatch = expectedStatus.includes(response.status);
    const statusColor = statusMatch ? 'green' : 'red';
    const statusIcon = statusMatch ? '✅' : '❌';
    
    log(`   ${statusIcon} Status: ${response.status} (expected: ${expectedStatus.join(' or ')})`, statusColor);
    log(`   ⏱️  Duration: ${duration}ms`, 'blue');
    
    // Try to parse JSON if content-type suggests it
    let parsedBody = null;
    if (response.headers['content-type']?.includes('application/json')) {
      try {
        parsedBody = JSON.parse(response.body);
        log(`   📦 Response type: JSON`, 'blue');
        if (parsedBody.requestId) {
          log(`   🆔 Request ID: ${parsedBody.requestId.substring(0, 8)}...`, 'blue');
        }
      } catch (e) {
        log(`   ⚠️  JSON parse failed`, 'yellow');
      }
    } else if (response.body.length < 200) {
      log(`   📦 Response: ${response.body.substring(0, 100)}`, 'blue');
    } else {
      log(`   📦 Response: ${response.body.length} bytes`, 'blue');
    }
    
    return {
      success: statusMatch,
      status: response.status,
      duration,
      body: parsedBody || response.body,
    };
  } catch (error) {
    log(`   ❌ Error: ${error.message}`, 'red');
    return {
      success: false,
      error: error.message,
    };
  }
}

async function runTests() {
  log('\n╔════════════════════════════════════════════════════════════╗', 'cyan');
  log('║  Wall-E Learning Diagnostics - Pre-Manual Test Suite      ║', 'cyan');
  log('╚════════════════════════════════════════════════════════════╝', 'cyan');
  
  const results = [];
  
  // Test 1: Main site accessibility
  log('\n📋 Test Suite 1: Site Accessibility', 'yellow');
  results.push(await testEndpoint(
    'Main Site',
    BASE_URL,
    [200, 301, 302]
  ));
  
  // Test 2: Health endpoint
  log('\n📋 Test Suite 2: API Health Check', 'yellow');
  results.push(await testEndpoint(
    'Worker Health',
    `${BASE_URL}/api/health`,
    [200]
  ));
  
  // Test 3: Learning endpoints (no auth)
  log('\n📋 Test Suite 3: Learning Endpoints (Public)', 'yellow');
  results.push(await testEndpoint(
    'Learning Progress (Test User)',
    `${BASE_URL}/api/learning/progress?userId=test`,
    [200, 404] // 404 is OK if test user doesn't exist
  ));
  
  // Test 4: Admin endpoints (should require auth)
  log('\n📋 Test Suite 4: Admin Endpoints (Auth Required)', 'yellow');
  results.push(await testEndpoint(
    'Admin Learning Health (No Auth)',
    `${BASE_URL}/api/admin/learning-health`,
    [401, 403] // Should be unauthorized without token
  ));
  
  results.push(await testEndpoint(
    'Admin Learning Recent Events (No Auth)',
    `${BASE_URL}/api/admin/learning-recent?limit=10`,
    [401, 403] // Should be unauthorized without token
  ));
  
  // Test 5: Admin endpoints with auth (if token provided)
  if (ADMIN_TOKEN) {
    log('\n📋 Test Suite 5: Admin Endpoints (With Auth)', 'yellow');
    results.push(await testEndpoint(
      'Admin Learning Health (With Auth)',
      `${BASE_URL}/api/admin/learning-health`,
      [200],
      {
        headers: {
          'Authorization': `Bearer ${ADMIN_TOKEN}`
        }
      }
    ));
    
    results.push(await testEndpoint(
      'Admin Learning Recent Events (With Auth)',
      `${BASE_URL}/api/admin/learning-recent?limit=10`,
      [200],
      {
        headers: {
          'Authorization': `Bearer ${ADMIN_TOKEN}`
        }
      }
    ));
  } else {
    log('\n⚠️  Skipping authenticated tests (ADMIN_TOKEN not set)', 'yellow');
  }
  
  // Test 6: Static assets
  log('\n📋 Test Suite 6: Frontend Assets', 'yellow');
  results.push(await testEndpoint(
    'Index HTML',
    `${BASE_URL}/`,
    [200]
  ));
  
  // Summary
  log('\n╔════════════════════════════════════════════════════════════╗', 'cyan');
  log('║  Test Summary                                              ║', 'cyan');
  log('╚════════════════════════════════════════════════════════════╝', 'cyan');
  
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const total = results.length;
  
  log(`\n✅ Passed: ${passed}/${total}`, passed === total ? 'green' : 'yellow');
  log(`❌ Failed: ${failed}/${total}`, failed > 0 ? 'red' : 'green');
  
  if (failed > 0) {
    log('\n⚠️  Some tests failed. Review errors above.', 'yellow');
    log('   Note: 404 for test user or 401 for admin endpoints without auth is expected.', 'yellow');
  } else {
    log('\n🎉 All tests passed! Ready for manual testing.', 'green');
  }
  
  // Next steps
  log('\n╔════════════════════════════════════════════════════════════╗', 'cyan');
  log('║  Next Steps: Manual Testing                               ║', 'cyan');
  log('╚════════════════════════════════════════════════════════════╝', 'cyan');
  
  log('\n1. Open browser and navigate to:', 'blue');
  log(`   ${BASE_URL}/admin`, 'cyan');
  
  log('\n2. Unlock admin portal with password', 'blue');
  
  log('\n3. Click "🤖 Wall-E Learning" tab (7th tab)', 'blue');
  
  log('\n4. Verify:', 'blue');
  log('   ✓ System Health panel loads', 'yellow');
  log('   ✓ Configuration shows correct flags', 'yellow');
  log('   ✓ Database tables show counts', 'yellow');
  log('   ✓ Recent Events panel appears (may be empty)', 'yellow');
  log('   ✓ User lookup field works', 'yellow');
  log('   ✓ Troubleshooting guide sections expand', 'yellow');
  
  log('\n5. Test user lookup:', 'blue');
  log('   • Click "👤 Get My ID" button', 'yellow');
  log('   • Or play a game and use that user ID', 'yellow');
  log('   • Click "🔍 Look Up" to see results', 'yellow');
  
  log('\n6. Check browser console for errors (F12)', 'blue');
  
  log('\n═══════════════════════════════════════════════════════════', 'cyan');
  
  return failed === 0 ? 0 : 1;
}

// Run tests
runTests()
  .then(exitCode => process.exit(exitCode))
  .catch(error => {
    log(`\n❌ Fatal error: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  });
