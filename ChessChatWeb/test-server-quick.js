/**
 * Quick Server & CPU Test
 * Tests that the dev server is running and CPU moves work
 */

console.log('\n🧪 ChessChat Server & CPU Quick Test\n');
console.log('Testing server: http://localhost:3001\n');

// Test 1: Server is running
async function testServer() {
  console.log('Test 1: Server Health Check');
  try {
    const response = await fetch('http://localhost:3001/');
    if (response.ok) {
      console.log('✅ Server is running on port 3001\n');
      return true;
    } else {
      console.log(`❌ Server returned status ${response.status}\n`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Server not reachable: ${error.message}\n`);
    return false;
  }
}

// Test 2: CPU can make a move
async function testCPUMove() {
  console.log('Test 2: CPU Move Generation');
  console.log('Position: Starting position');
  console.log('Difficulty: Beginner');
  
  const startTime = Date.now();
  
  try {
    const response = await fetch('http://localhost:3001/api/chess-move', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        pgn: '',
        difficulty: 'beginner',
        gameId: `test_${Date.now()}`
      })
    });

    const data = await response.json();
    const elapsed = Date.now() - startTime;

    if (data.success && data.move) {
      console.log(`✅ CPU generated move: ${data.move}`);
      console.log(`   Time: ${elapsed}ms`);
      console.log(`   Engine: ${data.engine || 'Unknown'}`);
      console.log(`   Difficulty: ${data.difficulty || 'Unknown'}\n`);
      return true;
    } else {
      console.log(`❌ CPU move failed: ${JSON.stringify(data, null, 2)}\n`);
      return false;
    }
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.log(`❌ CPU move error after ${elapsed}ms: ${error.message}\n`);
    return false;
  }
}

// Test 3: CPU handles different difficulties
async function testDifficulties() {
  console.log('Test 3: CPU Difficulty Levels');
  const difficulties = ['beginner', 'intermediate', 'advanced'];
  let passed = 0;
  
  for (const diff of difficulties) {
    process.stdout.write(`  ${diff}... `);
    try {
      const response = await fetch('http://localhost:3001/api/chess-move', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
          pgn: '',
          difficulty: diff,
          gameId: `test_${diff}_${Date.now()}`
        })
      });

      const data = await response.json();
      if (data.success && data.move) {
        console.log(`✅ ${data.move}`);
        passed++;
      } else {
        console.log(`❌ Failed`);
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log(`\n${passed}/${difficulties.length} difficulty levels working\n`);
  return passed === difficulties.length;
}

// Run all tests
async function runTests() {
  console.log('═'.repeat(60));
  console.log('Starting tests...\n');
  
  const test1 = await testServer();
  if (!test1) {
    console.log('❌ Server test failed. Make sure dev server is running:');
    console.log('   npm run dev\n');
    process.exit(1);
  }
  
  const test2 = await testCPUMove();
  const test3 = await testDifficulties();
  
  console.log('═'.repeat(60));
  console.log('TEST SUMMARY:');
  console.log(`  Server Health: ${test1 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  CPU Move: ${test2 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  Difficulty Levels: ${test3 ? '✅ PASS' : '❌ FAIL'}`);
  console.log('═'.repeat(60));
  
  const allPassed = test1 && test2 && test3;
  if (allPassed) {
    console.log('\n✅ All tests passed! Server and CPU are working correctly.\n');
    console.log('💡 You can now start manual testing at: http://localhost:3001\n');
  } else {
    console.log('\n❌ Some tests failed. Check the output above.\n');
    process.exit(1);
  }
}

// Run the tests
runTests().catch(error => {
  console.error('\n❌ Test suite crashed:', error.message);
  process.exit(1);
});
