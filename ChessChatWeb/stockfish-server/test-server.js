/**
 * Test script for Stockfish HTTP Server
 * 
 * This script tests the server endpoints to ensure everything is working.
 * 
 * Usage:
 *   node test-server.js
 * 
 * Prerequisites:
 *   - Server must be running on http://localhost:3001
 */

const API_KEY = process.env.STOCKFISH_API_KEY || 'development-key-change-in-production';
const BASE_URL = process.env.STOCKFISH_SERVER_URL || 'http://localhost:3001';

async function testHealthCheck() {
  console.log('\n[TEST] Health Check');
  console.log('=====================================');
  
  try {
    const response = await fetch(`${BASE_URL}/health`);
    const data = await response.json();
    
    console.log('✓ Status:', response.status);
    console.log('✓ Response:', JSON.stringify(data, null, 2));
    
    if (data.status === 'healthy') {
      console.log('✓ Health check PASSED');
      return true;
    } else {
      console.error('✗ Health check FAILED: Server not healthy');
      return false;
    }
  } catch (error) {
    console.error('✗ Health check FAILED:', error.message);
    return false;
  }
}

async function testComputeMove() {
  console.log('\n[TEST] Compute Move - Starting Position');
  console.log('=====================================');
  
  try {
    const startTime = Date.now();
    const response = await fetch(`${BASE_URL}/compute-move`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        cpuLevel: 5
      })
    });
    
    const duration = Date.now() - startTime;
    const data = await response.json();
    
    console.log('✓ Status:', response.status);
    console.log('✓ Response:', JSON.stringify(data, null, 2));
    console.log('✓ Duration:', duration + 'ms');
    
    if (data.success && data.move) {
      console.log('✓ Compute move PASSED');
      console.log('  Move:', data.move);
      console.log('  CPU Level:', data.cpuLevel);
      return true;
    } else {
      console.error('✗ Compute move FAILED:', data.error);
      return false;
    }
  } catch (error) {
    console.error('✗ Compute move FAILED:', error.message);
    return false;
  }
}

async function testInvalidFEN() {
  console.log('\n[TEST] Invalid FEN Handling');
  console.log('=====================================');
  
  try {
    const response = await fetch(`${BASE_URL}/compute-move`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        fen: 'invalid-fen',
        cpuLevel: 5
      })
    });
    
    const data = await response.json();
    
    console.log('✓ Status:', response.status);
    console.log('✓ Response:', JSON.stringify(data, null, 2));
    
    if (response.status === 400 && data.error) {
      console.log('✓ Invalid FEN handling PASSED');
      return true;
    } else {
      console.error('✗ Invalid FEN handling FAILED: Should return 400');
      return false;
    }
  } catch (error) {
    console.error('✗ Invalid FEN handling FAILED:', error.message);
    return false;
  }
}

async function testUnauthorized() {
  console.log('\n[TEST] Unauthorized Access');
  console.log('=====================================');
  
  try {
    const response = await fetch(`${BASE_URL}/compute-move`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
        // No Authorization header
      },
      body: JSON.stringify({
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        cpuLevel: 5
      })
    });
    
    const data = await response.json();
    
    console.log('✓ Status:', response.status);
    console.log('✓ Response:', JSON.stringify(data, null, 2));
    
    if (response.status === 401 && data.error) {
      console.log('✓ Unauthorized access handling PASSED');
      return true;
    } else {
      console.error('✗ Unauthorized access handling FAILED: Should return 401');
      return false;
    }
  } catch (error) {
    console.error('✗ Unauthorized access handling FAILED:', error.message);
    return false;
  }
}

async function testAnalyze() {
  console.log('\n[TEST] Position Analysis');
  console.log('=====================================');
  
  try {
    const response = await fetch(`${BASE_URL}/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        fen: 'rnbqkb1r/pppp1ppp/5n2/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 4 3',
        depth: 12
      })
    });
    
    const data = await response.json();
    
    console.log('✓ Status:', response.status);
    console.log('✓ Response:', JSON.stringify(data, null, 2));
    
    if (data.success && data.bestMove) {
      console.log('✓ Position analysis PASSED');
      console.log('  Best Move:', data.bestMove);
      console.log('  Evaluation:', data.evaluation);
      return true;
    } else {
      console.error('✗ Position analysis FAILED:', data.error);
      return false;
    }
  } catch (error) {
    console.error('✗ Position analysis FAILED:', error.message);
    return false;
  }
}

async function runAllTests() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║       Stockfish HTTP Server - Test Suite                  ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║  Server URL: ${BASE_URL.padEnd(45)} ║`);
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  const results = {
    health: await testHealthCheck(),
    computeMove: await testComputeMove(),
    invalidFEN: await testInvalidFEN(),
    unauthorized: await testUnauthorized(),
    analyze: await testAnalyze()
  };
  
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                    Test Summary                            ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  
  const tests = Object.entries(results);
  const passed = tests.filter(([, result]) => result).length;
  const total = tests.length;
  
  tests.forEach(([name, result]) => {
    const status = result ? '✓ PASS' : '✗ FAIL';
    const label = name.padEnd(40);
    console.log(`║  ${label} ${status.padStart(11)} ║`);
  });
  
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║  Results: ${passed}/${total} tests passed                              ║`);
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  process.exit(passed === total ? 0 : 1);
}

// Run tests
runAllTests().catch(error => {
  console.error('Test suite error:', error);
  process.exit(1);
});
