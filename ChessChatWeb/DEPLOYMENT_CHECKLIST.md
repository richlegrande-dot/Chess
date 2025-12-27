# Deployment Checklist - Option B Hybrid Architecture

**Date**: December 27, 2025  
**Architecture**: Cloudflare Pages + Worker Service (Service Binding)

---

## Pre-Deployment Verification

### ✅ 1. Run CI Verification Script

```bash
cd ChessChatWeb
node scripts/verify-hybrid-assistant.mjs
```

**Expected**: "✓ All checks passed! Safe to deploy."

**If errors**: Fix violations before proceeding. Script will list specific issues.

### ✅ 2. Verify Repository Structure

```bash
# Check shared modules exist
ls shared/walleEngine.ts
ls shared/walleChessEngine.ts
ls shared/personalizedReferences.ts

# Check worker structure
ls worker-assistant/wrangler.toml
ls worker-assistant/src/index.ts

# Check Pages Functions updated
grep -q "WALLE_ASSISTANT?: Fetcher" functions/api/chat.ts && echo "✓ Service binding interface present"
```

### ✅ 3. Test Local Build

```bash
cd ChessChatWeb
npm ci
npm run build

# Verify dist/ created
ls dist/index.html
```

**Expected**: Build completes without errors, `dist/` directory exists.

---

## Deployment Steps

### Step 1: Deploy Cloudflare Pages

#### Option A: Automatic (Git Push)

```bash
git add .
git commit -m "feat: implement Option B hybrid architecture with service binding"
git push origin main
```

**Monitor**: Cloudflare Dashboard → Pages → chesschat-web → Deployments

**Expected**:
- Build: 3-5 minutes
- Status: Success
- URL: `https://chesschat-web.pages.dev`

#### Option B: Manual Deploy

```bash
cd ChessChatWeb
npm run build
npx wrangler pages deploy dist
```

### Step 2: Configure Cloudflare Pages Settings

**Navigate to**: Cloudflare Dashboard → Pages → chesschat-web

#### 2a. Build Settings

**Settings → Builds & deployments**

| Setting | Value |
|---------|-------|
| **Build command** | `npm ci && npm run build` |
| **Build output directory** | `dist` |
| **Root directory (Path)** | `ChessChatWeb` |

**CRITICAL**: Path MUST be `ChessChatWeb` (not `/`)

#### 2b. Environment Variables

**Settings → Environment variables**

| Variable | Value | Scope |
|----------|-------|-------|
| `DATABASE_URL` | `prisma://accelerate...` | Production |
| `NODE_VERSION` | `20` | All |

**Get DATABASE_URL**: From Prisma Accelerate dashboard

#### 2c. Service Binding

**Settings → Functions → Bindings**

Click **Add binding**:

| Field | Value |
|-------|-------|
| **Type** | Service binding |
| **Binding name** | `WALLE_ASSISTANT` |
| **Service** | `walle-assistant` |
| **Environment** | `production` |

**Note**: This step requires Worker to be deployed first (Step 3).

### Step 3: Deploy Worker Service

#### 3a. Install Dependencies (First Time)

```bash
cd ChessChatWeb/worker-assistant
npm install
```

#### 3b. Configure Secret

```bash
npx wrangler secret put DATABASE_URL --env production
# Paste Prisma Accelerate URL when prompted
```

**Verify**:
```bash
npx wrangler secret list --env production
# Should show: DATABASE_URL
```

#### 3c. Deploy Worker

```bash
npx wrangler deploy --env production
```

**Expected Output**:
```
✨ Built successfully
📦 Uploading...
✅ Deployed walle-assistant to Cloudflare Workers
🌍 https://walle-assistant.<subdomain>.workers.dev
```

**Important**: Worker URL is internal-only. Not accessed directly.

### Step 4: Configure Service Binding (Repeat 2c)

If you deployed Worker after Pages, go back and configure the service binding:

**Cloudflare Dashboard → Pages → chesschat-web → Settings → Functions → Bindings**

Add: `WALLE_ASSISTANT` → `walle-assistant` → `production`

**Why**: Pages needs to know Worker exists to create the binding.

---

## Post-Deployment Verification

### ✅ 1. Check Pages Deployment

```bash
# Health check
curl https://chesschat-web.pages.dev/api/health
```

**Expected**:
```json
{
  "status": "healthy",
  "timestamp": "2025-12-27T...",
  "walleEngine": true
}
```

### ✅ 2. Check Worker Deployment

```bash
cd ChessChatWeb/worker-assistant
npx wrangler deployments list --env production
```

**Expected**: Shows recent deployment with timestamp.

### ✅ 3. Verify Service Binding Active

```bash
curl "https://chesschat-web.pages.dev/api/chat?debug=1" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello Wall-E","userId":"test123"}'
```

**Expected Response**:
```json
{
  "success": true,
  "response": "Hello! Based on your recent games...",
  "mode": "service-binding",  ← CRITICAL: Confirms worker is being used
  "historyEvidence": {
    "lastGamesUsed": 10,
    "personalizedReferenceCount": 2
  }
}
```

**If `mode: "local-fallback"`**: Service binding not configured. Repeat Step 2c.

### ✅ 4. Verify Provable Personalization

```bash
curl "https://chesschat-web.pages.dev/api/analyze-game" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "pgn": "1. e4 e5 2. Nf3 Nc6 3. Bc4",
    "moveHistory": [
      {"move": "e4", "from": "e2", "to": "e4"},
      {"move": "e5", "from": "e7", "to": "e5"},
      {"move": "Nf3", "from": "g1", "to": "f3"}
    ],
    "cpuLevel": 3,
    "playerColor": "white",
    "userId": "test123"
  }'
```

**Expected**: Response includes:
- `historyEvidence.personalizedReferenceCount >= 2` OR
- `historyEvidence.insufficientHistory = true` with reason

### ✅ 5. Test Chess Move Endpoint

```bash
curl "https://chesschat-web.pages.dev/api/chess-move?debug=1" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    "difficulty": "intermediate"
  }'
```

**Expected**:
```json
{
  "success": true,
  "move": "e2e4",
  "source": "opening_book",
  "mode": "service-binding"
}
```

### ✅ 6. Monitor Worker Logs

```bash
cd ChessChatWeb/worker-assistant
npx wrangler tail --env production
```

**Open another terminal and make requests**:
```bash
curl "https://chesschat-web.pages.dev/api/chat" \
  -X POST -d '{"message":"Test"}'
```

**Expected in tail**: Log entries showing requests processed.

---

## Rollback Procedure

### If Deployment Fails

#### Rollback Pages

**Cloudflare Dashboard → Pages → chesschat-web → Deployments**

- Find last successful deployment
- Click "Rollback to this deployment"

#### Rollback Worker

```bash
cd ChessChatWeb/worker-assistant
npx wrangler rollback --env production
```

### If Service Binding Issues

**Remove binding temporarily**:

**Dashboard → Pages → Settings → Functions → Bindings**

- Delete `WALLE_ASSISTANT` binding
- Pages Functions will use local fallback

**Redeploy Pages**: Triggers new deployment with fallback mode.

---

## Troubleshooting

### Problem: `mode: "local-fallback"` in Production

**Symptom**: Debug mode shows local execution instead of worker.

**Causes**:
1. Service binding not configured
2. Worker not deployed
3. Worker name mismatch

**Fix**:
```bash
# Check worker exists
cd ChessChatWeb/worker-assistant
npx wrangler deployments list --env production

# Check service binding in Dashboard
# Should show: WALLE_ASSISTANT → walle-assistant

# Redeploy Pages after fixing
git commit --allow-empty -m "trigger redeploy"
git push
```

### Problem: Worker Returns 404

**Symptom**: Service binding calls fail with 404.

**Cause**: Worker routes don't match.

**Fix**: Worker expects:
- `POST /assist/chat`
- `POST /assist/analyze-game`
- `POST /assist/chess-move`

Verify in `worker-assistant/src/index.ts`.

### Problem: DATABASE_URL Missing

**Symptom**:
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
# Paste Prisma Accelerate URL
```

### Problem: Build Fails - Path Error

**Symptom**:
```
npm error enoent Could not read package.json
```

**Fix**: Verify Cloudflare Pages settings:
- **Root directory (Path)**: `ChessChatWeb` ← MUST be set
- Not `/` (repo root)

---

## Performance Monitoring

### Expected Metrics

| Endpoint | P50 | P95 | P99 |
|----------|-----|-----|-----|
| `/api/chat` (service-binding) | <200ms | <400ms | <800ms |
| `/api/analyze-game` (service-binding) | <350ms | <700ms | <1400ms |
| `/api/chess-move` (service-binding) | <80ms | <180ms | <350ms |

### Monitor in Production

**Cloudflare Dashboard → Worker → Analytics**

- Request count
- Success rate
- Latency percentiles
- Error rate

**If latency > targets**: Check CPU budget in `shared/cpuConfig.ts`.

---

## Success Criteria

Deployment is successful when:

- ✅ Pages build succeeds
- ✅ Worker deploys successfully
- ✅ Service binding configured
- ✅ `?debug=1` shows `mode: "service-binding"`
- ✅ All endpoints return valid JSON
- ✅ `historyEvidence` present in responses
- ✅ CI verification passes
- ✅ No console errors in frontend
- ✅ Latency within targets

---

## Final Verification Command

Run this after deployment:

```bash
#!/bin/bash

echo "🔍 Verifying Option B Deployment..."

# 1. Health check
echo -n "1. Health check: "
curl -s https://chesschat-web.pages.dev/api/health | grep -q "healthy" && echo "✓" || echo "✗"

# 2. Service binding active
echo -n "2. Service binding: "
curl -s "https://chesschat-web.pages.dev/api/chat?debug=1" \
  -X POST -d '{"message":"test"}' | grep -q "service-binding" && echo "✓" || echo "✗"

# 3. Worker responds
echo -n "3. Worker responds: "
curl -s "https://chesschat-web.pages.dev/api/chess-move" \
  -X POST -d '{"fen":"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1","difficulty":"medium"}' \
  | grep -q "success" && echo "✓" || echo "✗"

# 4. Personalization enforced
echo -n "4. Personalization: "
curl -s "https://chesschat-web.pages.dev/api/chat" \
  -X POST -d '{"message":"test","userId":"verify123"}' \
  | grep -q "historyEvidence" && echo "✓" || echo "✗"

echo ""
echo "✅ Deployment verification complete!"
```

---

## Support & Documentation

- **Full Guide**: [docs/HYBRID_BINDING_DEPLOY.md](docs/HYBRID_BINDING_DEPLOY.md)
- **Worker Docs**: [worker-assistant/README.md](worker-assistant/README.md)
- **Implementation Summary**: [OPTION_B_IMPLEMENTATION_COMPLETE.md](OPTION_B_IMPLEMENTATION_COMPLETE.md)
- **CI Script**: [scripts/verify-hybrid-assistant.mjs](scripts/verify-hybrid-assistant.mjs)

---

**Last Updated**: December 27, 2025  
**Architecture**: Option B - Pages + Worker with Service Binding  
**Status**: Ready for deployment
