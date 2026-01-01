/**
 * Test script for Phase 3: Worker async game analysis
 * 
 * Tests the /api/learning/ingest-game endpoint with the new async flow
 */

const testGame = {
  userId: 'test-user-' + Date.now(),
  gameId: 'test-game-' + Date.now(),
  pgn: '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O 9. h3 Na5 10. Bc2 c5 11. d4 Qc7 12. Nbd2 cxd4',
  playerColor: 'white'
};

console.log('🧪 Testing Phase 3: Async Game Analysis\n');
console.log('Test Data:');
console.log(`  User ID: ${testGame.userId}`);
console.log(`  Game ID: ${testGame.gameId}`);
console.log(`  PGN: ${testGame.pgn}`);
console.log(`  Player Color: ${testGame.playerColor}\n`);

console.log('📤 Sending POST /api/learning/ingest-game...\n');

fetch('https://chesschat.uk/api/learning/ingest-game', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(testGame)
})
  .then(response => {
    console.log(`✅ Response Status: ${response.status} ${response.statusText}\n`);
    return response.json();
  })
  .then(data => {
    console.log('📊 Response Data:\n');
    console.log(JSON.stringify(data, null, 2));
    
    if (data.success) {
      console.log('\n✅ Test PASSED!');
      console.log(`   Analysis Mode: ${data.analysisMode}`);
      console.log(`   Request ID: ${data.requestId}`);
      console.log(`   Message: ${data.message}`);
      
      if (data.analysisMode === 'async') {
        console.log('\n⏳ Background Analysis Status:');
        console.log('   - Game queued for async analysis');
        console.log('   - Worker will call Render /analyze-game');
        console.log('   - Results will be stored in learning_events table');
        console.log('   - Check Worker logs and database for completion');
        console.log('\n💡 To verify:');
        console.log('   1. Check Worker logs: wrangler tail');
        console.log('   2. Query learning_events table');
        console.log('   3. Look for [GameAnalysis] logs');
      } else {
        console.log('\n⚠️  Using legacy sync analysis (fallback mode)');
      }
    } else {
      console.log('\n❌ Test FAILED!');
      console.log(`   Error: ${data.error}`);
    }
  })
  .catch(error => {
    console.error('\n❌ Network Error:', error.message);
  });
