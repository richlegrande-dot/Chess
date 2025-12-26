#!/usr/bin/env node

/**
 * Setup KV Namespaces for Cloudflare Pages
 * 
 * This script creates and binds KV namespaces (ANALYTICS_KV, RATE_LIMIT_KV)
 * via the Cloudflare Dashboard API.
 * 
 * Requirements:
 * - CLOUDFLARE_API_TOKEN environment variable with appropriate permissions
 * - CLOUDFLARE_ACCOUNT_ID environment variable
 * - CLOUDFLARE_PROJECT_NAME environment variable (optional, defaults to 'chess')
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Configuration
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const PROJECT_NAME = process.env.CLOUDFLARE_PROJECT_NAME || 'chess';

const KV_NAMESPACES = [
  { name: 'ANALYTICS_KV', title: `${PROJECT_NAME}-analytics` },
  { name: 'RATE_LIMIT_KV', title: `${PROJECT_NAME}-rate-limit` }
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

// Create KV namespace
async function createKVNamespace(title) {
  console.log(`Creating KV namespace: ${title}...`);
  
  const options = {
    hostname: 'api.cloudflare.com',
    port: 443,
    path: `/client/v4/accounts/${ACCOUNT_ID}/storage/kv/namespaces`,
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json'
    }
  };
  
  try {
    const response = await makeRequest(options, { title });
    const namespaceId = response.result.id;
    console.log(`✓ Created KV namespace: ${title} (ID: ${namespaceId})`);
    return namespaceId;
  } catch (error) {
    console.error(`❌ Failed to create KV namespace ${title}:`, error.message);
    throw error;
  }
}

// List existing KV namespaces
async function listKVNamespaces() {
  const options = {
    hostname: 'api.cloudflare.com',
    port: 443,
    path: `/client/v4/accounts/${ACCOUNT_ID}/storage/kv/namespaces`,
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json'
    }
  };
  
  try {
    const response = await makeRequest(options);
    return response.result || [];
  } catch (error) {
    console.error('❌ Failed to list KV namespaces:', error.message);
    throw error;
  }
}

// Update wrangler.toml with KV namespace IDs
function updateWranglerToml(namespaces) {
  const wranglerPath = path.join(__dirname, '..', 'wrangler.toml');
  
  if (!fs.existsSync(wranglerPath)) {
    console.error('❌ wrangler.toml not found');
    return;
  }
  
  let content = fs.readFileSync(wranglerPath, 'utf8');
  
  // Update KV namespace bindings
  namespaces.forEach(({ name, id, preview_id }) => {
    const regex = new RegExp(`{ binding = "${name}", id = "[^"]*", preview_id = "[^"]*" }`, 'g');
    const replacement = `{ binding = "${name}", id = "${id}", preview_id = "${preview_id}" }`;
    
    if (content.match(regex)) {
      content = content.replace(regex, replacement);
      console.log(`✓ Updated ${name} in wrangler.toml`);
    } else {
      console.warn(`⚠ Warning: Could not find binding for ${name} in wrangler.toml`);
    }
  });
  
  fs.writeFileSync(wranglerPath, content);
  console.log('✓ wrangler.toml updated successfully');
}

// Main execution
async function main() {
  console.log('🚀 Setting up KV Namespaces...\n');
  
  validateEnvironment();
  
  try {
    // List existing namespaces
    console.log('\nFetching existing KV namespaces...');
    const existingNamespaces = await listKVNamespaces();
    
    const createdNamespaces = [];
    
    // Create or find each namespace
    for (const kvConfig of KV_NAMESPACES) {
      const productionTitle = kvConfig.title;
      const previewTitle = `${kvConfig.title}-preview`;
      
      // Check if production namespace exists
      let productionNs = existingNamespaces.find(ns => ns.title === productionTitle);
      if (!productionNs) {
        const productionId = await createKVNamespace(productionTitle);
        productionNs = { id: productionId, title: productionTitle };
      } else {
        console.log(`✓ Found existing KV namespace: ${productionTitle} (ID: ${productionNs.id})`);
      }
      
      // Check if preview namespace exists
      let previewNs = existingNamespaces.find(ns => ns.title === previewTitle);
      if (!previewNs) {
        const previewId = await createKVNamespace(previewTitle);
        previewNs = { id: previewId, title: previewTitle };
      } else {
        console.log(`✓ Found existing KV namespace: ${previewTitle} (ID: ${previewNs.id})`);
      }
      
      createdNamespaces.push({
        name: kvConfig.name,
        id: productionNs.id,
        preview_id: previewNs.id
      });
    }
    
    // Update wrangler.toml
    console.log('\nUpdating wrangler.toml...');
    updateWranglerToml(createdNamespaces);
    
    console.log('\n✅ KV namespace setup completed successfully!');
    console.log('\nCreated/Found namespaces:');
    createdNamespaces.forEach(ns => {
      console.log(`  - ${ns.name}`);
      console.log(`    Production ID: ${ns.id}`);
      console.log(`    Preview ID: ${ns.preview_id}`);
    });
    
  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { createKVNamespace, listKVNamespaces, updateWranglerToml };
