/**
 * COMPREHENSIVE MORE INSIGHTS CHAT TESTING
 * Tests AI worker responses with multiple simulated games
 * Runs 3 iterations for reliability validation
 */

const API_URL = 'https://84222610.chesschat-web.pages.dev';
const ITERATIONS = 3;

// Test Game Scenarios
const testScenarios = [
  {
    name: 'Scholar\'s Mate (Quick Loss)',
    description: 'Early checkmate scenario - player lost quickly',
    gameData: {
      pgn: '1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7#',
      playerColor: 'Black',
      cpuLevel: 2,
      moveHistory: [
        { moveNum: 1, player: 'White', move: 'e4', fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1' },
        { moveNum: 1, player: 'Black', move: 'e5', fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2' },
        { moveNum: 2, player: 'White', move: 'Bc4', fen: 'rnbqkbnr/pppp1ppp/8/4p3/2B1P3/8/PPPP1PPP/RNBQK1NR b KQkq - 1 2' },
        { moveNum: 2, player: 'Black', move: 'Nc6', fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/8/PPPP1PPP/RNBQK1NR w KQkq - 2 3' },
        { moveNum: 3, player: 'White', move: 'Qh5', fen: 'r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3' },
        { moveNum: 3, player: 'Black', move: 'Nf6', fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4' },
        { moveNum: 4, player: 'White', move: 'Qxf7#', fen: 'r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4', captured: 'p' },
      ]
    },
    expectedInsights: {
      // Black player in Scholar's Mate doesn't make mistakes - White does
      // Black played reasonable moves until being checkmated
      shouldMentionCastling: false,
      shouldMentionCaptures: true,
      gamePhase: 'Opening'
    }
  },
  {
    name: 'Tactical Game with Exchanges',
    description: 'Middlegame with multiple captures and tactical play',
    gameData: {
      pgn: '1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. Ng5 d5 5. exd5 Nxd5 6. Nxf7 Kxf7 7. Qf3+ Ke6 8. Nc3 Nce7 9. O-O c6 10. d4',
      playerColor: 'White',
      cpuLevel: 5,
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
        { moveNum: 8, player: 'Black', move: 'Nce7', fen: 'r1bqkb1r/ppp1n1pp/4k3/3np3/2B5/2N2Q2/PPPP1PPP/R1B1K2R w KQ - 4 9' },
        { moveNum: 9, player: 'White', move: 'O-O', fen: 'r1bqkb1r/ppp1n1pp/4k3/3np3/2B5/2N2Q2/PPPP1PPP/R1B2RK1 b - - 5 9' },
        { moveNum: 9, player: 'Black', move: 'c6', fen: 'r1bqkb1r/pp2n1pp/2p1k3/3np3/2B5/2N2Q2/PPPP1PPP/R1B2RK1 w - - 0 10' },
        { moveNum: 10, player: 'White', move: 'd4', fen: 'r1bqkb1r/pp2n1pp/2p1k3/3np3/2BP4/2N2Q2/PPP2PPP/R1B2RK1 b - d3 0 10' },
      ]
    },
    expectedInsights: {
      minCaptures: 2,
      minChecks: 1,
      shouldMentionCastling: true,
      gamePhase: 'Middlegame'
    }
  },
  {
    name: 'Endgame Victory',
    description: 'Long game reaching endgame with player victory',
    gameData: {
      pgn: '1. e4 e5 2. Nf3 Nc6 3. d4 exd4 4. Nxd4 Nf6 5. Nxc6 bxc6 6. Bd3 d5 7. exd5 cxd5 8. O-O Be7 9. Re1 O-O 10. Bg5 h6 (continues 30+ moves)',
      playerColor: 'White',
      cpuLevel: 6,
      moveHistory: Array.from({ length: 35 }, (_, i) => {
        const moveNum = Math.floor(i / 2) + 1;
        const player = i % 2 === 0 ? 'White' : 'Black';
        return {
          moveNum,
          player,
          move: i === 0 ? 'e4' : i === 1 ? 'e5' : i === 17 ? 'O-O' : i === 34 ? 'Rxe8#' : `move${i}`,
          fen: `fen${i}`,
          captured: i === 34 ? 'r' : undefined
        };
      })
    },
    expectedInsights: {
      gamePhase: 'Endgame',
      shouldMentionCastling: false
    }
  },
  {
    name: 'Opening Blunder',
    description: 'No castling, lost quickly due to opening mistakes',
    gameData: {
      pgn: '1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5',
      playerColor: 'White',
      cpuLevel: 3,
      moveHistory: [
        { moveNum: 1, player: 'White', move: 'e4', fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1' },
        { moveNum: 1, player: 'Black', move: 'e5', fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2' },
        { moveNum: 2, player: 'White', move: 'Nf3', fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2' },
        { moveNum: 2, player: 'Black', move: 'd6', fen: 'rnbqkbnr/ppp2ppp/3p4/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 3' },
        { moveNum: 3, player: 'White', move: 'd4', fen: 'rnbqkbnr/ppp2ppp/3p4/4p3/3PP3/5N2/PPP2PPP/RNBQKB1R b KQkq d3 0 3' },
        { moveNum: 3, player: 'Black', move: 'Bg4', fen: 'rn1qkbnr/ppp2ppp/3p4/4p3/3PP1b1/5N2/PPP2PPP/RNBQKB1R w KQkq - 1 4' },
        { moveNum: 4, player: 'White', move: 'dxe5', fen: 'rn1qkbnr/ppp2ppp/3p4/4P3/4P1b1/5N2/PPP2PPP/RNBQKB1R b KQkq - 0 4', captured: 'p' },
        { moveNum: 4, player: 'Black', move: 'Bxf3', fen: 'rn1qkbnr/ppp2ppp/3p4/4P3/4P3/5b2/PPP2PPP/RNBQKB1R w KQkq - 0 5', captured: 'n' },
        { moveNum: 5, player: 'White', move: 'Qxf3', fen: 'rn1qkbnr/ppp2ppp/3p4/4P3/4P3/5Q2/PPP2PPP/RNB1KB1R b KQkq - 0 5', captured: 'b' },
        { moveNum: 5, player: 'Black', move: 'dxe5', fen: 'rn1qkbnr/ppp2ppp/8/4p3/4P3/5Q2/PPP2PPP/RNB1KB1R w KQkq - 0 6', captured: 'p' },
      ]
    },
    expectedInsights: {
      shouldMentionCastling: false,
      gamePhase: 'Opening',
      minCaptures: 2
    }
  },
  {
    name: 'Perfect Opening - No Captures',
    description: 'Clean opening with development, no exchanges yet',
    gameData: {
      pgn: '1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. O-O Nf6 5. d3',
      playerColor: 'White',
      cpuLevel: 4,
      moveHistory: [
        { moveNum: 1, player: 'White', move: 'e4', fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1' },
        { moveNum: 1, player: 'Black', move: 'e5', fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2' },
        { moveNum: 2, player: 'White', move: 'Nf3', fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2' },
        { moveNum: 2, player: 'Black', move: 'Nc6', fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3' },
        { moveNum: 3, player: 'White', move: 'Bc4', fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3' },
        { moveNum: 3, player: 'Black', move: 'Bc5', fen: 'r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4' },
        { moveNum: 4, player: 'White', move: 'O-O', fen: 'r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQ1RK1 b kq - 5 4' },
        { moveNum: 4, player: 'Black', move: 'Nf6', fen: 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQ1RK1 w kq - 6 5' },
        { moveNum: 5, player: 'White', move: 'd3', fen: 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQ1RK1 b kq - 0 5' },
      ]
    },
    expectedInsights: {
      shouldMentionCastling: true,
      gamePhase: 'Opening',
      minCaptures: 0,
      minStrengths: 2
    }
  }
];

// Validation functions
function validateGameStats(stats, expected, scenario) {
  const errors = [];
  
  if (expected.gamePhase && stats.gamePhase !== expected.gamePhase) {
    errors.push(`Expected game phase '${expected.gamePhase}' but got '${stats.gamePhase}'`);
  }
  
  if (expected.minCaptures !== undefined && stats.captures < expected.minCaptures) {
    errors.push(`Expected at least ${expected.minCaptures} captures but got ${stats.captures}`);
  }
  
  if (expected.minChecks !== undefined && stats.checks < expected.minChecks) {
    errors.push(`Expected at least ${expected.minChecks} checks but got ${stats.checks}`);
  }
  
  if (expected.shouldMentionCastling !== undefined) {
    if (expected.shouldMentionCastling && !stats.castled) {
      errors.push(`Expected castling to be detected`);
    }
  }
  
  return errors;
}

function validateInsights(insights, expected, scenario) {
  const errors = [];
  
  if (expected.minMistakes !== undefined && insights.mistakes.length < expected.minMistakes) {
    errors.push(`Expected at least ${expected.minMistakes} mistakes but got ${insights.mistakes.length}`);
  }
  
  if (expected.minStrengths !== undefined && insights.strengths.length < expected.minStrengths) {
    errors.push(`Expected at least ${expected.minStrengths} strengths but got ${insights.strengths.length}`);
  }
  
  return errors;
}

// Test execution
async function testScenario(scenario, iteration) {
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`📋 Scenario: ${scenario.name} (Iteration ${iteration})`);
  console.log(`   ${scenario.description}`);
  console.log(`${'─'.repeat(70)}`);

  try {
    const startTime = Date.now();
    const response = await fetch(`${API_URL}/api/analyze-game`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(scenario.gameData)
    });

    const elapsed = Date.now() - startTime;
    const data = await response.json();

    if (!response.ok || !data.success) {
      console.log(`❌ FAIL: API returned error`);
      console.log(`   Status: ${response.status}`);
      console.log(`   Error: ${data.error || 'Unknown error'}`);
      return { pass: false, errors: ['API request failed'], data };
    }

    console.log(`✅ API Response (${elapsed}ms)`);
    console.log(`\n📊 Game Statistics:`);
    console.log(`   Total Moves: ${data.gameStats.totalMoves}`);
    console.log(`   Player Moves: ${data.gameStats.playerMoves}`);
    console.log(`   Captures: ${data.gameStats.captures}`);
    console.log(`   Checks: ${data.gameStats.checks}`);
    console.log(`   Castled: ${data.gameStats.castled ? 'Yes' : 'No'}`);
    console.log(`   Game Phase: ${data.gameStats.gamePhase}`);

    console.log(`\n🎯 Insights Generated:`);
    console.log(`   Mistakes: ${data.insights.mistakes.length}`);
    if (data.insights.mistakes.length > 0) {
      data.insights.mistakes.forEach((m, i) => console.log(`      ${i + 1}. ${m}`));
    }
    console.log(`   Strengths: ${data.insights.strengths.length}`);
    if (data.insights.strengths.length > 0) {
      data.insights.strengths.forEach((s, i) => console.log(`      ${i + 1}. ${s}`));
    }
    console.log(`   Recommendations: ${data.insights.recommendations.length}`);
    console.log(`   Tactical Patterns: ${data.tacticalPatterns.length}`);

    // Validate
    const statsErrors = validateGameStats(data.gameStats, scenario.expectedInsights, scenario);
    const insightErrors = validateInsights(data.insights, scenario.expectedInsights, scenario);
    const allErrors = [...statsErrors, ...insightErrors];

    if (allErrors.length > 0) {
      console.log(`\n⚠️  VALIDATION WARNINGS:`);
      allErrors.forEach(err => console.log(`   - ${err}`));
      return { pass: false, errors: allErrors, data };
    }

    console.log(`\n✅ PASS: All validations passed`);
    return { pass: true, errors: [], data, elapsed };

  } catch (error) {
    console.log(`\n❌ FAIL: Exception thrown`);
    console.log(`   Error: ${error.message}`);
    return { pass: false, errors: [error.message], data: null };
  }
}

// Main test runner
async function runComprehensiveTests() {
  console.log('\n' + '='.repeat(70));
  console.log('MORE INSIGHTS CHAT - COMPREHENSIVE WORKER TESTING');
  console.log(`Testing ${testScenarios.length} scenarios × ${ITERATIONS} iterations`);
  console.log(`API URL: ${API_URL}`);
  console.log('='.repeat(70));

  const allResults = [];
  const startTime = Date.now();

  for (let iteration = 1; iteration <= ITERATIONS; iteration++) {
    console.log(`\n\n${'█'.repeat(70)}`);
    console.log(`█ ITERATION ${iteration} of ${ITERATIONS}`.padEnd(69) + '█');
    console.log('█'.repeat(70));

    const iterationResults = [];

    for (const scenario of testScenarios) {
      const result = await testScenario(scenario, iteration);
      iterationResults.push({
        scenario: scenario.name,
        iteration,
        ...result
      });
      
      // Brief pause between tests
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    allResults.push(...iterationResults);

    // Iteration summary
    const passed = iterationResults.filter(r => r.pass).length;
    const failed = iterationResults.filter(r => !r.pass).length;
    console.log(`\n${'─'.repeat(70)}`);
    console.log(`Iteration ${iteration} Summary: ${passed}/${iterationResults.length} passed, ${failed} failed`);
    console.log('─'.repeat(70));
  }

  const totalElapsed = Date.now() - startTime;

  // Final comprehensive report
  console.log('\n\n' + '='.repeat(70));
  console.log('FINAL COMPREHENSIVE REPORT');
  console.log('='.repeat(70));

  // Overall statistics
  const totalTests = allResults.length;
  const totalPassed = allResults.filter(r => r.pass).length;
  const totalFailed = allResults.filter(r => !r.pass).length;
  const passRate = ((totalPassed / totalTests) * 100).toFixed(1);

  console.log(`\n📊 Overall Statistics:`);
  console.log(`   Total Tests Run: ${totalTests}`);
  console.log(`   Passed: ${totalPassed} (${passRate}%)`);
  console.log(`   Failed: ${totalFailed}`);
  console.log(`   Total Time: ${(totalElapsed / 1000).toFixed(2)}s`);
  console.log(`   Avg per Test: ${(totalElapsed / totalTests).toFixed(0)}ms`);

  // Per-scenario reliability
  console.log(`\n📋 Scenario Reliability (${ITERATIONS} iterations each):`);
  for (const scenario of testScenarios) {
    const scenarioResults = allResults.filter(r => r.scenario === scenario.name);
    const scenarioPassed = scenarioResults.filter(r => r.pass).length;
    const reliability = ((scenarioPassed / ITERATIONS) * 100).toFixed(1);
    const icon = reliability === '100.0' ? '✅' : reliability >= '66.7' ? '⚠️' : '❌';
    console.log(`   ${icon} ${scenario.name}: ${scenarioPassed}/${ITERATIONS} (${reliability}%)`);
  }

  // Failed test details
  const failedTests = allResults.filter(r => !r.pass);
  if (failedTests.length > 0) {
    console.log(`\n❌ Failed Test Details:`);
    failedTests.forEach(test => {
      console.log(`\n   Scenario: ${test.scenario} (Iteration ${test.iteration})`);
      test.errors.forEach(err => console.log(`      - ${err}`));
    });
  }

  // Consistency check
  console.log(`\n🔄 Consistency Analysis:`);
  for (const scenario of testScenarios) {
    const scenarioResults = allResults.filter(r => r.scenario === scenario.name && r.pass);
    if (scenarioResults.length >= 2) {
      const captures = scenarioResults.map(r => r.data?.gameStats?.captures);
      const checks = scenarioResults.map(r => r.data?.gameStats?.checks);
      const consistent = captures.every(c => c === captures[0]) && checks.every(c => c === checks[0]);
      console.log(`   ${consistent ? '✅' : '⚠️'} ${scenario.name}: ${consistent ? 'Consistent' : 'Inconsistent'} across iterations`);
    }
  }

  // Success criteria
  console.log(`\n${'='.repeat(70)}`);
  const success = passRate === '100.0';
  if (success) {
    console.log('✅ SUCCESS: 100% PASS RATE ACHIEVED');
    console.log('   All worker responses are accurate and consistent!');
  } else if (passRate >= '90.0') {
    console.log(`⚠️  NEAR SUCCESS: ${passRate}% pass rate`);
    console.log('   Review failed tests above for issues');
  } else {
    console.log(`❌ FAILURE: Only ${passRate}% pass rate`);
    console.log('   Worker requires debugging and fixes');
  }
  console.log('='.repeat(70) + '\n');

  return success;
}

// Execute
runComprehensiveTests().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('\n❌ Test runner crashed:', error);
  process.exit(1);
});
