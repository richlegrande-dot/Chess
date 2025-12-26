#!/usr/bin/env node

/**
 * Pre-Deploy Validation Script
 * 
 * Validates wrangler.toml, secrets, and Prisma connection before deployment.
 * 
 * Requirements:
 * - wrangler.toml file exists and is valid
 * - All required secrets are configured
 * - Database connection is valid (if DATABASE_URL is set)
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// Configuration
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const PROJECT_NAME = process.env.CLOUDFLARE_PROJECT_NAME || 'chess';
const DATABASE_URL = process.env.DATABASE_URL;

const REQUIRED_SECRETS = ['OPENAI_API_KEY', 'DATABASE_URL', 'ADMIN_PASSWORD'];
const REQUIRED_KV_BINDINGS = ['ANALYTICS_KV', 'RATE_LIMIT_KV'];

// Validation results tracking
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

// Validate wrangler.toml exists and has required structure
function validateWranglerToml() {
  console.log('\n📋 Validating wrangler.toml...');
  
  const wranglerPath = path.join(__dirname, '..', 'wrangler.toml');
  
  if (!fs.existsSync(wranglerPath)) {
    addResult('failed', 'wrangler.toml not found');
    return false;
  }
  
  const content = fs.readFileSync(wranglerPath, 'utf8');
  
  // Check for required fields
  const requiredFields = ['name', 'compatibility_date'];
  let allFieldsPresent = true;
  
  requiredFields.forEach(field => {
    if (!content.includes(`${field} =`)) {
      addResult('failed', `Missing required field in wrangler.toml: ${field}`);
      allFieldsPresent = false;
    }
  });
  
  // Check KV namespace bindings
  let allBindingsPresent = true;
  REQUIRED_KV_BINDINGS.forEach(binding => {
    if (!content.includes(`binding = "${binding}"`)) {
      addResult('failed', `Missing KV binding in wrangler.toml: ${binding}`);
      allBindingsPresent = false;
    } else {
      // Check if ID is set (not empty)
      const regex = new RegExp(`binding = "${binding}", id = "([^"]*)"`, 'g');
      const match = regex.exec(content);
      if (match && match[1] === '') {
        addResult('failed', `KV binding ${binding} has empty ID. Run 'npm run setup:kv' to configure.`);
        allBindingsPresent = false;
      }
    }
  });
  
  if (allFieldsPresent && allBindingsPresent) {
    addResult('passed', 'wrangler.toml is valid');
    return true;
  }
  
  return false;
}

// Validate environment variables
function validateEnvironmentVariables() {
  console.log('\n🔐 Validating environment variables...');
  
  let allPresent = true;
  
  const requiredEnvVars = ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID'];
  
  requiredEnvVars.forEach(envVar => {
    if (!process.env[envVar]) {
      addResult('failed', `Missing required environment variable: ${envVar}`);
      allPresent = false;
    }
  });
  
  if (allPresent) {
    addResult('passed', 'Required environment variables are set');
  }
  
  return allPresent;
}

// Make HTTPS request
function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ statusCode: res.statusCode, data: parsed });
        } catch (e) {
          reject(new Error(`Failed to parse response: ${body}`));
        }
      });
    });
    
    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

// Validate secrets are configured (via wrangler)
async function validateSecrets() {
  console.log('\n🔑 Validating secrets...');
  
  if (!API_TOKEN || !ACCOUNT_ID) {
    addResult('warnings', 'Cannot validate secrets: missing API credentials');
    return true; // Don't fail validation, just warn
  }
  
  try {
    const { exec } = require('child_process');
    const util = require('util');
    const execAsync = util.promisify(exec);
    
    const { stdout } = await execAsync(
      `wrangler pages secret list --project-name=${PROJECT_NAME}`,
      {
        env: {
          ...process.env,
          CLOUDFLARE_API_TOKEN: API_TOKEN,
          CLOUDFLARE_ACCOUNT_ID: ACCOUNT_ID
        }
      }
    );
    
    const missingSecrets = [];
    REQUIRED_SECRETS.forEach(secret => {
      if (!stdout.includes(secret)) {
        missingSecrets.push(secret);
      }
    });
    
    if (missingSecrets.length > 0) {
      addResult('failed', `Missing secrets: ${missingSecrets.join(', ')}. Run 'npm run setup:secrets' to configure.`);
      return false;
    }
    
    addResult('passed', 'All required secrets are configured');
    return true;
  } catch (error) {
    addResult('warnings', `Could not verify secrets: ${error.message}`);
    return true; // Don't fail validation, just warn
  }
}

// Validate Prisma database connection
async function validatePrismaConnection() {
  console.log('\n🗄️  Validating database connection...');
  
  if (!DATABASE_URL) {
    addResult('warnings', 'DATABASE_URL not set, skipping database validation');
    return true;
  }
  
  try {
    // Check if Prisma client exists
    const prismaClientPath = path.join(__dirname, '..', 'node_modules', '@prisma/client');
    if (!fs.existsSync(prismaClientPath)) {
      addResult('warnings', 'Prisma client not installed, skipping database validation');
      return true;
    }
    
    // Try to import and test connection
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient({
      datasources: {
        db: {
          url: DATABASE_URL
        }
      }
    });
    
    // Simple connection test
    await prisma.$connect();
    await prisma.$disconnect();
    
    addResult('passed', 'Database connection is valid');
    return true;
  } catch (error) {
    addResult('failed', `Database connection failed: ${error.message}`);
    return false;
  }
}

// Validate package.json and dependencies
function validatePackageJson() {
  console.log('\n📦 Validating package.json...');
  
  const packagePath = path.join(__dirname, '..', 'package.json');
  
  if (!fs.existsSync(packagePath)) {
    addResult('failed', 'package.json not found');
    return false;
  }
  
  try {
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    
    if (!packageJson.name) {
      addResult('warnings', 'package.json missing name field');
    }
    
    // Check if wrangler is in dependencies or devDependencies
    const hasWrangler = 
      (packageJson.dependencies && packageJson.dependencies.wrangler) ||
      (packageJson.devDependencies && packageJson.devDependencies.wrangler);
    
    if (!hasWrangler) {
      addResult('warnings', 'wrangler not found in package.json dependencies');
    }
    
    addResult('passed', 'package.json is valid');
    return true;
  } catch (error) {
    addResult('failed', `Invalid package.json: ${error.message}`);
    return false;
  }
}

// Print validation summary
function printSummary() {
  console.log('\n' + '='.repeat(50));
  console.log('📊 Validation Summary');
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
    console.log('✅ Pre-deploy validation PASSED');
  } else {
    console.log('❌ Pre-deploy validation FAILED');
  }
  
  return success;
}

// Main execution
async function main() {
  console.log('🚀 Pre-Deploy Validation\n');
  
  const validations = [
    validatePackageJson,
    validateWranglerToml,
    validateEnvironmentVariables,
    validateSecrets,
    validatePrismaConnection
  ];
  
  for (const validation of validations) {
    try {
      await validation();
    } catch (error) {
      addResult('failed', `Validation error: ${error.message}`);
    }
  }
  
  const success = printSummary();
  process.exit(success ? 0 : 1);
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  validateWranglerToml,
  validateEnvironmentVariables,
  validateSecrets,
  validatePrismaConnection,
  validatePackageJson
};
