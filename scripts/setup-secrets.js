#!/usr/bin/env node

/**
 * Secret Management Utility for Cloudflare Pages
 * 
 * This script manages secrets (OPENAI_API_KEY, DATABASE_URL, ADMIN_PASSWORD)
 * for Cloudflare Pages Functions.
 * 
 * Requirements:
 * - CLOUDFLARE_API_TOKEN environment variable with appropriate permissions
 * - CLOUDFLARE_ACCOUNT_ID environment variable
 * - CLOUDFLARE_PROJECT_NAME environment variable (optional, defaults to 'chess')
 */

const https = require('https');
const readline = require('readline');

// Configuration
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const PROJECT_NAME = process.env.CLOUDFLARE_PROJECT_NAME || 'chess';

const REQUIRED_SECRETS = [
  {
    name: 'OPENAI_API_KEY',
    description: 'OpenAI API key for AI features',
    envVar: 'OPENAI_API_KEY'
  },
  {
    name: 'DATABASE_URL',
    description: 'Database connection string',
    envVar: 'DATABASE_URL'
  },
  {
    name: 'ADMIN_PASSWORD',
    description: 'Admin dashboard password',
    envVar: 'ADMIN_PASSWORD'
  }
];

// Validate environment variables
function validateEnvironment() {
  if (!API_TOKEN) {
    console.error('❌ Error: CLOUDFLARE_API_TOKEN environment variable is required');
    process.exit(1);
  }
  if (!ACCOUNT_ID) {
    console.error('❌ Error: CLOUDFLARE_ACCOUNT_ID environment variable is required');
    process.exit(1);
  }
  console.log('✓ Environment variables validated');
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
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(`API request failed: ${res.statusCode} - ${JSON.stringify(parsed)}`));
          }
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

// Set secret using wrangler command
async function setSecretWithWrangler(secretName, secretValue, environment = 'production') {
  const { exec } = require('child_process');
  const util = require('util');
  const execAsync = util.promisify(exec);
  
  try {
    const envFlag = environment === 'production' ? '--env production' : '--env preview';
    const command = `echo "${secretValue}" | wrangler pages secret put ${secretName} --project-name=${PROJECT_NAME} ${envFlag}`;
    
    await execAsync(command, { 
      env: { 
        ...process.env, 
        CLOUDFLARE_API_TOKEN: API_TOKEN,
        CLOUDFLARE_ACCOUNT_ID: ACCOUNT_ID
      }
    });
    
    console.log(`✓ Set secret: ${secretName} (${environment})`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to set secret ${secretName}:`, error.message);
    return false;
  }
}

// List secrets for the project
async function listSecrets(environment = 'production') {
  const { exec } = require('child_process');
  const util = require('util');
  const execAsync = util.promisify(exec);
  
  try {
    const envFlag = environment === 'production' ? '--env production' : '--env preview';
    const command = `wrangler pages secret list --project-name=${PROJECT_NAME} ${envFlag}`;
    
    const { stdout } = await execAsync(command, {
      env: {
        ...process.env,
        CLOUDFLARE_API_TOKEN: API_TOKEN,
        CLOUDFLARE_ACCOUNT_ID: ACCOUNT_ID
      }
    });
    
    return stdout;
  } catch (error) {
    console.error(`❌ Failed to list secrets:`, error.message);
    return null;
  }
}

// Prompt user for secret value
function promptForSecret(secretName, description) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    // Check if value is in environment first
    const envValue = process.env[secretName];
    if (envValue) {
      console.log(`✓ Using ${secretName} from environment variable`);
      rl.close();
      resolve(envValue);
      return;
    }
    
    rl.question(`Enter ${secretName} (${description}): `, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// Setup all secrets
async function setupSecrets(environment = 'production') {
  console.log(`\n📝 Setting up secrets for ${environment} environment...\n`);
  
  const results = [];
  
  for (const secret of REQUIRED_SECRETS) {
    const value = await promptForSecret(secret.name, secret.description);
    
    if (!value) {
      console.warn(`⚠ Warning: Skipping empty secret ${secret.name}`);
      results.push({ name: secret.name, success: false });
      continue;
    }
    
    const success = await setSecretWithWrangler(secret.name, value, environment);
    results.push({ name: secret.name, success });
  }
  
  return results;
}

// Verify secrets are set
async function verifySecrets(environment = 'production') {
  console.log(`\n🔍 Verifying secrets for ${environment} environment...\n`);
  
  const secretsList = await listSecrets(environment);
  
  if (!secretsList) {
    console.error('❌ Could not retrieve secrets list');
    return false;
  }
  
  console.log(secretsList);
  
  const missingSecrets = [];
  for (const secret of REQUIRED_SECRETS) {
    if (!secretsList.includes(secret.name)) {
      missingSecrets.push(secret.name);
    }
  }
  
  if (missingSecrets.length > 0) {
    console.error('\n❌ Missing secrets:', missingSecrets.join(', '));
    return false;
  }
  
  console.log('\n✓ All required secrets are configured');
  return true;
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'setup';
  const environment = args[1] || 'production';
  
  console.log('🔐 Secret Management Utility\n');
  
  validateEnvironment();
  
  try {
    switch (command) {
      case 'setup':
        const results = await setupSecrets(environment);
        const allSuccess = results.every(r => r.success);
        
        if (allSuccess) {
          console.log('\n✅ All secrets configured successfully!');
        } else {
          console.log('\n⚠ Some secrets failed to configure');
          results.filter(r => !r.success).forEach(r => {
            console.log(`  - ${r.name}`);
          });
          process.exit(1);
        }
        break;
        
      case 'list':
        await listSecrets(environment);
        break;
        
      case 'verify':
        const verified = await verifySecrets(environment);
        if (!verified) {
          process.exit(1);
        }
        break;
        
      default:
        console.log('Usage: node setup-secrets.js [command] [environment]');
        console.log('Commands:');
        console.log('  setup    - Set up all required secrets (default)');
        console.log('  list     - List configured secrets');
        console.log('  verify   - Verify all required secrets are set');
        console.log('Environment: production (default) or preview');
    }
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { setupSecrets, verifySecrets, listSecrets };
