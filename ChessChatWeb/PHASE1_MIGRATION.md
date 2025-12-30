# Phase 1 Migration: Stockfish Deployment

**Target:** Deploy Worker API with Stockfish engine  
**Duration:** 1-2 days  
**Risk Level:** Medium (can rollback quickly)

---

## Prerequisites

Before starting Phase 1:

- [ ] All documentation reviewed
- [ ] Architecture verification passes: `node scripts/verify-architecture.mjs`
- [ ] Stockfish integration implemented in `worker-api/src/stockfish.ts`
- [ ] Local testing complete
- [ ] Database backed up (if applicable)
- [ ] Rollback plan understood

---

## Step-by-Step Migration

### Step 1: Implement Stockfish (if not done)

Choose implementation strategy:

#### Option A: stockfish.js (Quick Start)

```bash
cd worker-api
npm install stockfish
```

Update `src/stockfish.ts`:

```typescript
import Stockfish from 'stockfish';

export class StockfishEngine {
  private engine: any = null;

  async init(): Promise<void> {
    this.engine = await Stockfish();
    // Configure engine
  }

  async computeMove(request: StockfishMoveRequest): Promise<StockfishResponse> {
    // Implement using stockfish.js API
  }
}
```

#### Option B: Native Stockfish Server (Production)

Set up separate Node.js server:

```bash
# Install Stockfish
brew install stockfish  # macOS
sudo apt install stockfish  # Ubuntu

# Create HTTP wrapper
node stockfish-server.js
```

Update `src/stockfish.ts` to call HTTP API.

### Step 2: Test Locally

```bash
# Terminal 1: Start Worker API
cd worker-api
npm run dev

# Terminal 2: Test endpoint
curl -X POST http://localhost:8787/api/chess-move \
  -H "Content-Type: application/json" \
  -d '{
    "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    "cpuLevel": 3,
    "timeMs": 2000
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "engine": "stockfish",
  "mode": "worker-api",
  "move": "e2e4",
  "diagnostics": {
    "requestId": "...",
    "latencyMs": 123,
    "depthReached": 10,
    "evaluationCp": 32,
    "pv": "e2e4 e7e5 g1f3 ...",
    "nodes": 123456
  }
}
```

### Step 3: Run Verification Scripts

```bash
# Architecture verification
node scripts/verify-architecture.mjs

# Should output:
# ✓ All architecture checks passed!
```

### Step 4: Deploy Database Schema (if needed)

```bash
cd worker-api

# Run migrations
npx prisma migrate deploy

# Verify tables created
npx prisma studio
```

### Step 5: Set Secrets

```bash
cd worker-api

# Set DATABASE_URL
wrangler secret put DATABASE_URL
# Paste: prisma+postgres://accelerate.prisma-data.net/?api_key=...

# Set ADMIN_PASSWORD
wrangler secret put ADMIN_PASSWORD
# Paste: your-secure-password

# Optional: INTERNAL_AUTH_TOKEN
wrangler secret put INTERNAL_AUTH_TOKEN
# Paste: your-auth-token
```

### Step 6: Deploy Worker API

```bash
cd worker-api

# Build and deploy
npm run prisma:generate
wrangler deploy
```

**Expected Output:**
```
✨ Built successfully!
✨ Successfully published your script to
   https://chesschat-worker-api.YOUR_SUBDOMAIN.workers.dev
```

**Important:** Copy the URL - you'll need it for testing.

### Step 7: Configure Route (Cloudflare Dashboard)

**CRITICAL:** This connects your domain to the Worker.

1. Go to **Cloudflare Dashboard** → **Workers & Pages**
2. Click on **chesschat-worker-api**
3. Go to **Settings** → **Triggers** → **Routes**
4. Click **Add Route**

**Configuration:**
- **Route:** `chesschat.uk/api/*`
- **Zone:** `chesschat.uk`
- **Worker:** `chesschat-worker-api`

5. Click **Save**

**Verification:**
```bash
# Wait 30 seconds for propagation
sleep 30

# Test production endpoint
curl https://chesschat.uk/api/admin/worker-health
```

**Expected Response:**
```json
{
  "healthy": true,
  "checks": {
    "database": { "status": "ok" },
    "stockfish": { "status": "ok" }
  }
}
```

### Step 8: Run Production Tests

```bash
# Comprehensive endpoint test
node scripts/test-prod-chess-move.mjs https://chesschat.uk
```

**Expected:**
```
═══ Testing Production Chess Move Endpoint ═══
✓ HTTP status is OK (200)
✓ Engine is Stockfish (correct)
✓ Response includes diagnostics
✓ Request ID: abc123
✓ Diagnostics include all key metrics
✓ Move generated: e2e4
✓ Mode is worker-api (correct)

═══ Summary ═══
Tests passed: 10
Tests failed: 0

✓ All tests passed! Production endpoint is working correctly.
```

### Step 9: Monitor Logs

```bash
# Check Worker logs (Cloudflare Dashboard)
# Go to: Workers & Pages → chesschat-worker-api → Logs

# Or query logs API
curl https://chesschat.uk/api/admin/worker-calls?limit=10
```

**Look for:**
- ✅ Successful move generations
- ✅ Reasonable latency (< 3000ms)
- ✅ No errors
- ✅ Correct engine: "stockfish"

### Step 10: Smoke Test with Frontend (Optional)

If frontend is already deployed:

1. Visit https://chesschat.uk
2. Start a game
3. Make a move
4. Verify CPU responds
5. Check browser DevTools → Network tab
6. Verify API calls go to `/api/chess-move`

---

## Success Criteria

Phase 1 is complete when:

- [x] Stockfish integration implemented
- [x] Worker API deployed
- [x] Route configured: `chesschat.uk/api/*` → Worker API
- [x] Production tests pass
- [x] Health check returns `healthy: true`
- [x] Moves are generated by Stockfish
- [x] Logs show successful requests
- [x] No errors in Cloudflare logs
- [x] Latency < 3 seconds per move
- [x] Database logs are persisted

---

## Rollback Plan

If issues occur:

### Immediate Rollback (< 5 minutes)

**Option A: Remove Route**

1. Go to **Cloudflare Dashboard** → **Workers & Pages**
2. Click on **chesschat-worker-api**
3. Go to **Settings** → **Triggers** → **Routes**
4. Delete the route: `chesschat.uk/api/*`
5. Save

This immediately reverts to previous behavior (Pages Functions or old Worker).

**Option B: Deploy Previous Worker**

```bash
cd worker-api
git checkout <previous-commit>
wrangler deploy
```

### Verification After Rollback

```bash
# Test that old system still works
curl https://chesschat.uk/api/chess-move \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"fen": "...", "cpuLevel": 3}'
```

---

## Troubleshooting

### Issue: Route Returns 404

**Symptoms:**
```bash
curl https://chesschat.uk/api/chess-move
# Returns 404
```

**Solutions:**
1. Check route is configured in Cloudflare Dashboard
2. Wait 30-60 seconds for propagation
3. Clear browser cache
4. Verify Worker is deployed: `wrangler deployments list`

### Issue: Worker Returns 500

**Symptoms:**
```bash
curl https://chesschat.uk/api/admin/worker-health
# Returns 500 or error
```

**Solutions:**
1. Check Worker logs in Cloudflare Dashboard
2. Verify `DATABASE_URL` secret is set correctly
3. Check Stockfish initialization logs
4. Verify Prisma Accelerate is accessible

### Issue: Stockfish Unavailable Error

**Symptoms:**
```json
{
  "success": false,
  "errorCode": "STOCKFISH_UNAVAILABLE"
}
```

**Solutions:**
1. Check Stockfish integration in `stockfish.ts`
2. Verify Stockfish is properly bundled with Worker
3. Check Worker logs for initialization errors
4. If using external server, verify it's accessible

### Issue: Database Connection Failed

**Symptoms:**
```json
{
  "checks": {
    "database": { "status": "error" }
  }
}
```

**Solutions:**
1. Verify `DATABASE_URL` secret is correct format
2. Check Prisma Accelerate is enabled
3. Verify database is accessible from Cloudflare network
4. Run `npx prisma migrate deploy` to ensure schema is up-to-date

### Issue: High Latency (> 5 seconds)

**Symptoms:**
- Moves take > 5 seconds to compute
- Timeouts occur

**Solutions:**
1. Reduce `timeMs` in requests (try 2000ms max)
2. Lower CPU level (try level 3-5)
3. Check Cloudflare CPU limits (10ms free, 50ms paid)
4. Consider using native Stockfish server for better performance

---

## Monitoring Post-Deployment

### First 24 Hours

**Check every hour:**
- [ ] Worker logs (Cloudflare Dashboard)
- [ ] Error rate (should be < 1%)
- [ ] Average latency (should be < 3s)
- [ ] Database connection status

**Metrics to watch:**
```bash
# Get latest logs
curl https://chesschat.uk/api/admin/worker-calls?limit=50

# Look for:
# - success: true (most requests)
# - latencyMs: < 3000
# - engine: "stockfish"
```

### First Week

- [ ] Monitor daily active users
- [ ] Check error patterns
- [ ] Review player feedback
- [ ] Verify database growth is reasonable

### Alerts to Set Up (Optional)

In Cloudflare Dashboard → Workers → Alerts:
- Error rate > 5%
- CPU time > 40ms (approaching limit)
- Request count spikes

---

## Next Steps After Phase 1

Once Phase 1 is stable:

1. **Phase 2:** Update frontend to use Worker API endpoints
2. **Phase 3:** Implement learning pipeline
3. **Phase 4:** Enable AI coaching

See [`ARCHITECTURE_STOCKFISH_AI_LEARNING.md`](./ARCHITECTURE_STOCKFISH_AI_LEARNING.md) for details.

---

## Checklist

Before marking Phase 1 complete:

- [ ] Stockfish integration implemented
- [ ] Local testing passed
- [ ] Verification scripts passed
- [ ] Worker API deployed
- [ ] Route configured
- [ ] Secrets set
- [ ] Production tests passed
- [ ] Health check returns healthy
- [ ] Logs show successful requests
- [ ] No errors in 1 hour of monitoring
- [ ] Rollback plan tested (optional but recommended)

---

**Phase 1 Status:** ⏳ Ready to Begin  
**Estimated Time:** 1-2 days  
**Go/No-Go Decision:** After Step 3 (local testing)

🚀 **Let's deploy Stockfish!** ♟️
