#!/usr/bin/env node
/**
 * Render Stockfish Cold Start Troubleshooter & Warmer
 * Purpose: Diagnose and wake up sleeping Render.com Stockfish server
 * Usage: node warm-start-render.js
 * Or: npm run warm-start
 */

import https from 'https';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const RENDER_URL = 'https://chesschat-stockfish.onrender.com';
const MAX_ATTEMPTS = 5;
const TIMEOUT_SECONDS = 60;

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m'
};

function log(color, prefix, message) {
  console.log(`${color}${prefix} ${message}${colors.reset}`);
}

const logSuccess = (msg) => log(colors.green, '✅', msg);
const logInfo = (msg) => log(colors.cyan, 'ℹ️ ', msg);
const logWarning = (msg) => log(colors.yellow, '⚠️ ', msg);
const logError = (msg) => log(colors.red, '❌', msg);
const logProgress = (msg) => log(colors.magenta, '⏳', msg);

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const timeout = (options.timeout || 30) * 1000;
    const timeoutId = setTimeout(() => {
      req.destroy();
      reject(new Error(`Request timeout after ${options.timeout}s`));
    }, timeout);

    const req = https.get(url, { ...options, timeout }, (res) => {
      clearTimeout(timeoutId);
      let data = '';
      
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ success: true, data: json, statusCode: res.statusCode });
        } catch (e) {
          reject(new Error(`Invalid JSON response: ${data.substring(0, 100)}`));
        }
      });
    });

    req.on('error', (error) => {
      clearTimeout(timeoutId);
      reject(error);
    });
  });
}

async function testRenderHealth(timeoutSec = 30) {
  try {
    const startTime = Date.now();
    const result = await makeRequest(`${RENDER_URL}/health`, { timeout: timeoutSec });
    const latency = Date.now() - startTime;
    
    if (result.success && result.data.status === 'healthy') {
      return {
        success: true,
        status: result.data.status,
        version: result.data.version,
        engines: result.data.engines,
        timestamp: result.data.timestamp,
        requestId: result.data.requestId,
        latency
      };
    }
    
    return { success: false, error: 'Server not healthy' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║   Render Stockfish Cold Start Troubleshooter & Warmer     ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  logInfo(`Target Server: ${RENDER_URL}`);
  logInfo(`Max Attempts: ${MAX_ATTEMPTS}`);
  logInfo(`Timeout per attempt: ${TIMEOUT_SECONDS}s`);
  console.log('');

  // Step 1: Initial Health Check
  logProgress('Step 1/4: Initial health check...');
  const initialHealth = await testRenderHealth(10);

  if (initialHealth.success) {
    logSuccess('Server is AWAKE and healthy!');
    logInfo(`  Status: ${initialHealth.status}`);
    logInfo(`  Version: ${initialHealth.version}`);
    logInfo(`  Engines: Active=${initialHealth.engines.active}, Max=${initialHealth.engines.max}`);
    logInfo(`  Latency: ${initialHealth.latency}ms`);
    logSuccess('No cold start needed. Server is ready! 🚀');
    process.exit(0);
  }

  logWarning('Server not responding (likely cold start)');
  logInfo(`  Error: ${initialHealth.error}`);
  console.log('');

  // Step 2: Wake-up sequence
  logProgress('Step 2/4: Starting wake-up sequence...');
  logInfo('This may take 30-120 seconds for Render to start the container...');
  console.log('');

  const totalStartTime = Date.now();
  let success = false;
  let attempt = 1;

  while (attempt <= MAX_ATTEMPTS && !success) {
    logProgress(`Attempt ${attempt}/${MAX_ATTEMPTS} - Pinging health endpoint...`);
    const attemptStartTime = Date.now();

    const health = await testRenderHealth(TIMEOUT_SECONDS);
    const attemptLatency = Math.round((Date.now() - attemptStartTime) / 1000);

    if (health.success) {
      logSuccess(`Server responded after ${attemptLatency}s!`);
      logInfo(`  Status: ${health.status}`);
      logInfo(`  Version: ${health.version}`);
      logInfo(`  Engines: Active=${health.engines.active}, Max=${health.engines.max}`);
      success = true;
      break;
    }

    logWarning(`Attempt ${attempt} failed after ${attemptLatency}s`);
    logInfo(`  Error: ${health.error}`);

    if (attempt < MAX_ATTEMPTS) {
      const waitTime = Math.min(15, 5 * attempt); // Progressive backoff
      logInfo(`  Waiting ${waitTime}s before next attempt...`);
      await sleep(waitTime * 1000);
    }

    attempt++;
  }

  if (!success) {
    logError(`Failed to wake up server after ${MAX_ATTEMPTS} attempts`);
    console.log('');
    console.log(colors.yellow + '🔧 Troubleshooting Steps:' + colors.reset);
    console.log(colors.yellow + '  1. Check Render dashboard: https://dashboard.render.com/' + colors.reset);
    console.log(colors.yellow + '  2. Verify service is not suspended or stopped' + colors.reset);
    console.log(colors.yellow + '  3. Check Render logs for startup errors' + colors.reset);
    console.log(colors.yellow + '  4. Try manual deploy if service is stuck' + colors.reset);
    console.log(colors.yellow + '  5. Contact Render support if issue persists' + colors.reset);
    process.exit(1);
  }

  const totalTime = Math.round((Date.now() - totalStartTime) / 1000);
  console.log('');
  logSuccess(`Total wake-up time: ${totalTime}s`);
  console.log('');

  // Step 3: Final health check
  logProgress('Step 3/4: Final health verification...');
  const finalHealth = await testRenderHealth(10);

  if (finalHealth.success) {
    logSuccess('Final verification passed!');
    logInfo('  Server is fully operational');
    logInfo(`  Engines ready: ${finalHealth.engines.active}/${finalHealth.engines.max}`);
    logInfo(`  Latency: ${finalHealth.latency}ms`);
  } else {
    logWarning('Final health check failed');
    logInfo('  Server may still be warming up...');
  }

  console.log('');
  console.log(colors.green + '╔════════════════════════════════════════════════════════════╗' + colors.reset);
  console.log(colors.green + '║                    🎉 WARMUP COMPLETE! 🎉                  ║' + colors.reset);
  console.log(colors.green + '╠════════════════════════════════════════════════════════════╣' + colors.reset);
  console.log(colors.green + '║  Render Stockfish server is now AWAKE and ready!          ║' + colors.reset);
  console.log(colors.green + '║  You can now play chess with fast response times.         ║' + colors.reset);
  console.log(colors.green + '╚════════════════════════════════════════════════════════════╝' + colors.reset);
  console.log('');

  // Summary
  console.log(colors.cyan + '📊 Summary:' + colors.reset);
  console.log(`  • Total time: ${totalTime}s`);
  console.log(`  • Attempts: ${attempt - 1}`);
  console.log('  • Status: Server is WARM ✅');
  console.log('');
  console.log(colors.yellow + '💡 Tip: Run this script before playing to avoid cold start delays!' + colors.reset);
  console.log('');

  process.exit(0);
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    logError(`Fatal error: ${error.message}`);
    process.exit(1);
  });
}

export { testRenderHealth, main };
