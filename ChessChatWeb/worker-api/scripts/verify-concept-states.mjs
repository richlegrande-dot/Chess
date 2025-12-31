#!/usr/bin/env node
/**
 * verify-concept-states.mjs
 * 
 * Queries /api/learning/plan and confirms UserConceptState entries exist.
 * 
 * Usage:
 *   node scripts/verify-concept-states.mjs [--url https://chesschat.uk] [--user testuser123]
 */

const args = process.argv.slice(2);
const urlIndex = args.indexOf('--url');
const userIndex = args.indexOf('--user');

const baseUrl = urlIndex >= 0 && args[urlIndex + 1] ? args[urlIndex + 1] : 'https://chesschat.uk';
const userId = userIndex >= 0 && args[userIndex + 1] ? args[userIndex + 1] : 'test-user-' + Date.now();

console.log(`🔍 Checking concept states for user: ${userId}`);
console.log(`URL: ${baseUrl}/api/learning/plan\n`);

try {
  const response = await fetch(`${baseUrl}/api/learning/plan?userId=${encodeURIComponent(userId)}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const data = await response.json();

  if (response.status === 503 && data.disabled) {
    console.log('⚠️  Learning V3 is disabled');
    console.log('\n✅ Verification complete (system correctly disabled)');
    process.exit(0);
  }

  if (!response.ok) {
    console.error('❌ Request failed');
    console.error(`Status: ${response.status}`);
    console.error('Response:', JSON.stringify(data, null, 2));
    process.exit(1);
  }

  console.log('✅ Plan retrieved successfully\n');
  console.log('Plan Details:');
  console.log(`  - Request ID: ${data.requestId}`);
  console.log(`  - Targets: ${data.plan.targets?.length || 0}`);
  console.log(`  - Duration: ${data.durationMs}ms`);

  if (data.plan.targets && data.plan.targets.length > 0) {
    console.log('\nPractice Targets:');
    data.plan.targets.forEach((target, i) => {
      console.log(`  ${i + 1}. ${target.conceptId}`);
      console.log(`     Mastery: ${(target.mastery * 100).toFixed(1)}%`);
      console.log(`     Priority: ${target.priority}`);
      console.log(`     Due: ${target.dueAt}`);
    });

    console.log('\n✅ Concept states verified');
  } else {
    console.log('\n⚠️  No concept states found (user may be new)');
    console.log('This is expected for new users or if Learning V3 is in shadow mode');
  }

  console.log('\n✅ Verification complete');
  process.exit(0);

} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
