#!/usr/bin/env node
/**
 * CI Check: Verify Shared Code Synchronization
 * 
 * Ensures that shared code between main project and worker-assistant
 * remains synchronized (no drift).
 * 
 * Usage: node .github/workflows/verify-shared-sync.mjs
 * Exit codes:
 *   0 - All shared files are in sync
 *   1 - Drift detected (files differ)
 *   2 - Error during verification
 */

import { readFileSync, existsSync } from 'fs';
import { createHash } from 'crypto';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../..');

// Shared files that must be synchronized
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

/**
 * Calculate SHA-256 hash of file content
 */
function getFileHash(filePath) {
  if (!existsSync(filePath)) {
    return null;
  }
  const content = readFileSync(filePath, 'utf-8');
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Check if two files are identical
 */
function compareFiles(sourcePath, destPath, fileName) {
  const sourceHash = getFileHash(sourcePath);
  const destHash = getFileHash(destPath);

  if (sourceHash === null) {
    console.error(`❌ Source file not found: ${sourcePath}`);
    return false;
  }

  if (destHash === null) {
    console.error(`❌ Destination file not found: ${destPath}`);
    return false;
  }

  if (sourceHash !== destHash) {
    console.error(`❌ DRIFT DETECTED: ${fileName}`);
    console.error(`   Source: ${sourcePath}`);
    console.error(`   Dest:   ${destPath}`);
    console.error(`   Source hash: ${sourceHash.substring(0, 12)}...`);
    console.error(`   Dest hash:   ${destHash.substring(0, 12)}...`);
    return false;
  }

  console.log(`✓ ${fileName} - in sync`);
  return true;
}

/**
 * Main verification function
 */
function verifySharedSync() {
  console.log('🔍 Verifying shared code synchronization...\n');

  const sourcePath = join(projectRoot, 'shared');
  const destPath = join(projectRoot, 'worker-assistant', 'src', 'shared');

  let allInSync = true;
  const results = {
    total: SHARED_FILES.length,
    synced: 0,
    drifted: []
  };

  for (const file of SHARED_FILES) {
    const sourceFile = join(sourcePath, file);
    const destFile = join(destPath, file);

    if (compareFiles(sourceFile, destFile, file)) {
      results.synced++;
    } else {
      allInSync = false;
      results.drifted.push(file);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`📊 Summary: ${results.synced}/${results.total} files in sync`);
  
  if (allInSync) {
    console.log('✅ All shared files are synchronized!');
    return 0;
  } else {
    console.log(`❌ ${results.drifted.length} file(s) have drifted:`);
    results.drifted.forEach(file => console.log(`   - ${file}`));
    console.log('\n📝 To fix drift:');
    console.log('   1. Review changes in both locations');
    console.log('   2. Merge changes to shared/ directory');
    console.log('   3. Copy from shared/ to worker-assistant/src/shared/');
    console.log('   4. OR use: npm run sync-shared (if script exists)');
    return 1;
  }
}

// Run verification
try {
  const exitCode = verifySharedSync();
  process.exit(exitCode);
} catch (error) {
  console.error('\n❌ Error during verification:', error.message);
  console.error(error.stack);
  process.exit(2);
}
