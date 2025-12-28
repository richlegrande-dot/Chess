#!/usr/bin/env node
/**
 * Hybrid Deployment Verification Script
 * 
 * Comprehensive verification for Option B hybrid architecture:
 * - Pages project (ChessChatWeb)
 * - Worker service (worker-assistant)
 * - Service binding
 * - Self-contained worker build
 * 
 * Usage: node scripts/verify-hybrid-deploy.mjs
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
    return {
      content,
      name: extractTOMLValue(content, 'name'),
      main: extractTOMLValue(content, 'main'),
      pages_build_output_dir: extractTOMLValue(content, 'pages_build_output_dir'),
      hasServiceBinding: content.includes('[[services]]'),
      hasNodejsCompat: content.includes('nodejs_compat'),
    };
  } catch (err) {
    error(`Failed to read ${filePath}: ${err.message}`);
    return null;
  }
}

function extractTOMLValue(content, key) {
  const regex = new RegExp(`^\\s*${key}\\s*=\\s*"([^"]+)"`, 'm');
  const match = content.match(regex);
  return match ? match[1] : null;
}

function checkFileContent(filePath, searchString, description) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    if (content.includes(searchString)) {
      success(`${description}`);
      return true;
    } else {
      error(`${description} - NOT FOUND`);
      return false;
    }
  } catch (err) {
    error(`Failed to check ${filePath}: ${err.message}`);
    return false;
  }
}

header('Hybrid Deployment Configuration Verification');
info('Verifying Option B hybrid architecture...\n');

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
  if (pagesConfig.pages_build_output_dir === 'dist') {
    success('Pages output directory: dist');
  } else {
    error(`Pages output directory: ${pagesConfig.pages_build_output_dir} (expected: dist)`);
  }
  
  if (pagesConfig.hasServiceBinding) {
    success('Pages wrangler.toml includes service binding');
    
    // Check for WALLE_ASSISTANT binding
    if (checkFileContent(pagesWranglerToml, 'WALLE_ASSISTANT', 'Service binding variable: WALLE_ASSISTANT')) {
      checkFileContent(pagesWranglerToml, 'walle-assistant-production', 'Service binding target: walle-assistant-production');
    }
  } else {
    error('Pages wrangler.toml missing [[services]] binding to worker');
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
const workerReadme = path.join(WORKER_ROOT, 'README.md');

const workerExists = checkFileExists(workerPackageJson, 'Worker package.json');
checkFileExists(workerWranglerToml, 'Worker wrangler.toml');
const hasWorkerLock = checkFileExists(workerPackageLock, 'Worker package-lock.json');
checkFileExists(workerIndexTs, 'Worker entrypoint');
checkFileExists(workerReadme, 'Worker README.md');

if (!hasWorkerLock) {
  error('Worker package-lock.json is REQUIRED for self-contained builds');
  info('Run: cd ChessChatWeb/worker-assistant && npm install');
}

// Verify Worker package.json has all dependencies
const workerPackage = workerExists ? readJSON(workerPackageJson) : null;
if (workerPackage) {
  const requiredDeps = ['@prisma/client', '@prisma/extension-accelerate', 'chess.js'];
  const deps = workerPackage.dependencies || {};
  
  let missingDeps = [];
  for (const dep of requiredDeps) {
    if (deps[dep]) {
      success(`Worker has dependency: ${dep}`);
    } else {
      error(`Worker missing dependency: ${dep}`);
      missingDeps.push(dep);
    }
  }
  
  if (missingDeps.length > 0) {
    error('Worker is missing required dependencies - install them now');
    info(`Run: cd ChessChatWeb/worker-assistant && npm install ${missingDeps.join(' ')}`);
  }
}

// Verify Worker wrangler.toml
const workerConfig = readTOML(workerWranglerToml);
if (workerConfig) {
  if (workerConfig.name === 'walle-assistant') {
    success('Worker name: walle-assistant');
  } else {
    error(`Worker name is "${workerConfig.name}" - should be "walle-assistant"`);
  }
  
  if (workerConfig.main === 'src/index.ts') {
    success('Worker entrypoint: src/index.ts');
  } else {
    warning(`Worker entrypoint: ${workerConfig.main} (expected: src/index.ts)`);
  }
  
  if (workerConfig.hasNodejsCompat) {
    success('Worker has nodejs_compat flag');
  } else {
    error('Worker missing nodejs_compat compatibility flag');
  }
  
  if (workerConfig.pages_build_output_dir) {
    error('Worker wrangler.toml has pages_build_output_dir - this is a Worker, not Pages!');
  }
}

// ============================================================================
// SELF-CONTAINED VERIFICATION
// ============================================================================

header('3. Self-Contained Worker Verification');

// Check for shared directory inside worker
const workerSharedDir = path.join(WORKER_ROOT, 'src', 'shared');
if (fs.existsSync(workerSharedDir)) {
  success('Worker has self-contained shared directory: src/shared/');
  
  // Check for required shared files
  const requiredShared = [
    'walleEngine.ts',
    'walleChessEngine.ts',
    'prisma.ts',
    'coachEngine.ts',
    'personalizedReferences.ts'
  ];
  
  for (const file of requiredShared) {
    checkFileExists(path.join(workerSharedDir, file), `Shared file: ${file}`);
  }
} else {
  error('Worker missing src/shared/ directory - worker is NOT self-contained');
  info('Run: Copy-Item -Path "ChessChatWeb\\shared" -Destination "ChessChatWeb\\worker-assistant\\src\\" -Recurse');
}

// Check that worker imports from ./shared not ../../shared
if (checkFileContent(workerIndexTs, "from './shared/", 'Worker uses local imports (./shared/)')) {
  // Good - using local imports
} else if (checkFileContent(workerIndexTs, "from '../../shared/", 'Worker uses parent imports')) {
  error('Worker imports from ../../shared/ - should import from ./shared/');
  info('Worker is NOT self-contained - update imports to use ./shared/');
}

// ============================================================================
// ENDPOINT VERIFICATION
// ============================================================================

header('4. Worker Endpoints Verification');

if (fs.existsSync(workerIndexTs)) {
  const requiredEndpoints = [
    { path: '/assist/chat', name: 'Chat endpoint' },
    { path: '/assist/analyze-game', name: 'Game analysis endpoint' },
    { path: '/assist/chess-move', name: 'Chess move endpoint' }
  ];
  
  for (const endpoint of requiredEndpoints) {
    checkFileContent(workerIndexTs, endpoint.path, endpoint.name);
  }
}

// ============================================================================
// SECURITY VERIFICATION
// ============================================================================

header('5. Security Features');

if (fs.existsSync(workerIndexTs)) {
  if (checkFileContent(workerIndexTs, 'INTERNAL_AUTH_TOKEN', 'Auth guard configured')) {
    success('Worker has optional auth token validation');
  } else {
    warning('Worker does not have auth guard - consider adding for production security');
  }
}

// ============================================================================
// CLOUDFLARE DASHBOARD CONFIGURATION
// ============================================================================

header('6. Required Cloudflare Dashboard Settings');

info('\n📋 Pages Project Configuration:');
log('   Dashboard: Cloudflare → Pages → chesschat-web');
log('   Repository: richlegrande-dot/Chess');
log('   Branch: main');
log(`   ${BOLD}Root directory: ChessChatWeb${RESET} ${GREEN}⚠️ CRITICAL${RESET}`);
log('   Build command: npm ci && npm run build');
log('   Build output directory: dist');
log('   Framework preset: Vite');
log('\n   Service Binding (Settings → Functions → Service bindings):');
log('   Variable name: WALLE_ASSISTANT');
log('   Service: walle-assistant');
log('   Environment: production');

info('\n📋 Worker Service Build Configuration:');
log('   Dashboard: Cloudflare → Workers & Pages → Create → Worker Service');
log('   Repository: richlegrande-dot/Chess');
log('   Branch: main');
log(`   ${BOLD}Path: ChessChatWeb/worker-assistant${RESET} ${GREEN}⚠️ CRITICAL${RESET}`);
log(`   ${BOLD}Build command: npm ci${RESET} ${GREEN}(simplified - no parent dependency)${RESET}`);
log(`   ${BOLD}Deploy command: npx wrangler deploy --env production${RESET} ${GREEN}⚠️ REQUIRED${RESET}`);
log('   Optional preview: npx wrangler deploy --env staging');

info('\n🔐 Secrets Configuration:');
log('   Worker secrets (wrangler secret put --env production):');
log('   - DATABASE_URL (optional - graceful degradation if missing)');
log('   - INTERNAL_AUTH_TOKEN (optional - for auth guard)');
log('\n   Pages environment variables:');
log('   - DATABASE_URL (optional)');
log('   - INTERNAL_AUTH_TOKEN (if worker has auth guard)');

// ============================================================================
// ARCHITECTURE VALIDATION
// ============================================================================

header('7. Architecture Validation');

// Check for OpenAI dependencies
const pagesPackage = readJSON(pagesPackageJson);
let hasOpenAI = false;

if (pagesPackage) {
  const allDeps = {
    ...pagesPackage.dependencies,
    ...pagesPackage.devDependencies
  };
  if (allDeps.openai || allDeps['@anthropic-ai/sdk']) {
    warning('Pages has external AI dependencies - should be Wall-E only');
    hasOpenAI = true;
  }
}

if (workerPackage) {
  const allDeps = {
    ...workerPackage.dependencies,
    ...workerPackage.devDependencies
  };
  if (allDeps.openai || allDeps['@anthropic-ai/sdk']) {
    error('Worker has external AI dependencies - MUST be Wall-E only');
    hasOpenAI = true;
  }
}

if (!hasOpenAI) {
  success('No external AI dependencies detected ✓');
}

// ============================================================================
// BUILD VERIFICATION INSTRUCTIONS
// ============================================================================

header('8. Build Verification');

info('\nTo verify worker can build independently:');
log('   cd ChessChatWeb/worker-assistant');
log('   npm ci');
log('   npx wrangler deploy --env staging --dry-run');

info('\nTo verify Pages can build:');
log('   cd ChessChatWeb');
log('   npm ci');
log('   npm run build');

// ============================================================================
// SUMMARY
// ============================================================================

header('Verification Summary');

if (hasErrors) {
  log('\n❌ VERIFICATION FAILED - Fix errors above before deploying', RED + BOLD);
  info('\nCommon fixes:');
  info('1. Ensure worker has package-lock.json: cd ChessChatWeb/worker-assistant && npm install');
  info('2. Copy shared files: Copy-Item -Path "ChessChatWeb\\shared" -Destination "ChessChatWeb\\worker-assistant\\src\\" -Recurse');
  info('3. Update worker imports from ../../shared/ to ./shared/');
  process.exit(1);
} else if (hasWarnings) {
  log('\n⚠️  VERIFICATION PASSED WITH WARNINGS - Review warnings above', YELLOW + BOLD);
  log('\n✅ Worker is self-contained and ready for deployment', GREEN);
  process.exit(0);
} else {
  log('\n✅ ALL CHECKS PASSED - Ready for deployment!', GREEN + BOLD);
  log('✅ Worker is fully self-contained', GREEN);
  log('✅ Service binding configured correctly', GREEN);
  log('✅ All required endpoints present', GREEN);
  process.exit(0);
}
