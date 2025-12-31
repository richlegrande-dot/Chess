#!/usr/bin/env node
/**
 * Verify Cloudflare Workers Service Build Path Configuration
 * 
 * Purpose: Ensure Cloudflare Workers Service Build is configured with the correct Path.
 * This script validates that package.json and wrangler.toml exist at the intended build root.
 * 
 * Critical Context:
 * - This is a Cloudflare Workers Service Build (NOT Pages)
 * - Repository structure: LLM vs Me/ChessChatWeb/
 * - package.json and wrangler.toml are in ChessChatWeb/ subdirectory
 * - Cloudflare Path MUST be set to "ChessChatWeb" (not "/")
 * 
 * Exit codes:
 * - 0: Configuration correct, Path value printed
 * - 1: Configuration error, missing files or wrong structure
 */

import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// This script lives in ChessChatWeb/scripts/
// Go up one level to get to ChessChatWeb/
const chessChatWebRoot = resolve(__dirname, '..');

// Go up one more level to get to repo root (LLM vs Me/)
const repoRoot = resolve(chessChatWebRoot, '..');

console.log('🔍 Verifying Cloudflare Workers Service Build path configuration...\n');
console.log(`Repository root: ${repoRoot}`);
console.log(`ChessChatWeb root: ${chessChatWebRoot}\n`);

let hasErrors = false;

// Verify repository structure
console.log('📁 Repository Structure:');
const expectedDirs = [
  { path: resolve(repoRoot, '.git'), name: '.git/', description: 'Git repository root' },
  { path: resolve(repoRoot, 'ChessChatWeb'), name: 'ChessChatWeb/', description: 'Web application directory' }
];

for (const { path, name, description } of expectedDirs) {
  if (existsSync(path)) {
    console.log(`  ✅ ${name} - ${description}`);
  } else {
    console.log(`  ❌ ${name} - MISSING! (${description})`);
    hasErrors = true;
  }
}

console.log();

// Verify ChessChatWeb/ contains required files
console.log('📄 Required Files in ChessChatWeb/:');
const requiredFiles = [
  { path: resolve(chessChatWebRoot, 'package.json'), name: 'package.json', description: 'Node.js dependencies' },
  { path: resolve(chessChatWebRoot, 'wrangler.toml'), name: 'wrangler.toml', description: 'Cloudflare Worker config' },
  { path: resolve(chessChatWebRoot, 'package-lock.json'), name: 'package-lock.json', description: 'Lockfile for reproducible builds' }
];

for (const { path, name, description } of requiredFiles) {
  if (existsSync(path)) {
    console.log(`  ✅ ${name} - ${description}`);
  } else {
    console.log(`  ❌ ${name} - MISSING! (${description})`);
    hasErrors = true;
  }
}

console.log();

// Verify source directories exist
console.log('📁 Source Directories in ChessChatWeb/:');
const sourceDirs = [
  { path: resolve(chessChatWebRoot, 'src'), name: 'src/', description: 'Frontend source code' },
  { path: resolve(chessChatWebRoot, 'functions'), name: 'functions/', description: 'Cloudflare Workers Functions' }
];

for (const { path, name, description } of sourceDirs) {
  if (existsSync(path)) {
    console.log(`  ✅ ${name} - ${description}`);
  } else {
    console.log(`  ❌ ${name} - MISSING! (${description})`);
    hasErrors = true;
  }
}

console.log();

// Verify files DO NOT exist at repo root (common mistake)
console.log('🚫 Files That Should NOT Be at Repo Root:');
const shouldNotExist = [
  { path: resolve(repoRoot, 'package.json'), name: 'package.json', reason: 'Should be in ChessChatWeb/' },
  { path: resolve(repoRoot, 'wrangler.toml'), name: 'wrangler.toml', reason: 'Should be in ChessChatWeb/' }
];

let foundWrongLocation = false;
for (const { path, name, reason } of shouldNotExist) {
  if (existsSync(path)) {
    console.log(`  ⚠️  ${name} found at repo root - ${reason}`);
    foundWrongLocation = true;
  }
}

if (!foundWrongLocation) {
  console.log(`  ✅ No configuration files at repo root (correct)`);
}

console.log();

// Final verdict
if (hasErrors) {
  console.log('❌ FAILED: Cloudflare Path configuration is incorrect!\n');
  console.log('Expected structure:');
  console.log('  LLM vs Me/              ← Repo root');
  console.log('    ├── .git/');
  console.log('    └── ChessChatWeb/     ← Path MUST point here');
  console.log('        ├── package.json');
  console.log('        ├── wrangler.toml');
  console.log('        ├── src/');
  console.log('        └── functions/\n');
  console.log('Action Required:');
  console.log('  1. Verify all required files exist in ChessChatWeb/');
  console.log('  2. Set Cloudflare Path = "ChessChatWeb"');
  console.log('  3. Rerun this script to verify\n');
  process.exit(1);
} else {
  console.log('✅ SUCCESS: Repository structure is correct!\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Cloudflare Workers Service Build Configuration  ');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('  Path: ChessChatWeb');
  console.log('  Build command: npm ci && npm run build');
  console.log('  Deploy command: npx wrangler deploy\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('Why "ChessChatWeb"?');
  console.log('  • package.json is at: ChessChatWeb/package.json');
  console.log('  • wrangler.toml is at: ChessChatWeb/wrangler.toml');
  console.log('  • Cloudflare must run commands from this directory\n');
  console.log('If you set Path to "/" (repo root):');
  console.log('  ❌ Build will fail with: ENOENT package.json\n');
  console.log('Apply this configuration in Cloudflare dashboard:');
  console.log('  Workers → Services → [your-service] → Settings → Builds\n');
  process.exit(0);
}
