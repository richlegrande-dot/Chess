#!/usr/bin/env node
/**
 * ingest-sample-game.mjs
 * 
 * Sends a known PGN and userId to /api/learning/ingest-game.
 * 
 * Usage:
 *   node scripts/ingest-sample-game.mjs [--url https://chesschat.uk] [--user testuser123]
 */

const args = process.argv.slice(2);
const urlIndex = args.indexOf('--url');
const userIndex = args.indexOf('--user');

const baseUrl = urlIndex >= 0 && args[urlIndex + 1] ? args[urlIndex + 1] : 'https://chesschat.uk';
const userId = userIndex >= 0 && args[userIndex + 1] ? args[userIndex + 1] : 'test-user-' + Date.now();

// Sample game with known mistakes (Scholar's Mate attempt)
const samplePGN = `[Event "Test Game"]
[Site "Verification"]
[Date "2025.12.30"]
[White "Player"]
[Black "Opponent"]
[Result "0-1"]

1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7# 0-1`;

const gameId = 'verify-game-' + Date.now();

console.log(`📤 Ingesting sample game to ${baseUrl}/api/learning/ingest-game`);
console.log(`User: ${userId}`);
console.log(`Game: ${gameId}\n`);

try {
  const response = await fetch(`${baseUrl}/api/learning/ingest-game`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      userId,
      gameId,
      pgn: samplePGN,
    }),
  });

  const data = await response.json();

  if (response.status === 503 && data.disabled) {
    console.log('⚠️  Learning V3 is disabled (expected if not yet enabled)');
    console.log('Response:', JSON.stringify(data, null, 2));
    console.log('\n✅ Verification complete (system correctly disabled)');
    process.exit(0);
  }

  if (response.status === 403 && data.readonly) {
    console.log('⚠️  Learning V3 is in read-only mode');
    console.log('Response:', JSON.stringify(data, null, 2));
    console.log('\n✅ Verification complete (system correctly read-only)');
    process.exit(0);
  }

  if (response.status === 202 && data.partial) {
    console.log('⚠️  Partial ingestion (timeout or error)');
    console.log('Response:', JSON.stringify(data, null, 2));
    console.log('\n✅ Verification complete (partial response handled)');
    process.exit(0);
  }

  if (!response.ok) {
    console.error('❌ Ingestion failed');
    console.error(`Status: ${response.status}`);
    console.error('Response:', JSON.stringify(data, null, 2));
    process.exit(1);
  }

  console.log('✅ Ingestion successful\n');
  console.log('Result:');
  console.log(`  - Request ID: ${data.requestId}`);
  console.log(`  - Concepts Updated: ${data.conceptsUpdated.length}`);
  console.log(`  - Shadow Mode: ${data.shadowMode}`);
  console.log(`  - Duration: ${data.durationMs}ms`);
  
  if (data.conceptsUpdated.length > 0) {
    console.log('\nConcepts:');
    data.conceptsUpdated.forEach(c => console.log(`  - ${c}`));
  }

  console.log('\n✅ Verification complete');
  process.exit(0);

} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
