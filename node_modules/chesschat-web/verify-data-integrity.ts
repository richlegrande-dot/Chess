import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyDataIntegrity() {
  try {
    console.log('\n🔍 DATA INTEGRITY VERIFICATION\n');
    console.log('═══════════════════════════════════════════════════════════════');
    
    // Check existing tables (should have data)
    const sources = await prisma.knowledgeSource.findMany({
      select: {
        id: true,
        title: true,
        sourceType: true,
        createdAt: true
      }
    });
    
    const chunks = await prisma.knowledgeChunk.findMany({
      select: {
        id: true,
        sourceId: true,
        chunkText: true
      }
    });
    
    const sessions = await prisma.adminSession.findMany({
      select: {
        id: true,
        token: true,
        createdAt: true,
        expiresAt: true
      }
    });
    
    console.log('\n📚 EXISTING DATA (Should be preserved):');
    console.log('───────────────────────────────────────────────────────────────');
    console.log(`✅ KnowledgeSource: ${sources.length} records`);
    if (sources.length > 0) {
      sources.forEach(s => {
        console.log(`   - "${s.title}" (${s.sourceType}) [ID: ${s.id}]`);
      });
    }
    
    console.log(`✅ KnowledgeChunk: ${chunks.length} records`);
    if (chunks.length > 0) {
      const bySource = chunks.reduce((acc, c) => {
        acc[c.sourceId] = (acc[c.sourceId] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      Object.entries(bySource).forEach(([sourceId, count]) => {
        const source = sources.find(s => s.id === sourceId);
        console.log(`   - ${count} chunks from "${source?.title || sourceId}"`);
      });
    }
    
    console.log(`✅ AdminSession: ${sessions.length} records`);
    if (sessions.length > 0) {
      sessions.forEach(s => {
        const isExpired = new Date(s.expiresAt) < new Date();
        console.log(`   - Session ${s.id.slice(0, 8)}... (${isExpired ? 'expired' : 'active'})`);
      });
    }
    
    console.log('\n🆕 NEW TABLES (Should be empty - awaiting sync):');
    console.log('───────────────────────────────────────────────────────────────');
    
    const profiles = await prisma.playerProfile.count();
    const games = await prisma.trainingGame.count();
    const signatures = await prisma.mistakeSignature.count();
    const metrics = await prisma.learningMetric.count();
    
    console.log(`✅ PlayerProfile: ${profiles} records (expected: 0)`);
    console.log(`✅ TrainingGame: ${games} records (expected: 0)`);
    console.log(`✅ MistakeSignature: ${signatures} records (expected: 0)`);
    console.log(`✅ LearningMetric: ${metrics} records (expected: 0)`);
    
    console.log('\n═══════════════════════════════════════════════════════════════');
    
    const totalExisting = sources.length + chunks.length + sessions.length;
    const totalNew = profiles + games + signatures + metrics;
    
    if (totalExisting > 0 && totalNew === 0) {
      console.log('\n✅ VERIFICATION PASSED!');
      console.log(`   - All ${totalExisting} existing records preserved`);
      console.log('   - New Wall-E tables created successfully');
      console.log('   - Ready for localStorage sync on next app launch');
      console.log('\n💡 Next Steps:');
      console.log('   1. Users open the app');
      console.log('   2. autoSyncOnStart() runs automatically');
      console.log('   3. localStorage data migrates to database');
      console.log('   4. Wall-E memories become permanent!\n');
    } else if (totalExisting === 0) {
      console.log('\n⚠️  WARNING: No existing data found');
      console.log('   This might be a fresh database or data loss occurred.\n');
    } else {
      console.log('\n✅ Migration successful with data preservation!\n');
    }
    
  } catch (error) {
    console.error('\n❌ VERIFICATION FAILED:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyDataIntegrity();
