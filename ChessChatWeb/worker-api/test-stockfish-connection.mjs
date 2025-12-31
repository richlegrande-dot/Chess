#!/usr/bin/env node
/**
 * test-stockfish-connection.mjs
 * 
 * Tests if Stockfish API is reachable and responsive
 */

async function testStockfishHealth() {
  console.log('🔍 Testing Stockfish API connection...\n');
  
  // Get STOCKFISH_SERVER_URL from wrangler secrets
  console.log('⚠️  You need to manually provide the STOCKFISH_SERVER_URL');
  console.log('Run: wrangler secret list\n');
  
  const serverUrl = process.env.STOCKFISH_SERVER_URL || 'https://chesschat-stockfish.onrender.com';
  const apiKey = process.env.STOCKFISH_API_KEY || 'test-key';
  
  console.log(`Testing: ${serverUrl}\n`);
  
  // Test 1: Health endpoint
  console.log('1️⃣  Testing health endpoint...');
  try {
    const startHealth = Date.now();
    const healthResponse = await fetch(`${serverUrl}/health`, {
      signal: AbortSignal.timeout(15000) // 15 second timeout
    });
    const healthDuration = Date.now() - startHealth;
    
    if (healthResponse.ok) {
      const data = await healthResponse.json();
      console.log(`   ✅ Health check passed (${healthDuration}ms)`);
      console.log(`   Response:`, JSON.stringify(data, null, 2));
    } else {
      console.log(`   ❌ Health check failed: ${healthResponse.status}`);
      return false;
    }
  } catch (error) {
    console.log(`   ❌ Health check error:`, error.message);
    if (error.name === 'TimeoutError') {
      console.log(`   ⚠️  Server took >15s to respond - likely cold start or down`);
    }
    return false;
  }
  
  // Test 2: Compute move endpoint
  console.log('\n2️⃣  Testing compute-move endpoint...');
  try {
    const startCompute = Date.now();
    const computeResponse = await fetch(`${serverUrl}/compute-move`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        cpuLevel: 1
      }),
      signal: AbortSignal.timeout(15000)
    });
    const computeDuration = Date.now() - startCompute;
    
    if (computeResponse.ok) {
      const data = await computeResponse.json();
      console.log(`   ✅ Compute-move passed (${computeDuration}ms)`);
      console.log(`   Move suggested:`, data.move);
      console.log(`   Diagnostics:`, JSON.stringify(data.diagnostics, null, 2));
    } else {
      console.log(`   ❌ Compute-move failed: ${computeResponse.status}`);
      const errorText = await computeResponse.text();
      console.log(`   Error:`, errorText);
      return false;
    }
  } catch (error) {
    console.log(`   ❌ Compute-move error:`, error.message);
    if (error.name === 'TimeoutError') {
      console.log(`   ⚠️  Analysis took >15s - server may be overloaded`);
    }
    return false;
  }
  
  console.log('\n✅ All Stockfish tests passed!\n');
  return true;
}

testStockfishHealth()
  .then(success => {
    if (!success) {
      console.log('\n❌ Stockfish API is not functioning correctly');
      console.log('\nPossible issues:');
      console.log('  1. Render service is sleeping (free tier) - first request wakes it up');
      console.log('  2. Wrong STOCKFISH_SERVER_URL configured');
      console.log('  3. Server is down or experiencing issues');
      console.log('\nTo fix:');
      console.log('  - Wait 30s and try again (cold start)');
      console.log('  - Check Render dashboard for errors');
      console.log('  - Verify STOCKFISH_SERVER_URL secret\n');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
