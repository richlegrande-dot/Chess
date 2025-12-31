#!/usr/bin/env node

/**
 * Direct Deployment Test - Bypasses Edge Cache
 * Tests the specific deployment URL to verify new code is deployed
 */

const DEPLOYMENT_URL = 'https://b526dc11.chesschat-web.pages.dev/api/chess-move';

async function testDeployment() {
  console.log('🎯 Testing Deployment Directly');
  console.log('━'.repeat(50));
  console.log(`Target: ${DEPLOYMENT_URL}`);
  console.log('Cache: Bypassed with headers\n');

  const testBody = {
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    difficulty: 'beginner',
    gameId: 'cache-test-' + Date.now(),
    timeMs: 2500,
    cpuLevel: 3
  };

  console.log('📤 Request Body:');
  console.log(JSON.stringify(testBody, null, 2));
  console.log('');

  try {
    const response = await fetch(DEPLOYMENT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      },
      body: JSON.stringify(testBody)
    });

    const data = await response.json();

    console.log('📥 Response Status:', response.status, response.statusText);
    console.log('');
    console.log('📄 Full Response:');
    console.log(JSON.stringify(data, null, 2));
    console.log('');

    // Critical checks
    console.log('═'.repeat(50));
    console.log('🔍 CRITICAL CHECKS');
    console.log('═'.repeat(50));
    
    const hasTimeMs = 'timeMs' in (data.workerCallLog?.request || {});
    const hasCpuLevel = 'cpuLevel' in (data.workerCallLog?.request || {});
    const requestedTimeMs = data.diagnostics?.requestedTimeMs || 0;
    const cpuLevel = data.diagnostics?.cpuLevel || 'unknown';

    console.log(`\n1. workerCallLog.request has 'timeMs' field: ${hasTimeMs ? '✅' : '❌'}`);
    console.log(`2. workerCallLog.request has 'cpuLevel' field: ${hasCpuLevel ? '✅' : '❌'}`);
    console.log(`3. diagnostics.requestedTimeMs: ${requestedTimeMs} (expected: 2500) ${requestedTimeMs === 2500 ? '✅' : '❌'}`);
    console.log(`4. diagnostics.cpuLevel: ${cpuLevel} (expected: 3) ${cpuLevel === 3 ? '✅' : '❌'}`);

    console.log('');
    if (hasTimeMs && hasCpuLevel && requestedTimeMs === 2500 && cpuLevel === 3) {
      console.log('✅ NEW CODE IS DEPLOYED!');
      console.log('   The deployment has the CPU strength fix.');
      console.log('   Edge cache may need 5-10 minutes to propagate.');
    } else if (!hasTimeMs && !hasCpuLevel) {
      console.log('❌ OLD CODE STILL ACTIVE!');
      console.log('   The deployment is missing the new parameters.');
      console.log('   This could mean:');
      console.log('   1. Build didn\'t include the changes');
      console.log('   2. Deployment failed silently');
      console.log('   3. Need to force a new deployment');
    } else {
      console.log('⚠️  PARTIAL UPDATE');
      console.log('   Some but not all changes are present.');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testDeployment();
