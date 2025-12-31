# Worker Required Mode Documentation

**Version:** 3.0  
**Date:** December 28, 2025  
**Status:** Active

## Overview

Worker Required Mode is an architectural configuration where the Cloudflare Pages Function (`/api/chess-move`) **requires** the Worker service binding to be functional. When the Worker is unavailable, requests fail loudly with detailed error responses instead of silently falling back to a local chess engine.

This mode was implemented to:
- **Force visibility of Worker failures** for proper troubleshooting
- **Prevent CPU strength degradation** from hidden fallback usage
- **Enable accurate Worker call logging** and monitoring
- **Ensure production issues are immediately visible**

## What Changed

### Before (Fallback Mode)
```
User → Pages Function → Worker (fails silently) → Local Fallback → Success
Result: No errors visible, Worker issues hidden, logs show 0 calls
```

### After (Worker Required Mode)
```
User → Pages Function → Worker (fails) → 502/503 Error → User sees failure
Result: Failures are visible, Worker issues must be fixed, proper logging
```

## Architecture

### Components

1. **Cloudflare Pages Function** (`functions/api/chess-move.ts`)
   - Requires `WALLE_ASSISTANT` service binding
   - Calls Worker at `https://internal/assist/chess-move`
   - Returns structured errors if Worker fails
   - Logs all attempts to `WORKER_CALL_LOGS` KV namespace

2. **Cloudflare Worker** (`worker-assistant/src/index.ts`)
   - Handles `/assist/chess-move` route (service binding endpoint)
   - Does NOT handle `/api/chess-move` (public route removed)
   - Returns chess moves with comprehensive metadata

3. **Archived Fallback** (`archive/fallback/main_thread_chess_move.ts`)
   - Local Wall-E engine implementation (archived)
   - Only used if `ALLOW_FALLBACK_MAIN_THREAD=true` (emergency use)
   - Default: disabled in production

## Error Responses

### No Service Binding (503)
```json
{
  "success": false,
  "mode": "worker-required",
  "engine": "none",
  "error": "Worker service binding not configured. Set WALLE_ASSISTANT binding in Cloudflare Dashboard.",
  "errorCode": "NO_WORKER_BINDING",
  "requestId": "abc123",
  "workerCallLog": { ... }
}
```

### Worker Unreachable (502)
```json
{
  "success": false,
  "mode": "worker-required",
  "engine": "none",
  "error": "Worker unreachable: Worker timeout after 15s",
  "errorCode": "WORKER_FETCH_FAILED",
  "requestId": "abc123",
  "workerCallLog": { ... }
}
```

### Worker Returns Error Status (502)
```json
{
  "success": false,
  "mode": "worker-required",
  "engine": "none",
  "error": "Worker returned error status: 500 Internal Server Error",
  "errorCode": "WORKER_ERROR_STATUS",
  "requestId": "abc123",
  "workerCallLog": { ... }
}
```

### Worker Returns Invalid JSON (502)
```json
{
  "success": false,
  "mode": "worker-required",
  "engine": "none",
  "error": "Worker returned invalid JSON response",
  "errorCode": "WORKER_INVALID_JSON",
  "requestId": "abc123",
  "workerCallLog": { ... }
}
```

## Interpreting Errors

### 503 Service Unavailable
**Cause:** Service binding `WALLE_ASSISTANT` not configured  
**Fix:** Add service binding in Cloudflare Dashboard → Pages → Settings → Functions → Service Bindings

### 502 Bad Gateway
**Cause:** Worker is configured but not responding correctly  
**Possible reasons:**
- Worker script has errors/crashes
- Worker route not configured
- Worker returns non-200 status
- Worker returns malformed JSON
- Worker timeout (>15 seconds)

**Fix:** Check Worker logs in Cloudflare Dashboard → Workers & Pages → walle-assistant-production → Logs

## Diagnostic Tools

### 1. Worker Health Endpoint

**Endpoint:** `GET /api/admin/worker-health`  
**Purpose:** Verify Worker binding and connectivity from production

```bash
# Test Worker health
curl "https://chesschat.uk/api/admin/worker-health?password=YOUR_ADMIN_PASSWORD"
```

**Response:**
```json
{
  "success": true,
  "bindingPresent": true,
  "workerHttpStatus": 200,
  "workerStatusText": "OK",
  "parsedJsonOk": true,
  "latencyMs": 234,
  "workerMode": "service-binding",
  "workerEngine": "worker",
  "timestamp": 1703721234567,
  "testRequest": {
    "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    "difficulty": "beginner"
  }
}
```

If unhealthy:
```json
{
  "success": false,
  "bindingPresent": false,
  "error": "Worker service binding (WALLE_ASSISTANT) not configured",
  "recommendation": "Configure service binding in Cloudflare Dashboard: Pages > Settings > Functions > Service Bindings"
}
```

### 2. Worker Calls Log (Admin Portal)

**Location:** Admin Portal → Worker Calls tab  
**Data Source:** `WORKER_CALL_LOGS` KV namespace (persistent)

Shows:
- Total call count (including failures)
- Success rate (worker vs failed %)
- Average latency
- Individual call details
- Error patterns

**Troubleshooting:**
- If total calls = 0: Check if `WORKER_CALL_LOGS` KV binding exists
- If all calls show `mode: "worker-required"`: Worker is not working
- If `success: false` with specific error: Use error message for diagnosis

### 3. Browser DevTools

**Console checks:**
```javascript
// Check gameStore state
console.log(window.gameStore.getState().debugInfo.workerCalls);

// Check latest API call
console.log(window.gameStore.getState().debugInfo.lastApiCall);

// Check if logWorkerCall exists
console.log(typeof window.gameStore.getState().logWorkerCall);
```

**Network tab:**
- Check `/api/chess-move` requests
- Look for 502/503 status codes
- Inspect response body for error details

## Emergency Fallback

### Enabling Fallback (NOT RECOMMENDED)

If you need to temporarily restore the local fallback:

1. **Set environment variable in Cloudflare Dashboard:**
   - Go to: Pages → Settings → Environment Variables
   - Add: `ALLOW_FALLBACK_MAIN_THREAD` = `true`
   - Save and redeploy

2. **What this does:**
   - Pages Function will use archived fallback when Worker fails
   - Errors are still logged, but requests succeed
   - UI shows `mode: "local-fallback"`

3. **WARNING:**
   - Fallback hides Worker issues again
   - Defeats the purpose of Worker Required Mode
   - Should only be used in emergencies
   - Remove flag once Worker is fixed

### Re-enabling Fallback Code

If you need to restore fallback permanently (not recommended):

1. Import fallback module in `functions/api/chess-move.ts` (already done)
2. The code already checks `ALLOW_FALLBACK_MAIN_THREAD` flag
3. Fallback is in `archive/fallback/main_thread_chess_move.ts`

## Configuration Checklist

### Cloudflare Dashboard (Manual Steps)

These settings **cannot be automated** and must be configured manually:

#### 1. Service Binding (REQUIRED)
- [ ] Go to: **Cloudflare Dashboard → Pages → chesschat-web → Settings → Functions**
- [ ] Scroll to: **Service Bindings** section
- [ ] Click: **Add binding**
- [ ] Variable name: `WALLE_ASSISTANT`
- [ ] Service: `walle-assistant-production` (or your Worker name)
- [ ] Environment: Production (and Preview if desired)
- [ ] Click: **Save**

#### 2. KV Namespace for Logs (OPTIONAL but recommended)
- [ ] Go to: **Cloudflare Dashboard → Pages → chesschat-web → Settings → Functions**
- [ ] Scroll to: **KV Namespace Bindings** section
- [ ] Click: **Add binding**
- [ ] Variable name: `WORKER_CALL_LOGS`
- [ ] KV namespace: `chesschat-worker-logs` (create if doesn't exist)
- [ ] Environment: Production
- [ ] Click: **Save**

#### 3. Worker Route Configuration (VERIFY)
- [ ] Go to: **Cloudflare Dashboard → Workers & Pages → walle-assistant-production → Settings → Triggers**
- [ ] Verify: **NO route** for `chesschat.uk/api/chess-move*` exists
- [ ] The Worker should **only be called via service binding**, not public routes
- [ ] If route exists: **Delete it**

#### 4. Environment Variables (OPTIONAL)
- [ ] Go to: **Cloudflare Dashboard → Pages → chesschat-web → Settings → Environment Variables**
- [ ] Optional: `INTERNAL_AUTH_TOKEN` (for Worker-to-Pages auth)
- [ ] Optional: `ADMIN_PASSWORD` (for admin portal auth)
- [ ] **DO NOT SET:** `ALLOW_FALLBACK_MAIN_THREAD` (leave disabled)

### Automated Verification

Run these scripts locally or in CI:

```bash
# Verify Worker Required Mode configuration
npm run verify:worker-required

# Run all verification scripts
npm run verify:all
```

## Troubleshooting Guide

### Issue: API returns 503 "No Worker binding"

**Diagnosis:**
- Service binding not configured
- Environment variable `WALLE_ASSISTANT` is undefined

**Solution:**
1. Configure service binding in Dashboard (see checklist above)
2. Redeploy Pages after adding binding
3. Test with `/api/admin/worker-health`

---

### Issue: API returns 502 "Worker timeout"

**Diagnosis:**
- Worker is taking >15 seconds to respond
- Worker may be stuck or experiencing high load

**Solution:**
1. Check Worker logs for errors
2. Check Worker CPU time in dashboard metrics
3. Verify Worker script is not crashing
4. Consider increasing timeout in Pages Function (if needed)

---

### Issue: API returns 502 "Worker returned 404"

**Diagnosis:**
- Worker route `/assist/chess-move` not implemented
- Worker route path mismatch

**Solution:**
1. Verify Worker handles `pathname === '/assist/chess-move'`
2. Check Worker logs for 404 errors
3. Redeploy Worker with correct route handler

---

### Issue: API returns 502 "Invalid JSON"

**Diagnosis:**
- Worker is returning HTML error page or plain text
- Worker is crashing and returning error page

**Solution:**
1. Check Worker logs for JavaScript errors
2. Verify Worker returns `Content-Type: application/json`
3. Test Worker directly (if possible)
4. Check for syntax errors in Worker code

---

### Issue: Worker Calls tab shows 0 calls

**Diagnosis:**
- `WORKER_CALL_LOGS` KV binding not configured
- No requests have been made yet
- KV writes are failing silently

**Solution:**
1. Verify KV binding exists (see checklist above)
2. Make a test CPU move
3. Check browser console for `logWorkerCall()` errors
4. Check if logs are written to KV in Cloudflare Dashboard

---

### Issue: All calls show `mode: "worker-required"`

**Diagnosis:**
- Worker is not responding successfully
- All requests are failing

**Solution:**
1. Use `/api/admin/worker-health` to diagnose
2. Check Worker logs for errors
3. Verify service binding is correct
4. Check Worker script has no syntax errors

---

### Issue: CPU strength seems weak

**Diagnosis:**
- Fallback may be accidentally enabled
- Worker difficulty calculation incorrect

**Solution:**
1. Check Admin Portal → Worker Calls for `mode` field
2. If `mode: "local-fallback"`: fallback is active (bad)
3. If `mode: "service-binding"`: Worker is active (good)
4. Verify `ALLOW_FALLBACK_MAIN_THREAD` is not set

## Monitoring

### Key Metrics

1. **Worker Call Success Rate**
   - Location: Admin Portal → Worker Calls tab
   - Target: >95% success
   - Alert if: <80% success

2. **Worker Latency**
   - Location: Admin Portal → Worker Calls tab
   - Target: <5 seconds average
   - Alert if: >10 seconds average

3. **Error Patterns**
   - Location: Admin Portal → Worker Calls tab → Error Patterns
   - Watch for: repeated timeout, 404, binding-issue

4. **Worker Dashboard Metrics**
   - Location: Cloudflare Dashboard → Workers → walle-assistant-production
   - Watch for: CPU time, requests, errors

### Health Checks

Run periodically:
```bash
# Check Worker health
curl "https://chesschat.uk/api/admin/worker-health?password=ADMIN_PASSWORD"

# Check Worker calls log
curl "https://chesschat.uk/api/admin/worker-calls?limit=10" \
  -H "Authorization: Bearer ADMIN_PASSWORD"
```

## Related Documentation

- [HYBRID_DEPLOYMENT_GUIDE.md](HYBRID_DEPLOYMENT_GUIDE.md) - Service binding setup
- [PROBLEM_STATEMENT.md](PROBLEM_STATEMENT.md) - Original issue that led to this change
- [DEBUG_PANEL_ENHANCEMENT.md](DEBUG_PANEL_ENHANCEMENT.md) - Debug panel features

## Migration Notes

If upgrading from Fallback Mode to Worker Required Mode:

1. **Before deploying:**
   - Ensure Worker is deployed and functional
   - Configure service binding in Dashboard
   - Test with `/api/admin/worker-health`

2. **During deployment:**
   - Deploy Worker first (if changes)
   - Then deploy Pages
   - Monitor Worker Calls tab

3. **After deployment:**
   - Make test CPU moves
   - Verify Worker Calls tab shows successes
   - Check error rate
   - Monitor for 502/503 errors

4. **Rollback plan:**
   - If issues occur: Set `ALLOW_FALLBACK_MAIN_THREAD=true`
   - This restores fallback while investigating
   - Fix Worker issue
   - Remove flag once fixed

## FAQ

**Q: Why disable fallback?**  
A: Fallback was hiding Worker failures, making troubleshooting impossible. Worker Required Mode forces issues to be visible so they can be fixed.

**Q: What if I need fallback for reliability?**  
A: Set `ALLOW_FALLBACK_MAIN_THREAD=true` as emergency measure. Fix Worker issue ASAP and remove flag.

**Q: How do I know if Worker is working?**  
A: Use `/api/admin/worker-health` endpoint or check Admin Portal → Worker Calls tab.

**Q: What if I see 502 errors in production?**  
A: This means Worker is not responding correctly. Check Worker logs and use troubleshooting guide above.

**Q: Can I use fallback in development?**  
A: Yes, set `ALLOW_FALLBACK_MAIN_THREAD=true` in local `.dev.vars` file.

**Q: How do I test Worker locally?**  
A: Use `wrangler dev` in worker-assistant directory and test with curl.

**Q: What's the difference between 502 and 503?**  
A: 503 = binding missing (configuration issue), 502 = Worker not responding (runtime issue).
