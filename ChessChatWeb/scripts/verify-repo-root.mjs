#!/usr/bin/env node
/**
 * Verify Repository Root Integrity
 * 
 * Purpose: Ensure Cloudflare can always find package.json during build/deploy.
 * This script validates that the repository layout matches what Cloudflare expects.
 * 
 * Required files at repo root:
 * - package.json
 * - package-lock.json
 * - src/ directory
 * - functions/ directory
 * 
 * Exit codes:
 * - 0: All checks passed
 * - 1: Missing required files/directories
 */

import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '..');

console.log('🔍 Verifying repository root layout...\n');
console.log(`Repository root: ${repoRoot}\n`);

const requiredFiles = [
  { path: 'package.json', description: 'Package manifest' },
  { path: 'package-lock.json', description: 'Lockfile for reproducible builds' }
];

const requiredDirs = [
  { path: 'src', description: 'Frontend source code' },
  { path: 'functions', description: 'Cloudflare Pages Functions (backend)' }
];

let hasErrors = false;

// Check required files
console.log('📄 Checking required files:');
for (const { path, description } of requiredFiles) {
  const fullPath = resolve(repoRoot, path);
  if (existsSync(fullPath)) {
    console.log(`  ✅ ${path} - ${description}`);
  } else {
    console.log(`  ❌ ${path} - MISSING! (${description})`);
    hasErrors = true;
  }
}

console.log();

// Check required directories
console.log('📁 Checking required directories:');
for (const { path, description } of requiredDirs) {
  const fullPath = resolve(repoRoot, path);
  if (existsSync(fullPath)) {
    console.log(`  ✅ ${path}/ - ${description}`);
  } else {
    console.log(`  ❌ ${path}/ - MISSING! (${description})`);
    hasErrors = true;
  }
}

console.log();

// Summary
if (hasErrors) {
  console.log('❌ FAILED: Repository root integrity check failed!');
  console.log('\nCloudflare will NOT be able to build this project.');
  console.log('Ensure all required files and directories exist at the repository root.');
  console.log('\nExpected structure:');
  console.log('  repo-root/');
  console.log('    ├── package.json');
  console.log('    ├── package-lock.json');
  console.log('    ├── src/');
  console.log('    └── functions/');
  process.exit(1);
} else {
  console.log('✅ SUCCESS: Repository root layout is correct!');
  console.log('Cloudflare will be able to find package.json and build the project.');
  process.exit(0);
}
