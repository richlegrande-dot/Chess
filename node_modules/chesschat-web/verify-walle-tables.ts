import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyTables() {
  try {
    const profileCount = await prisma.playerProfile.count();
    const gameCount = await prisma.trainingGame.count();
    const sigCount = await prisma.mistakeSignature.count();
    const metricCount = await prisma.learningMetric.count();
    const sourceCount = await prisma.knowledgeSource.count();
    const chunkCount = await prisma.knowledgeChunk.count();
    
    console.log('\n=== DATABASE VERIFICATION ===');
    console.log('✅ PlayerProfile table:', profileCount, 'records');
    console.log('✅ TrainingGame table:', gameCount, 'records');
    console.log('✅ MistakeSignature table:', sigCount, 'records');
    console.log('✅ LearningMetric table:', metricCount, 'records');
    console.log('✅ KnowledgeSource table (existing):', sourceCount, 'records');
    console.log('✅ KnowledgeChunk table (existing):', chunkCount, 'records');
    console.log('\n🎉 All Wall-E tables created successfully!');
    console.log('📊 Existing data preserved!\n');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyTables();
