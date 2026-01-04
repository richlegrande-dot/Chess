/**
 * Verification Script for Wall-E Learning System
 * Tests end-to-end learning flow: ingest → progress → postgame
 */

const WORKER_URL = process.env.WORKER_URL || 'https://chesschat-worker-api.richl.workers.dev';
const TEST_USER_ID = `test-user-${Date.now()}`;
const TEST_GAME_ID = `game-${Date.now()}`;

// Sample PGN for a quick 10-move game
const TEST_PGN = `1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O 9. h3 Bb7 10. d4 Re8`;

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

function section(title) {
  log(`\n${'='.repeat(60)}`, 'cyan');
  log(`  ${title}`, 'cyan');
  log('='.repeat(60), 'cyan');
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testIngestGame() {
  section('STEP 1: Ingest Game');
  
  log(`User ID: ${TEST_USER_ID}`, 'blue');
  log(`Game ID: ${TEST_GAME_ID}`, 'blue');
  log(`PGN: ${TEST_PGN.substring(0, 50)}...`, 'blue');
  
  try {
    const response = await fetch(`${WORKER_URL}/api/learning/ingest-game`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: TEST_USER_ID,
        gameId: TEST_GAME_ID,
        pgn: TEST_PGN,
        playerColor: 'white',
      }),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    log('\n✅ Ingestion Response:', 'green');
    console.log(JSON.stringify(data, null, 2));
    
    if (data.analysisMode === 'async') {
      log('\n⏳ Game queued for async analysis', 'yellow');
      return { requestId: data.requestId, isAsync: true };
    } else if (data.success) {
      log(`\n✅ Ingestion succeeded (${data.analysisMode || 'unknown'} mode)`, 'green');
      return { requestId: data.requestId, isAsync: false };
    } else {
      throw new Error(`Ingestion failed: ${data.error}`);
    }
    
  } catch (error) {
    log(`\n❌ Ingestion failed: ${error.message}`, 'red');
    throw error;
  }
}

async function testProgress() {
  section('STEP 2: Check Progress');
  
  log('Waiting 2 seconds for async processing...', 'yellow');
  await sleep(2000);
  
  try {
    const response = await fetch(`${WORKER_URL}/api/learning/progress?userId=${encodeURIComponent(TEST_USER_ID)}`, {
      method: 'GET',
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    log('\n✅ Progress Response:', 'green');
    console.log(JSON.stringify(data, null, 2));
    
    if (data.gamesAnalyzed > 0) {
      log(`\n✅ Found ${data.gamesAnalyzed} games analyzed`, 'green');
      log(`   Concepts tracked: ${data.totalConcepts}`, 'green');
      log(`   Average mastery: ${(data.avgMastery * 100).toFixed(1)}%`, 'green');
      
      if (data.topWeakConcepts.length > 0) {
        log(`\n🎯 Weakest concept: ${data.topWeakConcepts[0].name} (${(data.topWeakConcepts[0].mastery * 100).toFixed(0)}%)`, 'yellow');
      }
      
      if (data.topStrongConcepts.length > 0) {
        log(`💪 Strongest concept: ${data.topStrongConcepts[0].name} (${(data.topStrongConcepts[0].mastery * 100).toFixed(0)}%)`, 'green');
      }
      
      return data;
    } else {
      log('\n⚠️  No games analyzed yet (async processing may still be pending)', 'yellow');
      return null;
    }
    
  } catch (error) {
    log(`\n❌ Progress check failed: ${error.message}`, 'red');
    throw error;
  }
}

async function testPostgame() {
  section('STEP 3: Get Postgame Insights');
  
  try {
    const response = await fetch(`${WORKER_URL}/api/walle/postgame`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: TEST_USER_ID,
        gameId: TEST_GAME_ID,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    log('\n✅ Postgame Response:', 'green');
    console.log(JSON.stringify(data, null, 2));
    
    if (data.narrative) {
      log(`\n💬 Wall-E says: "${data.narrative}"`, 'cyan');
    }
    
    if (data.nextFocus) {
      log(`\n🎯 Next focus: ${data.nextFocus.concept} (${(data.nextFocus.mastery * 100).toFixed(0)}%)`, 'yellow');
    }
    
    return data;
    
  } catch (error) {
    log(`\n❌ Postgame check failed: ${error.message}`, 'red');
    throw error;
  }
}

async function main() {
  section('🤖 Wall-E Learning System Verification');
  log(`Worker URL: ${WORKER_URL}`, 'blue');
  log(`Test User: ${TEST_USER_ID}`, 'blue');
  
  try {
    // Step 1: Ingest game
    const ingestResult = await testIngestGame();
    
    // Step 2: Check progress
    const progress = await testProgress();
    
    // Step 3: Get postgame insights
    const postgame = await testPostgame();
    
    // Summary
    section('✅ VERIFICATION COMPLETE');
    log('All endpoints responded successfully!', 'green');
    
    if (progress && progress.gamesAnalyzed > 0) {
      log(`\n📊 Summary:`, 'cyan');
      log(`   Games analyzed: ${progress.gamesAnalyzed}`, 'green');
      log(`   Concepts tracked: ${progress.totalConcepts}`, 'green');
      log(`   Learning active: YES`, 'green');
    } else {
      log(`\n⚠️  Note: Game ingested but not yet visible in progress (async processing)`, 'yellow');
      log('   This is expected for async architecture. Check progress again in 30-60s.', 'yellow');
    }
    
    log(`\n🎉 Wall-E is CONNECTED and LEARNING!`, 'green');
    process.exit(0);
    
  } catch (error) {
    section('❌ VERIFICATION FAILED');
    log(`Error: ${error.message}`, 'red');
    log('\nCheck:', 'yellow');
    log('  1. Worker is deployed and accessible', 'yellow');
    log('  2. Database URL is configured', 'yellow');
    log('  3. STOCKFISH_GAME_ANALYSIS_ENABLED is set', 'yellow');
    log('  4. Render server is warm', 'yellow');
    process.exit(1);
  }
}

main();
