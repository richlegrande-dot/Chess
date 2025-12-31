# Troubleshooting: Worker vs Pages Failures

**Last Updated:** December 27, 2025  
**Architecture:** Hybrid Deployment (Option B)

## Quick Architecture Overview

```
Browser Request
    ↓
[Cloudflare Pages]  ← Public API: /api/chess-move
    ↓ (service binding)
[Worker: walle-assistant-production]  ← Internal: /assist/chess-move
    ↓
Response with diagnostics
```

**Critical Rule:** The Worker should ONLY handle `/assist/*` routes (internal). Public `/api/*` routes are handled by Pages Functions, which then call the Worker via service binding.

## How to Tell Where a Failure Originates

### 1. Check Response Headers

**Pages Function Response:**
```http
cf-ray: xxx-YYY
cf-cache-status: DYNAMIC
```

**Worker Route Interception (WRONG):**
```http
cf-worker: walle-assistant-production
```

If you see `cf-worker` header on public `/api/*` requests, **you have a Worker route misconfigured**.

### 2. Check Response Body `mode` Field

All responses include a `mode` field:

| Mode | Meaning | Expected? |
|------|---------|-----------|
| `service-binding` | Worker called via binding ✅ | **YES** - This is correct |
| `local-fallback` | Pages Function fallback ⚠️ | Only if Worker unavailable |
| `error` | Exception occurred ❌ | Should be rare |

**Example Good Response:**
```json
{
  "success": true,
  "move": "e2e4",
  "mode": "service-binding",
  "engine": "worker",
  "diagnostics": {
    "depthReached": 5,
    "eval": 0.3,
    "reason": "Computed move"
  }
}
```

**Example Fallback Response:**
```json
{
  "success": true,
  "move": "e2e4",
  "mode": "local-fallback",
  "engine": "wall-e",
  "diagnostics": {
    "reason": "Local fallback engine"
  },
  "workerCallLog": {
    "success": false,
    "error": "Worker service binding not available"
  }
}
```

### 3. Check Cloudflare Dashboard Logs

**Worker Dashboard** (`walle-assistant-production`):
- **Location:** Cloudflare Dashboard → Workers & Pages → walle-assistant-production → Logs
- **What to look for:**
  - If you see requests to `/api/chess-move` → **WRONG** (route misconfigured)
  - Should ONLY see requests to `/assist/chess-move`
  - CPU time should be > 0ms (if 0ms, Worker returned 404 immediately)

**Pages Dashboard** (`chesschat-web`):
- **Location:** Cloudflare Dashboard → Workers & Pages → chesschat-web → Functions logs
- **What to look for:**
  - Should see `/api/chess-move` requests
  - Check for "Worker binding failed" or "using local fallback" messages

### 4. Check Admin Portal Worker Calls Tab

**URL:** `/admin` (requires password)

**Indicators:**

| Indicator | Status | Meaning |
|-----------|--------|---------|
| Data Source: Persistent KV | ✅ | Logs are stored and readable |
| Data Source: In-Memory Only | ⚠️ | KV namespace not configured |
| Success Rate: >70% | ✅ | Service binding working well |
| Success Rate: <30% | ❌ | Major configuration issue |
| Total Calls: 0 | ❌ | Logging broken or no requests made |

## Common Issues and Fixes

### Issue 1: Worker Route Intercepting Public API

**Symptoms:**
- Browser requests to `/api/chess-move` get 503 errors
- Worker dashboard shows `/api/chess-move` requests
- Worker logs show 0ms CPU time (immediate 404)
- All moves use `local-fallback`

**Root Cause:**
A Worker route like `chesschat.uk/api/chess-move*` is configured, intercepting traffic BEFORE it reaches Pages Functions.

**Fix:**
1. Go to: Cloudflare Dashboard → Workers & Pages → walle-assistant-production → Settings → Triggers
2. **Remove** any routes matching `*api/chess-move*` or `*/api/*`
3. Worker should have NO public routes (it's internal-only)

**Verification:**
```bash
curl -I https://chesschat.uk/api/chess-move
# Should NOT have cf-worker header
```

### Issue 2: Service Binding Not Configured

**Symptoms:**
- All moves use `mode: "local-fallback"`
- Admin portal shows 0 successful worker calls
- Pages Function logs: "No worker service binding available"

**Root Cause:**
Service binding `WALLE_ASSISTANT` not configured in Pages settings.

**Fix:**
1. Go to: Cloudflare Dashboard → Workers & Pages → chesschat-web → Settings → Functions
2. Scroll to: **Service bindings**
3. Click: **Add binding**
4. Configure:
   - Variable name: `WALLE_ASSISTANT`
   - Service: `walle-assistant-production`
   - Environment: Production
5. Click: **Save**
6. Redeploy: Pages will need a redeploy to pick up the binding

**Verification:**
Check next move response - should have `mode: "service-binding"`.

### Issue 3: Worker Timeout (15s limit)

**Symptoms:**
- Requests take >15 seconds
- Errors: "Worker timeout after 15s"
- `mode: "local-fallback"` after long wait

**Root Cause:**
Worker chess engine taking too long to compute moves at high difficulty.

**Fix Options:**

A) **Reduce search depth** (worker-assistant/src/shared/walleChessEngine.ts):
```typescript
// Difficulty settings
const difficulties = {
  'beginner': { depth: 1, timeMs: 1000 },
  'intermediate': { depth: 2, timeMs: 2000 },  // was depth: 3
  'advanced': { depth: 3, timeMs: 5000 },      // was depth: 4
  'master': { depth: 4, timeMs: 10000 }        // was depth: 5
};
```

B) **Increase timeout** (functions/api/chess-move.ts):
```typescript
const timeoutMs = 20000; // Increase from 15s to 20s
```

C) **Add timeout logging** (already implemented):
Responses include `diagnostics.depthReached` to see if search completed.

### Issue 4: KV Namespace Not Configured (Admin Portal Shows 0 Calls)

**Symptoms:**
- Admin portal shows: "In-Memory Only" data source
- Worker calls are logged temporarily but lost on page refresh
- API returns: "WORKER_CALL_LOGS KV namespace not configured"

**Root Cause:**
KV namespace `WORKER_CALL_LOGS` not bound to Pages Functions.

**Fix:**
1. Create KV namespace (if doesn't exist):
   ```bash
   cd ChessChatWeb
   npx wrangler kv:namespace create WORKER_CALL_LOGS
   ```
   Note the ID returned (e.g., `abc123def456`)

2. Bind to Pages:
   - Go to: Cloudflare Dashboard → Workers & Pages → chesschat-web → Settings → Functions
   - Scroll to: **KV namespace bindings**
   - Click: **Add binding**
   - Variable name: `WORKER_CALL_LOGS`
   - KV namespace: Select or enter ID from step 1
   - Click: **Save**

3. Redeploy Pages

**Verification:**
Check Admin Portal - should show "Persistent KV" data source.

### Issue 5: Move Quality Issues ("Brainless" Moves)

**Symptoms:**
- CPU makes obviously bad moves
- Eval score is 0 or nonsensical
- `diagnostics.depthReached` is 0 or 1

**Diagnostic Steps:**

1. **Check if Worker is being used:**
   Look at response `mode`:
   - `service-binding` → Worker is being used ✅
   - `local-fallback` → Using fallback engine ⚠️

2. **Check diagnostics in response:**
   ```json
   "diagnostics": {
     "depthReached": 0,  // ❌ Too shallow!
     "nodes": 10,        // ❌ Too few nodes!
     "eval": 0.0,
     "openingBook": false,
     "reason": "Computed move"
   }
   ```

3. **Check opening book:**
   Early game moves should use opening book:
   ```json
   "diagnostics": {
     "openingBook": true,
     "reason": "Opening book move"
   }
   ```

**Fixes:**

A) **If Worker not being used:** Fix service binding (see Issue 2)

B) **If depth too shallow:** Increase search depth (see Issue 3, Option A)

C) **If opening book not loading:**
   Verify `worker-assistant/src/shared/openingBook.ts` is present and synced:
   ```bash
   node .github/workflows/verify-shared-sync.mjs
   ```

D) **If evaluation broken:**
   Check chess.js version match between shared/ and worker-assistant/:
   ```bash
   npm list chess.js
   cd worker-assistant && npm list chess.js
   ```

## Debugging Checklist

Use this checklist to systematically identify issues:

### ✅ Configuration Checks

- [ ] Worker route does NOT intercept `/api/*` paths
- [ ] Service binding `WALLE_ASSISTANT` configured in Pages
- [ ] KV binding `WORKER_CALL_LOGS` configured in Pages
- [ ] Worker deployed: `npx wrangler deploy` in worker-assistant/
- [ ] Pages deployed: Latest commit pushed to GitHub (auto-deploys)

### ✅ Runtime Checks

- [ ] Response has `mode: "service-binding"` (not "local-fallback")
- [ ] Response `diagnostics.depthReached` > 1
- [ ] Response `diagnostics.nodes` > 100
- [ ] Worker dashboard shows only `/assist/*` requests
- [ ] Pages Functions logs show successful binding calls
- [ ] Admin portal shows "Persistent KV" data source
- [ ] Admin portal success rate > 70%

### ✅ Code Checks

- [ ] Shared code in sync: `node .github/workflows/verify-shared-sync.mjs`
- [ ] Worker only handles `/assist/*` routes (no `/api/*`)
- [ ] Pages Function calls `env.WALLE_ASSISTANT.fetch('https://internal/assist/chess-move')`
- [ ] All responses include `mode` field
- [ ] All responses include `diagnostics` object
- [ ] Worker responses include `workerCallLog`

## Testing Commands

### Test Service Binding Locally (Wrangler Dev)

```bash
cd worker-assistant
npx wrangler dev

# In another terminal:
curl -X POST http://localhost:8787/assist/chess-move \
  -H "Content-Type: application/json" \
  -d '{"fen":"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1","difficulty":"intermediate"}'
```

### Test Pages Function Locally

```bash
cd ChessChatWeb
npm run dev

# In another terminal:
curl -X POST http://localhost:8788/api/chess-move \
  -H "Content-Type: application/json" \
  -d '{"fen":"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1","difficulty":"intermediate"}'
```

### Verify Shared Code Sync

```bash
cd ChessChatWeb
node .github/workflows/verify-shared-sync.mjs
```

Expected output:
```
✓ walleChessEngine.ts - in sync
✓ walleEngine.ts - in sync
...
📊 Summary: 9/9 files in sync
✅ All shared files are synchronized!
```

### Check Admin Portal

1. Open: `https://chesschat.uk/admin`
2. Enter admin password
3. Click: **Worker Calls** tab
4. Verify:
   - Data Source: Persistent KV
   - Success Rate: >70%
   - Recent calls visible

## Emergency Fallback

If the Worker is completely broken and you need immediate mitigation:

1. **Remove Worker route** (if configured):
   - Dashboard → walle-assistant-production → Settings → Triggers
   - Delete all routes

2. **Verify local fallback works:**
   - Make a CPU move in the game
   - Should complete successfully with `mode: "local-fallback"`
   - Move quality will be lower but functional

3. **Fix and redeploy Worker:**
   - Fix issues in worker-assistant/
   - Deploy: `npx wrangler deploy`
   - Re-test service binding

## Additional Resources

- [Cloudflare Service Bindings Docs](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/)
- [Cloudflare Pages Functions Docs](https://developers.cloudflare.com/pages/functions/)
- [HYBRID_DEPLOYMENT_GUIDE.md](./HYBRID_DEPLOYMENT_GUIDE.md) - Setup instructions
- [DEBUG_PANEL_ENHANCEMENT.md](./DEBUG_PANEL_ENHANCEMENT.md) - Frontend debugging

## Support

If issues persist after following this guide:

1. Check Cloudflare Status: https://www.cloudflarestatus.com/
2. Review Worker Logs in Dashboard
3. Check GitHub Issues: richlegrande-dot/Chess
4. Contact: admin@chesschat.uk
