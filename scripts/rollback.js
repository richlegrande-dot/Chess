#!/usr/bin/env node

/**
 * Rollback Script
 * 
 * Rolls back to a previous deployment using Cloudflare Pages API.
 * 
 * Usage:
 *   node rollback.js [deployment-id]
 *   node rollback.js list - List recent deployments
 *   node rollback.js latest - Rollback to the previous deployment
 */

const https = require('https');

// Configuration
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const PROJECT_NAME = process.env.CLOUDFLARE_PROJECT_NAME || 'chess';

// Validate environment
function validateEnvironment() {
  if (!API_TOKEN) {
    console.error('❌ Error: CLOUDFLARE_API_TOKEN environment variable is required');
    process.exit(1);
  }
  if (!ACCOUNT_ID) {
    console.error('❌ Error: CLOUDFLARE_ACCOUNT_ID environment variable is required');
    process.exit(1);
  }
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

// List deployments
async function listDeployments(limit = 10) {
  console.log(`\n📋 Fetching recent deployments for ${PROJECT_NAME}...\n`);
  
  const options = {
    hostname: 'api.cloudflare.com',
    port: 443,
    path: `/client/v4/accounts/${ACCOUNT_ID}/pages/projects/${PROJECT_NAME}/deployments`,
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json'
    }
  };
  
  try {
    const response = await makeRequest(options);
    const deployments = response.result || [];
    
    if (deployments.length === 0) {
      console.log('No deployments found.');
      return [];
    }
    
    console.log('Recent deployments:');
    console.log('='.repeat(80));
    
    deployments.slice(0, limit).forEach((deployment, index) => {
      const date = new Date(deployment.created_on).toLocaleString();
      const isProduction = deployment.environment === 'production';
      const status = deployment.latest_stage?.status || 'unknown';
      
      console.log(`${index + 1}. ${isProduction ? '🟢 PROD' : '🔵 PREV'} | ${deployment.id}`);
      console.log(`   Created: ${date}`);
      console.log(`   Status: ${status}`);
      console.log(`   Branch: ${deployment.deployment_trigger?.metadata?.branch || 'unknown'}`);
      console.log(`   Commit: ${deployment.deployment_trigger?.metadata?.commit_hash?.substring(0, 7) || 'unknown'}`);
      
      if (deployment.url) {
        console.log(`   URL: ${deployment.url}`);
      }
      
      console.log('');
    });
    
    return deployments;
  } catch (error) {
    console.error('❌ Failed to list deployments:', error.message);
    throw error;
  }
}

// Get deployment details
async function getDeployment(deploymentId) {
  const options = {
    hostname: 'api.cloudflare.com',
    port: 443,
    path: `/client/v4/accounts/${ACCOUNT_ID}/pages/projects/${PROJECT_NAME}/deployments/${deploymentId}`,
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json'
    }
  };
  
  try {
    const response = await makeRequest(options);
    return response.result;
  } catch (error) {
    console.error(`❌ Failed to get deployment ${deploymentId}:`, error.message);
    throw error;
  }
}

// Retry a deployment (effectively rolling back to it)
async function retryDeployment(deploymentId) {
  console.log(`\n🔄 Initiating rollback to deployment: ${deploymentId}...`);
  
  const options = {
    hostname: 'api.cloudflare.com',
    port: 443,
    path: `/client/v4/accounts/${ACCOUNT_ID}/pages/projects/${PROJECT_NAME}/deployments/${deploymentId}/retry`,
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json'
    }
  };
  
  try {
    const response = await makeRequest(options);
    console.log('✓ Rollback initiated successfully');
    return response.result;
  } catch (error) {
    console.error('❌ Failed to initiate rollback:', error.message);
    throw error;
  }
}

// Rollback to previous deployment
async function rollbackToLatest() {
  console.log('\n🔙 Rolling back to previous deployment...');
  
  const deployments = await listDeployments(10);
  
  if (deployments.length < 2) {
    console.error('❌ Error: Not enough deployments to rollback');
    process.exit(1);
  }
  
  // Find the most recent production deployment that's not the current one
  const currentDeployment = deployments[0];
  const previousDeployment = deployments.find((d, index) => 
    index > 0 && 
    d.environment === 'production' && 
    d.latest_stage?.status === 'success'
  );
  
  if (!previousDeployment) {
    console.error('❌ Error: No previous successful production deployment found');
    process.exit(1);
  }
  
  console.log('\nCurrent deployment:');
  console.log(`  ID: ${currentDeployment.id}`);
  console.log(`  Created: ${new Date(currentDeployment.created_on).toLocaleString()}`);
  
  console.log('\nRolling back to:');
  console.log(`  ID: ${previousDeployment.id}`);
  console.log(`  Created: ${new Date(previousDeployment.created_on).toLocaleString()}`);
  
  // Confirm rollback
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    rl.question('\nConfirm rollback? (yes/no): ', async (answer) => {
      rl.close();
      
      if (answer.toLowerCase() !== 'yes') {
        console.log('Rollback cancelled');
        process.exit(0);
      }
      
      await retryDeployment(previousDeployment.id);
      console.log('\n✅ Rollback completed!');
      console.log(`\nNew deployment URL: ${previousDeployment.url}`);
      console.log('\n⚠️  Note: It may take a few minutes for the rollback to take effect.');
      resolve();
    });
  });
}

// Rollback to specific deployment
async function rollbackToDeployment(deploymentId) {
  console.log(`\n🔙 Rolling back to deployment: ${deploymentId}...`);
  
  // Get deployment details
  const deployment = await getDeployment(deploymentId);
  
  console.log('\nDeployment details:');
  console.log(`  ID: ${deployment.id}`);
  console.log(`  Environment: ${deployment.environment}`);
  console.log(`  Created: ${new Date(deployment.created_on).toLocaleString()}`);
  console.log(`  Status: ${deployment.latest_stage?.status || 'unknown'}`);
  
  if (deployment.latest_stage?.status !== 'success') {
    console.warn('\n⚠️  Warning: This deployment may not have been successful');
  }
  
  // Confirm rollback
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    rl.question('\nConfirm rollback? (yes/no): ', async (answer) => {
      rl.close();
      
      if (answer.toLowerCase() !== 'yes') {
        console.log('Rollback cancelled');
        process.exit(0);
      }
      
      await retryDeployment(deploymentId);
      console.log('\n✅ Rollback completed!');
      console.log(`\nDeployment URL: ${deployment.url}`);
      console.log('\n⚠️  Note: It may take a few minutes for the rollback to take effect.');
      resolve();
    });
  });
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  console.log('🔄 Cloudflare Pages Rollback Utility\n');
  
  validateEnvironment();
  
  try {
    if (!command || command === 'list') {
      await listDeployments(10);
    } else if (command === 'latest') {
      await rollbackToLatest();
    } else {
      // Assume it's a deployment ID
      await rollbackToDeployment(command);
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

module.exports = {
  listDeployments,
  getDeployment,
  retryDeployment,
  rollbackToLatest,
  rollbackToDeployment
};
