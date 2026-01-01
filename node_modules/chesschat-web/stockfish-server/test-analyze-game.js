/**
 * Test script for /analyze-game endpoint
 */

const testPgn = `
1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 
6. Re1 b5 7. Bb3 d6 8. c3 O-O 9. h3 Na5 10. Bc2 c5 
11. d4 Qc7 12. Nbd2 cxd4
`;

const requestBody = {
  pgn: testPgn.trim(),
  depth: 12,
  samplingStrategy: 'smart',
  playerColor: 'white'
};

console.log('Testing /analyze-game endpoint...\n');
console.log('PGN:', requestBody.pgn);
console.log('Depth:', requestBody.depth);
console.log('Strategy:', requestBody.samplingStrategy);
console.log('\nSending request...\n');

fetch('http://localhost:3001/analyze-game', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer test-key-local'
  },
  body: JSON.stringify(requestBody)
})
  .then(response => response.json())
  .then(data => {
    console.log('✅ Response received:\n');
    console.log(JSON.stringify(data, null, 2));
    
    if (data.success) {
      console.log('\n📊 Analysis Summary:');
      console.log(`  Key Moments: ${data.keyMoments.length}`);
      console.log(`  Blunders: ${data.statistics.blunders}`);
      console.log(`  Mistakes: ${data.statistics.mistakes}`);
      console.log(`  Brilliant: ${data.statistics.brilliant}`);
      console.log(`  Accuracy: ${data.statistics.accuracy}%`);
      console.log(`  Compute Time: ${data.computeTimeMs}ms`);
      
      if (data.keyMoments.length > 0) {
        console.log('\n🔍 Key Moments:');
        data.keyMoments.forEach(moment => {
          console.log(`  Ply ${moment.ply}: ${moment.move} (${moment.classification}) - Eval swing: ${moment.evalSwing}cp`);
        });
      }
    }
  })
  .catch(error => {
    console.error('❌ Error:', error.message);
  });
