# ChessChatWeb Deployment Guide

**Last Updated**: December 18, 2025  
**Version**: 1.0.0  
**Target Platform**: Cloudflare Pages + D1

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Initial Setup](#initial-setup)
4. [Database Setup](#database-setup)
5. [Deployment](#deployment)
6. [Post-Deployment](#post-deployment)
7. [Monitoring](#monitoring)
8. [Troubleshooting](#troubleshooting)

## Overview

ChessChatWeb deploys to **Cloudflare Pages** with:
- **Frontend**: Static site (Vite build)
- **Backend**: Cloudflare Functions (serverless)
- **Database**: Cloudflare D1 (SQLite)

### Architecture

```
Your Domain
    ↓
Cloudflare Pages (CDN)
    ↓
Frontend (dist/) + Functions (functions/)
    ↓
Cloudflare D1 Database
```

### Deployment Flow

```
npm run build
    ↓
dist/ (frontend)
functions/ (backend)
    ↓
npx wrangler pages deploy
    ↓
Live on Cloudflare Edge
```

## Prerequisites

### Required Accounts

1. **Cloudflare Account** (free tier works)
   - Sign up at [cloudflare.com](https://cloudflare.com)
   - Verify email

2. **GitHub Account** (optional, for CI/CD)
   - For automatic deployments on push

### Required Tools

```bash
# Node.js 18+
node --version  # Should be v18.0.0 or higher

# npm 9+
npm --version

# Wrangler CLI (Cloudflare)
npm install -g wrangler

# Verify installation
wrangler --version
```

### Authenticate Wrangler

```bash
wrangler login
```

This opens a browser to authorize Wrangler with your Cloudflare account.

## Initial Setup

### 1. Clone Repository

```bash
git clone <repository-url>
cd ChessChatWeb
npm install
```

### 2. Create Cloudflare Pages Project

**Via Dashboard**:
1. Go to [dash.cloudflare.com](https://dash.cloudflare.com)
2. Pages → Create a project
3. **Name**: `chesschatweb` (or your preferred name)
4. **Production branch**: `main`
5. **Framework preset**: None (manual)
6. **Build command**: `npm run build`
7. **Build output directory**: `dist`
8. Click "Save and Deploy"

**Via CLI** (alternative):
```bash
wrangler pages project create chesschatweb
```

### 3. Configure Environment Variables

**Via Dashboard**:
1. Pages → `chesschatweb` → Settings → Environment variables
2. Add the following for **Production**:

| Variable | Value | Type |
|----------|-------|------|
| `NODE_ENV` | `production` | Plain text |
| `ADMIN_PASSWORD` | `YourSecurePassword!` | Encrypted |
| `DATABASE_URL` | (auto-set by D1 binding) | - |

**Important**: Use a strong admin password!

## Database Setup

### 1. Create D1 Database

```bash
wrangler d1 create chesschatweb-db
```

**Output**:
```
✅ Successfully created DB 'chesschatweb-db'
Database ID: abc123-def456-ghi789
```

**Save the Database ID!**

### 2. Configure wrangler.toml

Create or update `wrangler.toml`:

```toml
name = "chesschatweb"
compatibility_date = "2024-01-01"

[[d1_databases]]
binding = "DB"
database_name = "chesschatweb-db"
database_id = "abc123-def456-ghi789"  # Your database ID
```

### 3. Run Migrations

**Apply Prisma migrations to D1**:

```bash
# Generate SQL from Prisma schema
npx prisma migrate dev --name init

# Apply to D1 (local)
wrangler d1 migrations apply chesschatweb-db --local

# Apply to D1 (production)
wrangler d1 migrations apply chesschatweb-db --remote
```

**Verify Migration**:
```bash
wrangler d1 execute chesschatweb-db --remote --command "SELECT name FROM sqlite_master WHERE type='table';"
```

Should show: `KnowledgeSource`, `KnowledgeChunk`, `AdminSession`, `AuditLog`

### 4. Seed Knowledge Data (Optional)

**Via Import Script**:
```bash
# Requires local D1 setup
npm run import-knowledge
```

**Manually via Admin Portal**:
1. Deploy app first
2. Access admin portal
3. Use Knowledge Vault tab to add sources/chunks

## Deployment

### Option 1: Manual Deployment (CLI)

```bash
# Build frontend
npm run build

# Deploy to Cloudflare Pages
npx wrangler pages deploy dist --project-name chesschatweb
```

**Output**:
```
✨ Success! Uploaded 45 files
✨ Deployment complete!
🌎 https://chesschatweb.pages.dev
```

### Option 2: GitHub Integration (CI/CD)

**Setup**:
1. Push code to GitHub
2. Cloudflare Dashboard → Pages → `chesschatweb`
3. Settings → Builds & deployments
4. **Connect to Git** → Select repository
5. **Build settings**:
   - Build command: `npm run build`
   - Build output: `dist`
6. Save

**Automatic Deployments**:
- Every push to `main` triggers production deployment
- Pull requests create preview deployments

### Option 3: GitHub Actions (Custom CI)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Cloudflare Pages

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build
        run: npm run build
      
      - name: Deploy to Cloudflare Pages
        uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          projectName: chesschatweb
          directory: dist
```

**Required Secrets** (GitHub repo settings):
- `CLOUDFLARE_API_TOKEN`: Create at Cloudflare → My Profile → API Tokens
- `CLOUDFLARE_ACCOUNT_ID`: Found in Cloudflare dashboard URL

## Post-Deployment

### 1. Verify Health

```bash
curl https://chesschatweb.pages.dev/api/health
```

**Expected Response**:
```json
{
  "status": "healthy",
  "database": {
    "dbReady": true,
    "connectionStatus": "connected"
  }
}
```

### 2. Test Admin Portal

1. Navigate to `https://chesschatweb.pages.dev/admin`
2. Enter admin password (set in environment variables)
3. Verify tabs load:
   - System Health (green)
   - Knowledge Vault (shows sources)
   - CoachEngine (test interface works)
   - Audit Log (empty initially)

### 3. Test Game Play

1. Go to `https://chesschatweb.pages.dev`
2. Make a move (e.g., e2-e4)
3. AI responds within 5-10 seconds
4. Complete game and test post-game chat

### 4. Custom Domain (Optional)

**Setup**:
1. Cloudflare Dashboard → Pages → `chesschatweb`
2. Custom domains → Add custom domain
3. Enter your domain (e.g., `chess.yourdomain.com`)
4. Follow DNS configuration instructions
5. SSL certificate auto-provisions

**DNS Configuration**:
```
Type: CNAME
Name: chess
Target: chesschatweb.pages.dev
Proxy: Enabled (orange cloud)
```

## Monitoring

### Cloudflare Analytics

**Access**:
1. Dashboard → Pages → `chesschatweb`
2. Analytics tab

**Metrics**:
- Requests per day
- Bandwidth usage
- Error rate
- Geographic distribution

### Real-Time Logs

**Tail Logs**:
```bash
wrangler pages deployment tail
```

Shows live requests and console.log outputs.

**Filter by Status**:
```bash
wrangler pages deployment tail --status error
```

### Performance Monitoring

**Core Web Vitals**:
- Lighthouse in Chrome DevTools
- Run on deployed URL
- Target: All metrics in "Good" range

**Backend Performance**:
- Check `/api/health` for response times
- Monitor D1 query performance in Wrangler logs

### Error Tracking (Future Enhancement)

Recommended tools:
- **Sentry**: Real-time error tracking
- **LogFlare**: Log aggregation for Cloudflare
- **BetterStack**: Uptime monitoring

## Troubleshooting

### Common Issues

#### 1. "Database Not Found" Error

**Symptoms**: `/api/health` returns `dbReady: false`

**Solution**:
```bash
# Verify D1 binding in wrangler.toml
cat wrangler.toml | grep -A 3 "d1_databases"

# Re-apply migrations
wrangler d1 migrations apply chesschatweb-db --remote

# Check tables exist
wrangler d1 execute chesschatweb-db --remote --command "SELECT name FROM sqlite_master WHERE type='table';"
```

#### 2. "Function Invocation Failed"

**Symptoms**: 500 errors on API endpoints

**Solution**:
```bash
# Check logs
wrangler pages deployment tail --status error

# Common causes:
# - Missing environment variables
# - Prisma client not generated
# - Invalid function export signature

# Rebuild and redeploy
npm run build
wrangler pages deploy dist --project-name chesschatweb
```

#### 3. Admin Portal Won't Unlock

**Symptoms**: "Unauthorized" despite correct password

**Solution**:
1. Verify `ADMIN_PASSWORD` environment variable set correctly
2. Check Pages → Settings → Environment variables
3. Re-deploy after changing variables:
   ```bash
   # Trigger redeployment
   wrangler pages deployment create dist --project-name chesschatweb
   ```

#### 4. Build Fails

**Symptoms**: Deployment fails during build step

**Common Causes**:
- TypeScript errors
- Missing dependencies
- Node version mismatch

**Solution**:
```bash
# Test build locally
npm run build

# Fix TypeScript errors
npm run type-check

# Ensure all dependencies installed
npm ci

# Check Node version matches production
node --version  # Should be 18+
```

#### 5. Slow API Responses

**Symptoms**: Requests timeout or take >30s

**Possible Causes**:
- External AI API rate limits
- Cold starts (first request after idle)
- Large database queries

**Solution**:
- Check AI model availability (try different model)
- Pre-warm functions with health check pings
- Optimize database queries (add indexes)

### Rollback Deployment

**Via Dashboard**:
1. Pages → `chesschatweb` → Deployments
2. Find previous working deployment
3. Click "⋯" → "Rollback to this deployment"

**Via CLI**:
```bash
wrangler pages deployment list --project-name chesschatweb
wrangler pages deployment rollback <deployment-id>
```

### Database Backup

**Export D1 Database**:
```bash
wrangler d1 export chesschatweb-db --remote --output backup.sql
```

**Import Backup**:
```bash
wrangler d1 execute chesschatweb-db --remote --file backup.sql
```

**Recommended**: Schedule weekly backups via cron or GitHub Actions.

## Production Checklist

Before going live:

- [ ] Environment variables set (especially `ADMIN_PASSWORD`)
- [ ] D1 database created and migrated
- [ ] Health endpoint returns 200 OK
- [ ] Admin portal accessible and functional
- [ ] Knowledge Vault populated with content
- [ ] Test game play end-to-end
- [ ] Custom domain configured (if applicable)
- [ ] SSL certificate active
- [ ] Monitoring/alerting setup (optional)
- [ ] Backup strategy in place
- [ ] Team has admin credentials

## Scaling Considerations

### Cloudflare Limits (Free Tier)

- **Requests**: 100,000/day
- **D1 Database**: 5GB storage
- **Functions**: 100,000 invocations/day
- **Bandwidth**: Unlimited

### Upgrade Path

If you exceed limits:
1. **Workers Paid Plan**: $5/month
   - 10M requests/month
   - Additional usage billed
2. **D1 Scale**: Contact Cloudflare for larger databases

### Performance Optimization

- Enable caching for static assets (auto-enabled)
- Minimize function execution time
- Index database columns for common queries
- Use Cloudflare CDN features (minification, compression)

---

**Next Steps**: See [MAINTENANCE_GUIDE.md](./MAINTENANCE_GUIDE.md) for ongoing operations.
