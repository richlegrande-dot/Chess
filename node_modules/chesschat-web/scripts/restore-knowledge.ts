/**
 * Restore Wall-E's Knowledge Base from backup
 * Imports knowledge sources and chunks from JSON files
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function restoreKnowledge(backupPath?: string) {
  // Use latest backup if no path specified
  const backupFile = backupPath || path.join(process.cwd(), 'backups', 'latest', 'full-backup.json');

  if (!fs.existsSync(backupFile)) {
    console.error(`❌ Backup file not found: ${backupFile}`);
    console.log(`\nAvailable backups:`);
    const backupsDir = path.join(process.cwd(), 'backups');
    if (fs.existsSync(backupsDir)) {
      const dirs = fs.readdirSync(backupsDir, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name);
      dirs.forEach(dir => console.log(`  - backups/${dir}/full-backup.json`));
    }
    process.exit(1);
  }

  console.log(`\n🔄 Restoring Wall-E's knowledge base...`);
  console.log(`📁 From: ${backupFile}\n`);

  try {
    // Read backup
    const backup = JSON.parse(fs.readFileSync(backupFile, 'utf-8'));
    
    if (!Array.isArray(backup)) {
      throw new Error('Invalid backup format');
    }

    console.log(`📦 Found ${backup.length} sources to restore\n`);

    // Restore each source
    let restoredSources = 0;
    let restoredChunks = 0;

    for (const source of backup) {
      console.log(`Processing: ${source.name}...`);

      // Check if source already exists
      const existing = await prisma.knowledgeSource.findUnique({
        where: { id: source.id },
      });

      if (existing) {
        console.log(`  ⚠️  Source already exists, skipping`);
        continue;
      }

      // Create source without chunks first
      const { chunks, ...sourceData } = source;
      const createdSource = await prisma.knowledgeSource.create({
        data: {
          ...sourceData,
          createdAt: new Date(sourceData.createdAt),
          updatedAt: new Date(sourceData.updatedAt),
        },
      });

      // Create chunks
      if (chunks && chunks.length > 0) {
        await prisma.knowledgeChunk.createMany({
          data: chunks.map((chunk: any) => ({
            ...chunk,
            sourceId: createdSource.id,
            createdAt: new Date(chunk.createdAt),
            updatedAt: new Date(chunk.updatedAt),
          })),
        });
        restoredChunks += chunks.length;
      }

      restoredSources++;
      console.log(`  ✓ Restored ${chunks.length} chunks`);
    }

    console.log(`\n✅ Restore complete!`);
    console.log(`📊 Restored: ${restoredSources} sources, ${restoredChunks} chunks\n`);

  } catch (error) {
    console.error('❌ Restore failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Get backup path from command line args
const backupPath = process.argv[2];
restoreKnowledge(backupPath);
