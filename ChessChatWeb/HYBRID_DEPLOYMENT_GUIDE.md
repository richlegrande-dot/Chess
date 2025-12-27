# Hybrid Deployment Guide (Option B)

## Architecture Overview

ChessChat uses a **true hybrid architecture** with clear separation:

- **Cloudflare Pages**: Hosts the React/Vite site + public `/api/*` endpoints
- **Cloudflare Worker Service**: `walle-assistant` runs Wall-E logic independently
- **Communication**: Pages Functions call Worker via Service Binding (`env.WALLE_ASSISTANT.fetch()`)

This architecture keeps Pages and Worker deployments independent while maintaining tight integration.

---

## Critical: Pages vs Worker Configuration

### A) Cloudflare Pages Project Settings

**Project Type**: Cloudflare Pages (Git integration)

**Repository Configuration**:
- **Repository**: `richlegrande-dot/Chess`
- **Branch**: `main` (or your deployment branch)
- **Root directory**: `ChessChatWeb` ⚠️ **CRITICAL**
- **Build command**: `npm ci && npm run build`
- **Build output directory**: `dist`
- **Deploy command**: *(Leave empty - Pages auto-deploys)*

**Framework Preset**: Vite

**Environment Variables** (set in dashboard):
- `DATABASE_URL` (secret) - Prisma connection string
- `NODE_VERSION` = `18` (or `20`)

**Service Bindings** (Pages Settings → Functions → Service bindings):
- **Variable name**: `WALLE_ASSISTANT`
- **Service**: `walle-assistant`
- **Environment**: `production`

**Files Used**:
- Config: `ChessChatWeb/wrangler.toml`
- Package: `ChessChatWeb/package.json`
- Build: `ChessChatWeb/vite.config.ts`

---

### B) Cloudflare Worker Service Build Settings

**Project Type**: Worker Service Builds (Git integration)

⚠️ **THIS IS NOT A PAGES PROJECT - REQUIRES DEPLOY COMMAND**

**Repository Configuration**:
- **Repository**: `richlegrande-dot/Chess`
- **Branch**: `main` (or your deployment branch)
- **Path**: `ChessChatWeb/worker-assistant` ⚠️ **CRITICAL - Different from Pages!**
- **Build command**: `npm ci`
- **Deploy command**: `npx wrangler deploy --env production` ⚠️ **REQUIRED for Workers**

**For staging/preview**:
- **Deploy command**: `npx wrangler deploy --env staging`

**Environment Variables** (set via wrangler CLI or dashboard):
```bash
# Production
wrangler secret put DATABASE_URL --env production

# Staging
wrangler secret put DATABASE_URL --env staging
```

**Files Used**:
- Config: `ChessChatWeb/worker-assistant/wrangler.toml`
- Package: `ChessChatWeb/worker-assistant/package.json`
- Entrypoint: `ChessChatWeb/worker-assistant/src/index.ts`

---

## Key Differences Summary

| Aspect | Pages Project | Worker Service Build |
|--------|--------------|---------------------|
| **Root Path** | `ChessChatWeb` | `ChessChatWeb/worker-assistant` |
| **Build Command** | `npm ci && npm run build` | `npm ci` |
| **Deploy Command** | *(none - auto)* | `npx wrangler deploy --env production` ⚠️ |
| **Output Dir** | `dist` | *(not applicable)* |
| **Config File** | `wrangler.toml` | `worker-assistant/wrangler.toml` |
| **Type** | Cloudflare Pages | Cloudflare Worker Service |

---

## Service Binding Integration

### Pages Functions → Worker Communication

Pages Functions access the Worker via service binding:

```typescript
// In ChessChatWeb/functions/api/walle/chat.ts

export async function onRequestPost(context) {
  const { env, request } = context;
  
  // Call Worker via service binding
  const workerResponse = await env.WALLE_ASSISTANT.fetch(
    "https://internal/assist/chat",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestData)
    }
  );
  
  return workerResponse;
}
```

### Worker Endpoints (Internal Only)

The Worker exposes these endpoints (accessible only via service binding):
- `POST /assist/chat` - Wall-E chat interactions
- `POST /assist/analyze-game` - Game analysis
- `POST /assist/chess-move` - CPU move generation

⚠️ **These endpoints are NOT publicly accessible** - only via `env.WALLE_ASSISTANT.fetch()`

---

## Common Deployment Issues

### Issue 1: "ENOENT: package.json not found"

**Cause**: Wrong path configuration in Cloudflare dashboard

**Fix**:
- **Pages**: Root directory = `ChessChatWeb`
- **Worker**: Path = `ChessChatWeb/worker-assistant`

### Issue 2: "npm ci failed - package-lock.json missing"

**Cause**: Missing lockfile in worker-assistant directory

**Fix**: Lockfile now committed (`ChessChatWeb/worker-assistant/package-lock.json`)

**Alternative**: Change build command to `npm install` (less reliable)

### Issue 3: Worker build succeeds but deploy fails

**Cause**: Missing deploy command in Worker Service Build

**Fix**: Add deploy command: `npx wrangler deploy --env production`

### Issue 4: Pages can't find WALLE_ASSISTANT binding

**Cause**: Service binding not configured in Pages dashboard

**Fix**: 
1. Go to Pages project → Settings → Functions → Service bindings
2. Add binding: `WALLE_ASSISTANT` → `walle-assistant` service

---

## Deployment Checklist

### Pre-Deployment Verification

Run verification script:
```bash
node scripts/verify-hybrid-deploy-paths.mjs
```

This checks:
- ✅ Pages root has correct package.json and wrangler.toml
- ✅ Worker root has correct package.json and wrangler.toml
- ✅ Worker name matches "walle-assistant"
- ✅ Both package-lock.json files exist
- ✅ No Pages config in Worker wrangler.toml

### Pages Deployment

1. Push code to repository
2. Cloudflare Pages auto-deploys from `ChessChatWeb/`
3. Verify build logs show correct root directory
4. Check Functions → Service bindings configured

### Worker Deployment

1. Push code to repository
2. Cloudflare Worker Service Build runs from `ChessChatWeb/worker-assistant/`
3. Deploy command executes: `npx wrangler deploy --env production`
4. Verify worker deployed to `walle-assistant` service

### Post-Deployment Verification

1. Test Pages site loads correctly
2. Test public API endpoints: `/api/health`, `/api/walle/chat`
3. Verify service binding works (check Pages Functions logs)
4. Test Wall-E chat functionality
5. Check Worker logs in Cloudflare dashboard

---

## CI/CD Integration

Add to `.github/workflows/deploy.yml`:

```yaml
name: Hybrid Deployment Verification

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - name: Verify deployment configuration
        run: node scripts/verify-hybrid-deploy-paths.mjs
```

---

## Troubleshooting Commands

### Check Worker deployment status
```bash
cd ChessChatWeb/worker-assistant
npx wrangler deployments list
```

### View Worker logs
```bash
cd ChessChatWeb/worker-assistant
npx wrangler tail
```

### Test Worker locally
```bash
cd ChessChatWeb/worker-assistant
npm run dev
```

### Test Pages Functions locally
```bash
cd ChessChatWeb
npm run dev
```

---

## Architecture Enforcement

### Provable Personalization

Wall-E enforces **≥2 references** from user history:
- Implemented in Worker: `ChessChatWeb/worker-assistant/src/index.ts`
- Validated via: `shared/walleEngine.ts`

### No External AI Dependencies

- ❌ No OpenAI
- ❌ No Claude
- ❌ No external LLM services
- ✅ Wall-E only (deterministic chess coaching)

---

## Contact & Support

For deployment issues:
1. Check this guide first
2. Run verification script: `node scripts/verify-hybrid-deploy-paths.mjs`
3. Review Cloudflare build logs (both Pages and Worker)
4. Check service binding configuration in Pages dashboard

---

**Last Updated**: December 27, 2024  
**Architecture**: Option B (True Hybrid)  
**Worker Service**: walle-assistant  
**Pages Project**: chesschat-web
