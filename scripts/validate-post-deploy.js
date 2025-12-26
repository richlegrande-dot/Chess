#!/usr/bin/env node

/**
 * Post-Deploy Validation Script
 * 
 * Validates deployment by checking:
 * - Health check endpoint (/api/health)
 * - Database connectivity
 * - KV namespace functionality
 */

const https = require('https');

// Configuration
const DEPLOYMENT_URL = process.env.DEPLOYMENT_URL || process.argv[2];
const MAX_RETRIES = 5;
const RETRY_DELAY = 3000; // 3 seconds

// Validation results
const validationResults = {
  passed: [],
  failed: [],
  warnings: []
};

function addResult(type, message) {
  validationResults[type].push(message);
  const icon = type === 'passed' ? '✓' : type === 'failed' ? '❌' : '⚠';
  console.log(`${icon} ${message}`);
}

// Make HTTPS/HTTP request
function makeHttpRequest(url) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : require('http');
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Chess-Deploy-Validator/1.0'
      }
    };
    
    const req = client.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: body
        });
      });
    });
    
    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    req.end();
  });
}

// Wait for deployment to be ready
async function waitForDeployment(url, retries = MAX_RETRIES) {
  console.log(`\n⏳ Waiting for deployment to be ready (max ${retries} attempts)...`);
  
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`  Attempt ${i + 1}/${retries}...`);
      const response = await makeHttpRequest(url);
      
      if (response.statusCode < 500) {
        console.log('  ✓ Deployment is responding');
        return true;
      }
      
      console.log(`  Response: ${response.statusCode}, retrying...`);
    } catch (error) {
      console.log(`  Error: ${error.message}, retrying...`);
    }
    
    if (i < retries - 1) {
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
    }
  }
  
  return false;
}

// Validate health check endpoint
async function validateHealthEndpoint() {
  console.log('\n🏥 Validating health check endpoint...');
  
  if (!DEPLOYMENT_URL) {
    addResult('failed', 'Deployment URL not provided. Use: node validate-post-deploy.js <url>');
    return false;
  }
  
  const healthUrl = `${DEPLOYMENT_URL}/api/health`;
  
  try {
    const response = await makeHttpRequest(healthUrl);
    
    if (response.statusCode !== 200) {
      addResult('failed', `Health check returned status ${response.statusCode}`);
      return false;
    }
    
    // Parse health check response
    let healthData;
    try {
      healthData = JSON.parse(response.body);
    } catch (e) {
      addResult('failed', 'Health check response is not valid JSON');
      return false;
    }
    
    // Validate health status
    if (healthData.status === 'healthy') {
      addResult('passed', 'Health check passed: all systems healthy');
    } else if (healthData.status === 'degraded') {
      addResult('warnings', 'Health check shows degraded status');
      console.log('  Details:', JSON.stringify(healthData.checks, null, 2));
    } else {
      addResult('failed', `Health check failed with status: ${healthData.status}`);
      console.log('  Details:', JSON.stringify(healthData.checks, null, 2));
      return false;
    }
    
    // Check individual components
    if (healthData.checks) {
      if (healthData.checks.analytics_kv && healthData.checks.analytics_kv.status === 'healthy') {
        addResult('passed', 'Analytics KV namespace is functional');
      }
      
      if (healthData.checks.rate_limit_kv && healthData.checks.rate_limit_kv.status === 'healthy') {
        addResult('passed', 'Rate limit KV namespace is functional');
      }
      
      if (healthData.checks.secrets) {
        const secrets = healthData.checks.secrets;
        if (secrets.openai_configured && secrets.database_configured && secrets.admin_configured) {
          addResult('passed', 'All required secrets are configured');
        } else {
          const missing = [];
          if (!secrets.openai_configured) missing.push('OPENAI_API_KEY');
          if (!secrets.database_configured) missing.push('DATABASE_URL');
          if (!secrets.admin_configured) missing.push('ADMIN_PASSWORD');
          addResult('warnings', `Missing secrets: ${missing.join(', ')}`);
        }
      }
    }
    
    return true;
  } catch (error) {
    addResult('failed', `Health check request failed: ${error.message}`);
    return false;
  }
}

// Test basic routing
async function validateRouting() {
  console.log('\n🔀 Validating routing...');
  
  if (!DEPLOYMENT_URL) {
    return true; // Skip if no URL provided
  }
  
  try {
    // Test that the root path doesn't return 500
    const response = await makeHttpRequest(DEPLOYMENT_URL);
    
    if (response.statusCode < 500) {
      addResult('passed', 'Root path is accessible');
      return true;
    } else {
      addResult('warnings', `Root path returned ${response.statusCode}`);
      return true; // Don't fail validation for this
    }
  } catch (error) {
    addResult('warnings', `Could not verify routing: ${error.message}`);
    return true; // Don't fail validation for this
  }
}

// Validate response headers
async function validateSecurityHeaders() {
  console.log('\n🔒 Validating security headers...');
  
  if (!DEPLOYMENT_URL) {
    return true; // Skip if no URL provided
  }
  
  try {
    const response = await makeHttpRequest(`${DEPLOYMENT_URL}/api/health`);
    
    const securityHeaders = [
      'cache-control'
    ];
    
    let hasSecurityHeaders = false;
    securityHeaders.forEach(header => {
      if (response.headers[header]) {
        hasSecurityHeaders = true;
      }
    });
    
    if (hasSecurityHeaders) {
      addResult('passed', 'Security headers are present');
    } else {
      addResult('warnings', 'Consider adding security headers');
    }
    
    return true;
  } catch (error) {
    addResult('warnings', `Could not verify security headers: ${error.message}`);
    return true; // Don't fail validation for this
  }
}

// Print validation summary
function printSummary() {
  console.log('\n' + '='.repeat(50));
  console.log('📊 Post-Deploy Validation Summary');
  console.log('='.repeat(50));
  
  console.log(`\n✓ Passed: ${validationResults.passed.length}`);
  validationResults.passed.forEach(msg => console.log(`  - ${msg}`));
  
  if (validationResults.warnings.length > 0) {
    console.log(`\n⚠ Warnings: ${validationResults.warnings.length}`);
    validationResults.warnings.forEach(msg => console.log(`  - ${msg}`));
  }
  
  if (validationResults.failed.length > 0) {
    console.log(`\n❌ Failed: ${validationResults.failed.length}`);
    validationResults.failed.forEach(msg => console.log(`  - ${msg}`));
  }
  
  console.log('\n' + '='.repeat(50));
  
  const success = validationResults.failed.length === 0;
  if (success) {
    console.log('✅ Post-deploy validation PASSED');
    console.log('\n🎉 Deployment is ready!');
  } else {
    console.log('❌ Post-deploy validation FAILED');
    console.log('\n⚠️  Please review the errors above and redeploy if necessary');
  }
  
  return success;
}

// Main execution
async function main() {
  console.log('🚀 Post-Deploy Validation\n');
  
  if (!DEPLOYMENT_URL) {
    console.error('❌ Error: Deployment URL is required');
    console.log('Usage: node validate-post-deploy.js <deployment-url>');
    console.log('Example: node validate-post-deploy.js https://chess.pages.dev');
    process.exit(1);
  }
  
  console.log(`Validating deployment at: ${DEPLOYMENT_URL}`);
  
  // Wait for deployment to be ready
  const isReady = await waitForDeployment(`${DEPLOYMENT_URL}/api/health`);
  
  if (!isReady) {
    addResult('failed', 'Deployment did not become ready within timeout period');
    printSummary();
    process.exit(1);
  }
  
  // Run validations
  await validateHealthEndpoint();
  await validateRouting();
  await validateSecurityHeaders();
  
  const success = printSummary();
  process.exit(success ? 0 : 1);
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  validateHealthEndpoint,
  validateRouting,
  validateSecurityHeaders,
  waitForDeployment
};
