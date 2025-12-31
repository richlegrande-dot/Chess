#!/usr/bin/env node
/**
 * Architecture Verification Script
 * 
 * Purpose: Verify the Stockfish + AI Coaching architecture is correctly configured.
 * 
 * This script checks:
 * 1. Worker API owns all /api/* routes
 * 2. AI Worker has NO /api/* routes (only /assist/*)
 * 3. No minimax fallback is auto-enabled
 * 4. Consistent response schema (diagnostics + requestId)
 * 5. Stockfish integration is present
 * 6. No Pages Functions contain critical business logic
 * 
 * Exit codes:
 * - 0: All checks passed
 * - 1: One or more checks failed
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Colors
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[36m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

let failureCount = 0;

function log(msg) {
  console.log(msg);
}

function success(msg) {
  console.log(`${GREEN}✓${RESET} ${msg}`);
}

function error(msg) {
  console.log(`${RED}✗${RESET} ${msg}`);
  failureCount++;
}

function warning(msg) {
  console.log(`${YELLOW}⚠${RESET} ${msg}`);
}

function info(msg) {
  console.log(`${BLUE}ℹ${RESET} ${msg}`);
}

function header(msg) {
  console.log(`\n${BOLD}${msg}${RESET}`);
}

// ============================================================================
// Check 1: Worker API owns /api/* routes
// ============================================================================
header('Check 1: Worker API Configuration');

const workerApiPath = join(rootDir, 'worker-api');
const workerApiIndexPath = join(workerApiPath, 'src/index-new.ts');
const workerApiWranglerPath = join(workerApiPath, 'wrangler.toml');

if (!existsSync(workerApiIndexPath)) {
  error('Worker API index file not found: worker-api/src/index-new.ts');
} else {
  const content = readFileSync(workerApiIndexPath, 'utf-8');
  
  // Check for required endpoints
  const requiredEndpoints = [
    '/api/chess-move',
    '/api/game/complete',
    '/api/game/:id',
    '/api/learning/profile',
    '/api/admin/worker-health',
    '/api/admin/worker-calls',
  ];
  
  let allEndpointsFound = true;
  for (const endpoint of requiredEndpoints) {
    if (!content.includes(endpoint)) {
      error(`Worker API missing endpoint: ${endpoint}`);
      allEndpointsFound = false;
    }
  }
  
  if (allEndpointsFound) {
    success('Worker API has all required endpoints');
  }
  
  // Check for Stockfish integration
  if (content.includes('getStockfishEngine')) {
    success('Worker API uses Stockfish engine');
  } else {
    error('Worker API does not import Stockfish engine');
  }
  
  // Check for structured errors (no silent fallback)
  if (content.includes('errorCode') && content.includes('diagnostics')) {
    success('Worker API uses structured error responses');
  } else {
    error('Worker API missing structured error responses');
  }
  
  // Check for requestId in responses
  if (content.includes('requestId')) {
    success('Worker API includes requestId in responses');
  } else {
    error('Worker API missing requestId in responses');
  }
}

// Check wrangler.toml for routes
if (!existsSync(workerApiWranglerPath)) {
  error('Worker API wrangler.toml not found');
} else {
  const content = readFileSync(workerApiWranglerPath, 'utf-8');
  
  if (content.includes('routes') && content.includes('/api/*')) {
    success('Worker API wrangler.toml has /api/* route configured');
  } else {
    warning('Worker API wrangler.toml missing /api/* route (may be configured in dashboard)');
  }
}

// ============================================================================
// Check 2: AI Worker is coaching-only
// ============================================================================
header('Check 2: AI Worker Configuration');

const aiWorkerPath = join(rootDir, 'worker-assistant');
const aiWorkerIndexPath = join(aiWorkerPath, 'src/index-coaching.ts');
const aiWorkerWranglerPath = join(aiWorkerPath, 'wrangler.toml');

if (!existsSync(aiWorkerIndexPath)) {
  error('AI Worker coaching file not found: worker-assistant/src/index-coaching.ts');
} else {
  const content = readFileSync(aiWorkerIndexPath, 'utf-8');
  
  // Check for coaching endpoints ONLY
  if (content.includes('/assist/postgame') && content.includes('/assist/explain')) {
    success('AI Worker has coaching endpoints');
  } else {
    error('AI Worker missing coaching endpoints');
  }
  
  // Check that AI Worker does NOT have /api/* routes
  const lines = content.split('\n');
  let hasApiRoutes = false;
  for (const line of lines) {
    if (line.includes("'/api/") && !line.includes('NO /api/*')) {
      hasApiRoutes = true;
      break;
    }
  }
  
  if (!hasApiRoutes) {
    success('AI Worker has NO /api/* routes (correct)');
  } else {
    error('AI Worker has /api/* routes (should only have /assist/* routes)');
  }
  
  // Check that AI Worker does NOT generate chess moves
  if (content.includes('chess-move') || content.includes('selectMove') || content.includes('getBestMove')) {
    error('AI Worker appears to generate chess moves (should be coaching-only)');
  } else {
    success('AI Worker is coaching-only (no move generation)');
  }
}

// ============================================================================
// Check 3: No auto-enabled minimax fallback
// ============================================================================
header('Check 3: No Silent Fallback');

const archivedFallbackPath = join(rootDir, 'archive/fallback/main_thread_chess_move.ts');

if (existsSync(archivedFallbackPath)) {
  info('Archived fallback found (expected)');
  
  const content = readFileSync(archivedFallbackPath, 'utf-8');
  if (content.includes('ARCHIVED') || content.includes('Why Archived')) {
    success('Fallback is properly archived with documentation');
  } else {
    warning('Archived fallback missing documentation');
  }
}

// Check Worker API does not use fallback automatically
if (existsSync(workerApiIndexPath)) {
  const content = readFileSync(workerApiIndexPath, 'utf-8');
  
  if (content.includes('executeFallbackMove') || content.includes('minimax')) {
    error('Worker API contains fallback logic (should fail loudly instead)');
  } else {
    success('Worker API has no silent fallback logic');
  }
}

// ============================================================================
// Check 4: Pages Functions are minimal
// ============================================================================
header('Check 4: Pages Functions');

const pagesFunctionsPath = join(rootDir, 'functions/api');

if (existsSync(pagesFunctionsPath)) {
  warning('Pages Functions directory exists (should be minimal or empty)');
  info('Worker API should handle all /api/* logic');
} else {
  success('No Pages Functions directory (correct - Worker API handles everything)');
}

// ============================================================================
// Check 5: Stockfish integration file exists
// ============================================================================
header('Check 5: Stockfish Integration');

const stockfishPath = join(workerApiPath, 'src/stockfish.ts');

if (!existsSync(stockfishPath)) {
  error('Stockfish integration file not found: worker-api/src/stockfish.ts');
} else {
  const content = readFileSync(stockfishPath, 'utf-8');
  
  if (content.includes('StockfishEngine') && content.includes('computeMove')) {
    success('Stockfish integration file exists with correct API');
  } else {
    error('Stockfish integration file exists but missing expected exports');
  }
  
  if (content.includes('TODO') || content.includes('placeholder')) {
    warning('Stockfish integration contains TODOs (needs implementation)');
  }
}

// ============================================================================
// Check 6: Database schema has required tables
// ============================================================================
header('Check 6: Database Schema');

const schemaPath = join(workerApiPath, 'prisma/schema.prisma');

if (!existsSync(schemaPath)) {
  error('Prisma schema not found: worker-api/prisma/schema.prisma');
} else {
  const content = readFileSync(schemaPath, 'utf-8');
  
  const requiredModels = [
    'WorkerCallLog',
    'GameAnalysis',
    'AICallLog',
    'PlayerProfile',
    'GameRecord',
  ];
  
  let allModelsFound = true;
  for (const model of requiredModels) {
    if (!content.includes(`model ${model}`)) {
      error(`Prisma schema missing model: ${model}`);
      allModelsFound = false;
    }
  }
  
  if (allModelsFound) {
    success('Prisma schema has all required models');
  }
}

// ============================================================================
// Summary
// ============================================================================
header('Summary');

if (failureCount === 0) {
  console.log(`\n${GREEN}${BOLD}✓ All architecture checks passed!${RESET}\n`);
  console.log('The architecture is correctly configured for:');
  console.log('  - Stockfish as chess engine');
  console.log('  - Worker API owning /api/* routes');
  console.log('  - AI Worker for coaching only');
  console.log('  - No silent fallbacks');
  console.log('  - Structured errors with diagnostics\n');
  process.exit(0);
} else {
  console.log(`\n${RED}${BOLD}✗ ${failureCount} check(s) failed${RESET}\n`);
  console.log('Please fix the issues above before deploying.\n');
  process.exit(1);
}
