#!/usr/bin/env node
/**
 * test-with-mock-data.mjs
 * 
 * Inserts mock data and tests Learning V3 endpoints
 */

import { PrismaClient } from '@prisma/client/edge';

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

async function main() {
  console.log('🧪 Testing Learning V3 with mock data...\n');
  
  const testUserId = 'test-user-' + Date.now();
  
  try {
    // 1. Insert mock concept states
    console.log('1️⃣  Inserting mock concept states...');
    
    await prisma.userConceptState.createMany({
      data: [
        {
          id: `state-1-${testUserId}`,
          userId: testUserId,
          conceptId: 'TACTICAL_FORK',
          mastery: 0.3,
          confidence: 0.5,
          mistakeRateEMA: 0.6,
          successRateEMA: 0.4,
          spacedRepDueAt: new Date(),
          evidenceRefs: JSON.stringify([{ gameId: 'game-1', ply: 15 }]),
        },
        {
          id: `state-2-${testUserId}`,
          userId: testUserId,
          conceptId: 'OPENING_CONTROL_CENTER',
          mastery: 0.7,
          confidence: 0.8,
          mistakeRateEMA: 0.2,
          successRateEMA: 0.8,
          spacedRepDueAt: new Date(),
          evidenceRefs: JSON.stringify([]),
        },
        {
          id: `state-3-${testUserId}`,
          userId: testUserId,
          conceptId: 'ENDGAME_PAWN_STRUCTURE',
          mastery: 0.5,
          confidence: 0.6,
          mistakeRateEMA: 0.4,
          successRateEMA: 0.6,
          spacedRepDueAt: new Date(),
          evidenceRefs: JSON.stringify([]),
        }
      ]
    });
    
    console.log('   ✅ Created 3 concept states\n');
    
    // 2. Verify states were created
    console.log('2️⃣  Verifying concept states...');
    const states = await prisma.userConceptState.findMany({
      where: { userId: testUserId }
    });
    console.log(`   ✅ Found ${states.length} concept states for user\n`);
    
    // 3. Insert mock learning event
    console.log('3️⃣  Inserting mock learning event...');
    await prisma.learningEvent.create({
      data: {
        id: `event-1-${testUserId}`,
        ts: new Date(),
        userId: testUserId,
        eventType: 'ingestion',
        payload: JSON.stringify({
          gameId: 'game-123',
          conceptsDetected: ['TACTICAL_FORK'],
          result: 'success'
        })
      }
    });
    console.log('   ✅ Created learning event\n');
    
    // 4. Insert mock practice plan
    console.log('4️⃣  Inserting mock practice plan...');
    const now = new Date();
    const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    await prisma.practicePlan.create({
      data: {
        id: `plan-1-${testUserId}`,
        userId: testUserId,
        planStart: now,
        planEnd: weekLater,
        targetConcepts: JSON.stringify([
          { conceptId: 'TACTICAL_FORK', priority: 1.0, reason: 'Low mastery (30%)' }
        ]),
        suggestedDrills: JSON.stringify([
          'Practice fork puzzles (10-15 problems)',
          'Play at least 3 games this week'
        ]),
        completed: false
      }
    });
    console.log('   ✅ Created practice plan\n');
    
    // 5. Insert mock advice intervention
    console.log('5️⃣  Inserting mock advice intervention...');
    await prisma.adviceIntervention.create({
      data: {
        id: `advice-1-${testUserId}`,
        userId: testUserId,
        gameId: 'game-123',
        conceptsTargeted: JSON.stringify(['TACTICAL_FORK']),
        adviceText: 'Focus on looking for fork opportunities in your games',
        messageHash: 'hash-123',
        expectedBehavior: 'Increase fork detection rate',
        measurementCriteria: JSON.stringify({ metric: 'fork_success_rate', threshold: 0.5 }),
        evaluationGames: 5,
        gamesEvaluated: 0
      }
    });
    console.log('   ✅ Created advice intervention\n');
    
    // 6. Verify all data
    console.log('6️⃣  Final verification...\n');
    
    const finalStates = await prisma.userConceptState.count({ where: { userId: testUserId }});
    const events = await prisma.learningEvent.count({ where: { userId: testUserId }});
    const plans = await prisma.practicePlan.count({ where: { userId: testUserId }});
    const advice = await prisma.adviceIntervention.count({ where: { userId: testUserId }});
    
    console.log('   📊 Summary:');
    console.log(`      - Concept States: ${finalStates}`);
    console.log(`      - Learning Events: ${events}`);
    console.log(`      - Practice Plans: ${plans}`);
    console.log(`      - Advice Interventions: ${advice}`);
    
    if (finalStates === 3 && events === 1 && plans === 1 && advice === 1) {
      console.log('\n✅ All mock data inserted successfully!');
      console.log(`\n📝 Test User ID: ${testUserId}`);
      console.log('\n🧹 To clean up, run:');
      console.log(`   DELETE FROM user_concept_states WHERE "userId" = '${testUserId}';`);
      console.log(`   DELETE FROM learning_events WHERE "userId" = '${testUserId}';`);
      console.log(`   DELETE FROM practice_plans WHERE "userId" = '${testUserId}';`);
      console.log(`   DELETE FROM advice_interventions WHERE "userId" = '${testUserId}';\n`);
    } else {
      console.log('\n⚠️  Data mismatch - some records may not have been created\n');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });
