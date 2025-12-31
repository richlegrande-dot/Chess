#!/usr/bin/env node

/**
 * Cloudflare Pages Readiness Verifier
 * 
 * Ensures the repository structure meets Cloudflare Pages deployment requirements.
 * Run this before pushing to catch deployment issues early.
 */

import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

const checks = [];
let failureCount = 0;

function check(name, testFn, fix = null) {
  try {
    testFn();
    checks.push({ name, status: '✓ PASS', fix: null });
    console.log(`✓ ${name}`);
  } catch (error) {
    failureCount++;
    checks.push({ name, status: '✗ FAIL', error: error.message, fix });
    console.error(`✗ ${name}`);
    console.error(`  Error: ${error.message}`);
    if (fix) {
      console.error(`  Fix: ${fix}`);
    }
  }
}

console.log('🔍 Cloudflare Pages Readiness Verification\n');
console.log('=' .repeat(60));

// Check 1: package.json at repo root
check(
  'package.json exists at repo root',
  () => {
    const pkgPath = resolve(process.cwd(), 'package.json');
    if (!existsSync(pkgPath)) {
      throw new Error('package.json not found at repository root');
    }
  },
  'Create package.json with required scripts'
);

// Check 2: package-lock.json at repo root
check(
  'package-lock.json exists at repo root',
  () => {
    const lockPath = resolve(process.cwd(), 'package-lock.json');
    if (!existsSync(lockPath)) {
      throw new Error('package-lock.json not found');
    }
  },
  'Run "npm install" to generate package-lock.json'
);

// Check 3: package.json has build script
check(
  'package.json has "build" script',
  () => {
    const pkgPath = resolve(process.cwd(), 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    
    if (!pkg.scripts || !pkg.scripts.build) {
      throw new Error('"build" script not found in package.json');
    }
    
    console.log(`  Build command: "${pkg.scripts.build}"`);
  },
  'Add "build": "vite build" to scripts in package.json'
);

// Check 4: package.json has Node.js engine specified
check(
  'package.json specifies Node.js engine',
  () => {
    const pkgPath = resolve(process.cwd(), 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    
    if (!pkg.engines || !pkg.engines.node) {
      throw new Error('Node.js engine not specified');
    }
    
    console.log(`  Node version: ${pkg.engines.node}`);
    
    // Warn if Node version is too old
    const nodeVersion = parseInt(pkg.engines.node.replace(/[^\d]/g, ''));
    if (nodeVersion < 18) {
      console.warn(`  ⚠ Warning: Node ${nodeVersion} is old. Cloudflare recommends >=18`);
    }
  },
  'Add "engines": { "node": ">=18" } to package.json'
);

// Check 5: src/ directory exists
check(
  'src/ directory exists',
  () => {
    const srcPath = resolve(process.cwd(), 'src');
    if (!existsSync(srcPath)) {
      throw new Error('src/ directory not found');
    }
  },
  'Create src/ directory with your React/frontend code'
);

// Check 6: functions/ directory exists (for API routes)
check(
  'functions/ directory exists (API routes)',
  () => {
    const functionsPath = resolve(process.cwd(), 'functions');
    if (!existsSync(functionsPath)) {
      throw new Error('functions/ directory not found');
    }
  },
  'Create functions/ directory for Cloudflare Pages Functions'
);

// Check 7: index.html at repo root
check(
  'index.html exists at repo root',
  () => {
    const indexPath = resolve(process.cwd(), 'index.html');
    if (!existsSync(indexPath)) {
      throw new Error('index.html not found at repository root');
    }
  },
  'Ensure index.html is at the repository root, not inside src/'
);

// Check 8: Build output directory (post-build check)
check(
  'Build output directory exists (dist/)',
  () => {
    const distPath = resolve(process.cwd(), 'dist');
    if (!existsSync(distPath)) {
      throw new Error('dist/ directory not found. Run "npm run build" first.');
    }
    
    // Check if dist has an index.html
    const distIndexPath = resolve(distPath, 'index.html');
    if (!existsSync(distIndexPath)) {
      throw new Error('dist/index.html not found after build');
    }
  },
  'Run "npm run build" to generate dist/ directory'
);

// Check 9: No wrangler deploy command in package.json (Pages auto-deploys)
check(
  'package.json does NOT have wrangler deploy in build scripts',
  () => {
    const pkgPath = resolve(process.cwd(), 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    
    const buildScript = pkg.scripts?.build || '';
    if (buildScript.includes('wrangler') && buildScript.includes('deploy')) {
      throw new Error('Build script should not include "wrangler deploy"');
    }
  },
  'Remove "wrangler deploy" from build script. Cloudflare Pages auto-deploys.'
);

// Check 10: Verify critical dependencies
check(
  'Critical dependencies are installed',
  () => {
    const pkgPath = resolve(process.cwd(), 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    
    const requiredDeps = ['react', 'react-dom'];
    const missingDeps = requiredDeps.filter(
      dep => !pkg.dependencies?.[dep] && !pkg.devDependencies?.[dep]
    );
    
    if (missingDeps.length > 0) {
      throw new Error(`Missing dependencies: ${missingDeps.join(', ')}`);
    }
  },
  'Run "npm install react react-dom" to install required dependencies'
);

// Check 11: Wall-E engine exists (no API keys)
check(
  'Wall-E engine exists (NO API KEYS)',
  () => {
    const wallePath = resolve(process.cwd(), 'functions/lib/walleEngine.ts');
    if (!existsSync(wallePath)) {
      throw new Error('walleEngine.ts not found - AI endpoints won\'t work');
    }
    
    // Verify it doesn't require API keys
    const walleContent = readFileSync(wallePath, 'utf-8');
    if (walleContent.includes('OPENAI_API_KEY') && walleContent.includes('required')) {
      throw new Error('Wall-E engine still requires OPENAI_API_KEY');
    }
    
    console.log('  Wall-E engine verified (no API keys required)');
  },
  'Implement Wall-E engine that works without external API keys'
);

// Check 12: Prisma singleton exists
check(
  'Prisma singleton exists for connection pooling',
  () => {
    const prismaPath = resolve(process.cwd(), 'functions/lib/prisma.ts');
    if (!existsSync(prismaPath)) {
      throw new Error('prisma.ts singleton not found');
    }
    
    const prismaContent = readFileSync(prismaPath, 'utf-8');
    if (!prismaContent.includes('prismaSingleton') && !prismaContent.includes('getPrisma')) {
      throw new Error('Prisma singleton pattern not implemented');
    }
    
    console.log('  Prisma singleton verified');
  },
  'Create functions/lib/prisma.ts with singleton pattern'
);

console.log('=' .repeat(60));
console.log('\n📊 Verification Summary:\n');

const passCount = checks.length - failureCount;
console.log(`Total checks: ${checks.length}`);
console.log(`✓ Passed: ${passCount}`);
console.log(`✗ Failed: ${failureCount}`);

if (failureCount > 0) {
  console.log('\n⚠️  DEPLOYMENT READINESS: FAIL');
  console.log('\nFix the above issues before deploying to Cloudflare Pages.');
  console.log('Run this script again to verify fixes.\n');
  process.exit(1);
} else {
  console.log('\n✅ DEPLOYMENT READINESS: PASS');
  console.log('\nYour repository is ready for Cloudflare Pages deployment!');
  console.log('\nNext steps:');
  console.log('1. Commit your changes');
  console.log('2. Push to GitHub');
  console.log('3. Cloudflare Pages will auto-deploy\n');
  process.exit(0);
}
