#!/usr/bin/env node
/**
 * verify-tables.mjs
 * 
 * Check if Learning V3 tables exist (read-only check)
 */

import { PrismaClient } from '@prisma/client/edge';

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

async function main() {
  console.log('🔍 Checking Learning V3 tables...\n');
  
  try {
    const tables = await prisma.$queryRaw`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('user_concept_states', 'advice_interventions', 'practice_plans', 'learning_events')
      ORDER BY table_name
    `;
    
    console.log(`Found ${tables.length}/4 Learning V3 tables:\n`);
    
    const expectedTables = ['advice_interventions', 'learning_events', 'practice_plans', 'user_concept_states'];
    
    for (const expected of expectedTables) {
      const exists = tables.some(t => t.table_name === expected);
      console.log(`${exists ? '✅' : '❌'} ${expected}`);
    }
    
    if (tables.length === 4) {
      console.log('\n🎉 All tables present! Learning V3 is ready.\n');
    } else {
      console.log('\n⚠️  Tables missing. Run migration SQL in database console.\n');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Error checking tables:', error.message);
    process.exit(1);
  }
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });
