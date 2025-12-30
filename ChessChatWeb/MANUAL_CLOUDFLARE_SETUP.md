# Manual Cloudflare Setup for Stockfish + AI Coaching Architecture

**Version:** 2.0  
**Date:** December 29, 2025  
**Prerequisites:** Cloudflare account, GitHub repository, domain configured

This document describes the manual steps that **cannot be automated** and must be configured through the Cloudflare dashboard.

---

## Overview

The architecture requires:
1. **Worker API** - Handles all `/api/*` routes, runs Stockfish engine
2. **AI Coaching Worker** - Provides post-game coaching (internal service)
3. **Pages Frontend** - Serves the static site

---

## Step 1: Deploy Worker API

### 1.1 Navigate to Worker API Directory

```bash
cd ChessChatWeb/worker-api
```

### 1.2 Generate Prisma Client

```bash
npm install
npm run prisma:generate
```

### 1.3 Set Secrets

```bash
# Database URL (Prisma Accelerate format)
wrangler secret put DATABASE_URL

# Admin password
wrangler secret put ADMIN_PASSWORD

# Optional: Internal auth token for Worker-to-Worker communication
wrangler secret put INTERNAL_AUTH_TOKEN
```

**DATABASE_URL format:**
```
prisma+postgres://accelerate.prisma-data.net/?api_key=YOUR_ACCELERATE_API_KEY
```

### 1.4 Deploy Worker

```bash
wrangler deploy
```

**Expected output:**
```
✨ Built successfully!
✨ Successfully published your script to
   https://chesschat-worker-api.YOURNAME.workers.dev
```

### 1.5 Configure Route in Cloudflare Dashboard

**CRITICAL:** This step connects your domain to the Worker.

1. Go to **Cloudflare Dashboard** → **Workers & Pages**
2. Click on **chesschat-worker-api**
3. Go to **Settings** → **Triggers** → **Routes**
4. Click **Add Route**
5. Enter:
   - **Route:** `chesschat.uk/api/*`
   - **Zone:** `chesschat.uk`
   - **Worker:** `chesschat-worker-api`
6. Click **Save**

**Verification:**
```bash
curl https://chesschat.uk/api/admin/worker-health
```

Expected response: `{"healthy":true,...}`

---

## Step 2: Deploy AI Coaching Worker

### 2.1 Navigate to AI Worker Directory

```bash
cd ChessChatWeb/worker-assistant
```

### 2.2 Install Dependencies

```bash
npm install
```

### 2.3 Set Secrets (Optional)

```bash
# Internal auth token (should match Worker API)
wrangler secret put INTERNAL_AUTH_TOKEN

# If using OpenAI for coaching
wrangler secret put OPENAI_API_KEY

# If using Anthropic for coaching
wrangler secret put ANTHROPIC_API_KEY
```

### 2.4 Deploy Worker

```bash
wrangler deploy --env production
```

**Expected output:**
```
✨ Built successfully!
✨ Successfully published your script to
   https://walle-assistant.YOURNAME.workers.dev
```

**Important:** This worker should NOT have public routes. It's called internally by Worker API.

---

## Step 3: Create Service Binding (Worker API → AI Coach)

This allows Worker API to call the AI Coaching Worker internally.

### Option A: Via Dashboard (Recommended)

1. Go to **Workers & Pages** → **chesschat-worker-api**
2. Go to **Settings** → **Variables**
3. Scroll to **Service Bindings**
4. Click **Add Binding**
5. Enter:
   - **Variable name:** `AI_COACH`
   - **Service:** `walle-assistant`
   - **Environment:** `production`
6. Click **Save**

### Option B: Via Wrangler (Alternative)

Edit `worker-api/wrangler.toml` and add:

```toml
[[services]]
binding = "AI_COACH"
service = "walle-assistant"
environment = "production"
```

Then redeploy:
```bash
cd worker-api
wrangler deploy
```

**Verification:**

The service binding will be used when Worker API calls `/api/ai/postgame`.

---

## Step 4: Deploy Pages Frontend

### 4.1 Build Frontend

```bash
cd ChessChatWeb
npm install
npm run build
```

### 4.2 Deploy to Pages

```bash
wrangler pages deploy dist
```

**OR** use Git integration (recommended):

1. Push code to GitHub
2. In **Cloudflare Dashboard** → **Workers & Pages** → **chesschat-web**
3. Go to **Settings** → **Builds & deployments**
4. Verify:
   - **Root directory:** `ChessChatWeb`
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
5. Click **Save and Deploy**

### 4.3 Configure Pages Environment Variables (Optional)

If Pages needs any environment variables:

1. Go to **Pages** → **chesschat-web** → **Settings** → **Environment variables**
2. Add variables for production and preview

---

## Step 5: Run Database Migrations

### 5.1 Connect to Database

Ensure your `DATABASE_URL` is set correctly (see Step 1.3).

### 5.2 Run Migrations

```bash
cd worker-api
npx prisma migrate deploy
```

This will create the necessary tables:
- `WorkerCallLog`
- `GameAnalysis`
- `AICallLog`
- `PlayerProfile`
- `GameRecord`
- And others

**Verification:**

```bash
npx prisma studio
```

This opens a web UI where you can inspect the database tables.

---

## Step 6: Configure Domain (If Not Already)

### 6.1 Add Domain to Cloudflare

1. Go to **Cloudflare Dashboard** → **Websites**
2. Click **Add a Site**
3. Enter your domain: `chesschat.uk`
4. Follow the nameserver setup instructions

### 6.2 Point Domain to Pages

1. Go to **DNS** → **Records**
2. Add a CNAME record:
   - **Name:** `@` (or `chesschat`)
   - **Target:** `chesschat-web.pages.dev`
   - **Proxy status:** Proxied (orange cloud)
3. Click **Save**

**Verification:**
```bash
dig chesschat.uk
```

Should point to Cloudflare's network.

---

## Step 7: Verify Architecture

### 7.1 Run Automated Verification

```bash
cd ChessChatWeb
node scripts/verify-architecture.mjs
```

This checks:
- ✅ Worker API owns `/api/*` routes
- ✅ AI Worker has NO `/api/*` routes
- ✅ Stockfish integration is present
- ✅ No silent fallback logic
- ✅ Structured error responses

### 7.2 Test Production Endpoint

```bash
node scripts/test-prod-chess-move.mjs https://chesschat.uk
```

This tests:
- ✅ `/api/chess-move` returns moves
- ✅ Engine is `stockfish`
- ✅ Response includes diagnostics + requestId
- ✅ Logs are persisted

### 7.3 Manual Smoke Test

```bash
# Test chess move
curl -X POST https://chesschat.uk/api/chess-move \
  -H "Content-Type: application/json" \
  -d '{
    "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    "cpuLevel": 3,
    "timeMs": 2000
  }'

# Test health
curl https://chesschat.uk/api/admin/worker-health

# Test frontend
curl https://chesschat.uk
```

---

## Step 8: GitHub Actions (Optional)

### 8.1 Add Cloudflare API Token to GitHub Secrets

1. In Cloudflare Dashboard, go to **My Profile** → **API Tokens**
2. Click **Create Token**
3. Use template: **Edit Cloudflare Workers**
4. Copy the token
5. In GitHub, go to **Settings** → **Secrets and variables** → **Actions**
6. Click **New repository secret**
7. Name: `CF_API_TOKEN`
8. Value: (paste token)

### 8.2 Create GitHub Actions Workflow

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [main, production]
  pull_request:
    branches: [main]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: cd ChessChatWeb && npm ci
      - name: Run verification
        run: cd ChessChatWeb && node scripts/verify-architecture.mjs

  deploy-worker-api:
    needs: verify
    if: github.ref == 'refs/heads/production'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Deploy Worker API
        run: |
          cd ChessChatWeb/worker-api
          npm ci
          npm run prisma:generate
          npx wrangler deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CF_API_TOKEN }}

  deploy-ai-worker:
    needs: verify
    if: github.ref == 'refs/heads/production'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Deploy AI Worker
        run: |
          cd ChessChatWeb/worker-assistant
          npm ci
          npx wrangler deploy --env production
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CF_API_TOKEN }}
```

---

## Troubleshooting

### Issue: Route not working (404 errors)

**Solution:**
1. Check that route is configured: `chesschat.uk/api/*` → `chesschat-worker-api`
2. Verify route is not being intercepted by Pages Functions
3. Clear browser cache

### Issue: Service binding not found

**Error:** `AI_COACH is not defined`

**Solution:**
1. Verify service binding is configured in Worker API settings
2. Check that AI Worker is deployed
3. Ensure binding name matches: `AI_COACH` (case-sensitive)

### Issue: Database connection failed

**Error:** `P1001: Can't reach database server`

**Solution:**
1. Verify `DATABASE_URL` secret is set correctly
2. Check that Prisma Accelerate is enabled
3. Ensure database is accessible from Cloudflare network

### Issue: Stockfish not working

**Error:** `STOCKFISH_UNAVAILABLE`

**Solution:**
1. Check that `stockfish.ts` is properly implemented
2. Verify Stockfish WASM is bundled with Worker
3. Review Worker logs for initialization errors

---

## Summary Checklist

Before going live:

- [ ] Worker API deployed and accessible
- [ ] Route configured: `chesschat.uk/api/*` → Worker API
- [ ] Worker API secrets set (DATABASE_URL, ADMIN_PASSWORD)
- [ ] AI Coaching Worker deployed
- [ ] Service binding configured (AI_COACH)
- [ ] Database migrations run
- [ ] Pages frontend deployed
- [ ] Domain DNS configured
- [ ] Verification scripts pass
- [ ] Smoke tests pass
- [ ] GitHub Actions configured (optional)

---

## Next Steps

See [ARCHITECTURE_STOCKFISH_AI_LEARNING.md](./ARCHITECTURE_STOCKFISH_AI_LEARNING.md) for:
- Migration plan (phased rollout)
- Learning pipeline implementation (Phase 3)
- AI integration details (Phase 4)

---

**Questions?** Review the architecture document or check Cloudflare logs for errors.
