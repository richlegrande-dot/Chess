/**
 * Database Schema Readiness Check
 * 
 * Verifies that the Prisma schema is ready for V3.1 migration.
 * Run with: node check-schema-readiness.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('\n========================================');
console.log('V3.1 Database Schema Readiness Check');
console.log('========================================\n');

// Read the Prisma schema file
const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');

if (!fs.existsSync(schemaPath)) {
  console.error('❌ ERROR: schema.prisma not found at:', schemaPath);
  process.exit(1);
}

const schemaContent = fs.readFileSync(schemaPath, 'utf8');

console.log('✅ Found schema.prisma\n');

// Check for required tables
const requiredTables = [
  {
    name: 'AnalysisCache',
    mapName: 'analysis_cache',
    fields: [
      'cacheKey',
      'fen',
      'depth',
      'evalCp',
      'mate',
      'bestMove',
      'pv',
      'hitCount',
      'createdAt',
      'expiresAt'
    ],
    indexes: ['cacheKey', 'fen', 'expiresAt']
  },
  {
    name: 'IngestionEvent',
    mapName: 'ingestion_events',
    fields: [
      'id',
      'userId',
      'gameId',
      'candidatesSelected',
      'stockfishCallsMade',
      'cacheHitRate',
      'tierSelected',
      'maxDepth',
      'positionsAnalyzed',
      'durationMs',
      'eventResult',
      'ts'
    ],
    indexes: ['id', 'userId', 'eventResult']
  }
];

let allChecksPass = true;

// Check each table
for (const table of requiredTables) {
  console.log(`Checking table: ${table.name}`);
  
  // Check if table model exists
  const tableRegex = new RegExp(`model\\s+${table.name}\\s*\\{`, 'i');
  const tableExists = tableRegex.test(schemaContent);
  
  if (!tableExists) {
    console.log(`❌ Table model "${table.name}" not found in schema`);
    allChecksPass = false;
    continue;
  }
  
  console.log(`  ✅ Model exists`);
  
  // Extract the table definition
  const modelStart = schemaContent.search(tableRegex);
  const modelEnd = schemaContent.indexOf('}', modelStart);
  const modelContent = schemaContent.substring(modelStart, modelEnd);
  
  // Check each required field
  let missingFields = [];
  for (const field of table.fields) {
    const fieldRegex = new RegExp(`\\b${field}\\s+`, 'i');
    if (!fieldRegex.test(modelContent)) {
      missingFields.push(field);
    }
  }
  
  if (missingFields.length > 0) {
    console.log(`  ❌ Missing fields: ${missingFields.join(', ')}`);
    allChecksPass = false;
  } else {
    console.log(`  ✅ All ${table.fields.length} fields present`);
  }
  
  // Check for indexes (basic check)
  const hasIndexes = modelContent.includes('@@index') || modelContent.includes('@@id') || modelContent.includes('@id');
  if (hasIndexes) {
    console.log(`  ✅ Indexes defined`);
  } else {
    console.log(`  ⚠️  Warning: No indexes found (check manually)`);
  }
  
  console.log('');
}

// Check for existing tables that shouldn't be broken
const existingTables = [
  'UserConceptState',
  'AdviceIntervention',
  'GameRecord',
  'GameAnalysis'
];

console.log('Checking existing tables (should remain unchanged):\n');

for (const table of existingTables) {
  const tableRegex = new RegExp(`model\\s+${table}\\s*\\{`, 'i');
  const tableExists = tableRegex.test(schemaContent);
  
  if (tableExists) {
    console.log(`  ✅ ${table} - present`);
  } else {
    console.log(`  ⚠️  ${table} - not found (may have been renamed)`);
  }
}

console.log('\n========================================');
console.log('Summary');
console.log('========================================\n');

if (allChecksPass) {
  console.log('✅ Schema is ready for V3.1 migration');
  console.log('✅ Both new tables are properly defined');
  console.log('✅ All required fields are present');
  console.log('\nNext steps:');
  console.log('  1. Review the schema visually: prisma/schema.prisma');
  console.log('  2. Generate migration: npx prisma migrate dev --name add_v3_1_tables');
  console.log('  3. Or for production: npx prisma migrate deploy');
  console.log('\n✅ Ready to proceed!\n');
  process.exit(0);
} else {
  console.log('❌ Schema has issues - review the errors above');
  console.log('\nRequired actions:');
  console.log('  1. Check prisma/schema.prisma for missing tables/fields');
  console.log('  2. Re-run this script after fixes');
  console.log('  3. Do NOT run migration until schema is correct');
  console.log('\n❌ Not ready for migration\n');
  process.exit(1);
}
