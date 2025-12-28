#!/usr/bin/env node
/**
 * Worker Required Mode Verification Script
 * 
 * Checks that:
 * 1. Pages wrangler.toml has correct service binding
 * 2. Pages function uses correct endpoint (/assist/chess-move)
 * 3. No runtime fallback is executed (unless ALLOW_FALLBACK_MAIN_THREAD)
 * 4. Worker only handles /assist/* routes (not /api/*)
 * 5. Response modes include "worker-required" for failures
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

let exitCode = 0;
const errors = [];
const warnings = [];

console.log('🔍 Worker Required Mode Verification\n');

// ========================================
// 1. Check wrangler.toml for service binding
// ========================================
console.log('1️⃣  Checking wrangler.toml for service binding...');
const wranglerPath = join(projectRoot, 'wrangler.toml');

if (!existsSync(wranglerPath)) {
  errors.push('❌ wrangler.toml not found');
  exitCode = 1;
} else {
  const wranglerContent = readFileSync(wranglerPath, 'utf-8');
  
  // Check for service binding (in [[env.production.services]] section)
  const hasServiceBinding = /\[\[env\.production\.services\]\]/m.test(wranglerContent) ||
                           /\[\[services\]\]/m.test(wranglerContent);
  const hasWalleBinding = /binding\s*=\s*["']WALLE_ASSISTANT["']/m.test(wranglerContent);
  
  if (!hasServiceBinding) {
    warnings.push('⚠️  No [[services]] section found in wrangler.toml (Pages bindings are configured in Dashboard)');
  } else if (!hasWalleBinding) {
    errors.push('❌ Service binding "WALLE_ASSISTANT" not found in wrangler.toml');
    exitCode = 1;
  } else {
    console.log('   ✅ Service binding "WALLE_ASSISTANT" found in wrangler.toml');
  }
}

// ========================================
// 2. Check Pages function calls correct endpoint
// ========================================
console.log('\n2️⃣  Checking Pages function endpoint usage...');
const chessMoveFunction = join(projectRoot, 'functions', 'api', 'chess-move.ts');

if (!existsSync(chessMoveFunction)) {
  errors.push('❌ functions/api/chess-move.ts not found');
  exitCode = 1;
} else {
  const functionContent = readFileSync(chessMoveFunction, 'utf-8');
  
  // Should use /assist/chess-move
  const usesCorrectEndpoint = /https:\/\/internal\/assist\/chess-move/m.test(functionContent);
  
  // Should NOT use /api/chess-move in fetch calls (but OK in log strings)
  const usesWrongEndpoint = /fetch\([^)]*['"`]\/api\/chess-move['"`]/m.test(functionContent) ||
                             /\.fetch\([^)]*\/api\/chess-move/m.test(functionContent);
  
  if (!usesCorrectEndpoint) {
    errors.push('❌ Pages function does not call https://internal/assist/chess-move');
    exitCode = 1;
  } else {
    console.log('   ✅ Pages function calls correct Worker endpoint (/assist/chess-move)');
  }
  
  if (usesWrongEndpoint) {
    errors.push('❌ Pages function still references /api/chess-move (should be /assist/chess-move)');
    exitCode = 1;
  }
}

// ========================================
// 3. Check fallback is disabled by default
// ========================================
console.log('\n3️⃣  Checking fallback is disabled by default...');

if (existsSync(chessMoveFunction)) {
  const functionContent = readFileSync(chessMoveFunction, 'utf-8');
  
  // Check for ALLOW_FALLBACK_MAIN_THREAD flag usage
  const hasFallbackFlag = /ALLOW_FALLBACK_MAIN_THREAD/m.test(functionContent);
  const fallbackIsConditional = /if\s*\(\s*.*ALLOW_FALLBACK_MAIN_THREAD\s*===\s*['"]true['"]\s*\)/m.test(functionContent);
  
  // Check that WalleChessEngine is NOT directly imported (should be in archive only)
  const directlyImportsEngine = /import\s+{[^}]*WalleChessEngine[^}]*}\s+from\s+['"].*shared\/walleChessEngine['"]/m.test(functionContent);
  
  if (directlyImportsEngine && !functionContent.includes('// Archive')) {
    errors.push('❌ Pages function directly imports WalleChessEngine (should only be in archive)');
    exitCode = 1;
  } else {
    console.log('   ✅ WalleChessEngine not directly imported in Pages function');
  }
  
  if (hasFallbackFlag && fallbackIsConditional) {
    console.log('   ✅ Fallback is conditional on ALLOW_FALLBACK_MAIN_THREAD flag');
  } else if (hasFallbackFlag) {
    warnings.push('⚠️  ALLOW_FALLBACK_MAIN_THREAD flag found but may not be properly conditional');
  } else {
    errors.push('❌ No ALLOW_FALLBACK_MAIN_THREAD fallback mechanism found');
    exitCode = 1;
  }
  
  // Check for archived fallback module
  const fallbackArchivePath = join(projectRoot, 'archive', 'fallback', 'main_thread_chess_move.ts');
  if (existsSync(fallbackArchivePath)) {
    console.log('   ✅ Fallback archived in archive/fallback/main_thread_chess_move.ts');
  } else {
    warnings.push('⚠️  Archived fallback not found at archive/fallback/main_thread_chess_move.ts');
  }
}

// ========================================
// 4. Check Worker only handles /assist/*
// ========================================
console.log('\n4️⃣  Checking Worker route handlers...');
const workerIndexPath = join(projectRoot, 'worker-assistant', 'src', 'index.ts');

if (!existsSync(workerIndexPath)) {
  warnings.push('⚠️  Worker index.ts not found at worker-assistant/src/index.ts');
} else {
  const workerContent = readFileSync(workerIndexPath, 'utf-8');
  
  // Should handle /assist/chess-move
  const handlesAssistRoute = /pathname\s*===\s*['"]\/assist\/chess-move['"]/m.test(workerContent);
  
  // Should NOT handle /api/chess-move
  const handlesApiRoute = /pathname\s*===\s*['"]\/api\/chess-move['"]/m.test(workerContent);
  
  if (!handlesAssistRoute) {
    errors.push('❌ Worker does not handle /assist/chess-move route');
    exitCode = 1;
  } else {
    console.log('   ✅ Worker handles /assist/chess-move route');
  }
  
  if (handlesApiRoute) {
    errors.push('❌ Worker still handles /api/chess-move route (should be removed)');
    exitCode = 1;
  } else {
    console.log('   ✅ Worker does not handle /api/chess-move (correct)');
  }
}

// ========================================
// 5. Check response modes include worker-required
// ========================================
console.log('\n5️⃣  Checking response mode strings...');

if (existsSync(chessMoveFunction)) {
  const functionContent = readFileSync(chessMoveFunction, 'utf-8');
  
  // Should have "worker-required" mode
  const hasWorkerRequiredMode = /mode:\s*['"]worker-required['"]/m.test(functionContent);
  
  // Should have "worker-required" in comments/docs
  const documentedWorkerRequired = /worker.required/mi.test(functionContent);
  
  if (!hasWorkerRequiredMode) {
    errors.push('❌ Response mode "worker-required" not found in error responses');
    exitCode = 1;
  } else {
    console.log('   ✅ Response mode "worker-required" found in error responses');
  }
  
  if (documentedWorkerRequired) {
    console.log('   ✅ Worker Required Mode is documented in file');
  }
}

// ========================================
// Summary
// ========================================
console.log('\n' + '='.repeat(60));

if (warnings.length > 0) {
  console.log('\n⚠️  Warnings:');
  warnings.forEach(w => console.log('  ' + w));
}

if (errors.length > 0) {
  console.log('\n❌ Errors:');
  errors.forEach(e => console.log('  ' + e));
  console.log('\n❌ Verification FAILED\n');
} else {
  console.log('\n✅ All checks passed!\n');
  console.log('Worker Required Mode is correctly configured:');
  console.log('  • Service binding configured');
  console.log('  • Correct endpoints used');
  console.log('  • Fallback archived and conditional');
  console.log('  • Worker routes properly scoped');
  console.log('  • Error modes properly defined\n');
}

process.exit(exitCode);
