const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkData() {
  try {
    const sources = await prisma.knowledgeSource.count();
    const chunks = await prisma.knowledgeChunk.count();
    const sessions = await prisma.adminSession.count();
    
    console.log('\n=== DATABASE CONTENTS ===');
    console.log(`Knowledge Sources: ${sources}`);
    console.log(`Knowledge Chunks: ${chunks}`);
    console.log(`Admin Sessions: ${sessions}`);
    
    if (sources > 0) {
      console.log('\n=== KNOWLEDGE SOURCES ===');
      const sourceList = await prisma.knowledgeSource.findMany({
        select: {
          name: true,
          type: true,
          status: true,
          _count: {
            select: { chunks: true }
          }
        }
      });
      sourceList.forEach(s => {
        console.log(`- ${s.name} (${s.type}): ${s._count.chunks} chunks, status: ${s.status}`);
      });
    }
    
    console.log('\n=========================\n');
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkData();
