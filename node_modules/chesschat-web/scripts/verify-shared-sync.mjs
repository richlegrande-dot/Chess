#!/usr/bin/env node
/**
 * Shared Code Sync Verification Script
 * 
 * CRITICAL: Verifies that ChessChatWeb/shared/ and ChessChatWeb/worker-assistant/src/shared/
 * are IDENTICAL to prevent drift between Pages and Worker implementations.
 * 
 * The self-contained worker approach copies shared code, creating duplication.
 * This script prevents the "works in Pages but not in Worker" bug class.
 * 
 * Usage: node scripts/verify-shared-sync.mjs
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const REPO_ROOT = path.resolve(__dirname, '../..');
const PAGES_SHARED = path.join(REPO_ROOT, 'ChessChatWeb', 'shared');
const WORKER_SHARED = path.join(REPO_ROOT, 'ChessChatWeb', 'worker-assistant', 'src', 'shared');

// Colors
const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const BOLD = '\x1b[1m';

let hasErrors = false;

function log(message, color = RESET) {
  console.log(`${color}${message}${RESET}`);
}

function success(message) {
  log(`✅ ${message}`, GREEN);
}

function error(message) {
  log(`❌ ${message}`, RED);
  hasErrors = true;
}

function warning(message) {
  log(`⚠️  ${message}`, YELLOW);
}

function info(message) {
  log(`ℹ️  ${message}`, BLUE);
}

function header(message) {
  log(`\n${BOLD}${message}${RESET}`, BLUE);
  log('='.repeat(message.length), BLUE);
}

/**
 * Calculate file hash
 */
function getFileHash(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return crypto.createHash('sha256').update(content).digest('hex');
  } catch (err) {
    return null;
  }
}

/**
 * Get all files recursively
 */
function getAllFiles(dirPath, baseDir = dirPath) {
  const files = [];
  
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        files.push(...getAllFiles(fullPath, baseDir));
      } else {
        const relativePath = path.relative(baseDir, fullPath);
        files.push(relativePath);
      }
    }
  } catch (err) {
    error(`Failed to read directory: ${dirPath}`);
  }
  
  return files;
}

/**
 * Compare two directories
 */
function compareDirectories(dir1, dir2, name1, name2) {
  const files1 = getAllFiles(dir1).sort();
  const files2 = getAllFiles(dir2).sort();
  
  const set1 = new Set(files1);
  const set2 = new Set(files2);
  
  // Files only in dir1
  const onlyIn1 = files1.filter(f => !set2.has(f));
  // Files only in dir2
  const onlyIn2 = files2.filter(f => !set1.has(f));
  // Files in both
  const inBoth = files1.filter(f => set2.has(f));
  
  let hasDifferences = false;
  
  // Check for missing files
  if (onlyIn1.length > 0) {
    error(`Files in ${name1} but NOT in ${name2}:`);
    onlyIn1.forEach(f => log(`  - ${f}`, RED));
    hasDifferences = true;
  }
  
  if (onlyIn2.length > 0) {
    error(`Files in ${name2} but NOT in ${name1}:`);
    onlyIn2.forEach(f => log(`  - ${f}`, RED));
    hasDifferences = true;
  }
  
  // Check for content differences
  const differentFiles = [];
  for (const file of inBoth) {
    const hash1 = getFileHash(path.join(dir1, file));
    const hash2 = getFileHash(path.join(dir2, file));
    
    if (hash1 !== hash2) {
      differentFiles.push(file);
    }
  }
  
  if (differentFiles.length > 0) {
    error(`Files with DIFFERENT content:`);
    differentFiles.forEach(f => log(`  - ${f}`, RED));
    hasDifferences = true;
  }
  
  return {
    hasDifferences,
    stats: {
      totalFiles: files1.length,
      inSync: inBoth.length - differentFiles.length,
      onlyIn1: onlyIn1.length,
      onlyIn2: onlyIn2.length,
      different: differentFiles.length
    }
  };
}

header('Shared Code Sync Verification');
info('Checking for drift between Pages and Worker shared code...\n');

// Check both directories exist
if (!fs.existsSync(PAGES_SHARED)) {
  error(`Pages shared directory not found: ${PAGES_SHARED}`);
  process.exit(1);
}

if (!fs.existsSync(WORKER_SHARED)) {
  error(`Worker shared directory not found: ${WORKER_SHARED}`);
  process.exit(1);
}

success('Both shared directories exist');

// Compare directories
header('Comparing Shared Code');
info(`Pages:  ${path.relative(REPO_ROOT, PAGES_SHARED)}`);
info(`Worker: ${path.relative(REPO_ROOT, WORKER_SHARED)}\n`);

const result = compareDirectories(
  PAGES_SHARED,
  WORKER_SHARED,
  'Pages shared/',
  'Worker src/shared/'
);

// Summary
header('Sync Status');

if (!result.hasDifferences) {
  success(`All ${result.stats.totalFiles} files are IDENTICAL ✓`);
  log(`\n✅ Shared code is in sync - Pages and Worker will behave identically`, GREEN + BOLD);
  process.exit(0);
} else {
  error('DRIFT DETECTED - Shared code is OUT OF SYNC');
  log('');
  info('Statistics:');
  log(`  Total files in Pages: ${result.stats.totalFiles}`);
  log(`  Files in sync: ${result.stats.inSync}`, result.stats.inSync === result.stats.totalFiles ? GREEN : YELLOW);
  log(`  Only in Pages: ${result.stats.onlyIn1}`, result.stats.onlyIn1 > 0 ? RED : GREEN);
  log(`  Only in Worker: ${result.stats.onlyIn2}`, result.stats.onlyIn2 > 0 ? RED : GREEN);
  log(`  Different content: ${result.stats.different}`, result.stats.different > 0 ? RED : GREEN);
  
  log('');
  error('ACTION REQUIRED: Sync shared code to prevent "works in Pages but not Worker" bugs');
  info('To fix:');
  log('  1. Determine which version is correct (Pages or Worker)');
  log('  2. Copy correct version to the other location:');
  log('     PowerShell: Copy-Item -Path "ChessChatWeb\\shared" -Destination "ChessChatWeb\\worker-assistant\\src\\" -Recurse -Force');
  log('     Or manually sync the files listed above');
  log('  3. Commit both directories together');
  log('  4. Re-run this script to verify sync');
  
  process.exit(1);
}
