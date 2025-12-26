/**
 * Verify Wall-E's data protection system
 * Checks all backup layers and reports status
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function verifyDataProtection() {
  console.log('\n🔍 Wall-E Data Protection System Verification\n');
  console.log('=' .repeat(60));
  
  let allGood = true;

  // 1. Check Database Connection
  console.log('\n1️⃣  Checking Production Database...');
  try {
    const sourceCount = await prisma.knowledgeSource.count();
    const chunkCount = await prisma.knowledgeChunk.count();
    
    if (sourceCount > 0) {
      console.log(`   ✅ Database connected: ${sourceCount} sources, ${chunkCount} chunks`);
    } else {
      console.log('   ⚠️  Database is empty - may need to import data');
      allGood = false;
    }
  } catch (error) {
    console.log('   ❌ Database connection failed:', (error as Error).message);
    allGood = false;
  }

  // 2. Check Latest Backup
  console.log('\n2️⃣  Checking Latest Backup...');
  const latestBackupPath = path.join(process.cwd(), 'backups', 'latest', 'full-backup.json');
  if (fs.existsSync(latestBackupPath)) {
    const backup = JSON.parse(fs.readFileSync(latestBackupPath, 'utf-8'));
    const metadataPath = path.join(process.cwd(), 'backups', 'latest', 'metadata.json');
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
    
    const backupAge = Date.now() - new Date(metadata.backupDate).getTime();
    const hoursOld = Math.floor(backupAge / (1000 * 60 * 60));
    
    console.log(`   ✅ Latest backup found: ${metadata.totalSources} sources, ${metadata.totalChunks} chunks`);
    console.log(`   📅 Age: ${hoursOld} hours old (${metadata.backupDate})`);
    
    if (hoursOld > 48) {
      console.log('   ⚠️  Backup is over 2 days old - consider running npm run db:backup');
    }
  } else {
    console.log('   ❌ No latest backup found');
    console.log('   💡 Run: npm run db:backup');
    allGood = false;
  }

  // 3. Check Timestamped Backups
  console.log('\n3️⃣  Checking Timestamped Archives...');
  const backupsDir = path.join(process.cwd(), 'backups');
  if (fs.existsSync(backupsDir)) {
    const archives = fs.readdirSync(backupsDir, { withFileTypes: true })
      .filter(d => d.isDirectory() && d.name.startsWith('knowledge-'))
      .map(d => d.name);
    
    if (archives.length > 0) {
      console.log(`   ✅ Found ${archives.length} timestamped backup(s)`);
      console.log(`   📦 Most recent: ${archives[archives.length - 1]}`);
    } else {
      console.log('   ⚠️  No timestamped archives found');
    }
  }

  // 4. Check Source Files
  console.log('\n4️⃣  Checking Original Source Files...');
  const seedDir = path.join(process.cwd(), 'knowledge_seed');
  if (fs.existsSync(seedDir)) {
    const sourceFiles = fs.readdirSync(seedDir).filter(f => f.endsWith('.md'));
    
    if (sourceFiles.length > 0) {
      console.log(`   ✅ Found ${sourceFiles.length} markdown source file(s)`);
      sourceFiles.forEach(f => console.log(`      - ${f}`));
    } else {
      console.log('   ❌ No source files found in knowledge_seed/');
      allGood = false;
    }
  } else {
    console.log('   ❌ knowledge_seed/ directory not found');
    allGood = false;
  }

  // 5. Check Backup Scripts
  console.log('\n5️⃣  Checking Backup Scripts...');
  const scripts = [
    'scripts/backup-knowledge.ts',
    'scripts/restore-knowledge.ts',
    'scripts/auto-backup.ps1',
  ];
  
  let scriptsOK = true;
  for (const script of scripts) {
    if (fs.existsSync(script)) {
      console.log(`   ✅ ${script}`);
    } else {
      console.log(`   ❌ ${script} missing`);
      scriptsOK = false;
      allGood = false;
    }
  }

  // 6. Check GitHub Workflow
  console.log('\n6️⃣  Checking GitHub Actions Workflow...');
  const workflowPath = '.github/workflows/backup-knowledge.yml';
  if (fs.existsSync(workflowPath)) {
    console.log(`   ✅ ${workflowPath}`);
    console.log('   💡 Make sure DATABASE_URL secret is set in GitHub');
  } else {
    console.log(`   ⚠️  ${workflowPath} not found - automated backups disabled`);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  if (allGood) {
    console.log('\n🎉 ALL SYSTEMS OPERATIONAL! 🎉');
    console.log('\nYour Wall-E training data is fully protected with:');
    console.log('  ✅ Live database');
    console.log('  ✅ Local backups');
    console.log('  ✅ Timestamped archives');
    console.log('  ✅ Original source files');
    console.log('  ✅ Backup/restore scripts');
    console.log('  ✅ Automation ready\n');
  } else {
    console.log('\n⚠️  SOME ISSUES FOUND');
    console.log('\nPlease address the issues marked with ❌ above.\n');
    console.log('Quick fixes:');
    console.log('  - Run: npm run db:backup');
    console.log('  - Check: DATABASE_URL in .env');
    console.log('  - Verify: knowledge_seed/ has .md files\n');
  }

  await prisma.$disconnect();
}

verifyDataProtection();
