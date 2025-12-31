# Operator Verification Checklist

**Purpose:** Quick manual checks an operator can perform in the Cloudflare Dashboard to verify Worker API health and configuration.

**When to Use:**
- After deploying a new version
- When investigating production issues
- As part of routine health monitoring
- Before and after configuration changes

---

## ✅ Pre-Deployment Checklist

### 1. Worker Exists and Is Active

**Location:** https://dash.cloudflare.com → Workers & Pages

**Checks:**
- [ ] Worker `chesschat-worker-api` is listed
- [ ] Status shows as "Active" (green indicator)
- [ ] Latest deployment timestamp is recent

**Expected:** Worker should appear in list with green "Active" status.

**If Failed:** Redeploy using `wrangler deploy` from `worker-api/` directory.

---

### 2. Route Configuration

**Location:** Workers & Pages → chesschat-worker-api → Settings → Triggers

**Checks:**
- [ ] Route `chesschat.uk/api/*` exists
- [ ] Route is marked as "Active"
- [ ] Zone is set to `chesschat.uk`

**Expected:** One route should be visible: `chesschat.uk/api/*` → `chesschat-worker-api`

**If Failed:**
1. Click "Add route"
2. Route: `chesschat.uk/api/*`
3. Zone: `chesschat.uk`
4. Worker: `chesschat-worker-api`
5. Save

---

### 3. Secrets Are Configured

**Location:** Workers & Pages → chesschat-worker-api → Settings → Variables

**Checks:**
- [ ] `DATABASE_URL` secret exists (value hidden)
- [ ] `ADMIN_PASSWORD` secret exists (value hidden)
- [ ] Both secrets show type "secret" (not "text")

**Expected:** Two secrets listed under "Environment Variables" section with 🔒 lock icon.

**If Failed:** Use `wrangler secret put <SECRET_NAME>` to add missing secrets.

**Security Note:** Secret values are never displayed in the dashboard (by design).

---

## ✅ Post-Deployment Verification

### 4. Request Volume

**Location:** Workers & Pages → chesschat-worker-api → Metrics

**Checks:**
- [ ] Request count is increasing (not flat at zero)
- [ ] Requests per second shows activity
- [ ] Success rate is >95%

**Expected:** After deployment, you should see request activity within 2-5 minutes.

**Test Manually:**
```powershell
# Generate test traffic
Invoke-RestMethod "https://chesschat.uk/api/admin/worker-health"
```

**Refresh dashboard** - Request count should increment.

**If No Traffic:** Check route configuration (step 2).

---

### 5. Error Rate

**Location:** Workers & Pages → chesschat-worker-api → Metrics

**Checks:**
- [ ] Error rate is <5%
- [ ] No sudden spikes in errors
- [ ] Invocation errors are zero or near-zero

**Expected:** Error rate should be very low (<1% ideally).

**If High Error Rate:**
1. Click "View Logs" or use `wrangler tail`
2. Look for specific error messages
3. Common issues:
   - Missing secrets (DATABASE_URL)
   - Invalid Prisma Accelerate connection
   - Database connection timeout

---

### 6. Worker Logs

**Location:** Workers & Pages → chesschat-worker-api → Logs (Real-time)

**OR** Via CLI: `wrangler tail`

**Checks:**
- [ ] Health check requests appear in logs
- [ ] Chess move requests show successful execution
- [ ] No repeated error messages
- [ ] Database queries are completing

**Expected Sample Logs:**
```
GET /api/admin/worker-health → 200 OK (150ms)
POST /api/chess-move → 200 OK (850ms)
Database query completed in 120ms
```

**If Errors Appear:**
- Look for "PrismaClient" errors → Check DATABASE_URL secret
- "Rate limit" errors → Accelerate connection may be hitting limits
- "Timeout" errors → Database may be slow or unreachable

---

## ✅ Functional Testing

### 7. Health Endpoint

**Test via CLI:**
```powershell
Invoke-RestMethod "https://chesschat.uk/api/admin/worker-health"
```

**Expected Response:**
```json
{
  "healthy": true,
  "checks": {
    "database": { "status": "ok", "message": "Connected" }
  },
  "latencyMs": 250
}
```

**Dashboard Check:**
- [ ] Metrics show successful 200 response
- [ ] Response time is reasonable (<2s)

**If Failed:** Worker or database connection issue - check logs.

---

### 8. Chess Move Endpoint

**Test via CLI:**
```powershell
$body = @{
  fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
  difficulty = "medium"
  cpuLevel = 3
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://chesschat.uk/api/chess-move" -Method Post -Body $body -ContentType "application/json"
```

**Expected Response:**
```json
{
  "success": true,
  "move": "e2e4",
  "mode": "worker",
  "engine": "worker"
}
```

**Dashboard Check:**
- [ ] POST requests appear in metrics
- [ ] Success rate remains high
- [ ] No 500 errors

**If Failed:** Chess engine or Worker logic issue - check logs for stack traces.

---

## ✅ Performance Monitoring

### 9. Response Time

**Location:** Workers & Pages → chesschat-worker-api → Metrics → Invocation Duration

**Checks:**
- [ ] P50 (median) response time: <500ms
- [ ] P99 response time: <2000ms
- [ ] No sudden spikes in latency

**Expected:** Most requests should complete quickly (<500ms for health, <1500ms for chess moves).

**Performance Note:** Prisma Accelerate adds ~150-300ms latency. Database queries via Accelerate may vary between 255ms to 1647ms depending on cold starts and network conditions.

**If Slow:**
- Check Prisma Accelerate dashboard for connection issues
- Verify database isn't overloaded
- Consider adding caching for repeated queries

---

### 10. Worker Execution Time

**Location:** Workers & Pages → chesschat-worker-api → Metrics → CPU Time

**Checks:**
- [ ] CPU time is consistent (not spiking)
- [ ] Execution stays within Worker CPU limits
- [ ] No "exceeded CPU limit" errors

**Expected:** Most requests use minimal CPU (<50ms).

**If High CPU:**
- Chess engine is CPU-intensive (expected for complex positions)
- Consider limiting search depth or time for lower difficulties

---

## 🚨 Alerts Recommendations

**Configure Cloudflare Notifications for:**

| Alert Type | Threshold | Action |
|------------|-----------|--------|
| Error Rate | >5% for 5 minutes | Investigate logs immediately |
| Request Volume | <10 requests/minute | Check if site is down |
| Response Time | P99 >5 seconds | Database or Worker performance issue |
| Worker Failed | 3 consecutive failures | Critical - requires immediate attention |

**To Configure:**
1. Go to: https://dash.cloudflare.com → Notifications
2. Click "Add" → "Workers"
3. Set thresholds and notification channels (email, Slack, PagerDuty, etc.)

---

## ✅ Database Connection Health

### 11. Prisma Accelerate Status

**Location:** https://console.prisma.io (if using Prisma Cloud)

**Checks:**
- [ ] Accelerate connection is active
- [ ] Query volume is normal
- [ ] No connection errors or rate limits

**Expected:** Connection shows as healthy with normal query volume.

**If Issues:**
- Check DATABASE_URL secret format
- Verify Accelerate API key is valid
- Check Accelerate quotas/limits

---

## 📊 Quick Health Dashboard

Create a bookmark folder with these links for fast access:

```
Worker Dashboard:
https://dash.cloudflare.com/[account-id]/workers/services/view/chesschat-worker-api/production

Metrics:
https://dash.cloudflare.com/[account-id]/workers/services/view/chesschat-worker-api/production/metrics

Logs:
https://dash.cloudflare.com/[account-id]/workers/services/view/chesschat-worker-api/production/logs

Health Check:
https://chesschat.uk/api/admin/worker-health
```

---

## Summary Checklist

**Before Deployment:**
- [ ] Worker exists and is active
- [ ] Route configured: `chesschat.uk/api/*`
- [ ] Secrets set: `DATABASE_URL`, `ADMIN_PASSWORD`

**After Deployment:**
- [ ] Request volume is increasing
- [ ] Error rate <5%
- [ ] Logs show successful requests
- [ ] Health endpoint returns 200 OK
- [ ] Chess move endpoint works
- [ ] Response times are reasonable
- [ ] CPU usage is normal

**Optional:**
- [ ] Alerts configured for critical metrics
- [ ] Prisma Accelerate connection healthy
- [ ] Dashboard bookmarks created

---

## When to Escalate

**Contact development team if:**
- Error rate >10% for more than 5 minutes
- All requests failing (100% error rate)
- Database connection completely down
- Worker not responding at all
- Logs show repeated "PrismaClient" or "Accelerate" errors

**Include in report:**
1. Screenshot of Metrics dashboard
2. Recent log entries (last 50 lines)
3. Output of `wrangler secret list`
4. Output of health check request
5. Timestamp when issue started

---

## Resources

- **Automated Verification:** Run `npm run verify:worker:prod` from project root
- **Manual Deployment:** Run `wrangler deploy` from `worker-api/` directory
- **View Logs:** Run `wrangler tail` from `worker-api/` directory
- **Deployment Guide:** `WORKER_DEPLOYMENT.md`
- **Manual Setup:** `docs/MANUAL_CLOUDFLARE_SETUP.md`
