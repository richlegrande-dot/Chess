/**
 * Database Connection Test Script
 * Tests connectivity to Prisma Accelerate and database operations
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testDatabaseConnection() {
  console.log('🔍 Testing Database Connection...\n');
  
  const tests = {
    passed: 0,
    failed: 0,
    errors: [] as string[]
  };

  try {
    // Test 1: Basic Connection
    console.log('Test 1: Basic Connection');
    await prisma.$connect();
    console.log('✅ Connected to database successfully\n');
    tests.passed++;
  } catch (error) {
    console.error('❌ Failed to connect to database');
    console.error('Error:', error);
    tests.failed++;
    tests.errors.push(`Connection: ${error}`);
  }

  try {
    // Test 2: Query Test - Count Knowledge Sources
    console.log('Test 2: Query Test - Knowledge Sources');
    const sourceCount = await prisma.knowledgeSource.count();
    console.log(`✅ Found ${sourceCount} knowledge sources\n`);
    tests.passed++;
  } catch (error) {
    console.error('❌ Failed to query knowledge sources');
    console.error('Error:', error);
    tests.failed++;
    tests.errors.push(`Query KnowledgeSources: ${error}`);
  }

  try {
    // Test 3: Query Test - Count Knowledge Chunks
    console.log('Test 3: Query Test - Knowledge Chunks');
    const chunkCount = await prisma.knowledgeChunk.count();
    console.log(`✅ Found ${chunkCount} knowledge chunks\n`);
    tests.passed++;
  } catch (error) {
    console.error('❌ Failed to query knowledge chunks');
    console.error('Error:', error);
    tests.failed++;
    tests.errors.push(`Query KnowledgeChunks: ${error}`);
  }

  try {
    // Test 4: Query Test - Count Game Records
    console.log('Test 4: Query Test - Game Records');
    const gameCount = await prisma.gameRecord.count();
    console.log(`✅ Found ${gameCount} game records\n`);
    tests.passed++;
  } catch (error) {
    console.error('❌ Failed to query game records');
    console.error('Error:', error);
    tests.failed++;
    tests.errors.push(`Query GameRecords: ${error}`);
  }

  try {
    // Test 5: Write Test - Create and Delete Test Source
    console.log('Test 5: Write Test - Create and Delete');
    const testSource = await prisma.knowledgeSource.create({
      data: {
        title: 'Test Connection Source',
        sourceType: 'NOTE',
        isDeleted: false
      }
    });
    console.log(`✅ Created test source: ${testSource.id}`);
    
    await prisma.knowledgeSource.delete({
      where: { id: testSource.id }
    });
    console.log(`✅ Deleted test source successfully\n`);
    tests.passed++;
  } catch (error) {
    console.error('❌ Failed write test');
    console.error('Error:', error);
    tests.failed++;
    tests.errors.push(`Write Test: ${error}`);
  }

  try {
    // Test 6: Database Health Check
    console.log('Test 6: Database Health Check');
    const result = await prisma.$queryRaw`SELECT 1 as health_check`;
    console.log('✅ Database health check passed\n');
    tests.passed++;
  } catch (error) {
    console.error('❌ Database health check failed');
    console.error('Error:', error);
    tests.failed++;
    tests.errors.push(`Health Check: ${error}`);
  }

  // Disconnect
  await prisma.$disconnect();

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(50));
  console.log(`✅ Passed: ${tests.passed}`);
  console.log(`❌ Failed: ${tests.failed}`);
  console.log(`📈 Success Rate: ${((tests.passed / (tests.passed + tests.failed)) * 100).toFixed(1)}%`);
  
  if (tests.failed > 0) {
    console.log('\n❌ ERRORS ENCOUNTERED:');
    tests.errors.forEach((error, index) => {
      console.log(`${index + 1}. ${error}`);
    });
    process.exit(1);
  } else {
    console.log('\n✅ All database tests passed!');
    process.exit(0);
  }
}

// Run tests
testDatabaseConnection().catch((error) => {
  console.error('\n💥 Unexpected error during testing:');
  console.error(error);
  process.exit(1);
});
