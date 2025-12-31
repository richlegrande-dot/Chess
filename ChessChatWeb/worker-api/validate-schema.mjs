/**
 * Simple V3.1 Schema Validation
 * Confirms new tables exist in schema.prisma
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(__dirname, 'prisma', 'schema.prisma');

console.log('\n✅ V3.1 Schema Validation\n');

const schema = fs.readFileSync(schemaPath, 'utf8');

// Simple checks
const hasAnalysisCache = schema.includes('model AnalysisCache');
const hasIngestionEvent = schema.includes('model IngestionEvent');
const hasCacheKeyField = schema.includes('cacheKey');
const hasTierField = schema.includes('tierSelected');

console.log(`Schema file: ${schemaPath}`);
console.log(`\n${hasAnalysisCache ? '✅' : '❌'} AnalysisCache model found`);
console.log(`${hasIngestionEvent ? '✅' : '❌'} IngestionEvent model found`);
console.log(`${hasCacheKeyField ? '✅' : '❌'} Cache key field found`);
console.log(`${hasTierField ? '✅' : '❌'} Tier selection field found`);

if (hasAnalysisCache && hasIngestionEvent && hasCacheKeyField && hasTierField) {
  console.log('\n✅ Schema is ready for V3.1!');
  console.log('\nNext steps:');
  console.log('  1. Review schema: prisma/schema.prisma');
  console.log('  2. Generate migration: npx prisma migrate dev --name add_v3_1_tables');
  console.log('  3. Or deploy to production: npx prisma migrate deploy\n');
  process.exit(0);
} else {
  console.log('\n❌ Schema is missing V3.1 tables\n');
  process.exit(1);
}
