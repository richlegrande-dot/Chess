# Hybrid Binding Deployment Guide

**Architecture**: Option B - Cloudflare Pages + Standalone Worker Service  
**Date**: December 27, 2025  
**Status**: Implementation Complete

---

## 🏗️ Architecture Overview

### Two-Component System

```
┌─────────────────────────────────────────────────┐
│  Cloudflare Pages (chesschat-web)              │
│  ┌───────────────────────────────────────────┐ │
│  │  Frontend (React/Vite)                    │ │
│  │  - Build output: dist/                    │ │
│  │  - Served from CDN                        │ │
│  └───────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────┐ │
│  │  Pages Functions (/api/*)                 │ │
│  │  - /api/chat ───────────────┐            │ │
│  │  - /api/analyze-game ────┐  │            │ │
│  │  - /api/chess-move ────┐ │  │            │ │
│  └────────────────────────┼─┼──┼────────────┘ │
└─────────────────────────┬─┼─┼──┼──────────────┘
                          │ │ │  │
              Service     │ │ │  │
              Binding     │ │ │  │
              (internal)  │ │ │  │
                          ▼ ▼ ▼  ▼
          ┌──────────────────────────────────────┐
          │  Worker Service (walle-assistant)    │
          │  ┌────────────────────────────────┐  │
          │  │  POST /assist/chat             │  │
          │  │  POST /assist/analyze-game     │  │
          │  │  POST /assist/chess-move       │  │
          │  └────────────────────────────────┘  │
          │  Uses shared Wall-E logic from:      │
          │  ChessChatWeb/shared/*               │
          └──────────────────────────────────────┘
```

### Key Components

1. **Cloudflare Pages (Frontend + Pages Functions)**
   - Hosts React/Vite frontend
   - Exposes public `/api/*` endpoints
   - Calls Worker via service binding (when available)
   - Falls back to local execution (development/fallback)

2. **Standalone Worker Service (walle-assistant)**
   - Dedicated CPU for Wall-E logic
   - Internal-only (not publicly routable)
   - Called via service binding from Pages Functions
   - Shares code with Pages Functions via `ChessChatWeb/shared/`

3. **Shared Modules (`ChessChatWeb/shared/`)**
   - `walleEngine.ts` - Main Wall-E coaching engine
   - `walleChessEngine.ts` - CPU chess opponent
   - `personalizedReferences.ts` - Provable personalization
   - `prisma.ts` - Database singleton
   - `coachEngine.ts`, `coachHeuristicsV2.ts`, etc.

---

## 📁 Repository Structure

```
ChessChatWeb/
├── src/                          # Frontend React/Vite code
├── dist/                         # Build output (Vite)
├── public/                       # Static assets
├── functions/                    # Pages Functions
│   ├── api/
│   │   ├── chat.ts              # Calls worker or runs locally
│   │   ├── analyze-game.ts      # Calls worker or runs locally
│   │   └── chess-move.ts        # Calls worker or runs locally
│   └── lib/
│       ├── security.ts          # Rate limiting, sanitization
│       └── ...                  # Other utilities
├── shared/                       # SHARED CODE (Pages + Worker)
│   ├── walleEngine.ts           # Wall-E coaching engine
│   ├── walleChessEngine.ts      # CPU chess engine
│   ├── personalizedReferences.ts
│   ├── prisma.ts                # Database client
│   └── ...                      # All Wall-E logic
├── worker-assistant/             # Standalone Worker Service
│   ├── wrangler.toml            # Worker config
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       └── index.ts             # Worker entry point
├── wrangler.toml                # Pages config
├── package.json                 # Root dependencies
└── vite.config.ts
```

---

## 🚀 Deployment Instructions

### A. Deploy Cloudflare Pages (Frontend + Functions)

**This is the main website that users access.**

#### 1. Dashboard Settings

Navigate to: **Cloudflare Dashboard → Pages → chesschat-web → Settings → Builds & deployments**

| Setting | Value | Notes |
|---------|-------|-------|
| **Build command** | `npm ci && npm run build` | Install + compile |
| **Build output directory** | `dist` | Vite output |
| **Root directory (Path)** | `ChessChatWeb` | Subfolder in repo |
| **Deploy command** | *(leave empty)* | Pages auto-deploys |

**CRITICAL**: Path = `ChessChatWeb` because:
- ✅ `package.json` is in `ChessChatWeb/`
- ✅ `wrangler.toml` is in `ChessChatWeb/`
- ❌ Path = `/` would fail (no package.json at repo root)

#### 2. Environment Variables

Navigate to: **Settings → Environment variables**

| Variable | Value | Scope |
|----------|-------|-------|
| `DATABASE_URL` | `prisma://accelerate...` | Production |
| `NODE_VERSION` | `20` | All environments |

**Note**: `WALLE_ASSISTANT` binding is configured separately (see step 3).

#### 3. Service Binding Configuration

Navigate to: **Settings → Functions → Bindings**

Click **Add binding** → **Service binding**:

| Field | Value |
|-------|-------|
| **Binding name** | `WALLE_ASSISTANT` |
| **Service** | `walle-assistant` |
| **Environment** | `production` |

**What this does**:
- Makes `env.WALLE_ASSISTANT` available in Pages Functions
- Allows internal calls to Worker service
- No public routes exposed

#### 4. Deploy

```bash
# Automatic via Git push
git push origin main

# Or manual via CLI
cd ChessChatWeb
npx wrangler pages deploy dist
```

**Expected result**:
- Build: 3-5 minutes
- Deploy: Automatic after build
- URL: `https://chesschat-web.pages.dev`

---

### B. Deploy Worker Service (walle-assistant)

**This is the internal AI assistant, NOT publicly accessible.**

#### 1. Install Dependencies (First Time Only)

```bash
cd ChessChatWeb/worker-assistant
npm install
```

**Note**: Worker reuses parent dependencies. Minimal package.json.

#### 2. Configure Secrets

```bash
# From ChessChatWeb/worker-assistant directory
npx wrangler secret put DATABASE_URL --env production
# Paste your Prisma Accelerate URL when prompted
```

**Verify**:
```bash
npx wrangler secret list --env production
```

#### 3. Deploy Worker

```bash
# From ChessChatWeb/worker-assistant directory
npx wrangler deploy --env production
```

**Expected output**:
```
✨ Built successfully
📦 Uploading...
✅ Deployed walle-assistant to Cloudflare Workers
🌍 https://walle-assistant.<subdomain>.workers.dev
```

**Important**: The worker URL is NOT used directly. Pages Functions call it via service binding.

#### 4. Verify Deployment

```bash
# Check worker status
npx wrangler deployments list --env production
```

---

## 🔗 Service Binding Behavior

### How It Works

Pages Functions check for `env.WALLE_ASSISTANT`:

```typescript
// In functions/api/chat.ts
if (env.WALLE_ASSISTANT) {
  // Call worker via service binding (internal)
  const response = await env.WALLE_ASSISTANT.fetch('https://internal/assist/chat', {
    method: 'POST',
    body: JSON.stringify({ message, userId, gameContext })
  });
  return response; // mode: 'service-binding'
} else {
  // Local fallback (development or if binding missing)
  const engine = getWallEEngine();
  const response = await engine.chat(...);
  return response; // mode: 'local-fallback'
}
```

### Benefits

1. **Production**: Worker handles Wall-E logic (dedicated CPU)
2. **Development**: Local execution (no worker needed)
3. **Graceful**: Falls back if worker unavailable
4. **Internal**: Service binding = internal-only (not public)

### Debug Mode

Add `?debug=1` to see which mode is active:

```bash
# Check if service binding is working
curl "https://chesschat-web.pages.dev/api/chat?debug=1" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello Wall-E"}'

# Response includes:
{
  "success": true,
  "response": "...",
  "mode": "service-binding"  # ← or "local-fallback"
}
```

---

## ✅ Verification Steps

### 1. Check Pages Deployment

```bash
# Visit the site
open https://chesschat-web.pages.dev

# Check health endpoint
curl https://chesschat-web.pages.dev/api/health
```

**Expected**:
```json
{
  "status": "healthy",
  "timestamp": "2025-12-27T...",
  "environment": "production",
  "walleEngine": true
}
```

### 2. Check Worker Deployment

```bash
cd ChessChatWeb/worker-assistant
npx wrangler tail --env production
```

**Open another terminal**:
```bash
curl "https://chesschat-web.pages.dev/api/chat?debug=1" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"message":"Test"}'
```

**Expected in tail**:
- Log: "Request started"
- Log: "Success"
- No errors

### 3. Verify Service Binding

```bash
curl "https://chesschat-web.pages.dev/api/chat?debug=1" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello", "userId":"test123"}'
```

**Check response**:
```json
{
  "success": true,
  "response": "...",
  "mode": "service-binding",  # ← Confirms binding works
  "historyEvidence": {
    "lastGamesUsed": 10,
    "personalizedReferenceCount": 2
  }
}
```

### 4. Verify Provable Personalization

```bash
curl "https://chesschat-web.pages.dev/api/analyze-game" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "pgn": "1. e4 e5 2. Nf3 Nc6",
    "moveHistory": [...],
    "cpuLevel": 3,
    "playerColor": "white",
    "userId": "test123"
  }'
```

**Check response includes**:
```json
{
  "success": true,
  "historyEvidence": {
    "lastGamesUsed": 10,
    "gameIdsUsed": ["game-1", "game-2", ...],
    "topMistakePatternsUsed": ["pattern-1", "pattern-2"],
    "personalizedReferenceCount": 3
  },
  "personalizedReferences": [
    {
      "gameId": "game-1",
      "type": "mistake_pattern",
      "text": "In game #1234, you missed a similar tactic..."
    }
  ]
}
```

---

## 🛠️ Local Development

### Run Pages Functions Locally

```bash
cd ChessChatWeb
npm run dev
```

**Behavior**:
- Frontend: `http://localhost:5173`
- Functions: Local execution (no worker binding)
- Mode: `local-fallback`

### Run Worker Locally

```bash
cd ChessChatWeb/worker-assistant
npx wrangler dev
```

**Behavior**:
- Worker: `http://localhost:8787`
- Test endpoints directly:
  ```bash
  curl http://localhost:8787/assist/chat \
    -X POST \
    -H "Content-Type: application/json" \
    -d '{"message":"Test"}'
  ```

### Test Both Together

**Terminal 1** (Worker):
```bash
cd ChessChatWeb/worker-assistant
npx wrangler dev --port 8787
```

**Terminal 2** (Pages):
```bash
cd ChessChatWeb
npx wrangler pages dev dist --binding WALLE_ASSISTANT=http://localhost:8787
```

**Test**:
```bash
curl "http://localhost:8788/api/chat?debug=1" \
  -X POST \
  -d '{"message":"Test"}'

# Should show: "mode": "service-binding"
```

---

## 🚨 Troubleshooting

### Problem: "mode": "local-fallback" in Production

**Cause**: Service binding not configured

**Fix**:
1. Cloudflare Dashboard → Pages → chesschat-web → Settings → Functions → Bindings
2. Add service binding: `WALLE_ASSISTANT` → `walle-assistant`
3. Redeploy Pages (or wait for next Git push)

### Problem: Worker Returns 404

**Cause**: Worker routes don't match

**Fix**: Worker expects:
- `POST /assist/chat`
- `POST /assist/analyze-game`
- `POST /assist/chess-move`

Check Pages Functions are calling correct paths.

### Problem: DATABASE_URL Missing in Worker

**Symptoms**:
```json
{
  "success": false,
  "error": "Database unavailable"
}
```

**Fix**:
```bash
cd ChessChatWeb/worker-assistant
npx wrangler secret put DATABASE_URL --env production
```

### Problem: Import Errors in Worker

**Symptoms**:
```
Error: Cannot find module '../../shared/walleEngine'
```

**Fix**: Check `worker-assistant/tsconfig.json` includes shared:
```json
{
  "include": ["src/**/*", "../../shared/**/*"]
}
```

### Problem: Build Fails - Path Error

**Error**:
```
npm error enoent Could not read package.json
```

**Fix**: Verify Cloudflare Pages settings:
- **Root directory (Path)**: `ChessChatWeb` ← MUST be set
- Not `/` (repo root has no package.json)

---

## 📊 Performance Expectations

### Pages Functions (Local Fallback)

| Metric | Target | Typical |
|--------|--------|---------|
| Chat response | <500ms | 200-400ms |
| Game analysis | <1s | 400-800ms |
| Chess move | <300ms | 50-200ms |

### Worker Service (Service Binding)

| Metric | Target | Typical |
|--------|--------|---------|
| Chat response | <400ms | 150-300ms |
| Game analysis | <800ms | 300-600ms |
| Chess move | <250ms | 30-150ms |

**Service binding benefits**:
- Dedicated CPU for Wall-E logic
- Isolated from frontend build overhead
- Better cold start performance

---

## 🔒 Security & Integrity

### Non-Negotiable Constraints (Enforced)

1. **NO EXTERNAL AI DEPENDENCIES**
   - ✅ Wall-E only
   - ❌ No OpenAI, Anthropic, or any external APIs
   - Verified by CI: `scripts/verify-hybrid-assistant.mjs`

2. **PROVABLE PERSONALIZATION**
   - Every coaching response MUST include:
     - `historyEvidence.personalizedReferenceCount >= 2` OR
     - `historyEvidence.insufficientHistory = true` with reason
   - Verified at runtime: `personalizedReferences.ts`

3. **DATABASE_URL OPTIONAL**
   - System degrades gracefully if DB unavailable
   - Basic coaching without personalization
   - No crashes or failures

### CI Verification

Run before every deployment:
```bash
node scripts/verify-hybrid-assistant.mjs
```

**Checks**:
- No `openai` imports anywhere
- No `api.openai.com` strings
- Worker structure exists
- Pages Functions reference `historyEvidence`
- Worker endpoints include personalization

---

## 📖 Related Documentation

- [CLOUDFLARE_CONFIG_CORRECTION.md](./CLOUDFLARE_CONFIG_CORRECTION.md) - Path configuration details
- [PROVABLE_PERSONALIZATION_COMPLETE.md](./PROVABLE_PERSONALIZATION_COMPLETE.md) - Evidence system
- [WALL_E_IMPLEMENTATION.md](./WALL_E_IMPLEMENTATION.md) - Wall-E architecture
- [COMPLETE_OPENAI_REMOVAL.md](./COMPLETE_OPENAI_REMOVAL.md) - No AI dependencies

---

## 🎯 Summary

**Deployment Checklist**:

- [ ] 1. Deploy Pages (Git push or `wrangler pages deploy dist`)
- [ ] 2. Configure Pages service binding: `WALLE_ASSISTANT` → `walle-assistant`
- [ ] 3. Deploy Worker (`wrangler deploy --env production`)
- [ ] 4. Set Worker secret: `DATABASE_URL`
- [ ] 5. Verify: `curl .../api/chat?debug=1` shows `mode: service-binding`
- [ ] 6. Run CI: `node scripts/verify-hybrid-assistant.mjs`

**Result**:
- ✅ Pages hosts frontend + exposes `/api/*`
- ✅ Worker handles Wall-E logic (internal)
- ✅ Service binding connects them (internal-only)
- ✅ Local fallback for development
- ✅ No external AI dependencies
- ✅ Provable personalization enforced

**Status**: Ready for production deployment
