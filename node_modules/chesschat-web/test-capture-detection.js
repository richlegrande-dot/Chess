/**
 * Focused Capture Detection Test
 * Validates that the AI worker correctly detects all captures
 * using both 'captured' field and 'x' notation in moves
 */

const API_URL = 'https://84222610.chesschat-web.pages.dev';

const captureTestCases = [
  {
    name: 'Captures with lowercase x notation',
    gameData: {
      pgn: '1. e4 e5 2. Nf3 d6 3. d4 exd4',
      playerColor: 'White',
      moveHistory: [
        { moveNum: 1, player: 'White', move: 'e4', fen: 'fen1' },
        { moveNum: 1, player: 'Black', move: 'e5', fen: 'fen2' },
        { moveNum: 2, player: 'White', move: 'Nf3', fen: 'fen3' },
        { moveNum: 2, player: 'Black', move: 'd6', fen: 'fen4' },
        { moveNum: 3, player: 'White', move: 'd4', fen: 'fen5' },
        { moveNum: 3, player: 'Black', move: 'exd4', fen: 'fen6' },
      ]
    },
    expectedCaptures: {
      white: 0,
      black: 1
    }
  },
  {
    name: 'Captures with uppercase X notation',
    gameData: {
      pgn: '1. e4 d5 2. exd5 Qxd5',
      playerColor: 'White',
      moveHistory: [
        { moveNum: 1, player: 'White', move: 'e4', fen: 'fen1' },
        { moveNum: 1, player: 'Black', move: 'd5', fen: 'fen2' },
        { moveNum: 2, player: 'White', move: 'eXd5', fen: 'fen3' }, // Uppercase X
        { moveNum: 2, player: 'Black', move: 'QXd5', fen: 'fen4' }, // Uppercase X
      ]
    },
    expectedCaptures: {
      white: 1,
      black: 1
    }
  },
  {
    name: 'Captures using captured field only',
    gameData: {
      pgn: '1. e4 d5 2. exd5 Nf6 3. Bb5+ c6 4. dxc6',
      playerColor: 'White',
      moveHistory: [
        { moveNum: 1, player: 'White', move: 'e4', fen: 'fen1' },
        { moveNum: 1, player: 'Black', move: 'd5', fen: 'fen2' },
        { moveNum: 2, player: 'White', move: 'e-d5', fen: 'fen3', captured: 'p' },
        { moveNum: 2, player: 'Black', move: 'Nf6', fen: 'fen4' },
        { moveNum: 3, player: 'White', move: 'Bb5+', fen: 'fen5' },
        { moveNum: 3, player: 'Black', move: 'c6', fen: 'fen6' },
        { moveNum: 4, player: 'White', move: 'd-c6', fen: 'fen7', captured: 'p' },
      ]
    },
    expectedCaptures: {
      white: 2,
      black: 0
    }
  },
  {
    name: 'Mixed notation - both x and captured field',
    gameData: {
      pgn: '1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. Ng5 d5 5. exd5 Nxd5 6. Nxf7 Kxf7',
      playerColor: 'White',
      moveHistory: [
        { moveNum: 1, player: 'White', move: 'e4', fen: 'fen1' },
        { moveNum: 1, player: 'Black', move: 'e5', fen: 'fen2' },
        { moveNum: 2, player: 'White', move: 'Nf3', fen: 'fen3' },
        { moveNum: 2, player: 'Black', move: 'Nc6', fen: 'fen4' },
        { moveNum: 3, player: 'White', move: 'Bc4', fen: 'fen5' },
        { moveNum: 3, player: 'Black', move: 'Nf6', fen: 'fen6' },
        { moveNum: 4, player: 'White', move: 'Ng5', fen: 'fen7' },
        { moveNum: 4, player: 'Black', move: 'd5', fen: 'fen8' },
        { moveNum: 5, player: 'White', move: 'exd5', fen: 'fen9', captured: 'p' },
        { moveNum: 5, player: 'Black', move: 'Nxd5', fen: 'fen10', captured: 'p' },
        { moveNum: 6, player: 'White', move: 'Nxf7', fen: 'fen11', captured: 'p' },
        { moveNum: 6, player: 'Black', move: 'Kxf7', fen: 'fen12', captured: 'n' },
      ]
    },
    expectedCaptures: {
      white: 2,
      black: 2
    }
  },
  {
    name: 'Checkmate with capture',
    gameData: {
      pgn: '1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7#',
      playerColor: 'White',
      moveHistory: [
        { moveNum: 1, player: 'White', move: 'e4', fen: 'fen1' },
        { moveNum: 1, player: 'Black', move: 'e5', fen: 'fen2' },
        { moveNum: 2, player: 'White', move: 'Bc4', fen: 'fen3' },
        { moveNum: 2, player: 'Black', move: 'Nc6', fen: 'fen4' },
        { moveNum: 3, player: 'White', move: 'Qh5', fen: 'fen5' },
        { moveNum: 3, player: 'Black', move: 'Nf6', fen: 'fen6' },
        { moveNum: 4, player: 'White', move: 'Qxf7#', fen: 'fen7', captured: 'p' },
      ]
    },
    expectedCaptures: {
      white: 1,
      black: 0
    }
  },
  {
    name: 'No captures - clean opening',
    gameData: {
      pgn: '1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5',
      playerColor: 'White',
      moveHistory: [
        { moveNum: 1, player: 'White', move: 'e4', fen: 'fen1' },
        { moveNum: 1, player: 'Black', move: 'e5', fen: 'fen2' },
        { moveNum: 2, player: 'White', move: 'Nf3', fen: 'fen3' },
        { moveNum: 2, player: 'Black', move: 'Nc6', fen: 'fen4' },
        { moveNum: 3, player: 'White', move: 'Bc4', fen: 'fen5' },
        { moveNum: 3, player: 'Black', move: 'Bc5', fen: 'fen6' },
      ]
    },
    expectedCaptures: {
      white: 0,
      black: 0
    }
  },
  {
    name: 'Multiple captures in sequence',
    gameData: {
      pgn: '1. e4 d5 2. exd5 Qxd5 3. Nc3 Qxc3 4. dxc3',
      playerColor: 'White',
      moveHistory: [
        { moveNum: 1, player: 'White', move: 'e4', fen: 'fen1' },
        { moveNum: 1, player: 'Black', move: 'd5', fen: 'fen2' },
        { moveNum: 2, player: 'White', move: 'exd5', fen: 'fen3', captured: 'p' },
        { moveNum: 2, player: 'Black', move: 'Qxd5', fen: 'fen4', captured: 'p' },
        { moveNum: 3, player: 'White', move: 'Nc3', fen: 'fen5' },
        { moveNum: 3, player: 'Black', move: 'Qxc3', fen: 'fen6', captured: 'n' },
        { moveNum: 4, player: 'White', move: 'dxc3', fen: 'fen7', captured: 'q' },
      ]
    },
    expectedCaptures: {
      white: 2,
      black: 2
    }
  },
  {
    name: 'Unicode multiplication sign (×)',
    gameData: {
      pgn: '1. e4 d5 2. e×d5',
      playerColor: 'White',
      moveHistory: [
        { moveNum: 1, player: 'White', move: 'e4', fen: 'fen1' },
        { moveNum: 1, player: 'Black', move: 'd5', fen: 'fen2' },
        { moveNum: 2, player: 'White', move: 'e×d5', fen: 'fen3' }, // Unicode ×
      ]
    },
    expectedCaptures: {
      white: 1,
      black: 0
    }
  }
];

async function testCaptureDetection(testCase) {
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`🧪 Test: ${testCase.name}`);
  console.log(`${'─'.repeat(70)}`);

  try {
    const response = await fetch(`${API_URL}/api/analyze-game`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testCase.gameData)
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      console.log(`❌ FAIL: API error`);
      console.log(`   Status: ${response.status}`);
      console.log(`   Error: ${data.error || 'Unknown'}`);
      return { pass: false, error: 'API error' };
    }

    const detectedCaptures = data.gameStats.captures;
    const expectedCaptures = testCase.gameData.playerColor === 'White' 
      ? testCase.expectedCaptures.white 
      : testCase.expectedCaptures.black;

    // Manual count for verification
    const manualCountCaptured = testCase.gameData.moveHistory.filter(m => 
      m.captured && m.player === testCase.gameData.playerColor
    ).length;
    
    const manualCountNotation = testCase.gameData.moveHistory.filter(m => 
      (m.move.toLowerCase().includes('x') || m.move.includes('×')) && 
      m.player === testCase.gameData.playerColor
    ).length;

    console.log(`\n📊 Capture Analysis:`);
    console.log(`   Player Color: ${testCase.gameData.playerColor}`);
    console.log(`   Expected Captures: ${expectedCaptures}`);
    console.log(`   Detected by Worker: ${detectedCaptures}`);
    console.log(`\n🔍 Manual Verification:`);
    console.log(`   Moves with 'captured' field: ${manualCountCaptured}`);
    console.log(`   Moves with 'x' notation: ${manualCountNotation}`);
    console.log(`   Max of both methods: ${Math.max(manualCountCaptured, manualCountNotation)}`);

    // Detailed move analysis
    console.log(`\n📝 Move-by-Move Analysis:`);
    testCase.gameData.moveHistory.forEach(move => {
      const hasCapture = move.captured || 
                        move.move.toLowerCase().includes('x') || 
                        move.move.includes('×');
      if (hasCapture && move.player === testCase.gameData.playerColor) {
        const markers = [];
        if (move.captured) markers.push(`captured='${move.captured}'`);
        if (move.move.toLowerCase().includes('x') || move.move.includes('×')) markers.push('has x');
        console.log(`   Move ${move.moveNum} (${move.player}): ${move.move} [${markers.join(', ')}]`);
      }
    });

    const pass = detectedCaptures === expectedCaptures;
    
    if (pass) {
      console.log(`\n✅ PASS: Capture detection accurate`);
    } else {
      console.log(`\n❌ FAIL: Expected ${expectedCaptures} but detected ${detectedCaptures}`);
    }

    return { 
      pass, 
      expected: expectedCaptures, 
      detected: detectedCaptures,
      testCase: testCase.name 
    };

  } catch (error) {
    console.log(`\n❌ FAIL: Exception - ${error.message}`);
    return { pass: false, error: error.message, testCase: testCase.name };
  }
}

async function runAllCaptureTests() {
  console.log('\n' + '='.repeat(70));
  console.log('CAPTURE DETECTION - FOCUSED VALIDATION TEST');
  console.log(`API URL: ${API_URL}`);
  console.log(`Test Cases: ${captureTestCases.length}`);
  console.log('='.repeat(70));

  const results = [];

  for (const testCase of captureTestCases) {
    const result = await testCaptureDetection(testCase);
    results.push(result);
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  // Summary
  console.log('\n\n' + '='.repeat(70));
  console.log('CAPTURE DETECTION TEST SUMMARY');
  console.log('='.repeat(70));

  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  const passRate = ((passed / results.length) * 100).toFixed(1);

  console.log(`\n📊 Results:`);
  console.log(`   Total Tests: ${results.length}`);
  console.log(`   Passed: ${passed} (${passRate}%)`);
  console.log(`   Failed: ${failed}`);

  if (failed > 0) {
    console.log(`\n❌ Failed Tests:`);
    results.filter(r => !r.pass).forEach(r => {
      console.log(`   - ${r.testCase}`);
      if (r.expected !== undefined) {
        console.log(`     Expected: ${r.expected}, Got: ${r.detected}`);
      } else if (r.error) {
        console.log(`     Error: ${r.error}`);
      }
    });
  }

  console.log(`\n${'='.repeat(70)}`);
  if (passRate === '100.0') {
    console.log('✅ SUCCESS: 100% CAPTURE DETECTION ACCURACY');
    console.log('   All capture scenarios validated successfully!');
  } else {
    console.log(`⚠️  PARTIAL SUCCESS: ${passRate}% accuracy`);
    console.log('   Review failed tests above');
  }
  console.log('='.repeat(70) + '\n');

  return passRate === '100.0';
}

// Execute
runAllCaptureTests().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('\n❌ Test runner crashed:', error);
  process.exit(1);
});
