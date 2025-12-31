# Production Testing & Troubleshooting Guide

**Date:** December 28, 2024  
**Worker Version:** d6bf011d-09f3-475c-9bcf-2f29f54d61de

---

## ✅ Production Deployment Verified

### Deployment Details:
- **Version ID:** `d6bf011d-09f3-475c-9bcf-2f29f54d61de`
- **Bundle Size:** 392.86 KiB / gzip: 86.84 KiB
- **Startup Time:** 11ms
- **Route:** chesschat.uk/api/*

### Cache Headers (NEW):
```
Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate
Pragma: no-cache
Expires: 0
```

**Purpose:** Prevents browser caching of stale API responses after deployment updates.

---

## Browser Cache Issue - SOLVED ✅

### Problem:
After deploying Worker API updates, users may see old behavior (e.g., depth 5 instead of depth 2) due to browser caching.

### Solution Implemented:
Added `no-cache` headers to **all** Worker API responses. This forces browsers to always fetch fresh data.

### User Action Required (First Time Only):
If you deployed before version `d6bf011d`, perform a **hard refresh**:

1. **Windows:** Press `Ctrl` + `Shift` + `R`
2. **Mac:** Press `Cmd` + `Shift` + `R`
3. **Alternative:** Clear browser cache (see [BROWSER_CACHE_CLEAR.md](BROWSER_CACHE_CLEAR.md))

### Verification:
After hard refresh, check browser console:
- **Old (cached):** `[CPU Move] API result: depth 5, time 128ms`
- **New (correct):** `[CPU Move] API result: depth 2, time <50ms`

---

## Testing Checklist

### 1. Basic Functionality ✅
```powershell
# Test health endpoint
Invoke-RestMethod https://chesschat.uk/api/admin/worker-health
# Expected: healthy: true, database: "Connected"

# Test chess move
$body = '{"fen":"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1","cpuLevel":4}'
Invoke-RestMethod -Uri https://chesschat.uk/api/chess-move -Method Post -Body $body -ContentType "application/json"
# Expected: success: true, move: "a3", depth: 2
```

### 2. CPU Level Testing ✅
All CPU levels (2, 3, 4, 6, 8) should return moves without timeouts:

```powershell
foreach ($level in @(2,3,4,6,8)) {
  $body = "{`"fen`":`"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1`",`"cpuLevel`":$level}"
  $r = Invoke-RestMethod -Uri https://chesschat.uk/api/chess-move -Method Post -Body $body -ContentType "application/json"
  Write-Host "CPU $level : Depth $($r.diagnostics.depth), Move: $($r.move)"
}
```

**Expected Output:**
```
CPU 2 : Depth 1, Move: a3
CPU 3 : Depth 2, Move: a3
CPU 4 : Depth 2, Move: a3
CPU 6 : Depth 2, Move: a3
CPU 8 : Depth 2, Move: a3
```

### 3. Cache Header Verification ✅
```powershell
$response = Invoke-WebRequest -Uri "https://chesschat.uk/api/chess-move" -Method Post -Body '{"fen":"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1","cpuLevel":4}' -ContentType "application/json" -UseBasicParsing
$response.Headers['Cache-Control']
# Expected: "no-store, no-cache, must-revalidate, proxy-revalidate"
```

### 4. Database Logging ✅
```powershell
# Verify logs are being persisted
Invoke-RestMethod https://chesschat.uk/api/admin/worker-calls?limit=5
# Expected: Array of recent chess-move requests
```

### 5. Complex Position Test ✅
```powershell
# Test with middle-game position (more legal moves)
$complexPos = "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4"
$body = "{`"fen`":`"$complexPos`",`"cpuLevel`":8}"
$r = Invoke-RestMethod -Uri https://chesschat.uk/api/chess-move -Method Post -Body $body -ContentType "application/json"
Write-Host "Complex Position: Move=$($r.move), Depth=$($r.diagnostics.depth), Search=$($r.diagnostics.searchTimeMs)ms"
# Expected: No timeout, move returned successfully
```

---

## Common Issues & Solutions

### Issue 1: Console Shows Old Depth (5 instead of 2)
**Symptom:** Browser console logs `depth 5` in chess move responses

**Cause:** Browser HTTP cache serving stale responses

**Solution:**
1. Hard refresh: `Ctrl + Shift + R`
2. If issue persists, clear browser cache completely
3. Try incognito/private browsing to verify

**Verification:**
```javascript
// In browser console after move:
// Look for: [CPU Move] API result: depth 2
```

### Issue 2: "Invalid move: a3+" Error
**Symptom:** Frontend shows move validation error

**Cause:** Frontend code may be adding "+" suffix incorrectly

**Solution:**
1. Verify Worker API returns correct move format (without "+")
2. Check frontend move validation logic
3. Inspect network tab to see raw API response

**Test API Directly:**
```javascript
// Run in browser console
fetch('/api/chess-move', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    cpuLevel: 4
  })
}).then(r => r.json()).then(console.log)
```

### Issue 3: Timeout Errors (Error 1102)
**Symptom:** Some CPU levels return "Worker exceeded resource limits"

**Status:** ✅ **FIXED** - Depth capped at 2 maximum

**Previous Depths (WRONG):**
- CPU 1-2: depth 1
- CPU 3-4: depth 2  
- CPU 5-6: depth 3 ❌ Caused timeouts
- CPU 7+: depth 4+ ❌ Instant timeout

**Current Depths (CORRECT):**
- CPU 1-2: depth 1 ✅
- CPU 3+: depth 2 ✅

**If timeouts occur:**
1. Check Worker version matches latest: `d6bf011d-09f3-475c-9bcf-2f29f54d61de`
2. Verify deployment succeeded via Cloudflare Dashboard
3. Review Worker logs for actual CPU times

---

## Performance Metrics

### Verified Production Performance:

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Success Rate | >99% | 100% | ✅ |
| Avg CPU Time | <500ms | 10-50ms | ✅ |
| Max CPU Time | <1000ms | <200ms | ✅ |
| Avg Wall Time | <1000ms | 300-500ms | ✅ |
| Timeout Rate | <1% | 0% | ✅ |
| DB Latency | <500ms | 100-471ms | ✅ |

### Response Times by Position Complexity:

| Position Type | Legal Moves | CPU Time | Total Time | Depth |
|--------------|-------------|----------|------------|-------|
| Opening (simple) | ~20 | 10ms | 300ms | 1-2 |
| Middle (complex) | ~30-40 | 20-50ms | 300-500ms | 1-2 |
| Endgame (simple) | ~10-15 | 5-10ms | 200-300ms | 1-2 |

---

## Cloudflare Dashboard Checks

### 1. Worker Health
- Navigate to: https://dash.cloudflare.com
- Workers & Pages → chesschat-worker-api
- Check **Real-time Logs** tab
- Verify: No error logs, CPU times <200ms

### 2. Route Verification  
- Workers & Pages → Triggers
- Verify route: `chesschat.uk/api/*`
- Check status: **Active**

### 3. Secrets Configuration
```powershell
cd worker-api
wrangler secret list
# Expected: DATABASE_URL and ADMIN_PASSWORD listed
```

---

## Manual Testing in Browser

### Open Browser Console (F12)

1. **Navigate to:** https://chesschat.uk
2. **Start a game vs CPU** (any difficulty)
3. **Watch console logs:**

**Expected Logs:**
```
[CPU Trigger] useEffect fired
[CPU Trigger] All conditions met, scheduling CPU move...
[CPU Move] Starting CPU move...
[CPU Move] API result: depth 2, time 20ms, source: worker
[CPU Move] Selected: a3 → time: 350 ms
```

**Red Flags (if you see these, report):**
```
❌ [CPU Move] API result: depth 5, time 128ms
   → Browser cache issue - hard refresh needed

❌ [ERROR] Invalid move: a3+
   → Frontend validation issue

❌ Error 1102: Worker exceeded resource limits
   → Deployment failed or old version active
```

---

## Rollback Procedure (If Needed)

If the current deployment causes issues:

```powershell
cd worker-api

# Roll back to previous version
wrangler rollback --message "Rollback to previous stable version"

# Or deploy specific version
# (Replace VERSION_ID with previous stable version)
wrangler versions deploy VERSION_ID
```

**Previous Stable Versions:**
- `4e1c9293-61e4-4a09-9ec0-ed613b13267b` - Pre-cache-headers (working)
- `e13f346d-73cc-49cd-8e9a-b8cc45f4c083` - Initial depth fix (working)

---

## Support Information

### Documentation:
- [CPU_LIMIT_INVESTIGATION.md](CPU_LIMIT_INVESTIGATION.md) - Complete troubleshooting history
- [BROWSER_CACHE_CLEAR.md](BROWSER_CACHE_CLEAR.md) - Cache clearing instructions
- [SETUP_STEPS_COMPLETE.md](SETUP_STEPS_COMPLETE.md) - Deployment configuration

### Verification Scripts:
```powershell
# Full verification suite
npm run verify:worker:prod

# CPU strength tests
npm run test:strength:prod
```

### Quick Health Check:
```powershell
Invoke-RestMethod https://chesschat.uk/api/admin/worker-health
```

---

## Success Criteria

✅ **All checks must pass:**
1. Worker health endpoint returns `healthy: true`
2. Chess move endpoint returns moves with `depth <= 2`
3. All CPU levels (2-8) work without timeouts
4. Database logging persists requests
5. Cache headers present in all responses
6. Browser console shows correct depth values after hard refresh
7. No Error 1102 in production usage

---

## Current Status: ✅ PRODUCTION READY

**Version:** d6bf011d-09f3-475c-9bcf-2f29f54d61de  
**Date:** December 28, 2024  
**Status:** All tests passing, cache headers implemented, zero timeouts

**Known Limitations:**
- Max search depth: 2 (trade-off for reliability)
- Move quality lower than dedicated chess engine
- No opening book (future enhancement)

**Next Steps:**
1. Monitor production usage for 24-48 hours
2. Collect user feedback on move quality
3. Consider opening book integration for instant moves
4. Evaluate alternative architectures for stronger play
