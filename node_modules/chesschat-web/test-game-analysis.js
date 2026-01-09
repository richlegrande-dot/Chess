/**
 * Automated Test for Game Analysis API
 * Tests the /api/analyze-game endpoint with sample game data
 */

const PRODUCTION_URL = 'https://a6a7054e.chesschat-web.pages.dev';
const LOCAL_URL = 'http://localhost:8788';

// Sample game with captures and tactical play
const testGameData = {
  pgn: '1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. Ng5 d5 5. exd5 Nxd5 6. Nxf7 Kxf7 7. Qf3+ Ke6 8. Nc3 Nb4 9. O-O',
  playerColor: 'White',
  cpuLevel: 4,
  moveHistory: [
    { moveNum: 1, player: 'White', move: 'e4', fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1' },
    { moveNum: 1, player: 'Black', move: 'e5', fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2' },
    { moveNum: 2, player: 'White', move: 'Nf3', fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2' },
    { moveNum: 2, player: 'Black', move: 'Nc6', fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3' },
    { moveNum: 3, player: 'White', move: 'Bc4', fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3' },
    { moveNum: 3, player: 'Black', move: 'Nf6', fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4' },
    { moveNum: 4, player: 'White', move: 'Ng5', fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p1N1/2B1P3/8/PPPP1PPP/RNBQK2R b KQkq - 5 4' },
    { moveNum: 4, player: 'Black', move: 'd5', fen: 'r1bqkb1r/ppp2ppp/2n2n2/3pp1N1/2B1P3/8/PPPP1PPP/RNBQK2R w KQkq d6 0 5' },
    { moveNum: 5, player: 'White', move: 'exd5', fen: 'r1bqkb1r/ppp2ppp/2n2n2/3Pp1N1/2B5/8/PPPP1PPP/RNBQK2R b KQkq - 0 5', captured: 'p' },
    { moveNum: 5, player: 'Black', move: 'Nxd5', fen: 'r1bqkb1r/ppp2ppp/2n5/3np1N1/2B5/8/PPPP1PPP/RNBQK2R w KQkq - 0 6', captured: 'p' },
    { moveNum: 6, player: 'White', move: 'Nxf7', fen: 'r1bqkb1r/ppp2Npp/2n5/3np3/2B5/8/PPPP1PPP/RNBQK2R b KQkq - 0 6', captured: 'p' },
    { moveNum: 6, player: 'Black', move: 'Kxf7', fen: 'r1bqkb1r/ppp2kpp/2n5/3np3/2B5/8/PPPP1PPP/RNBQK2R w KQ - 0 7', captured: 'n' },
    { moveNum: 7, player: 'White', move: 'Qf3+', fen: 'r1bqkb1r/ppp2kpp/2n5/3np3/2B5/5Q2/PPPP1PPP/RNB1K2R b KQ - 1 7' },
    { moveNum: 7, player: 'Black', move: 'Ke6', fen: 'r1bqkb1r/ppp3pp/2n1k3/3np3/2B5/5Q2/PPPP1PPP/RNB1K2R w KQ - 2 8' },
    { moveNum: 8, player: 'White', move: 'Nc3', fen: 'r1bqkb1r/ppp3pp/2n1k3/3np3/2B5/2N2Q2/PPPP1PPP/R1B1K2R b KQ - 3 8' },
    { moveNum: 8, player: 'Black', move: 'Nb4', fen: 'r1bqkb1r/ppp3pp/2n1k3/4p3/1nB5/2N2Q2/PPPP1PPP/R1B1K2R w KQ - 4 9' },
    { moveNum: 9, player: 'White', move: 'O-O', fen: 'r1bqkb1r/ppp3pp/2n1k3/4p3/1nB5/2N2Q2/PPPP1PPP/R1B2RK1 b - - 5 9' },
  ]
};

// Test case with no captures
const testGameNoCaptures = {
  pgn: '1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5',
  playerColor: 'White',
  cpuLevel: 2,
  moveHistory: [
    { moveNum: 1, player: 'White', move: 'e4', fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1' },
    { moveNum: 1, player: 'Black', move: 'e5', fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2' },
    { moveNum: 2, player: 'White', move: 'Nf3', fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2' },
    { moveNum: 2, player: 'Black', move: 'Nc6', fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3' },
    { moveNum: 3, player: 'White', move: 'Bc4', fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3' },
    { moveNum: 3, player: 'Black', move: 'Bc5', fen: 'r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4' },
  ]
};

async function testAnalysisEndpoint(url, testName, gameData) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`TEST: ${testName}`);
  console.log(`URL: ${url}/api/analyze-game`);
  console.log(`${'='.repeat(60)}`);

  try {
    const startTime = Date.now();
    const response = await fetch(`${url}/api/analyze-game`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(gameData)
    });

    const elapsed = Date.now() - startTime;
    const data = await response.json();

    console.log(`\n✅ Response received in ${elapsed}ms`);
    console.log(`Status: ${response.status}`);
    
    if (data.success) {
      console.log(`\n📊 Game Statistics:`);
      console.log(`   Total Moves: ${data.gameStats?.totalMoves || 'N/A'}`);
      console.log(`   Player Moves: ${data.gameStats?.playerMoves || 'N/A'}`);
      console.log(`   Captures: ${data.gameStats?.captures || 0}`);
      console.log(`   Checks: ${data.gameStats?.checks || 0}`);
      console.log(`   Castled: ${data.gameStats?.castled ? 'Yes' : 'No'}`);
      console.log(`   Game Phase: ${data.gameStats?.gamePhase || 'N/A'}`);

      if (data.insights) {
        console.log(`\n🎯 Insights:`);
        
        if (data.insights.mistakes && data.insights.mistakes.length > 0) {
          console.log(`\n   Mistakes (${data.insights.mistakes.length}):`);
          data.insights.mistakes.forEach((m, i) => console.log(`   ${i + 1}. ${m}`));
        }
        
        if (data.insights.strengths && data.insights.strengths.length > 0) {
          console.log(`\n   Strengths (${data.insights.strengths.length}):`);
          data.insights.strengths.forEach((s, i) => console.log(`   ${i + 1}. ${s}`));
        }
        
        if (data.insights.recommendations && data.insights.recommendations.length > 0) {
          console.log(`\n   Recommendations (${data.insights.recommendations.length}):`);
          data.insights.recommendations.forEach((r, i) => console.log(`   ${i + 1}. ${r}`));
        }
      }

      if (data.tacticalPatterns && data.tacticalPatterns.length > 0) {
        console.log(`\n🎲 Tactical Patterns (${data.tacticalPatterns.length}):`);
        data.tacticalPatterns.forEach((p, i) => console.log(`   ${i + 1}. ${p}`));
      }

      // Verify capture detection
      const expectedCaptures = gameData.moveHistory.filter(m => 
        m.captured || m.move.includes('x')
      ).filter(m => m.player === gameData.playerColor).length;

      console.log(`\n🔍 Capture Detection Validation:`);
      console.log(`   Expected: ${expectedCaptures} captures`);
      console.log(`   Detected: ${data.gameStats?.captures || 0} captures`);
      
      if (expectedCaptures === data.gameStats?.captures) {
        console.log(`   ✅ PASS: Capture detection accurate`);
      } else {
        console.log(`   ⚠️ WARNING: Capture count mismatch`);
      }

      console.log(`\n✅ TEST PASSED: ${testName}`);
      return true;

    } else {
      console.log(`\n❌ TEST FAILED: ${testName}`);
      console.log(`Error: ${data.error}`);
      return false;
    }

  } catch (error) {
    console.log(`\n❌ TEST FAILED: ${testName}`);
    console.log(`Error: ${error.message}`);
    return false;
  }
}

async function runAllTests() {
  console.log('\n' + '='.repeat(60));
  console.log('GAME ANALYSIS API - AUTOMATED TEST SUITE');
  console.log('='.repeat(60));

  const results = [];

  // Test 1: Game with captures (Production)
  results.push(await testAnalysisEndpoint(
    PRODUCTION_URL,
    'Production - Game with Captures',
    testGameData
  ));

  // Test 2: Game without captures (Production)
  results.push(await testAnalysisEndpoint(
    PRODUCTION_URL,
    'Production - Game without Captures',
    testGameNoCaptures
  ));

  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('TEST SUMMARY');
  console.log(`${'='.repeat(60)}`);
  
  const passed = results.filter(r => r).length;
  const total = results.length;
  
  console.log(`Tests Passed: ${passed}/${total}`);
  console.log(`Tests Failed: ${total - passed}/${total}`);
  
  if (passed === total) {
    console.log(`\n✅ ALL TESTS PASSED`);
  } else {
    console.log(`\n⚠️ SOME TESTS FAILED`);
  }
  
  console.log(`${'='.repeat(60)}\n`);

  return passed === total;
}

// Run tests
runAllTests().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('Test runner error:', error);
  process.exit(1);
});
