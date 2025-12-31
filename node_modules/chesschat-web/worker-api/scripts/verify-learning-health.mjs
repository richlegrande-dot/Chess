#!/usr/bin/env node
/**
 * verify-learning-health.mjs
 * 
 * Calls /api/admin/learning-health and validates response.
 * 
 * Usage:
 *   node scripts/verify-learning-health.mjs [--url https://chesschat.uk] [--password YOUR_ADMIN_PASSWORD]
 */

const args = process.argv.slice(2);
const urlIndex = args.indexOf('--url');
const passwordIndex = args.indexOf('--password');

const baseUrl = urlIndex >= 0 && args[urlIndex + 1] ? args[urlIndex + 1] : 'https://chesschat.uk';
const adminPassword = passwordIndex >= 0 && args[passwordIndex + 1] 
  ? args[passwordIndex + 1] 
  : process.env.ADMIN_PASSWORD;

if (!adminPassword) {
  console.error('❌ Error: ADMIN_PASSWORD required');
  console.error('Usage: node scripts/verify-learning-health.mjs --password YOUR_PASSWORD');
  process.exit(1);
}

console.log(`🔍 Checking Learning Health at ${baseUrl}/api/admin/learning-health\n`);

try {
  const response = await fetch(`${baseUrl}/api/admin/learning-health`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${adminPassword}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('❌ Health check failed');
    console.error(`Status: ${response.status}`);
    console.error('Response:', JSON.stringify(data, null, 2));
    process.exit(1);
  }

  console.log('✅ Health check successful\n');
  console.log('Configuration:');
  console.log(`  - Enabled: ${data.config.enabled}`);
  console.log(`  - Read-only: ${data.config.readonly}`);
  console.log(`  - Shadow Mode: ${data.config.shadowMode}`);
  console.log(`  - Canary: ${data.config.canaryEnabled} (${data.config.canaryPercentage}%)`);
  console.log('\nTable Counts:');
  console.log(`  - User Concept States: ${data.tables.userConceptStates}`);
  console.log(`  - Advice Interventions: ${data.tables.adviceInterventions}`);
  console.log(`  - Practice Plans: ${data.tables.practicePlans}`);
  console.log(`  - Learning Events: ${data.tables.learningEvents}`);
  console.log(`\nStatus: ${data.status}`);
  console.log(`Duration: ${data.durationMs}ms`);

  // Assertions
  if (data.tables.userConceptStates < 0) {
    throw new Error('Invalid userConceptStates count');
  }
  if (data.tables.adviceInterventions < 0) {
    throw new Error('Invalid adviceInterventions count');
  }
  if (data.tables.practicePlans < 0) {
    throw new Error('Invalid practicePlans count');
  }
  if (data.tables.learningEvents < 0) {
    throw new Error('Invalid learningEvents count');
  }

  console.log('\n✅ All assertions passed');
  process.exit(0);

} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
