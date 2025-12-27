#!/usr/bin/env node

/**
 * Worker Assistant Path Verification Script
 * 
 * Critical verification for Option B hybrid deployment:
 * - Confirms worker-assistant/ structure exists
 * - Validates wrangler.toml configuration
 * - Ensures separation from Pages configuration
 * - Outputs exact Worker Service deployment path
 * 
 * This script MUST pass in CI before any deployment.
 */

import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

// ANSI colors
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

let errorCount = 0;
let warningCount = 0;

function error(message) {
  console.error(`${RED}✗ ERROR: ${message}${RESET}`);
  errorCount++;
}

function warning(message) {
  console.warn(`${YELLOW}⚠ WARNING: ${message}${RESET}`);
  warningCount++;
}

function success(message) {
  console.log(`${GREEN}✓ ${message}${RESET}`);
}

function info(message) {
  console.log(`${BLUE}ℹ ${message}${RESET}`);
}

function highlight(message) {
  console.log(`${CYAN}${BOLD}${message}${RESET}`);
}

console.log(`\n${BOLD}═══════════════════════════════════════════════════════════${RESET}`);
console.log(`${BOLD}  Worker Assistant Path Verification (Option B Hybrid)${RESET}`);
console.log(`${BOLD}═══════════════════════════════════════════════════════════${RESET}\n`);

/**
 * Check 1: Worker assistant directory structure
 */
function checkWorkerStructure() {
  info('Checking worker-assistant directory structure...');
  
  const workerDir = join(rootDir, 'worker-assistant');
  const requiredFiles = [
    'package.json',
    'wrangler.toml',
    'src/index.ts',
  ];

  if (!existsSync(workerDir)) {
    error(`Worker directory not found: ${workerDir}`);
    return false;
  }

  success('Worker directory exists: worker-assistant/');

  let allFilesExist = true;
  for (const file of requiredFiles) {
    const filePath = join(workerDir, file);
    if (!existsSync(filePath)) {
      error(`Required file missing: worker-assistant/${file}`);
      allFilesExist = false;
    } else {
      success(`Found: worker-assistant/${file}`);
    }
  }

  return allFilesExist;
}

/**
 * Check 2: Validate wrangler.toml configuration
 */
function checkWranglerConfig() {
  info('\nValidating worker-assistant/wrangler.toml...');
  
  const wranglerPath = join(rootDir, 'worker-assistant', 'wrangler.toml');
  
  if (!existsSync(wranglerPath)) {
    error('wrangler.toml not found');
    return false;
  }

  const content = readFileSync(wranglerPath, 'utf-8');
  
  // Check service name
  const nameMatch = content.match(/name\s*=\s*["']([^"']+)["']/);
  if (!nameMatch) {
    error('Service name not defined in wrangler.toml');
    return false;
  }
  
  const serviceName = nameMatch[1];
  if (serviceName !== 'walle-assistant') {
    error(`Incorrect service name: ${serviceName} (expected: walle-assistant)`);
    return false;
  }
  success(`Service name: ${serviceName} ✓`);

  // Check entrypoint
  const mainMatch = content.match(/main\s*=\s*["']([^"']+)["']/);
  if (mainMatch) {
    const entrypoint = mainMatch[1];
    success(`Entrypoint: ${entrypoint} ✓`);
    
    // Verify entrypoint file exists
    const entrypointPath = join(rootDir, 'worker-assistant', entrypoint);
    if (!existsSync(entrypointPath)) {
      error(`Entrypoint file not found: ${entrypoint}`);
      return false;
    }
    success(`Entrypoint file exists ✓`);
  } else {
    // Check if using default src/index.ts
    const defaultEntrypoint = join(rootDir, 'worker-assistant', 'src', 'index.ts');
    if (existsSync(defaultEntrypoint)) {
      success('Using default entrypoint: src/index.ts ✓');
    } else {
      error('No entrypoint defined and src/index.ts not found');
      return false;
    }
  }

  // Check compatibility date
  if (!content.match(/compatibility_date\s*=/)) {
    warning('No compatibility_date specified (recommended)');
  } else {
    success('Compatibility date specified ✓');
  }

  // Verify it's NOT a Pages configuration
  if (content.includes('pages_build_output_dir')) {
    error('Worker wrangler.toml contains Pages configuration! Workers and Pages must be separate.');
    return false;
  }
  success('Configuration is Worker-specific (not Pages) ✓');

  return true;
}

/**
 * Check 3: Validate package.json
 */
function checkPackageJson() {
  info('\nValidating worker-assistant/package.json...');
  
  const packagePath = join(rootDir, 'worker-assistant', 'package.json');
  
  if (!existsSync(packagePath)) {
    error('package.json not found');
    return false;
  }

  const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));
  
  // Check name
  if (!packageJson.name || !packageJson.name.includes('walle')) {
    warning(`Package name "${packageJson.name}" doesn't reference "walle"`);
  } else {
    success(`Package name: ${packageJson.name} ✓`);
  }

  // Check scripts
  const requiredScripts = ['deploy'];
  let hasAllScripts = true;
  
  for (const script of requiredScripts) {
    if (!packageJson.scripts || !packageJson.scripts[script]) {
      error(`Missing script: ${script}`);
      hasAllScripts = false;
    } else {
      success(`Script "${script}": ${packageJson.scripts[script]} ✓`);
    }
  }

  return hasAllScripts;
}

/**
 * Check 4: Validate index.ts exports
 */
function checkWorkerEntrypoint() {
  info('\nValidating worker entrypoint...');
  
  const entrypointPath = join(rootDir, 'worker-assistant', 'src', 'index.ts');
  
  if (!existsSync(entrypointPath)) {
    error('src/index.ts not found');
    return false;
  }

  const content = readFileSync(entrypointPath, 'utf-8');
  
  // Check for fetch handler
  const hasFetchHandler = /export\s+default\s+{[^}]*fetch/.test(content) || 
                          /export\s+async\s+function\s+fetch/.test(content);
  
  if (!hasFetchHandler) {
    error('No fetch handler exported (required for Workers)');
    return false;
  }
  success('Fetch handler found ✓');

  // Check for Wall-E imports
  if (!content.includes('walleEngine') && !content.includes('WalleChessEngine')) {
    warning('No Wall-E engine imports detected (expected for walle-assistant)');
  } else {
    success('Wall-E engine imports found ✓');
  }

  // Ensure NO external AI dependencies
  const bannedImports = [
    { pattern: /import.*['"]openai['"]/, name: 'OpenAI' },
    { pattern: /import.*['"]@anthropic-ai\/sdk['"]/, name: 'Anthropic' },
    { pattern: /import.*['"]cohere-ai['"]/, name: 'Cohere' },
  ];

  let hasViolations = false;
  for (const { pattern, name } of bannedImports) {
    if (pattern.test(content)) {
      error(`CRITICAL: ${name} import found in worker! Wall-E only.`);
      hasViolations = true;
    }
  }

  if (!hasViolations) {
    success('No external AI dependencies ✓ (Wall-E only)');
  }

  return !hasViolations;
}

/**
 * Check 5: Verify separation from Pages
 */
function checkSeparation() {
  info('\nVerifying Pages/Worker separation...');
  
  const pagesWranglerPath = join(rootDir, 'wrangler.toml');
  const workerWranglerPath = join(rootDir, 'worker-assistant', 'wrangler.toml');
  
  if (!existsSync(pagesWranglerPath)) {
    warning('Root wrangler.toml not found (Pages configuration)');
  }
  
  if (!existsSync(workerWranglerPath)) {
    error('Worker wrangler.toml not found');
    return false;
  }

  // Read both configs
  const pagesConfig = existsSync(pagesWranglerPath) ? 
    readFileSync(pagesWranglerPath, 'utf-8') : '';
  const workerConfig = readFileSync(workerWranglerPath, 'utf-8');

  // Verify Pages config has pages_build_output_dir
  if (pagesConfig && !pagesConfig.includes('pages_build_output_dir')) {
    warning('Root wrangler.toml missing pages_build_output_dir (may not be Pages config)');
  }

  // Verify Worker config does NOT have pages_build_output_dir
  if (workerConfig.includes('pages_build_output_dir')) {
    error('Worker wrangler.toml has Pages config! These must be separate.');
    return false;
  }

  success('Pages and Worker configurations are separate ✓');
  return true;
}

/**
 * Output deployment instructions
 */
function outputDeploymentInfo() {
  console.log(`\n${BOLD}═══════════════════════════════════════════════════════════${RESET}`);
  console.log(`${BOLD}  Cloudflare Deployment Configuration${RESET}`);
  console.log(`${BOLD}═══════════════════════════════════════════════════════════${RESET}\n`);

  highlight('📦 PAGES PROJECT (React/Vite + Functions)');
  console.log(`   Dashboard Name:  chesschat-web`);
  console.log(`   Build Path:      ${CYAN}ChessChatWeb${RESET} (repository root)`);
  console.log(`   Build Command:   ${CYAN}npm ci && npm run build${RESET}`);
  console.log(`   Build Output:    ${CYAN}dist${RESET}`);
  console.log(`   Deploy:          ${CYAN}Automatic (Pages git integration)${RESET}`);
  console.log(`   Functions:       ChessChatWeb/functions/api/*\n`);

  highlight('⚙️  WORKER SERVICE (Internal Wall-E Assistant)');
  console.log(`   Service Name:    ${CYAN}walle-assistant${RESET}`);
  console.log(`   Build Path:      ${CYAN}ChessChatWeb/worker-assistant${RESET} ${BOLD}← CRITICAL!${RESET}`);
  console.log(`   Build Command:   ${CYAN}npm ci && npm run build${RESET}`);
  console.log(`   Deploy Command:  ${CYAN}npx wrangler deploy --env production${RESET}`);
  console.log(`   Entrypoint:      src/index.ts\n`);

  highlight('🔗 SERVICE BINDING (Pages → Worker)');
  console.log(`   In Pages settings, add service binding:`);
  console.log(`   Variable Name:   ${CYAN}WALLE_ASSISTANT${RESET}`);
  console.log(`   Service:         ${CYAN}walle-assistant${RESET}`);
  console.log(`   Environment:     production\n`);

  console.log(`${YELLOW}${BOLD}IMPORTANT:${RESET} Cloudflare has TWO separate build systems!`);
  console.log(`   • Pages project builds at root (ChessChatWeb)`);
  console.log(`   • Worker service builds at ChessChatWeb/worker-assistant`);
  console.log(`   • They must NOT share the same build configuration\n`);
}

// Run all checks
let allPassed = true;

allPassed = checkWorkerStructure() && allPassed;
allPassed = checkWranglerConfig() && allPassed;
allPassed = checkPackageJson() && allPassed;
allPassed = checkWorkerEntrypoint() && allPassed;
allPassed = checkSeparation() && allPassed;

// Output deployment info
outputDeploymentInfo();

// Final summary
console.log(`${BOLD}═══════════════════════════════════════════════════════════${RESET}`);
console.log(`${BOLD}  Verification Summary${RESET}`);
console.log(`${BOLD}═══════════════════════════════════════════════════════════${RESET}\n`);

if (errorCount === 0 && warningCount === 0) {
  success('All checks passed! ✨');
  console.log(`\n${GREEN}${BOLD}✓ Worker assistant is ready for Cloudflare deployment${RESET}\n`);
  process.exit(0);
} else {
  if (errorCount > 0) {
    console.error(`${RED}${BOLD}✗ ${errorCount} error(s) found${RESET}`);
  }
  if (warningCount > 0) {
    console.warn(`${YELLOW}⚠ ${warningCount} warning(s) found${RESET}`);
  }
  
  if (errorCount > 0) {
    console.log(`\n${RED}${BOLD}✗ Worker assistant is NOT ready for deployment${RESET}\n`);
    process.exit(1);
  } else {
    console.log(`\n${YELLOW}${BOLD}⚠ Worker assistant may deploy with warnings${RESET}\n`);
    process.exit(0);
  }
}
