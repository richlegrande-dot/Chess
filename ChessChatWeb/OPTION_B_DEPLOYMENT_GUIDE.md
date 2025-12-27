# Option B Hybrid Deployment Guide

**Architecture:** Cloudflare Pages + Standalone Worker Service (Connected via Service Binding)

## Overview

This project uses a hybrid architecture to separate concerns:

- **Pages Project** (`chesschat-web`): Public website + API endpoints (`/api/*`)
- **Worker Service** (`walle-assistant`): Internal AI assistant (Wall-E only)
- **Service Binding**: Pages Functions call Worker via `env.WALLE_ASSISTANT.fetch(...)`

## Critical Distinction: Two Separate Build Systems

Cloudflare has **TWO completely separate deployment systems**:

### 1. Pages Project (React/Vite + Functions)

- **Dashboard Name:** `chesschat-web`
- **Build Path:** `ChessChatWeb` (repository root)
- **Build Command:** `npm ci && npm run build`
- **Build Output:** `dist`
- **Deploy Method:** Automatic (Pages Git integration)
- **Functions Location:** `ChessChatWeb/functions/api/*`
- **Configuration File:** `ChessChatWeb/wrangler.toml`

### 2. Worker Service (Standalone Wall-E Assistant)

- **Service Name:** `walle-assistant`
- **Build Path:** `ChessChatWeb/worker-assistant` ⚠️ **CRITICAL: NOT root!**
- **Build Command:** `npm ci && npm run build`
- **Deploy Command:** `npx wrangler deploy --env production`
- **Entrypoint:** `src/index.ts`
- **Configuration File:** `ChessChatWeb/worker-assistant/wrangler.toml`

## Deployment Steps

### Initial Setup

1. **Verify repository structure:**
   ```bash
   npm run verify:worker-path
   # or manually:
   node scripts/verify-worker-assistant-path.mjs
   ```

2. **Deploy Worker Service first:**
   ```bash
   cd worker-assistant
   npm ci
   npx wrangler deploy --env production
   ```

3. **Configure Service Binding in Pages Dashboard:**
   - Go to: Cloudflare Dashboard → Pages → `chesschat-web` → Settings → Functions
   - Scroll to: **Service bindings**
   - Add binding:
     - **Variable name:** `WALLE_ASSISTANT`
     - **Service:** `walle-assistant`
     - **Environment:** `production`
   - Save

4. **Deploy Pages project:**
   - Push to `main` branch (automatic deployment)
   - Or manually: `npm run deploy`

### Cloudflare Dashboard Configuration

#### Pages Project Settings

**Location:** Dashboard → Pages → `chesschat-web` → Settings → Builds & deployments

```
Production branch: main
Build configuration:
  Build command:       npm ci && npm run build
  Build output dir:    dist
  Root directory:      ChessChatWeb
```

**Environment Variables** (Settings → Environment variables):

```bash
# OPTIONAL (graceful degradation if missing)
DATABASE_URL=<your-database-url>  # Prisma connection string

# OPTIONAL (rate limiting)
RATE_LIMIT_PER_IP=30
RATE_LIMIT_WINDOW=60
```

**Service Bindings** (Settings → Functions → Service bindings):

```
Variable:     WALLE_ASSISTANT
Service:      walle-assistant
Environment:  production
```

#### Worker Service Settings

**Location:** Dashboard → Workers & Pages → `walle-assistant`

No additional dashboard configuration needed (all in wrangler.toml).

**Secrets** (if using database):

```bash
cd worker-assistant
npx wrangler secret put DATABASE_URL --env production
# Enter your database URL when prompted
```

## Service Binding Architecture

### How It Works

1. **Request Flow:**
   ```
   Client → Pages (/api/chat) → Pages Function (chat.ts)
     ↓
     → Try env.WALLE_ASSISTANT.fetch() first
     ↓
     → If binding available: Worker Service handles request
     → If binding missing: Local fallback (Pages runs Wall-E directly)
   ```

2. **Mode Detection:**
   - Add `?debug=1` to any API endpoint
   - Response includes `mode` field:
     - `"service-binding"` - Using Worker Service
     - `"local-fallback"` - Running locally in Pages

3. **Graceful Degradation:**
   - If Worker Service is unavailable, Pages Functions run Wall-E locally
   - If DATABASE_URL is missing, basic mode (no personalization)
   - Never fails completely

### Pages Functions with Service Binding

Example from `functions/api/chat.ts`:

```typescript
interface Env {
  DATABASE_URL?: string;
  WALLE_ASSISTANT?: Fetcher; // Service binding
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  // Try service binding first
  if (context.env.WALLE_ASSISTANT) {
    try {
      const response = await context.env.WALLE_ASSISTANT.fetch(
        'https://internal/assist/chat',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message, userId, gameContext })
        }
      );
      
      const data = await response.json();
      if (data.success) {
        return Response.json({ ...data, mode: 'service-binding' });
      }
    } catch (error) {
      console.warn('Worker binding failed, using local fallback');
    }
  }

  // Local fallback: Run Wall-E directly
  const engine = getWallEEngine();
  const result = await engine.chat(context, message, gameContext);
  return Response.json({ ...result, mode: 'local-fallback' });
}
```

## Testing Service Binding

### 1. Test Pages Functions

```bash
# Test chat endpoint
curl -X POST https://your-domain.pages.dev/api/chat?debug=1 \
  -H "Content-Type: application/json" \
  -d '{"message": "How do I improve my opening?", "userId": "test-user"}'

# Check response includes:
# - "mode": "service-binding" (if Worker connected)
# - "mode": "local-fallback" (if Worker unavailable)
```

### 2. Verify Worker Service

```bash
# Check Worker is deployed
npx wrangler deployments list --name walle-assistant

# Test Worker directly (if public)
curl https://walle-assistant.your-account.workers.dev/assist/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "test"}'
```

### 3. Check Service Binding Connection

In browser dev tools:
```javascript
// After making a request to /api/chat?debug=1
const response = await fetch('/api/chat?debug=1', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: 'test' })
});
const data = await response.json();
console.log('Mode:', data.mode); // Should be "service-binding"
```

## Non-Negotiables

✅ **Wall-E Only** - No OpenAI or external AI APIs anywhere
✅ **Provable Personalization** - All coaching responses include `historyEvidence`
✅ **DATABASE_URL Optional** - Graceful degradation if missing
✅ **Service Binding Optional** - Falls back to local Wall-E if binding unavailable

## Verification Scripts

Run before deployment:

```bash
# Verify worker structure
node scripts/verify-worker-assistant-path.mjs

# Verify no external AI dependencies
node scripts/verify-hybrid-assistant.mjs

# Verify Wall-E integrity
node scripts/verify-walle-integrity.mjs

# Full CI suite
npm test
```

## CI/CD Integration

The `.github/workflows/ci.yml` includes:

```yaml
- name: Verify Worker Assistant deployment path (Option B)
  run: |
    node scripts/verify-worker-assistant-path.mjs
    echo "✓ Worker assistant path verified"

- name: Verify hybrid assistant architecture
  run: |
    node scripts/verify-hybrid-assistant.mjs
    echo "✓ Hybrid assistant architecture verified"
```

## Troubleshooting

### Issue: Pages Functions return "local-fallback" mode

**Cause:** Service binding not configured

**Solution:**
1. Verify Worker is deployed: `npx wrangler deployments list --name walle-assistant`
2. Check service binding in Pages Dashboard
3. Ensure variable name is exactly `WALLE_ASSISTANT`
4. Redeploy Pages after adding binding

### Issue: Worker deployment fails with "path not found"

**Cause:** Incorrect build path

**Solution:**
1. Verify Cloudflare Worker settings use path: `ChessChatWeb/worker-assistant`
2. NOT `ChessChatWeb` (that's for Pages)
3. Run: `node scripts/verify-worker-assistant-path.mjs`

### Issue: "Database unavailable" error

**Cause:** DATABASE_URL not set (this is OK! Graceful degradation)

**Solution:**
- If you want personalization: Set DATABASE_URL in both Pages and Worker
- If basic mode is OK: No action needed (expected behavior)

### Issue: "OpenAI import detected" in CI

**Cause:** External AI dependency violation

**Solution:**
1. Remove all OpenAI/external AI imports
2. Use Wall-E engine only: `getWallEEngine()`
3. Run: `node scripts/verify-hybrid-assistant.mjs`

## Deployment Checklist

Before deploying to production:

- [ ] Worker structure verified: `node scripts/verify-worker-assistant-path.mjs`
- [ ] No external AI dependencies: `node scripts/verify-hybrid-assistant.mjs`
- [ ] Worker deployed: `cd worker-assistant && npx wrangler deploy --env production`
- [ ] Service binding configured in Pages Dashboard
- [ ] DATABASE_URL set (optional, for personalization)
- [ ] Pages deployed: Push to `main` branch
- [ ] Test endpoint with `?debug=1`: Should return `"mode": "service-binding"`
- [ ] Verify personalization: Response includes `historyEvidence`

## Repository Structure

```
ChessChatWeb/
├── wrangler.toml                    # Pages configuration
├── package.json                     # Pages dependencies
├── dist/                           # Pages build output
├── functions/                      # Pages Functions (API endpoints)
│   ├── api/
│   │   ├── chat.ts                # Uses service binding
│   │   ├── analyze-game.ts        # Uses service binding
│   │   └── chess-move.ts          # Uses service binding
│   └── lib/                       # Shared utilities
├── shared/                         # Shared code (Wall-E engine)
│   ├── walleEngine.ts
│   └── walleChessEngine.ts
├── worker-assistant/               # ← Worker Service (separate)
│   ├── wrangler.toml              # Worker configuration
│   ├── package.json               # Worker dependencies
│   └── src/
│       └── index.ts               # Worker entrypoint
└── scripts/
    └── verify-worker-assistant-path.mjs
```

## Summary

**Option B Hybrid = Best of Both Worlds:**

1. **Pages** handles website + public API (fast, edge-cached)
2. **Worker** handles AI logic (isolated, scalable)
3. **Service Binding** connects them (internal, no public exposure)
4. **Graceful Degradation** ensures it always works (even if binding fails)

**Key Insight:** Cloudflare has TWO build systems. Don't confuse them:
- Pages builds at root (`ChessChatWeb`)
- Worker builds at subfolder (`ChessChatWeb/worker-assistant`)

**Critical Files:**
- `ChessChatWeb/wrangler.toml` - Pages config (includes service binding)
- `ChessChatWeb/worker-assistant/wrangler.toml` - Worker config (standalone)
- `scripts/verify-worker-assistant-path.mjs` - Pre-deployment verification

Deploy confidently. 🚀
