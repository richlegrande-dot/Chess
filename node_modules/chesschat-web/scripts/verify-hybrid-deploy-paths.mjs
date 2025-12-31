#!/usr/bin/env node
/**
 * Hybrid Deployment Path Verification Script
 * 
 * Verifies that Pages and Worker projects have correct configuration
 * for Cloudflare deployment via Git integration.
 * 
 * Usage: node scripts/verify-hybrid-deploy-paths.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths relative to repo root
const REPO_ROOT = path.resolve(__dirname, '../..');
const PAGES_ROOT = path.join(REPO_ROOT, 'ChessChatWeb');
const WORKER_ROOT = path.join(PAGES_ROOT, 'worker-assistant');

// Colors for terminal output
const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const BOLD = '\x1b[1m';

let hasErrors = false;
let hasWarnings = false;

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
  hasWarnings = true;
}

function info(message) {
  log(`ℹ️  ${message}`, BLUE);
}

function header(message) {
  log(`\n${BOLD}${message}${RESET}`, BLUE);
  log('='.repeat(message.length), BLUE);
}

function checkFileExists(filePath, description) {
  if (fs.existsSync(filePath)) {
    success(`${description}: ${path.relative(REPO_ROOT, filePath)}`);
    return true;
  } else {
    error(`${description} NOT FOUND: ${path.relative(REPO_ROOT, filePath)}`);
    return false;
  }
}

function readJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (err) {
    error(`Failed to read ${filePath}: ${err.message}`);
    return null;
  }
}

function readTOML(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    // Simple TOML parser for our specific needs
    const nameMatch = content.match(/^\s*name\s*=\s*"([^"]+)"/m);
    const mainMatch = content.match(/^\s*main\s*=\s*"([^"]+)"/m);
    const pagesBuildMatch = content.match(/^\s*pages_build_output_dir\s*=\s*"([^"]+)"/m);
    const buildCommandMatch = content.match(/^\s*command\s*=\s*"([^"]+)"/m);
    
    return {
      name: nameMatch ? nameMatch[1] : null,
      main: mainMatch ? mainMatch[1] : null,
      pages_build_output_dir: pagesBuildMatch ? pagesBuildMatch[1] : null,
      hasBuildCommand: !!buildCommandMatch,
      content
    };
  } catch (err) {
    error(`Failed to read ${filePath}: ${err.message}`);
    return null;
  }
}

header('Hybrid Deployment Configuration Verification');
info('Checking Pages and Worker project structure...\n');

// ============================================================================
// PAGES ROOT VERIFICATION
// ============================================================================

header('1. Pages Project (ChessChatWeb)');

const pagesPackageJson = path.join(PAGES_ROOT, 'package.json');
const pagesWranglerToml = path.join(PAGES_ROOT, 'wrangler.toml');
const pagesPackageLock = path.join(PAGES_ROOT, 'package-lock.json');
const pagesViteConfig = path.join(PAGES_ROOT, 'vite.config.ts');

checkFileExists(pagesPackageJson, 'Pages package.json');
checkFileExists(pagesWranglerToml, 'Pages wrangler.toml');
checkFileExists(pagesPackageLock, 'Pages package-lock.json');
checkFileExists(pagesViteConfig, 'Pages vite.config.ts');

// Verify Pages wrangler.toml
const pagesConfig = readTOML(pagesWranglerToml);
if (pagesConfig) {
  if (pagesConfig.pages_build_output_dir) {
    success(`Pages output directory configured: "${pagesConfig.pages_build_output_dir}"`);
  } else {
    error('Pages wrangler.toml missing pages_build_output_dir');
  }
  
  if (pagesConfig.name) {
    success(`Pages project name: "${pagesConfig.name}"`);
  }
  
  if (pagesConfig.hasBuildCommand) {
    warning('Pages wrangler.toml has [build] command - this should be configured in dashboard instead');
  }
}

// ============================================================================
// WORKER ROOT VERIFICATION
// ============================================================================

header('2. Worker Service (worker-assistant)');

const workerPackageJson = path.join(WORKER_ROOT, 'package.json');
const workerWranglerToml = path.join(WORKER_ROOT, 'wrangler.toml');
const workerPackageLock = path.join(WORKER_ROOT, 'package-lock.json');
const workerIndexTs = path.join(WORKER_ROOT, 'src', 'index.ts');

const workerExists = checkFileExists(workerPackageJson, 'Worker package.json');
checkFileExists(workerWranglerToml, 'Worker wrangler.toml');
checkFileExists(workerPackageLock, 'Worker package-lock.json');
checkFileExists(workerIndexTs, 'Worker entrypoint');

// Verify Worker wrangler.toml
const workerConfig = readTOML(workerWranglerToml);
if (workerConfig) {
  if (workerConfig.name === 'walle-assistant') {
    success('Worker name is "walle-assistant" ✓');
  } else {
    error(`Worker name is "${workerConfig.name}" - should be "walle-assistant"`);
  }
  
  if (workerConfig.main) {
    success(`Worker entrypoint: "${workerConfig.main}"`);
  } else {
    error('Worker wrangler.toml missing "main" field');
  }
  
  if (workerConfig.pages_build_output_dir) {
    error('Worker wrangler.toml has pages_build_output_dir - this is a Worker, not Pages!');
  } else {
    success('Worker correctly configured as Worker Service (not Pages)');
  }
  
  if (workerConfig.hasBuildCommand) {
    warning('Worker wrangler.toml has [build] command - deploy command should be in dashboard instead');
  }
}

// ============================================================================
// CLOUDFLARE DASHBOARD CONFIGURATION
// ============================================================================

header('3. Required Cloudflare Dashboard Settings');

info('\n📋 Pages Project Configuration:');
log('   Repository: richlegrande-dot/Chess');
log('   Branch: main');
log(`   ${BOLD}Root directory: ChessChatWeb${RESET} ${GREEN}⚠️ CRITICAL${RESET}`);
log('   Build command: npm ci && npm run build');
log('   Build output directory: dist');
log('   Deploy command: (leave empty - auto-deploys)');
log('   Framework preset: Vite');

info('\n📋 Worker Service Build Configuration:');
log('   Repository: richlegrande-dot/Chess');
log('   Branch: main');
log(`   ${BOLD}Path: ChessChatWeb/worker-assistant${RESET} ${GREEN}⚠️ CRITICAL${RESET}`);
log(`   ${BOLD}Build command: npm ci${RESET} ${GREEN}(simplified - no parent dependency)${RESET}`);
log(`   ${BOLD}Deploy command: npx wrangler deploy --env production${RESET} ${GREEN}⚠️ REQUIRED${RESET}`);
log('   Optional preview: npx wrangler deploy --env staging');

info('\n🔗 Service Binding (Pages → Worker):');
log('   Pages Settings → Functions → Service bindings');
log('   Variable name: WALLE_ASSISTANT');
log('   Service: walle-assistant');
log('   Environment: production');

// ============================================================================
// SHARED DEPENDENCIES CHECK
// ============================================================================

header('4. Shared Dependencies');

const sharedDir = path.join(PAGES_ROOT, 'shared');
if (fs.existsSync(sharedDir)) {
  success('Shared directory exists (used by both Pages and Worker)');
  
  const walleEngine = path.join(sharedDir, 'walleEngine.ts');
  const walleChessEngine = path.join(sharedDir, 'walleChessEngine.ts');
  
  checkFileExists(walleEngine, 'Shared Wall-E engine');
  checkFileExists(walleChessEngine, 'Shared Wall-E chess engine');
} else {
  error('Shared directory not found - Worker and Pages may not function correctly');
}

// ============================================================================
// ARCHITECTURE VALIDATION
// ============================================================================

header('5. Architecture Validation');

// Check for OpenAI dependencies
const pagesPackage = readJSON(pagesPackageJson);
const workerPackage = workerExists ? readJSON(workerPackageJson) : null;

let hasOpenAI = false;
if (pagesPackage) {
  const allDeps = {
    ...pagesPackage.dependencies,
    ...pagesPackage.devDependencies
  };
  if (allDeps.openai || allDeps['@anthropic-ai/sdk']) {
    warning('Pages package.json has external AI dependencies - should be Wall-E only');
    hasOpenAI = true;
  }
}

if (workerPackage) {
  const allDeps = {
    ...workerPackage.dependencies,
    ...workerPackage.devDependencies
  };
  if (allDeps.openai || allDeps['@anthropic-ai/sdk']) {
    error('Worker package.json has external AI dependencies - MUST be Wall-E only');
    hasOpenAI = true;
  }
}

if (!hasOpenAI) {
  success('No external AI dependencies detected ✓');
}

// ============================================================================
// SUMMARY
// ============================================================================

header('Verification Summary');

if (hasErrors) {
  log('\n❌ VERIFICATION FAILED - Fix errors above before deploying', RED + BOLD);
  process.exit(1);
} else if (hasWarnings) {
  log('\n⚠️  VERIFICATION PASSED WITH WARNINGS - Review warnings above', YELLOW + BOLD);
  process.exit(0);
} else {
  log('\n✅ ALL CHECKS PASSED - Ready for deployment!', GREEN + BOLD);
  process.exit(0);
}
