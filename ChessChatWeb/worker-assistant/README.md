# Wall-E Assistant Worker

**Standalone Cloudflare Worker Service for Chess Coaching AI**

## Overview

This Worker provides internal AI assistance called by Cloudflare Pages Functions via **service binding**. It is **NOT** publicly accessible.

**Key Characteristics:**
- ✅ Wall-E only (NO external AI APIs)
- ✅ Internal service (accessed via binding, not public URL)
- ✅ Provable personalization (≥2 game references)
- ✅ DATABASE_URL optional (graceful degradation)

## Architecture

```
Client → Pages (/api/*) → Pages Functions
                              ↓ (env.WALLE_ASSISTANT.fetch)
                         Worker Service (/assist/*)
                              ↓
                         Shared Modules (../shared/walleEngine)
```

## Deployment

### Path Configuration ⚠️ CRITICAL

**Cloudflare Worker Service Build Settings:**
- **Path:** `ChessChatWeb/worker-assistant` ← NOT root!
- **Build Command:** `npm ci && npm run build`
- **Deploy Command:** `npx wrangler deploy --env production`

### Quick Deploy

```bash
cd worker-assistant
npm ci
npx wrangler deploy --env production
```

### Verify Before Deploy

```bash
# From repository root
npm run verify:worker-path
# or
node scripts/verify-worker-assistant-path.mjs
```

## Endpoints

### POST /assist/chat
Chat with Wall-E coaching assistant.

**Request:**
```json
{
  "message": "How can I improve my opening?",
  "userId": "user123",
  "gameContext": { "finalFEN": "...", "result": "loss" }
}
```

**Response:**
```json
{
  "success": true,
  "response": "Based on your last 10 games...",
  "historyEvidence": {
    "lastGamesUsed": 10,
    "personalizedReferenceCount": 3
  },
  "personalizedReferences": ["game1", "game2", "game3"]
}
```

### POST /assist/analyze-game
Analyze a completed game.

**Request:**
```json
{
  "pgn": "1. e4 e5 2. Nf3 ...",
  "moveHistory": [ ... ],
  "cpuLevel": 3,
  "playerColor": "white",
  "userId": "user123"
}
```

**Response:**
```json
{
  "success": true,
  "analysis": "Your game showed improvement in...",
  "recommendations": ["Focus on endgame", "Practice tactics"],
  "historyEvidence": { ... }
}
```

### POST /assist/chess-move
Generate CPU opponent move.

**Request:**
```json
{
  "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  "difficulty": "medium",
  "gameId": "game123"
}
```

**Response:**
```json
{
  "success": true,
  "move": "e2e4",
  "evaluation": 0.2,
  "thinkingTime": 450
}
```

## Configuration

### wrangler.toml

```toml
name = "walle-assistant"
main = "src/index.ts"
compatibility_date = "2024-11-21"
workers_dev = true

[build]
command = "npm run build || echo 'No build needed'"

[env.production]
# DATABASE_URL set via: wrangler secret put DATABASE_URL --env production

[env.staging]
# DATABASE_URL set via: wrangler secret put DATABASE_URL --env staging
```

### Environment Variables

**Optional (graceful degradation):**
- `DATABASE_URL` - Prisma connection string for personalized coaching

**Set secrets:**
```bash
npx wrangler secret put DATABASE_URL --env production
```

## Development

### Local Testing

```bash
# Install dependencies
npm install

# Run worker locally
npx wrangler dev

# Test chat endpoint
curl http://localhost:8787/assist/chat \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"message":"How do I improve?","userId":"test"}'
```

### Deployment

```bash
# Deploy to production
npx wrangler deploy --env production

# Deploy to staging
npx wrangler deploy --env staging

# Check deployments
npx wrangler deployments list --name walle-assistant
```

## Service Binding Setup

After deploying the Worker, configure the service binding in Pages:

1. Go to: **Cloudflare Dashboard → Pages → chesschat-web → Settings → Functions**
2. Scroll to: **Service bindings**
3. Click: **Add binding**
4. Configure:
   - **Variable name:** `WALLE_ASSISTANT`
   - **Service:** `walle-assistant`
   - **Environment:** `production`
5. Save and redeploy Pages

## Verification

### Check Deployment

```bash
# List deployments
npx wrangler deployments list --name walle-assistant

# View logs (requires Pro/Enterprise)
npx wrangler tail --name walle-assistant
```

### Test Service Binding

From Pages Function (should automatically use binding):
```bash
curl https://your-domain.pages.dev/api/chat?debug=1 \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"message":"test"}'

# Check response includes: "mode": "service-binding"
```

## Non-Negotiables

- ✅ **Wall-E only** - No OpenAI or external AI APIs
- ✅ **Provable personalization** - All responses include `historyEvidence` with ≥2 game references
- ✅ **DATABASE_URL optional** - Gracefully degrades to basic mode if missing
- ✅ **Internal only** - Accessed via service binding, not public URL

## Troubleshooting

### Issue: "Service binding not found"

**Cause:** Binding not configured in Pages Dashboard

**Solution:**
1. Deploy Worker first: `npx wrangler deploy --env production`
2. Configure binding in Pages Dashboard (see "Service Binding Setup" above)
3. Redeploy Pages

### Issue: "Database unavailable"

**Cause:** DATABASE_URL not set (expected behavior)

**Solution:**
- This is OK! Worker gracefully degrades to basic mode
- To enable personalization: `npx wrangler secret put DATABASE_URL --env production`

### Issue: Build fails with "path not found"

**Cause:** Incorrect Cloudflare Worker build path

**Solution:**
- Verify path is: `ChessChatWeb/worker-assistant` (NOT root)
- Run: `node scripts/verify-worker-assistant-path.mjs`

## File Structure

```
worker-assistant/
├── wrangler.toml         # Worker configuration
├── package.json          # Worker dependencies
├── README.md             # This file
├── tsconfig.json         # TypeScript config
└── src/
    └── index.ts          # Worker entrypoint (fetch handler)
```

## Related Documentation

- [Option B Deployment Guide](../OPTION_B_DEPLOYMENT_GUIDE.md) - Full deployment instructions
- [Parent README](../README.md) - Project overview
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)

---

**Wall-E Assistant Worker** - Internal AI service for ChessChat Web 🤖♟️

### Deploy

```bash
# Deploy to production
npx wrangler deploy --env production

# Deploy to staging
npx wrangler deploy --env staging
```

### Configure Secrets

```bash
# Set DATABASE_URL
npx wrangler secret put DATABASE_URL --env production
```

## Service Binding Setup

### In Cloudflare Dashboard

1. Go to Pages project → Settings → Functions → Bindings
2. Add Service Binding:
   - **Name**: `WALLE_ASSISTANT`
   - **Service**: `walle-assistant`
   - **Environment**: `production`

### Verification

```bash
# Check if binding is working
curl "https://chesschat-web.pages.dev/api/chat?debug=1" \
  -X POST \
  -d '{"message":"Test"}'

# Should return: "mode": "service-binding"
```

## Code Sharing

This worker imports shared Wall-E logic from `../shared/`:
- `walleEngine.ts` - Main coaching engine
- `walleChessEngine.ts` - CPU chess opponent
- `personalizedReferences.ts` - Provable personalization
- `prisma.ts` - Database client

**DO NOT** duplicate code. Always import from `../../shared/`.

## Constraints

### Non-Negotiable

1. **NO EXTERNAL AI**: Wall-E only, no OpenAI/Anthropic/etc.
2. **PROVABLE PERSONALIZATION**: Every response must include `historyEvidence` with ≥2 references OR explicit "insufficient history" reason.
3. **DATABASE OPTIONAL**: Graceful degradation if DATABASE_URL unavailable.

### Verification

```bash
# Run integrity checks
cd ..
node scripts/verify-hybrid-assistant.mjs
```

## Related Docs

- [../docs/HYBRID_BINDING_DEPLOY.md](../docs/HYBRID_BINDING_DEPLOY.md) - Full deployment guide
- [../COMPLETE_OPENAI_REMOVAL.md](../COMPLETE_OPENAI_REMOVAL.md) - No AI dependencies
- [../PROVABLE_PERSONALIZATION_COMPLETE.md](../PROVABLE_PERSONALIZATION_COMPLETE.md) - Evidence system
