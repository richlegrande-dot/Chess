import https from 'https';

console.log('\n=== PRODUCTION CHESS ENGINE TESTING (WITH OPENING BOOK + BUDGET FIX) ===\n');

const tests = [
  { name: 'Starting Position', fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', difficulty: 'medium', expectBook: true },
  { name: 'After 1.e4', fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1', difficulty: 'easy', expectBook: true },
  { name: 'After 1.e4 e5', fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2', difficulty: 'medium', expectBook: true },
  { name: 'Midgame', fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4', difficulty: 'medium', expectBook: false },
  { name: 'Endgame', fen: '8/8/4k3/8/8/4K3/4P3/8 w - - 0 1', difficulty: 'hard', expectBook: false },
  { name: 'Complex Position', fen: 'r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 0 8', difficulty: 'expert', expectBook: false }
];

let results = [];
let current = 0;

function runTest() {
  if (current >= tests.length) {
    printSummary();
    return;
  }

  const test = tests[current];
  console.log(`Test ${current + 1}/${tests.length}: ${test.name} (${test.difficulty})`);

  const postData = JSON.stringify({
    fen: test.fen,
    difficulty: test.difficulty,
    userId: 'test-' + Date.now()
  });

  const options = {
    hostname: 'chesschat-web.pages.dev',
    path: '/api/chess-move?debug=1',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': postData.length
    },
    timeout: 10000
  };

  const start = Date.now();
  const req = https.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      const totalTime = Date.now() - start;
      try {
        const result = JSON.parse(data);
        const engineMs = result.debug?.engineMs || totalTime;
        const usedBook = result.debug?.usedOpeningBook || false;
        const mode = result.debug?.mode || 'unknown';
        
        const engineOK = engineMs <= 800;
        const totalOK = totalTime <= 1500;
        const bookOK = test.expectBook ? usedBook : true;
        const passed = engineOK && totalOK && bookOK;
        
        console.log(`  Move: ${result.move}`);
        console.log(`  Engine: ${engineMs.toFixed(0)}ms ${engineOK ? '✅' : '❌'}`);
        console.log(`  Total: ${totalTime}ms ${totalOK ? '✅' : '❌'}`);
        console.log(`  Mode: ${mode}`);
        if (test.expectBook) {
          console.log(`  Book: ${usedBook ? '✅' : '❌'}`);
        }
        console.log(`  ${passed ? '✅ PASS' : '❌ FAIL'}`);
        
        results.push({ test: test.name, engineMs, totalTime, mode, usedBook, expectBook: test.expectBook, passed });
      } catch (e) {
        console.log(`  ❌ Parse error`);
        results.push({ test: test.name, totalTime, passed: false, error: 'Parse error' });
      }
      
      current++;
      setTimeout(runTest, 500);
    });
  });

  req.on('timeout', () => {
    console.log(`  ❌ TIMEOUT`);
    req.destroy();
    results.push({ test: test.name, passed: false, error: 'Timeout' });
    current++;
    setTimeout(runTest, 500);
  });

  req.on('error', (e) => {
    console.log(`  ❌ Error: ${e.message}`);
    results.push({ test: test.name, passed: false, error: e.message });
    current++;
    setTimeout(runTest, 500);
  });

  req.write(postData);
  req.end();
}

function printSummary() {
  console.log('\n=== SUMMARY ===\n');
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const avgEngine = results.reduce((sum, r) => sum + (r.engineMs || 0), 0) / results.length;
  const maxEngine = Math.max(...results.map(r => r.engineMs || 0));
  const bookTests = results.filter(r => r.expectBook);
  const usedBook = bookTests.filter(r => r.usedBook).length;
  
  console.log(`Tests: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log(`Engine Time: Avg ${avgEngine.toFixed(0)}ms | Max ${maxEngine.toFixed(0)}ms`);
  console.log(`Opening Book: ${usedBook}/${bookTests.length} ${usedBook === bookTests.length ? '✅' : '❌'}`);
  
  if (failed === 0 && usedBook === bookTests.length) {
    console.log('\n🎉 SUCCESS: Opening latency fixed!\n');
  } else {
    console.log('\n⚠️  Issues detected - check deployment\n');
  }
}

runTest();
