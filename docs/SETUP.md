# Chess Application - Complete Setup Guide

This guide provides comprehensive instructions for setting up, configuring, and deploying the Chess application on Cloudflare Pages.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Initial Setup](#initial-setup)
3. [Cloudflare Dashboard Configuration](#cloudflare-dashboard-configuration)
4. [KV Namespace Setup](#kv-namespace-setup)
5. [Secret Management](#secret-management)
6. [Deployment](#deployment)
7. [GitHub Actions Setup](#github-actions-setup)
8. [Troubleshooting](#troubleshooting)

## Prerequisites

Before you begin, ensure you have:

- Node.js 18+ installed
- A Cloudflare account with Pages enabled
- Cloudflare API Token with appropriate permissions
- GitHub repository access

### Required Cloudflare Permissions

Your API Token needs the following permissions:
- Account Settings: Read
- Workers KV Storage: Edit
- Cloudflare Pages: Edit

## Initial Setup

### 1. Clone the Repository

```bash
git clone https://github.com/richlegrande-dot/Chess.git
cd Chess
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment Variables

Create a `.env` file in the root directory (this file is gitignored):

```bash
# Cloudflare Configuration
CLOUDFLARE_API_TOKEN=your_api_token_here
CLOUDFLARE_ACCOUNT_ID=your_account_id_here
CLOUDFLARE_PROJECT_NAME=chess

# Application Secrets (for local development)
OPENAI_API_KEY=your_openai_key_here
DATABASE_URL=your_database_url_here
ADMIN_PASSWORD=your_admin_password_here
```

#### Finding Your Cloudflare Account ID

1. Log in to the [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Select your account
3. Go to "Pages" or any Workers & Pages section
4. Your Account ID is displayed in the right sidebar

#### Creating a Cloudflare API Token

1. Go to [API Tokens](https://dash.cloudflare.com/profile/api-tokens)
2. Click "Create Token"
3. Use the "Edit Cloudflare Workers" template or create a custom token with:
   - Account Settings: Read
   - Workers KV Storage: Edit
   - Cloudflare Pages: Edit
4. Save the token securely

## Cloudflare Dashboard Configuration

### 1. Create a Pages Project

1. Log in to the [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Go to "Workers & Pages"
3. Click "Create application"
4. Select "Pages" tab
5. Click "Connect to Git"
6. Authorize GitHub and select your repository
7. Configure build settings:
   - **Build command:** `npm run build`
   - **Build output directory:** `public`
   - **Root directory:** `/` (default)

### 2. Configure Environment Variables in Dashboard

In your Pages project settings, add these environment variables:

**Production Environment:**
- `ENVIRONMENT` = `production`

**Preview Environment:**
- `ENVIRONMENT` = `preview`

## KV Namespace Setup

KV namespaces are required for analytics and rate limiting.

### Automatic Setup (Recommended)

Run the setup script:

```bash
npm run setup:kv
```

This script will:
1. Create `chess-analytics` and `chess-analytics-preview` KV namespaces
2. Create `chess-rate-limit` and `chess-rate-limit-preview` KV namespaces
3. Update `wrangler.toml` with the namespace IDs

### Manual Setup

If you prefer to set up KV namespaces manually:

1. Go to the Cloudflare Dashboard
2. Navigate to "Workers & Pages" > "KV"
3. Create the following namespaces:
   - `chess-analytics` (production)
   - `chess-analytics-preview` (preview)
   - `chess-rate-limit` (production)
   - `chess-rate-limit-preview` (preview)
4. Copy the namespace IDs
5. Update `wrangler.toml`:

```toml
kv_namespaces = [
  { binding = "ANALYTICS_KV", id = "production_id_here", preview_id = "preview_id_here" },
  { binding = "RATE_LIMIT_KV", id = "production_id_here", preview_id = "preview_id_here" }
]
```

### Binding KV Namespaces in Dashboard

1. Go to your Pages project settings
2. Navigate to "Settings" > "Functions"
3. Scroll to "KV namespace bindings"
4. Add bindings:
   - **Variable name:** `ANALYTICS_KV`, **KV namespace:** `chess-analytics`
   - **Variable name:** `RATE_LIMIT_KV`, **KV namespace:** `chess-rate-limit`

## Secret Management

Secrets are environment-specific and must be configured for both production and preview environments.

### Using the Setup Script

```bash
# Setup secrets for production
npm run setup:secrets setup production

# Setup secrets for preview
npm run setup:secrets setup preview
```

The script will prompt you for each required secret:
- `OPENAI_API_KEY`: Your OpenAI API key
- `DATABASE_URL`: Your database connection string
- `ADMIN_PASSWORD`: Admin dashboard password

### Using Wrangler CLI

```bash
# Set secrets using wrangler
echo "your_openai_key" | wrangler pages secret put OPENAI_API_KEY --project-name=chess --env production
echo "your_database_url" | wrangler pages secret put DATABASE_URL --project-name=chess --env production
echo "your_admin_password" | wrangler pages secret put ADMIN_PASSWORD --project-name=chess --env production
```

### Using Cloudflare Dashboard

1. Go to your Pages project
2. Navigate to "Settings" > "Environment variables"
3. Select the environment (Production or Preview)
4. Add each secret:
   - Click "Add variable"
   - Select "Encrypt" for sensitive values
   - Enter the variable name and value
   - Click "Save"

### Verify Secrets

```bash
# Verify secrets are configured
npm run setup:secrets verify production
npm run setup:secrets verify preview

# List configured secrets
npm run setup:secrets list production
```

## Deployment

### Pre-Deployment Validation

Before deploying, validate your configuration:

```bash
npm run validate:pre-deploy
```

This checks:
- ✓ wrangler.toml is valid
- ✓ Required environment variables are set
- ✓ Secrets are configured
- ✓ KV namespaces are set up
- ✓ Database connection (if applicable)

### Manual Deployment

```bash
# Deploy to preview
npm run deploy:preview

# Deploy to production
npm run deploy:production
```

### Post-Deployment Validation

After deployment, validate the deployment:

```bash
npm run validate:post-deploy https://chess.pages.dev
```

This checks:
- ✓ Health check endpoint responds
- ✓ KV namespaces are functional
- ✓ Secrets are accessible
- ✓ Application is responding

## GitHub Actions Setup

GitHub Actions are configured to automatically deploy on push.

### Required GitHub Secrets

Add these secrets to your GitHub repository:

1. Go to your repository on GitHub
2. Navigate to "Settings" > "Secrets and variables" > "Actions"
3. Click "New repository secret"
4. Add the following secrets:

- `CLOUDFLARE_API_TOKEN`: Your Cloudflare API token
- `CLOUDFLARE_ACCOUNT_ID`: Your Cloudflare account ID
- `CLOUDFLARE_PROJECT_NAME`: `chess` (or your project name)

### Workflow Triggers

**Preview Deployments** (`.github/workflows/deploy-preview.yml`):
- Triggered on pull requests
- Triggered on pushes to non-main branches
- Deploys to preview environment
- Comments deployment URL on pull requests

**Production Deployments** (`.github/workflows/deploy-production.yml`):
- Triggered on pushes to `main` branch
- Can be manually triggered via "Actions" tab
- Deploys to production environment
- Includes post-deployment validation

### Manual Workflow Dispatch

To manually trigger a production deployment:

1. Go to "Actions" tab in GitHub
2. Select "Deploy Production" workflow
3. Click "Run workflow"
4. Select branch and click "Run workflow"

## Pages Functions File-Based Routing

Cloudflare Pages Functions use file-based routing. The routing structure is:

```
functions/
├── api/
│   └── health.js        → /api/health
├── _middleware.js       → Runs for all routes
└── [[path]].js          → Catch-all route
```

### Creating New API Endpoints

Create a new file in the `functions/` directory:

**Example: `/functions/api/status.js`**

```javascript
export async function onRequestGet(context) {
  return new Response(JSON.stringify({ status: 'ok' }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
```

This creates an endpoint at `/api/status`.

### HTTP Methods

Export functions for different HTTP methods:

- `onRequestGet` - GET requests
- `onRequestPost` - POST requests
- `onRequestPut` - PUT requests
- `onRequestDelete` - DELETE requests
- `onRequest` - All methods

### Accessing Environment Variables and KV

```javascript
export async function onRequestGet(context) {
  const { env, request } = context;
  
  // Access secrets
  const apiKey = env.OPENAI_API_KEY;
  
  // Access KV namespaces
  await env.ANALYTICS_KV.put('key', 'value');
  const value = await env.ANALYTICS_KV.get('key');
  
  return new Response('OK');
}
```

## Rollback Procedures

If a deployment fails or introduces issues, you can rollback.

### List Recent Deployments

```bash
npm run rollback list
```

### Rollback to Previous Deployment

```bash
npm run rollback latest
```

### Rollback to Specific Deployment

```bash
npm run rollback <deployment-id>
```

The rollback script will:
1. Show deployment details
2. Ask for confirmation
3. Initiate the rollback
4. Provide the deployment URL

## Troubleshooting

### KV Namespace IDs Not Set

**Error:** "KV binding has empty ID"

**Solution:** Run `npm run setup:kv` to create and bind KV namespaces.

### Missing Secrets

**Error:** "Missing secrets: OPENAI_API_KEY"

**Solution:** Run `npm run setup:secrets setup production` to configure secrets.

### Pre-Deploy Validation Fails

Run validation to see specific errors:

```bash
npm run validate:pre-deploy
```

Address each failed check before deploying.

### Health Check Fails

1. Check that KV namespaces are bound correctly
2. Verify secrets are configured
3. Check deployment logs in Cloudflare Dashboard
4. Visit `/api/health` directly to see the error

### Deployment URL Not Working

1. Wait 2-3 minutes for DNS propagation
2. Check deployment status in Cloudflare Dashboard
3. Run post-deploy validation: `npm run validate:post-deploy <url>`

### Database Connection Issues

1. Verify `DATABASE_URL` is set correctly
2. Check that database allows connections from Cloudflare IPs
3. Test connection locally first

## Local Development

Run the development server:

```bash
npm run dev
```

This starts a local Wrangler development server with KV namespace bindings.

### Testing Locally

1. Create a `.dev.vars` file (gitignored):

```
OPENAI_API_KEY=test_key
DATABASE_URL=postgresql://localhost/chess
ADMIN_PASSWORD=test_password
```

2. Run the dev server: `npm run dev`
3. Access the application at `http://localhost:8788`
4. Test the health check: `http://localhost:8788/api/health`

## Additional Resources

- [Cloudflare Pages Documentation](https://developers.cloudflare.com/pages/)
- [Cloudflare Pages Functions](https://developers.cloudflare.com/pages/functions/)
- [Cloudflare KV Documentation](https://developers.cloudflare.com/kv/)
- [Wrangler CLI Documentation](https://developers.cloudflare.com/workers/wrangler/)

## Support

For issues or questions:
1. Check the [Troubleshooting](#troubleshooting) section
2. Review Cloudflare Dashboard logs
3. Run validation scripts for detailed diagnostics
4. Open an issue on GitHub
