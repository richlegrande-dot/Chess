#!/usr/bin/env node
/**
 * create-tables.mjs
 * 
 * Creates Learning Layer V3 database tables using Prisma Client
 */

import { PrismaClient } from '@prisma/client/edge';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

async function main() {
  console.log('📦 Creating Learning Layer V3 database tables...\n');
  
  const migrationPath = join(__dirname, 'prisma', 'migrations', '20251230_learning_layer_v3', 'migration.sql');
  const sql = readFileSync(migrationPath, 'utf-8');
  
  // Remove comments and split by semicolons
  const cleanSql = sql
    .split('\n')
    .filter(line => !line.trim().startsWith('--'))
    .join('\n');
  
  const statements = cleanSql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 10); // Filter out empty/tiny statements
  
  let successCount = 0;
  let skipCount = 0;
  
  for (const statement of statements) {
    try {
      await prisma.$executeRawUnsafe(statement);
      successCount++;
      
      // Extract table name for logging
      const match = statement.match(/CREATE TABLE.*?"(\w+)"/i);
      if (match) {
        console.log(`✅ Created table: ${match[1]}`);
      }
    } catch (error) {
      // Check if table already exists
      if (error.message.includes('already exists')) {
        const match = statement.match(/CREATE TABLE.*?"(\w+)"/i);
        if (match) {
          console.log(`⏭️  Table already exists: ${match[1]}`);
          skipCount++;
        }
      } else {
        console.error(`❌ Error executing statement:`, error.message);
        console.error(`Statement: ${statement.substring(0, 100)}...`);
      }
    }
  }
  
  console.log(`\n✅ Migration complete!`);
  console.log(`   Created: ${successCount} objects`);
  console.log(`   Skipped: ${skipCount} objects (already exist)`);
  
  // Verify tables exist
  console.log('\n🔍 Verifying tables...');
  
  const tables = await prisma.$queryRaw`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN ('user_concept_states', 'advice_interventions', 'practice_plans', 'learning_events')
    ORDER BY table_name
  `;
  
  console.log(`\nFound ${tables.length}/4 Learning V3 tables:`);
  tables.forEach(t => console.log(`   ✅ ${t.table_name}`));
  
  if (tables.length === 4) {
    console.log('\n🎉 All Learning V3 tables created successfully!\n');
  } else {
    console.log('\n⚠️  Some tables are missing. Check errors above.\n');
  }
}

main()
  .catch((e) => {
    console.error('❌ Failed to create tables:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
