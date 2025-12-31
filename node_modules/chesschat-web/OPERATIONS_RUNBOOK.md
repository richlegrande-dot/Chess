# Operations Runbook - Stockfish Render Architecture

**Last Updated:** December 29, 2025  
**System:** ChessChat Production (Cloudflare + Render.com)

## Quick Reference

| Alert | Severity | First Response |
|-------|----------|----------------|
| 502 errors > 5% | 🔴 Critical | Check Render logs + Stockfish health |
| Cold starts > 30s | 🟡 Warning | Enable keep-warm or scale Render |
| DB connection errors | 🔴 Critical | Check Prisma Accelerate status |
| Engine pool exhausted | 🟡 Warning | Review concurrent load patterns |

## System Health Checks

### 1. Quick Health Check (30 seconds)

```bash
# Test Worker health
curl -H "Authorization: Bearer $ADMIN_PASSWORD" \
  https://chesschat.uk/api/admin/worker-health

# Test Stockfish health
curl -H "Authorization: Bearer $ADMIN_PASSWORD" \
  https://chesschat.uk/api/admin/stockfish-health

# Test actual move computation
curl -X POST https://chesschat.uk/api/chess-move \
  -H "Content-Type: application/json" \
  -d '{"fen":"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1","cpuLevel":5,"mode":"vs-cpu"}'
```

**Expected:** All return 200 with `success: true` and `latencyMs < 2000`.

### 2. E2E Test Suite

```bash
cd ChessChatWeb/worker-api
export WORKER_URL=https://chesschat.uk
export ADMIN_PASSWORD=<your-admin-password>
node test-e2e.js
```

**Expected:** 7/7 tests pass.

### 3. Render Service Status

**Dashboard:** https://dashboard.render.com/web/chesschat-stockfish

**Checks:**
- Status: ✅ Live (not 🔴 Suspended or 🟡 Deploying)
- Health: Last check < 1 minute ago
- Logs: No repeated errors in last 10 minutes
- Metrics: Memory < 400MB (of 512MB)

### 4. Cloudflare Worker Logs

**Dashboard:** https://dash.cloudflare.com → Workers & Pages → chesschat-worker-api → Logs (Real-time)

**Look for:**
- ✅ `success: true` in majority of logs
- ⚠️ `STOCKFISH_TIMEOUT` or `STOCKFISH_UNAVAILABLE` patterns
- 🔴 Repeated `BAD_FEN` (could indicate client bug)

### 5. Database Query

```sql
-- Recent errors
SELECT
  ts,
  endpoint,
  mode,
  engine,
  error,
  latency_ms
FROM "WorkerCallLog"
WHERE success = false
  AND ts > NOW() - INTERVAL '1 hour'
ORDER BY ts DESC
LIMIT 20;

-- Success rate (last hour)
SELECT
  engine,
  COUNT(*) as total_calls,
  SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful,
  ROUND(100.0 * SUM(CASE WHEN success THEN 1 ELSE 0 END) / COUNT(*), 2) as success_rate,
  ROUND(AVG(latency_ms), 0) as avg_latency_ms,
  MAX(latency_ms) as max_latency_ms
FROM "WorkerCallLog"
WHERE ts > NOW() - INTERVAL '1 hour'
GROUP BY engine;
```

**Expected:**
- `success_rate` > 95% for `stockfish` engine
- `avg_latency_ms` < 1500 (warm), < 5000 (with cold starts)
- No repeated errors for same FEN

## Common Issues & Fixes

### Issue 1: "502 STOCKFISH_TIMEOUT"

**Symptoms:**
- Client sees "Server busy, please try again"
- Worker logs show `STOCKFISH_TIMEOUT`
- Render logs show slow or missing requests

**Root Causes:**
A) Render cold start (after 15 min idle)
B) Engine pool exhausted (>2 concurrent requests)
C) Render service crashed or OOM

**Diagnosis:**
```bash
# Check Render logs
# Dashboard → Logs → Filter by "compute_move"

# Check for cold starts
grep "coldStartDetected.*true" render-logs.txt

# Check for OOM kills
grep -i "out of memory\|killed" render-logs.txt

# Check concurrent requests
grep "action.*compute_move_start" render-logs.txt | tail -20
```

**Fix:**

**For Cold Starts:**
```bash
# Option A: Enable keep-warm cron
# Edit wrangler.toml:
[vars]
ENABLE_STOCKFISH_KEEPWARM = "true"

[[triggers.crons]]
cron = "*/10 * * * *"

# Deploy
cd ChessChatWeb/worker-api
npm run deploy
```

**For Engine Pool Exhaustion:**
- Check if burst of 3+ simultaneous requests
- Consider upgrading Render plan (paid tier allows more memory)
- Or implement request queuing with 429 rate limits

**For Render Crash:**
```bash
# Restart Render service (automatic in 30-60s, or manual)
# Dashboard → Manual Deploy → Deploy Latest Commit
```

### Issue 2: "502 STOCKFISH_UNAUTHORIZED"

**Symptoms:**
- All vs-cpu moves failing with 502
- Worker logs: `STOCKFISH_UNAUTHORIZED`
- Render logs: 401 errors

**Root Cause:** API key mismatch between Worker and Render

**Fix:**
```bash
# 1. Check Render secret
# Dashboard → Environment → STOCKFISH_API_KEY
# Copy the value

# 2. Update Worker secret (if mismatch)
cd ChessChatWeb/worker-api
wrangler secret put STOCKFISH_API_KEY
# Paste the Render value when prompted

# 3. Verify
curl -H "Authorization: Bearer $ADMIN_PASSWORD" \
  https://chesschat.uk/api/admin/stockfish-health
# Should return { success: true, status: "healthy" }
```

### Issue 3: "400 BAD_FEN"

**Symptoms:**
- Client shows "Invalid position"
- Worker returns 400
- Specific to certain game states

**Root Cause:** Client sending corrupted FEN (usually a client-side bug)

**Diagnosis:**
```sql
-- Find recent BAD_FEN errors
SELECT
  ts,
  request_json->>'fen' as fen,
  request_json->>'mode' as mode
FROM "WorkerCallLog"
WHERE error LIKE '%Invalid FEN%'
ORDER BY ts DESC
LIMIT 10;
```

**Fix:**
- Not a server issue - investigate client chess.js state management
- Check if FEN is being corrupted during serialization
- Verify chess.js version matches between client and server

### Issue 4: Database Connection Errors

**Symptoms:**
- Worker health check fails with DB error
- `prisma.$queryRaw` timeout
- Logs: "Failed to fetch worker calls"

**Root Cause:** Prisma Accelerate connection issue

**Diagnosis:**
```bash
# Check DATABASE_URL format
wrangler secret list
# Should see DATABASE_URL (encrypted)

# Test connection from local
cd ChessChatWeb/worker-api
npx wrangler dev
# In another terminal:
curl -X POST http://localhost:8787/api/chess-move \
  -H "Content-Type: application/json" \
  -d '{"fen":"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1","cpuLevel":5,"mode":"vs-cpu"}'
```

**Fix:**
```bash
# 1. Verify Prisma Accelerate is active
# Visit: https://console.prisma.io/

# 2. Regenerate connection string if expired
# Prisma Console → Project → Generate API Key

# 3. Update Worker secret
cd ChessChatWeb/worker-api
wrangler secret put DATABASE_URL
# Paste: prisma+postgres://accelerate.prisma-data.net/?api_key=...

# 4. Verify
curl -H "Authorization: Bearer $ADMIN_PASSWORD" \
  https://chesschat.uk/api/admin/worker-health
```

### Issue 5: Render Service Not Responding

**Symptoms:**
- All requests timeout after 60s
- Render dashboard shows "Live" but logs frozen
- Pings to /health fail

**Root Cause:** Render service hung or crashed

**Fix:**
```bash
# Option 1: Wait for auto-restart (30-60s)
# Render has health check auto-restart

# Option 2: Manual restart
# Dashboard → Manual Deploy → Deploy Latest Commit

# Option 3: Force reboot (if stuck)
# Dashboard → Settings → Delete Service → Re-create from Git

# After restart, verify
curl https://chesschat-stockfish.onrender.com/health
# Should return { status: "healthy", engines: { active: 0, max: 2 } }
```

### Issue 6: Memory Exhaustion (Render OOM)

**Symptoms:**
- Render logs: "Out of memory"
- Service restarts frequently
- Worker sees intermittent STOCKFISH_UNAVAILABLE

**Root Cause:** Engine pool + Node.js overhead > 512MB

**Diagnosis:**
```bash
# Check Render metrics
# Dashboard → Metrics → Memory Usage
# Look for spikes to 512MB before crashes
```

**Fix:**
```bash
# Option A: Reduce MAX_ENGINES (temporary)
# Edit stockfish-server/server.js:
const MAX_ENGINES = 1; // Down from 2

# Commit + push to redeploy
git add ChessChatWeb/stockfish-server/server.js
git commit -m "Reduce engine pool to prevent OOM"
git push

# Option B: Upgrade to Render paid tier
# $7/month for 1GB RAM
# Dashboard → Settings → Change Plan → Starter
```

### Issue 7: Determinism Issues (Random Moves)

**Symptoms:**
- Same position returns different moves on repeat calls
- Test 5 (Determinism) fails in E2E suite
- Users report unpredictable CPU behavior

**Root Cause:** Stockfish randomization at low Skill Levels

**Expected Behavior:**
- Skill Level 0-9: Some variation (intentional)
- Skill Level 10+: Highly deterministic
- MultiPV=1 and Contempt=0 reduce randomness

**Fix:**
- **Not a bug** if variation is small (<3 different moves in 10 trials)
- For strict determinism: Use cpuLevel >= 10 (Skill Level 20)
- Document that lower levels include intentional randomization for realism

## Rollback Procedures

### Rollback Worker API

```bash
cd ChessChatWeb/worker-api

# Option A: Revert to previous Git commit
git log --oneline -10  # Find last good commit
git revert <commit-hash>
git push

# Worker auto-deploys via GitHub Actions

# Option B: Manual rollback in Cloudflare
# Dashboard → Workers & Pages → chesschat-worker-api → Deployments
# Click "Rollback" on previous deployment
```

### Rollback Render Service

```bash
cd ChessChatWeb/stockfish-server

# Option A: Git revert + redeploy
git log --oneline -10
git revert <commit-hash>
git push

# Render auto-deploys from Git

# Option B: Manual rollback in Render
# Dashboard → Deploys → Select previous deploy → "Rollback to this version"
```

## Secret Rotation

### Rotate STOCKFISH_API_KEY

```bash
# 1. Generate new key
NEW_KEY=$(openssl rand -hex 32)
echo "New key: $NEW_KEY"

# 2. Update Render FIRST (to accept both old + new)
# Dashboard → Environment → STOCKFISH_API_KEY → Edit → Save

# Wait 30 seconds for Render restart

# 3. Update Worker
cd ChessChatWeb/worker-api
wrangler secret put STOCKFISH_API_KEY
# Paste new key

# 4. Verify
curl -X POST https://chesschat.uk/api/chess-move \
  -H "Content-Type: application/json" \
  -d '{"fen":"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1","cpuLevel":5,"mode":"vs-cpu"}'
# Should return success

# 5. Remove old key from Render (optional)
# Can keep both for gradual migration
```

### Rotate ADMIN_PASSWORD

```bash
# 1. Generate new password
NEW_PASSWORD=$(openssl rand -base64 24)
echo "New password: $NEW_PASSWORD"

# 2. Update Worker secret
cd ChessChatWeb/worker-api
wrangler secret put ADMIN_PASSWORD
# Paste new password

# 3. Update local .env for testing
echo "ADMIN_PASSWORD=$NEW_PASSWORD" >> .env.local

# 4. Update any external monitors/scripts

# 5. Verify
curl -H "Authorization: Bearer $NEW_PASSWORD" \
  https://chesschat.uk/api/admin/worker-health
```

### Rotate DATABASE_URL

```bash
# 1. Generate new Prisma Accelerate API key
# Visit: https://console.prisma.io/ → Generate API Key

# 2. Update Worker secret
cd ChessChatWeb/worker-api
wrangler secret put DATABASE_URL
# Paste: prisma+postgres://accelerate.prisma-data.net/?api_key=NEW_KEY

# 3. Verify
curl -H "Authorization: Bearer $ADMIN_PASSWORD" \
  https://chesschat.uk/api/admin/worker-health
# Check database.status = "ok"

# 4. Revoke old API key in Prisma Console (optional)
```

## Monitoring & Alerts

### Key Metrics to Track

| Metric | Source | Threshold | Alert Level |
|--------|--------|-----------|-------------|
| Success Rate | WorkerCallLog | < 95% | 🟡 Warning |
| Success Rate | WorkerCallLog | < 90% | 🔴 Critical |
| Avg Latency | WorkerCallLog | > 2000ms | 🟡 Warning |
| Avg Latency | WorkerCallLog | > 5000ms | 🔴 Critical |
| Cold Starts | Render logs | > 50% requests | 🟡 Warning |
| Engine Pool Wait | Render logs | > 5s wait | 🟡 Warning |
| Memory Usage | Render metrics | > 450MB | 🟡 Warning |
| Memory Usage | Render metrics | > 500MB | 🔴 Critical |
| DB Errors | WorkerCallLog | > 1% | 🔴 Critical |

### Automated Monitoring Setup (Optional)

**Option A: Cloudflare Workers Analytics**
- Dashboard → Workers & Pages → chesschat-worker-api → Analytics
- Built-in graphs for requests, errors, CPU time

**Option B: Custom Status Page**
```bash
# Deploy simple status monitor
# Uses /api/admin/worker-health endpoint
# Can be hosted on Cloudflare Pages

# Example: https://status.chesschat.uk
```

**Option C: External Uptime Monitor**
- UptimeRobot, Pingdom, or StatusCake
- Monitor: https://chesschat.uk/api/admin/stockfish-health
- Alert if: Status ≠ 200 or latency > 5s

## Capacity Planning

### Current Limits

| Component | Limit | Current Usage | Headroom |
|-----------|-------|---------------|----------|
| Cloudflare Workers | 100k req/day (free) | ~5k/day | 95% |
| Render Free Tier | 750 hours/month | ~730 hours/month | 3% |
| Render Memory | 512MB | ~300MB avg | 40% |
| Stockfish Engines | 2 concurrent | ~1.2 avg | 40% |
| Prisma Accelerate | 1M queries/month (free) | ~50k/month | 95% |

### Scaling Triggers

**Upgrade Render Plan ($7/month) if:**
- OOM crashes > 5 per day
- Cold starts > 30% of requests
- Concurrent requests regularly > 2

**Upgrade Cloudflare Plan ($5/month) if:**
- Request volume > 80k/day
- Need custom analytics or alerting

**Upgrade Prisma Plan ($29/month) if:**
- Query volume > 800k/month
- Need longer connection pooling timeout

## Disaster Recovery

### Full System Down

**Scenario:** Both Render and Worker unavailable

**Recovery:**
1. Verify issue is not DNS/Cloudflare (check status.cloudflare.com)
2. Rollback Worker if recent deploy caused issue
3. Restart Render service manually
4. If still down, deploy to backup Render service:
   ```bash
   # Create new Render service from Git
   # Point STOCKFISH_SERVER_URL to new URL
   wrangler secret put STOCKFISH_SERVER_URL
   ```

### Database Corruption

**Scenario:** WorkerCallLog table corrupted or DB connection lost

**Recovery:**
1. Worker will continue to function (logging fails gracefully)
2. Investigate DB provider (Neon/Supabase status page)
3. If needed, recreate table:
   ```bash
   cd ChessChatWeb/prisma
   npx prisma migrate reset --force
   npx prisma migrate deploy
   ```

### Render Account Suspended

**Scenario:** Render free tier limits exceeded or abuse detected

**Recovery:**
1. Deploy to alternative platform:
   - **Railway.app** (similar to Render)
   - **Fly.io** (Docker-based, more complex)
   - **Self-hosted VPS** (revert to Option A)

2. Update STOCKFISH_SERVER_URL in Worker

## Performance Optimization

### Reduce Latency

**Current: 300-700ms (warm), 30-60s (cold)**

**Optimizations:**
1. Enable keep-warm cron (eliminates cold starts)
2. Reduce movetime for low CPU levels (faster compute)
3. Deploy Render to region closer to users (requires paid tier)
4. Use Cloudflare Durable Objects for in-memory engine pool (advanced)

### Increase Concurrency

**Current: 2 concurrent engines (512MB RAM)**

**Options:**
1. Upgrade to Render Starter plan ($7/month, 1GB RAM) → 4 engines
2. Deploy multiple Render services, load balance in Worker
3. Move to paid Cloudflare Workers plan, use compute-on-edge

## Support Contacts

- **Render Support:** https://render.com/docs/support
- **Cloudflare Support:** https://support.cloudflare.com/
- **Prisma Support:** https://www.prisma.io/support
- **Repository Issues:** https://github.com/richlegrande-dot/Chess/issues

## Related Documentation

- [ARCHITECTURE_STOCKFISH_RENDER.md](./ARCHITECTURE_STOCKFISH_RENDER.md) - System architecture
- [RENDER_DEPLOY.md](./RENDER_DEPLOY.md) - Deployment procedures
- [CLOUDFLARE_WORKER_SETUP.md](./CLOUDFLARE_WORKER_SETUP.md) - Worker configuration
- [RENDER_MIGRATION_COMPLETE.md](./RENDER_MIGRATION_COMPLETE.md) - Migration status
