# Cloudflare Pages Deployment Documentation

Complete guide for deploying ChessChat Web to Cloudflare Pages with automated deployment, KV storage, and Prisma database integration.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Architecture Overview](#architecture-overview)
3. [Setup Instructions](#setup-instructions)
4. [Deployment Scripts](#deployment-scripts)
5. [GitHub Actions CI/CD](#github-actions-cicd)
6. [Pages Functions](#pages-functions)
7. [KV Storage](#kv-storage)
8. [Environment Variables](#environment-variables)
9. [Database Configuration](#database-configuration)
10. [Troubleshooting](#troubleshooting)
11. [Rollback Procedures](#rollback-procedures)

## Getting Started

### Prerequisites

- Node.js 16+ and npm
- Git repository
- Cloudflare account
- Wrangler CLI installed globally: `npm install -g wrangler`

### Quick Start

1. **Authenticate with Cloudflare:**
   ```bash
   wrangler login
   ```

2. **Set environment variables:**
   ```bash
   export CLOUDFLARE_ACCOUNT_ID="your-account-id"
   export PROJECT_NAME="chesschat-web"
   ```

3. **Run deployment:**
   ```bash
   ./scripts/deploy/deploy.sh
   ```

## Architecture Overview

### Cloudflare Pages Architecture

```
┌─────────────────────────────────────────────────┐
│           Cloudflare Pages Project              │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌──────────────┐      ┌──────────────┐       │
│  │   Static     │      │    Pages     │       │
│  │   Assets     │      │  Functions   │       │
│  │  (React UI)  │      │  (Backend)   │       │
│  └──────────────┘      └──────────────┘       │
│         │                      │               │
│         └──────────┬───────────┘               │
│                    │                           │
│         ┌──────────▼──────────┐                │
│         │   KV Namespaces     │                │
│         │ - Cache             │                │
│         │ - Sessions          │                │
│         │ - Game State        │                │
│         └─────────────────────┘                │
│                    │                           │
│         ┌──────────▼──────────┐                │
│         │  Prisma Database    │                │
│         │  (PostgreSQL)       │                │
│         └─────────────────────┘                │
└─────────────────────────────────────────────────┘
```

### Directory Structure

```
.
├── .github/
│   └── workflows/
│       └── deploy-cloudflare-pages.yml  # CI/CD workflow
├── scripts/
│   ├── deploy/
│   │   └── deploy.sh                    # Main deployment script
│   ├── kv/
│   │   └── setup-kv.sh                  # KV namespace setup
│   ├── env/
│   │   └── manage-env.sh                # Environment management
│   ├── validate/
│   │   └── pre-deploy.sh                # Pre-deploy validation
│   ├── verify/
│   │   └── post-deploy.sh               # Post-deploy verification
│   ├── troubleshoot/
│   │   └── troubleshoot.sh              # Troubleshooting utility
│   └── rollback/
│       └── rollback.sh                  # Rollback procedures
├── docs/
│   ├── DEPLOYMENT.md                    # This file
│   ├── PAGES_FUNCTIONS.md               # Pages Functions guide
│   ├── FILE_ROUTING.md                  # File-based routing guide
│   └── DASHBOARD_SETUP.md               # Dashboard configuration
├── functions/                           # Pages Functions directory
│   ├── api/
│   │   └── [...].ts                     # API routes
│   └── _middleware.ts                   # Middleware
├── public/
│   └── _redirects                       # Routing configuration
├── src/                                 # React application source
├── wrangler.toml                        # Cloudflare configuration
└── package.json
```

## Setup Instructions

### 1. Initial Configuration

Create a `wrangler.toml` file in your project root:

```toml
name = "chesschat-web"
compatibility_date = "2024-01-01"

# Pages configuration
pages_build_output_dir = "dist"

# KV Namespace Bindings (optional - can be set in dashboard)
[[kv_namespaces]]
binding = "CACHE"
id = "your-cache-namespace-id"
preview_id = "your-preview-cache-namespace-id"

[[kv_namespaces]]
binding = "SESSIONS"
id = "your-sessions-namespace-id"
preview_id = "your-preview-sessions-namespace-id"
```

### 2. Set Up KV Namespaces

Run the KV setup script:

```bash
./scripts/kv/setup-kv.sh
```

This will:
- Create production and preview KV namespaces
- Display namespace IDs for configuration
- Guide you through binding setup

### 3. Configure Environment Variables

Create a `.env.production` file:

```bash
./scripts/env/manage-env.sh template
```

Edit `.env.production` with your values:

```env
DATABASE_URL=postgresql://user:password@host:5432/database
API_SECRET_KEY=your-secret-key
JWT_SECRET=your-jwt-secret
CLOUDFLARE_ACCOUNT_ID=your-account-id
CLOUDFLARE_API_TOKEN=your-api-token
```

Sync secrets to Cloudflare:

```bash
./scripts/env/manage-env.sh sync .env.production
```

### 4. Configure GitHub Secrets

Add these secrets to your GitHub repository:

- `CLOUDFLARE_API_TOKEN`: Your Cloudflare API token
- `CLOUDFLARE_ACCOUNT_ID`: Your Cloudflare account ID

Navigate to: Repository Settings → Secrets and variables → Actions

## Deployment Scripts

### Main Deployment Script

Deploy to Cloudflare Pages:

```bash
# Deploy to production
./scripts/deploy/deploy.sh

# Deploy to preview
ENVIRONMENT=preview ./scripts/deploy/deploy.sh
```

The script performs:
1. ✅ Dependency check (Node.js, npm, wrangler)
2. ✅ Pre-deploy validation
3. ✅ Build the application
4. ✅ Deploy to Cloudflare Pages
5. ✅ Post-deploy verification
6. ✅ Save deployment history

### KV Namespace Management

```bash
# Setup KV namespaces
./scripts/kv/setup-kv.sh
```

### Environment Management

```bash
# Sync environment variables
./scripts/env/manage-env.sh sync .env.production

# List secrets
./scripts/env/manage-env.sh list

# Set a secret
./scripts/env/manage-env.sh set DATABASE_URL "postgresql://..."

# Delete a secret
./scripts/env/manage-env.sh delete OLD_SECRET

# Validate environment file
./scripts/env/manage-env.sh validate .env.production

# Create template
./scripts/env/manage-env.sh template
```

### Pre-deploy Validation

```bash
./scripts/validate/pre-deploy.sh
```

Validates:
- ✅ Node.js and npm versions
- ✅ Wrangler installation and authentication
- ✅ package.json and build scripts
- ✅ wrangler.toml configuration
- ✅ Environment variables
- ✅ TypeScript and Vite configuration
- ✅ Disk space

### Post-deploy Verification

```bash
# Automatic verification (called by deploy script)
DEPLOYMENT_URL="https://chesschat-web.pages.dev" ./scripts/verify/post-deploy.sh
```

Verifies:
- ✅ HTTP endpoint accessibility
- ✅ HTML content structure
- ✅ API health endpoints
- ✅ Static assets
- ✅ DNS resolution
- ✅ SSL/TLS certificates
- ✅ Response times

### Troubleshooting

```bash
# Interactive mode
./scripts/troubleshoot/troubleshoot.sh

# Command mode
./scripts/troubleshoot/troubleshoot.sh status
./scripts/troubleshoot/troubleshoot.sh kv
./scripts/troubleshoot/troubleshoot.sh env
./scripts/troubleshoot/troubleshoot.sh database
./scripts/troubleshoot/troubleshoot.sh functions
```

### Rollback Procedures

```bash
# List recent deployments
./scripts/rollback/rollback.sh list

# View deployment history
./scripts/rollback/rollback.sh history

# Rollback to specific commit
./scripts/rollback/rollback.sh git-rollback abc123

# Create rollback branch
./scripts/rollback/rollback.sh create-branch abc123

# Show rollback procedures
./scripts/rollback/rollback.sh procedures
```

## GitHub Actions CI/CD

The repository includes a complete CI/CD workflow for automated deployments.

### Workflow Triggers

- **Push to `main`**: Deploy to production
- **Push to `develop`**: Deploy to development environment
- **Pull Request**: Deploy preview environment
- **Manual dispatch**: Deploy to specified environment

### Workflow Jobs

1. **Pre-deployment Validation**: Validates configuration and dependencies
2. **Build**: Builds the React application
3. **Deploy Preview**: Deploys to preview environment (PRs only)
4. **Deploy Production**: Deploys to production (main branch)
5. **Deploy Development**: Deploys to development (develop branch)

### Environment Configuration

Configure environments in GitHub:
- Settings → Environments → New environment

Create:
- `production`: Protected, requires approval
- `preview`: Automatic deployment
- `development`: Automatic deployment

### Deployment Process

```mermaid
graph LR
    A[Push Code] --> B[Pre-deploy Validation]
    B --> C[Build Application]
    C --> D{Branch?}
    D -->|main| E[Deploy Production]
    D -->|develop| F[Deploy Development]
    D -->|PR| G[Deploy Preview]
    E --> H[Post-deploy Verification]
    F --> H
    G --> H
    H --> I[Save History]
```

## Pages Functions

See [PAGES_FUNCTIONS.md](./PAGES_FUNCTIONS.md) for detailed information about:
- File-based routing
- API handlers
- Middleware
- Context API
- TypeScript support
- Best practices

## KV Storage

Cloudflare KV is a global, low-latency key-value store.

### Namespaces

The setup creates these namespaces:
- **CACHE**: Application caching
- **SESSIONS**: User session storage
- **GAME_STATE**: Chess game state
- **ANALYTICS**: Analytics data

### Usage in Functions

```typescript
export async function onRequestGet(context) {
  const { CACHE } = context.env;
  
  // Get value
  const value = await CACHE.get('key');
  
  // Set value
  await CACHE.put('key', 'value', { expirationTtl: 3600 });
  
  // Delete value
  await CACHE.delete('key');
  
  return new Response(value);
}
```

## Environment Variables

### Required Variables

- `DATABASE_URL`: PostgreSQL connection string
- `API_SECRET_KEY`: Secret key for API authentication
- `JWT_SECRET`: Secret for JWT token signing

### Optional Variables

- `NODE_ENV`: Environment mode (production/development)
- `VITE_API_URL`: API base URL for frontend
- `VITE_WS_URL`: WebSocket URL for frontend

### Setting Variables

**Via Dashboard:**
1. Go to Workers & Pages → Your Project
2. Settings → Environment Variables
3. Add variable → Choose environment

**Via Script:**
```bash
./scripts/env/manage-env.sh set VARIABLE_NAME "value"
```

## Database Configuration

### Using Prisma with Cloudflare Pages

1. **Install Prisma:**
   ```bash
   npm install @prisma/client
   npm install -D prisma
   ```

2. **Initialize Prisma:**
   ```bash
   npx prisma init
   ```

3. **Configure Connection Pooling:**
   
   For serverless environments, use a connection pooler:
   - Supabase Pooler
   - PgBouncer
   - Prisma Data Proxy

4. **Set DATABASE_URL:**
   ```bash
   ./scripts/env/manage-env.sh set DATABASE_URL "postgresql://..."
   ```

5. **Generate Prisma Client:**
   ```bash
   npx prisma generate
   ```

### Example Function with Prisma

```typescript
import { PrismaClient } from '@prisma/client';

export async function onRequestGet(context) {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: context.env.DATABASE_URL,
      },
    },
  });
  
  const users = await prisma.user.findMany();
  
  return Response.json(users);
}
```

## Troubleshooting

### Common Issues

#### 1. Build Failures

**Symptoms:** Deployment fails during build
**Solutions:**
- Check Node.js version in environment variables
- Verify `npm run build` works locally
- Review build logs in dashboard
- Check for TypeScript errors

#### 2. Runtime Errors

**Symptoms:** 500 errors, function failures
**Solutions:**
- Check Functions logs in dashboard
- Verify environment variables are set
- Test database connection
- Review browser console for client errors

#### 3. Database Connection Issues

**Symptoms:** Cannot connect to database
**Solutions:**
- Use connection pooler (required for serverless)
- Check DATABASE_URL format
- Verify firewall allows Cloudflare IPs
- Add `?sslmode=require` if needed

#### 4. KV Binding Issues

**Symptoms:** Cannot access KV namespaces
**Solutions:**
- Verify bindings in dashboard
- Check namespace IDs match
- Confirm API token has KV permissions

### Getting Help

Run the troubleshooting utility:
```bash
./scripts/troubleshoot/troubleshoot.sh
```

## Rollback Procedures

### Method 1: Dashboard Rollback (Recommended)

1. Go to Cloudflare Dashboard
2. Workers & Pages → Your Project
3. Find deployment to rollback to
4. Click "Rollback to this deployment"

### Method 2: Git Rollback

```bash
./scripts/rollback/rollback.sh git-rollback <commit-sha>
```

### Method 3: Create Rollback Branch

```bash
./scripts/rollback/rollback.sh create-branch <commit-sha>
git push origin rollback-<timestamp>
```

## Best Practices

### Security

- ✅ Never commit secrets to repository
- ✅ Use Cloudflare secrets for sensitive data
- ✅ Rotate API tokens regularly
- ✅ Use environment-specific configurations

### Performance

- ✅ Enable Cloudflare caching
- ✅ Optimize bundle size
- ✅ Use lazy loading for routes
- ✅ Implement code splitting

### Deployment

- ✅ Always validate locally before pushing
- ✅ Use preview deployments for testing
- ✅ Monitor deployment logs
- ✅ Have rollback plan ready

### Development

- ✅ Use TypeScript for type safety
- ✅ Write tests for critical paths
- ✅ Document API endpoints
- ✅ Follow consistent code style

## Additional Resources

- [Cloudflare Pages Documentation](https://developers.cloudflare.com/pages/)
- [Pages Functions Documentation](https://developers.cloudflare.com/pages/functions/)
- [Wrangler CLI Documentation](https://developers.cloudflare.com/workers/wrangler/)
- [KV Storage Documentation](https://developers.cloudflare.com/kv/)
- [Prisma Documentation](https://www.prisma.io/docs/)

## Support

For issues or questions:
1. Check troubleshooting guide above
2. Run `./scripts/troubleshoot/troubleshoot.sh`
3. Review Cloudflare Dashboard logs
4. Check [Cloudflare Community](https://community.cloudflare.com/)
5. Join [Cloudflare Discord](https://discord.gg/cloudflaredev)
