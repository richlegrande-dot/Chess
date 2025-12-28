#!/usr/bin/env node
/**
 * Sync Shared Code Helper
 * 
 * Copies shared code from shared/ to worker-assistant/src/shared/
 * Use this after making changes to shared files.
 * 
 * Usage: npm run sync:shared
 */

import { copyFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

const SHARED_FILES = [
  'walleChessEngine.ts',
  'walleEngine.ts',
  'prisma.ts',
  'personalizedReferences.ts',
  'openingBook.ts',
  'cpuConfig.ts',
  'coachResponseTemplate.ts',
  'coachHeuristicsV2.ts',
  'coachEngine.ts'
];

function syncSharedCode() {
  console.log('📦 Syncing shared code from shared/ to worker-assistant/src/shared/\n');

  const sourcePath = join(projectRoot, 'shared');
  const destPath = join(projectRoot, 'worker-assistant', 'src', 'shared');

  // Ensure destination directory exists
  if (!existsSync(destPath)) {
    mkdirSync(destPath, { recursive: true });
  }

  let synced = 0;
  let errors = 0;

  for (const file of SHARED_FILES) {
    const sourceFile = join(sourcePath, file);
    const destFile = join(destPath, file);

    if (!existsSync(sourceFile)) {
      console.error(`❌ Source file not found: ${sourceFile}`);
      errors++;
      continue;
    }

    try {
      copyFileSync(sourceFile, destFile);
      console.log(`✓ Copied ${file}`);
      synced++;
    } catch (error) {
      console.error(`❌ Failed to copy ${file}:`, error.message);
      errors++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`📊 Summary: ${synced}/${SHARED_FILES.length} files synced`);
  
  if (errors === 0) {
    console.log('✅ All shared files synchronized successfully!');
    console.log('\n📝 Next steps:');
    console.log('   1. Review changes: git diff worker-assistant/src/shared/');
    console.log('   2. Test worker: cd worker-assistant && npm test');
    console.log('   3. Verify sync: npm run verify:shared-sync');
    console.log('   4. Commit changes: git add . && git commit');
    return 0;
  } else {
    console.log(`❌ ${errors} error(s) occurred during sync`);
    return 1;
  }
}

try {
  const exitCode = syncSharedCode();
  process.exit(exitCode);
} catch (error) {
  console.error('\n❌ Sync failed:', error.message);
  console.error(error.stack);
  process.exit(2);
}
