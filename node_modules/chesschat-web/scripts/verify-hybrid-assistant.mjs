#!/usr/bin/env node

/**
 * Hybrid Assistant Verification Script
 * 
 * Enforces architectural integrity for Option B:
 * - NO external AI dependencies (OpenAI, Anthropic, etc.)
 * - Worker service structure exists
 * - Pages Functions maintain provable personalization
 * - Shared code structure is correct
 * 
 * Run in CI before deployment to catch violations.
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
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

/**
 * Check 1: No external AI dependencies
 */
function checkNoExternalAI() {
  info('Checking for external AI dependencies...');
  
  const bannedPatterns = [
    { pattern: /import.*['"]openai['"]/, name: 'OpenAI import' },
    { pattern: /import.*['"]@anthropic-ai\/sdk['"]/, name: 'Anthropic import' },
    { pattern: /import.*['"]cohere-ai['"]/, name: 'Cohere import' },
    { pattern: /api\.openai\.com/, name: 'OpenAI API URL' },
    { pattern: /api\.anthropic\.com/, name: 'Anthropic API URL' },
    { pattern: /openai_api_key/i, name: 'OpenAI API key reference' },
    { pattern: /anthropic_api_key/i, name: 'Anthropic API key reference' },
  ];

  const checkDirs = [
    join(rootDir, 'functions'),
    join(rootDir, 'shared'),
    join(rootDir, 'worker-assistant'),
    join(rootDir, 'src'),
  ];

  function scanFiles(dir) {
    if (!existsSync(dir)) return;
    
    const files = readdirSync(dir);
    for (const file of files) {
      const fullPath = join(dir, file);
      const stat = statSync(fullPath);
      
      if (stat.isDirectory()) {
        // Skip node_modules, dist, .git
        if (!['node_modules', 'dist', '.git', '.wrangler'].includes(file)) {
          scanFiles(fullPath);
        }
      } else if (file.endsWith('.ts') || file.endsWith('.js') || file.endsWith('.tsx') || file.endsWith('.jsx')) {
        const content = readFileSync(fullPath, 'utf-8');
        
        for (const { pattern, name } of bannedPatterns) {
          if (pattern.test(content)) {
            error(`${name} found in ${fullPath}`);
          }
        }
      }
    }
  }

  for (const dir of checkDirs) {
    scanFiles(dir);
  }

  if (errorCount === 0) {
    success('No external AI dependencies found');
  }
}

/**
 * Check 2: Worker service structure exists
 */
function checkWorkerStructure() {
  info('Checking worker service structure...');
  
  const requiredFiles = [
    'worker-assistant/wrangler.toml',
    'worker-assistant/src/index.ts',
    'worker-assistant/package.json',
    'worker-assistant/tsconfig.json',
  ];

  for (const file of requiredFiles) {
    const fullPath = join(rootDir, file);
    if (!existsSync(fullPath)) {
      error(`Missing required file: ${file}`);
    } else {
      success(`Found ${file}`);
    }
  }

  // Check worker index.ts has required endpoints
  const workerIndexPath = join(rootDir, 'worker-assistant/src/index.ts');
  if (existsSync(workerIndexPath)) {
    const content = readFileSync(workerIndexPath, 'utf-8');
    
    const requiredEndpoints = [
      '/assist/chat',
      '/assist/analyze-game',
      '/assist/chess-move',
    ];

    for (const endpoint of requiredEndpoints) {
      if (!content.includes(endpoint)) {
        error(`Worker missing endpoint: ${endpoint}`);
      } else {
        success(`Worker has endpoint: ${endpoint}`);
      }
    }

    // Check it uses shared modules
    if (!content.includes('../../shared/walleEngine')) {
      error('Worker does not import from shared/walleEngine');
    } else {
      success('Worker imports shared Wall-E engine');
    }
  }
}

/**
 * Check 3: Shared code structure
 */
function checkSharedStructure() {
  info('Checking shared code structure...');
  
  const sharedDir = join(rootDir, 'shared');
  if (!existsSync(sharedDir)) {
    error('Missing shared/ directory');
    return;
  }

  const requiredSharedFiles = [
    'walleEngine.ts',
    'walleChessEngine.ts',
    'personalizedReferences.ts',
    'prisma.ts',
    'coachEngine.ts',
  ];

  for (const file of requiredSharedFiles) {
    const fullPath = join(sharedDir, file);
    if (!existsSync(fullPath)) {
      error(`Missing shared file: ${file}`);
    } else {
      success(`Found shared/${file}`);
    }
  }
}

/**
 * Check 4: Pages Functions use service binding
 */
function checkServiceBinding() {
  info('Checking Pages Functions service binding support...');
  
  const pagesApiFunctions = [
    'functions/api/chat.ts',
    'functions/api/analyze-game.ts',
    'functions/api/chess-move.ts',
  ];

  for (const funcPath of pagesApiFunctions) {
    const fullPath = join(rootDir, funcPath);
    if (!existsSync(fullPath)) {
      warning(`Missing Pages Function: ${funcPath}`);
      continue;
    }

    const content = readFileSync(fullPath, 'utf-8');
    
    // Check for service binding interface
    if (!content.includes('WALLE_ASSISTANT?: Fetcher')) {
      error(`${funcPath} missing WALLE_ASSISTANT service binding interface`);
    } else {
      success(`${funcPath} has service binding interface`);
    }

    // Check for fallback logic
    if (!content.includes('env.WALLE_ASSISTANT') || !content.includes('local-fallback')) {
      warning(`${funcPath} may be missing fallback logic`);
    } else {
      success(`${funcPath} has service binding + fallback`);
    }

    // Check imports use shared path
    if (!content.includes("from '../../shared/")) {
      error(`${funcPath} not using shared modules (should import from ../../shared/)`);
    } else {
      success(`${funcPath} imports from shared/`);
    }
  }
}

/**
 * Check 5: Provable personalization enforcement
 */
function checkPersonalization() {
  info('Checking provable personalization enforcement...');
  
  const criticalFiles = [
    'shared/walleEngine.ts',
    'functions/api/chat.ts',
    'functions/api/analyze-game.ts',
    'worker-assistant/src/index.ts',
  ];

  for (const filePath of criticalFiles) {
    const fullPath = join(rootDir, filePath);
    if (!existsSync(fullPath)) {
      continue;
    }

    const content = readFileSync(fullPath, 'utf-8');
    
    // Check for historyEvidence references
    if (filePath.includes('walleEngine') || filePath.includes('chat') || filePath.includes('analyze-game') || filePath.includes('worker-assistant')) {
      if (!content.includes('historyEvidence')) {
        error(`${filePath} missing historyEvidence tracking`);
      } else {
        success(`${filePath} includes historyEvidence`);
      }

      if (!content.includes('personalizedReferences')) {
        error(`${filePath} missing personalizedReferences tracking`);
      } else {
        success(`${filePath} includes personalizedReferences`);
      }
    }
  }

  // Check personalizedReferences.ts exists and has validation
  const personalizedRefPath = join(rootDir, 'shared/personalizedReferences.ts');
  if (existsSync(personalizedRefPath)) {
    const content = readFileSync(personalizedRefPath, 'utf-8');
    
    if (!content.includes('validatePersonalization')) {
      error('personalizedReferences.ts missing validatePersonalization function');
    } else {
      success('personalizedReferences.ts has validation');
    }

    if (!content.includes('buildPersonalizedReferences')) {
      error('personalizedReferences.ts missing buildPersonalizedReferences function');
    } else {
      success('personalizedReferences.ts has builder');
    }
  }
}

/**
 * Check 6: No OpenAI in package.json
 */
function checkPackageJson() {
  info('Checking package.json dependencies...');
  
  const packageJsonFiles = [
    'package.json',
    'worker-assistant/package.json',
  ];

  const bannedDeps = ['openai', '@anthropic-ai/sdk', 'cohere-ai'];

  for (const pkgPath of packageJsonFiles) {
    const fullPath = join(rootDir, pkgPath);
    if (!existsSync(fullPath)) {
      continue;
    }

    const content = readFileSync(fullPath, 'utf-8');
    const pkg = JSON.parse(content);
    
    const allDeps = {
      ...pkg.dependencies,
      ...pkg.devDependencies,
    };

    for (const banned of bannedDeps) {
      if (allDeps[banned]) {
        error(`${pkgPath} contains banned dependency: ${banned}`);
      }
    }
    
    success(`${pkgPath} has no banned dependencies`);
  }
}

/**
 * Check 7: Worker wrangler.toml configuration
 */
function checkWranglerConfig() {
  info('Checking worker wrangler.toml...');
  
  const wranglerPath = join(rootDir, 'worker-assistant/wrangler.toml');
  if (!existsSync(wranglerPath)) {
    error('Missing worker-assistant/wrangler.toml');
    return;
  }

  const content = readFileSync(wranglerPath, 'utf-8');
  
  if (!content.includes('name = "walle-assistant"')) {
    error('Worker name should be "walle-assistant"');
  } else {
    success('Worker has correct name');
  }

  if (!content.includes('main = "src/index.ts"')) {
    error('Worker main entry should be "src/index.ts"');
  } else {
    success('Worker has correct entry point');
  }
}

/**
 * Main execution
 */
function main() {
  console.log(`\n${BLUE}═══════════════════════════════════════════════════════════${RESET}`);
  console.log(`${BLUE}  Hybrid Assistant Verification (Option B Architecture)${RESET}`);
  console.log(`${BLUE}═══════════════════════════════════════════════════════════${RESET}\n`);

  checkNoExternalAI();
  console.log('');
  
  checkWorkerStructure();
  console.log('');
  
  checkSharedStructure();
  console.log('');
  
  checkServiceBinding();
  console.log('');
  
  checkPersonalization();
  console.log('');
  
  checkPackageJson();
  console.log('');
  
  checkWranglerConfig();
  console.log('');

  // Summary
  console.log(`${BLUE}═══════════════════════════════════════════════════════════${RESET}`);
  if (errorCount === 0 && warningCount === 0) {
    console.log(`${GREEN}✓ All checks passed! Hybrid assistant architecture is valid.${RESET}`);
    console.log(`${GREEN}  Safe to deploy.${RESET}`);
    process.exit(0);
  } else {
    console.log(`${RED}✗ Verification failed:${RESET}`);
    console.log(`  ${RED}Errors: ${errorCount}${RESET}`);
    console.log(`  ${YELLOW}Warnings: ${warningCount}${RESET}`);
    if (errorCount > 0) {
      console.log(`\n${RED}Fix errors before deploying.${RESET}`);
      process.exit(1);
    } else {
      console.log(`\n${YELLOW}Warnings detected but no blocking errors.${RESET}`);
      process.exit(0);
    }
  }
}

main();
