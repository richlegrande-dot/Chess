#!/usr/bin/env node
/**
 * create-table-manual.mjs
 * 
 * Manually creates one Learning V3 table at a time with explicit transaction handling
 */

import { PrismaClient } from '@prisma/client/edge';

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

const createUserConceptStates = `
CREATE TABLE IF NOT EXISTS "user_concept_states" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "conceptId" TEXT NOT NULL,
  "mastery" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  "mistakeRateEMA" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  "successRateEMA" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  "spacedRepDueAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3),
  "lastPracticedAt" TIMESTAMP(3),
  "evidenceRefs" JSONB NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("userId", "conceptId")
)`;

const createAdviceInterventions = `
CREATE TABLE IF NOT EXISTS "advice_interventions" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "gameId" TEXT,
  "conceptsTargeted" JSONB NOT NULL,
  "adviceText" TEXT NOT NULL,
  "messageHash" TEXT NOT NULL,
  "expectedBehavior" TEXT NOT NULL,
  "measurementCriteria" JSONB NOT NULL,
  "evaluationGames" INTEGER NOT NULL DEFAULT 5,
  "gamesEvaluated" INTEGER NOT NULL DEFAULT 0,
  "outcome" TEXT,
  "measuredDelta" DOUBLE PRECISION,
  "followUpRequired" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "evaluatedAt" TIMESTAMP(3)
)`;

const createPracticePlans = `
CREATE TABLE IF NOT EXISTS "practice_plans" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "weekStart" TIMESTAMP(3) NOT NULL,
  "focusConcepts" JSONB NOT NULL,
  "recommendedPuzzles" JSONB NOT NULL,
  "openingRecommendations" JSONB,
  "completed" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
)`;

const createLearningEvents = `
CREATE TABLE IF NOT EXISTS "learning_events" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "conceptId" TEXT,
  "gameId" TEXT,
  "delta" DOUBLE PRECISION,
  "evidence" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
)`;

async function main() {
  console.log('📦 Creating Learning Layer V3 tables manually...\n');
  
  try {
    // Create tables one by one
    console.log('Creating user_concept_states...');
    await prisma.$executeRawUnsafe(createUserConceptStates);
    console.log('✅ user_concept_states created\n');
    
    console.log('Creating advice_interventions...');
    await prisma.$executeRawUnsafe(createAdviceInterventions);
    console.log('✅ advice_interventions created\n');
    
    console.log('Creating practice_plans...');
    await prisma.$executeRawUnsafe(createPracticePlans);
    console.log('✅ practice_plans created\n');
    
    console.log('Creating learning_events...');
    await prisma.$executeRawUnsafe(createLearningEvents);
    console.log('✅ learning_events created\n');
    
    // Verify
    const tables = await prisma.$queryRaw`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('user_concept_states', 'advice_interventions', 'practice_plans', 'learning_events')
      ORDER BY table_name
    `;
    
    console.log(`🔍 Verification: Found ${tables.length}/4 tables:`);
    tables.forEach(t => console.log(`   ✅ ${t.table_name}`));
    
    if (tables.length === 4) {
      console.log('\n🎉 All Learning V3 tables created successfully!\n');
    } else {
      console.log('\n⚠️  Some tables are missing\n');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });
