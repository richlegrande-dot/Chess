/**
 * Backup Wall-E's Knowledge Base to JSON files
 * Exports all knowledge sources and chunks from database
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function backupKnowledge() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(process.cwd(), 'backups', `knowledge-${timestamp}`);
  
  // Create backup directory
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  console.log(`\n📦 Backing up Wall-E's knowledge base...`);
  console.log(`📁 Backup directory: ${backupDir}\n`);

  try {
    // Export all knowledge sources
    const sources = await prisma.knowledgeSource.findMany({
      include: {
        chunks: true,
      },
    });

    console.log(`✓ Found ${sources.length} knowledge sources`);

    // Save full backup
    const fullBackupPath = path.join(backupDir, 'full-backup.json');
    fs.writeFileSync(fullBackupPath, JSON.stringify(sources, null, 2));
    console.log(`✓ Saved full backup: ${fullBackupPath}`);

    // Save each source as individual file
    let totalChunks = 0;
    for (const source of sources) {
      const safeName = (source.name || source.id || 'unknown').replace(/[^a-z0-9]/gi, '-').toLowerCase();
      const fileName = `${safeName}.json`;
      const filePath = path.join(backupDir, fileName);
      fs.writeFileSync(filePath, JSON.stringify(source, null, 2));
      totalChunks += source.chunks.length;
      console.log(`  - ${source.name || source.id}: ${source.chunks.length} chunks`);
    }

    // Create metadata file
    const metadata = {
      backupDate: new Date().toISOString(),
      totalSources: sources.length,
      totalChunks: totalChunks,
      sources: sources.map(s => ({
        id: s.id,
        name: s.name,
        type: s.type,
        status: s.status,
        chunkCount: s.chunks.length,
      })),
    };

    const metadataPath = path.join(backupDir, 'metadata.json');
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    console.log(`✓ Saved metadata: ${metadataPath}`);

    // Also save to a "latest" backup (for easy access)
    const latestDir = path.join(process.cwd(), 'backups', 'latest');
    if (!fs.existsSync(latestDir)) {
      fs.mkdirSync(latestDir, { recursive: true });
    }
    fs.writeFileSync(path.join(latestDir, 'full-backup.json'), JSON.stringify(sources, null, 2));
    fs.writeFileSync(path.join(latestDir, 'metadata.json'), JSON.stringify(metadata, null, 2));

    console.log(`\n✅ Backup complete!`);
    console.log(`📊 Total: ${sources.length} sources, ${totalChunks} chunks\n`);

  } catch (error) {
    console.error('❌ Backup failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

backupKnowledge();
