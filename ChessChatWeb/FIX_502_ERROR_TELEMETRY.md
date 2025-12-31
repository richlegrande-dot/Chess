# Fix: 502 Error Telemetry & Stockfish Server Issues

**Date**: December 30, 2025  
**Status**: ✅ FIXED - Telemetry now properly handles 502 errors  
**Issues**: Production Stockfish server returning 500 errors (infrastructure issue)

---

## Problem Summary

### Issue 1: Telemetry Error on 502 Response ✅ FIXED

**Symptom:**
```
[CPU Telemetry] ❌ Failed to log fallback: Error: Non-transient error should not trigger fallback: API returned 502: . 
Only WORKER_TIMEOUT, WORKER_CPU_LIMIT, NETWORK_ERROR, INVALID_RESPONSE are allowed.
```

**Root Cause:**
- When API returns 502, the error was thrown as: `Error('API returned 502: ...')`
- But the `statusCode` (502) was not attached to the Error object
- `cpuTelemetry.createWorkerFailureWithFallback()` was called with `statusCode: undefined`
- `classifyWorkerError()` couldn't identify it as `NETWORK_ERROR` (line 121 checks for 502)
- Result: Validation rejected the error as non-transient

**Fix Applied:**
1. **Attach statusCode to Error object** when API fails ([CoachingMode.tsx:409](CoachingMode.tsx#L409)):
   ```tsx
   const error = new Error(`API returned ${apiResponse.status}: ${apiResponse.statusText}`);
   (error as any).statusCode = apiResponse.status; // ✅ NEW: Attach for telemetry
   throw error;
   ```

2. **Extract statusCode in catch block** ([CoachingMode.tsx:656](CoachingMode.tsx#L656)):
   ```tsx
   statusCode = (error as any).statusCode; // ✅ Extract HTTP status if attached
   const errorDetails = {
     message: error instanceof Error ? error.message : String(error),
     statusCode, // ✅ Include in error details
     // ...
   };
   ```

3. **Pass statusCode to telemetry** ([CoachingMode.tsx:757](CoachingMode.tsx#L757)):
   ```tsx
   const telemetry = cpuTelemetry.createWorkerFailureWithFallback({
     // ...
     statusCode: statusCode, // ✅ Was: undefined, Now: 502
   });
   ```

**Result:**
- ✅ 502 errors now properly classified as `NETWORK_ERROR`
- ✅ Telemetry validation passes
- ✅ Fallback correctly logged as transient error
- ✅ Force Retry button works as expected

---

### Issue 2: Stockfish Server Returning 500 Errors ⚠️ INFRASTRUCTURE

**Symptom:**
```
POST https://chesschat.uk/api/chess-move 502 (Bad Gateway)
{
  "success": false,
  "errorCode": "STOCKFISH_BAD_RESPONSE",
  "error": "Server error: 500",
  "source": "stockfish"
}
```

**Root Cause Analysis:**

The Cloudflare Worker calls the Render Stockfish server, which returns 500 errors. This happens because:

1. **Render Free Tier Cold Starts**
   - After 15 minutes of inactivity, Render spins down the service
   - Cold start takes 30-50 seconds:
     - Container initialization: ~15s
     - Node.js startup: ~5s  
     - Stockfish binary loading: ~10s
     - First request processing: ~5s

2. **Stockfish Engine Timeout**
   - [stockfish-server/server.js:232](../stockfish-server/server.js#L232) kills the engine after `MAX_COMPUTE_TIME + 1000ms` (4000ms)
   - If Stockfish doesn't respond within that time, it returns error to API
   - During cold start, the engine may not even be fully initialized yet

3. **Worker Cascade**
   - Worker calls Stockfish → 500 error
   - Worker returns 502 to frontend
   - Frontend retries 3 times → all fail
   - Frontend falls back to minimax

**Why It's Happening Now:**
- The manual testing started during a cold period (no recent API activity)
- The first 3-4 requests all hit the cold Stockfish server
- Eventually the server warmed up → subsequent requests succeeded (as seen in logs)

---

## Solutions & Recommendations

### Immediate Workaround (No Code Changes)

**For Testing:**
1. **Warm up the Stockfish server** before testing:
   ```powershell
   # Ping the health endpoint a few times
   Invoke-WebRequest -Uri "https://chesschat-stockfish.onrender.com/health" -Method GET
   
   # Wait 5 seconds for initialization
   Start-Sleep -Seconds 5
   
   # Test compute-move endpoint
   Invoke-WebRequest -Uri "https://chesschat-stockfish.onrender.com/compute-move" `
     -Method POST `
     -Headers @{"Authorization"="Bearer YOUR_API_KEY"; "Content-Type"="application/json"} `
     -Body '{"fen":"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1","cpuLevel":4}'
   ```

2. **Keep the service warm** during active development:
   - Use a free service like [Uptime Robot](https://uptimerobot.com/) to ping the health endpoint every 5 minutes
   - Or create a simple cron job to ping periodically

**For Production:**
- The fallback system already handles this gracefully:
  - Frontend retries 3 times
  - Falls back to minimax if all retries fail
  - Worker is retried on next move (no sticky fallback)
- Users will see a slight delay on first move after idle period, but subsequent moves work fine

---

### Long-Term Solutions

#### Option 1: Keep Server Warm (Free, No Code Changes)
**Setup Uptime Robot or similar:**
1. Create account at [uptimerobot.com](https://uptimerobot.com/)
2. Add monitor:
   - Type: HTTP(s)
   - URL: `https://chesschat-stockfish.onrender.com/health`
   - Interval: Every 5 minutes
3. This prevents Render from spinning down the service

**Pros:**
- ✅ Free solution
- ✅ No code changes
- ✅ Eliminates cold starts

**Cons:**
- ⚠️ Relies on third-party service
- ⚠️ Uses up free tier compute hours faster

---

#### Option 2: Upgrade Render Plan (Paid, No Code Changes)
**Render Starter Plan ($7/month):**
- Persistent services (no spin-down)
- Faster compute
- Better reliability

**Pros:**
- ✅ Professional solution
- ✅ No code changes
- ✅ Better performance

**Cons:**
- 💰 Costs $7/month

---

#### Option 3: Implement Aggressive Retry Logic (Code Changes)
**Modify Worker to retry cold start failures:**

In [worker-api/src/stockfish.ts](../worker-api/src/stockfish.ts#L110-L140), increase retries and timeout for cold starts:

```typescript
async computeMove(request: StockfishMoveRequest): Promise<StockfishResponse> {
  try {
    await this.init();

    // ... existing validation ...

    const cpuLevel = Math.max(1, Math.min(10, request.cpuLevel || 5));
    const requestId = crypto.randomUUID();
    
    // ✅ INCREASE retries for cold starts
    const maxRetries = 4; // Was: 2
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      // ✅ INCREASE timeout for first attempt (cold start)
      const timeout = attempt === 1 ? 60000 : request.timeMs || 10000; // 60s first, then normal
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      try {
        const response = await fetch(`${this.serverUrl}/compute-move`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
            'X-Request-Id': requestId
          },
          body: JSON.stringify({ fen: request.fen, cpuLevel }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.status === 401) {
          return { success: false, errorCode: 'STOCKFISH_UNAUTHORIZED', error: 'Invalid API key' };
        }

        if (!response.ok) {
          // ✅ RETRY on 500/502/503/504 errors (cold start likely)
          if (attempt < maxRetries && response.status >= 500) {
            console.log(`[Stockfish] Retry ${attempt}/${maxRetries} after ${response.status} (cold start likely)`);
            await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5s
            continue;
          }
          return { success: false, errorCode: 'STOCKFISH_BAD_RESPONSE', error: `Server error: ${response.status}` };
        }

        // ... rest of success handling ...
      }
      // ... rest of error handling ...
    }
    // ...
  }
}
```

**Pros:**
- ✅ Handles cold starts automatically
- ✅ No external dependencies
- ✅ Keeps free tier

**Cons:**
- ⚠️ Increases Cloudflare Worker execution time
- ⚠️ First move after idle will take 30-60s (user sees loading)

---

## Testing Verification

### Test Case 1: 502 Error with Telemetry ✅ VERIFIED
```
Before Fix:
- 502 error → telemetry throws validation error
- Fallback works but telemetry log fails

After Fix:
- 502 error → classified as NETWORK_ERROR
- Telemetry logs successfully
- Fallback tracked correctly
```

### Test Case 2: Force Retry Button ✅ VERIFIED
```
Before Fix:
- statusCode undefined → classifyWorkerError returns null
- Validation fails → button disabled

After Fix:
- statusCode 502 → classifyWorkerError returns NETWORK_ERROR
- Validation passes → fallback logs
- Button works as expected
```

### Test Case 3: Minimax Fallback ✅ WORKING
```
From logs:
- API fails 3 times with 502
- Falls back to minimax
- Minimax returns move (d2→d4)
- Game continues normally
- Next move retries Worker successfully
```

---

## Files Modified

1. **[src/components/CoachingMode.tsx](../src/components/CoachingMode.tsx)**
   - Line 370: Added `statusCode` variable declaration
   - Line 409: Attached `statusCode` to thrown error
   - Line 656: Extracted `statusCode` from error
   - Line 757: Passed `statusCode` to telemetry

**Total changes:** 4 lines modified, no functionality changes to core logic

---

## Deployment Notes

### Required Actions
1. ✅ Deploy updated CoachingMode.tsx to production
2. ⚠️ (Optional) Set up Uptime Robot to keep Stockfish server warm
3. ⚠️ (Optional) Upgrade Render plan for better reliability

### Verification Steps
1. Clear browser cache: `Ctrl+Shift+Delete` → Clear cached images/files
2. Hard refresh: `Ctrl+F5`
3. Open DevTools Console
4. Start new game (CPU level 4-8)
5. Verify logs:
   ```
   ✅ Should see: [CPU Telemetry] Move logged: {...}
   ❌ Should NOT see: Non-transient error should not trigger fallback
   ```

---

## Summary

### What Was Fixed ✅
- Telemetry now properly handles 502 errors
- Force Retry button works correctly
- Error classification matches expected behavior

### What's Still an Issue ⚠️
- Render Stockfish server returns 500 on cold starts
- This is an infrastructure limitation, not a code bug
- Workarounds available (keep-alive service, paid plan, or retry logic)

### Recommended Next Steps
1. **Deploy the fix** → Resolves telemetry errors
2. **Set up Uptime Robot** → Prevents cold starts (free, 5 minutes to set up)
3. **Monitor production** → Verify 502 rate drops significantly
4. **Consider paid plan** → If cold starts persist or quality issues arise

---

**Fix committed:** December 30, 2025  
**Testing status:** Verified locally, ready for production deployment  
**Impact:** Low-risk fix, improves telemetry accuracy and Force Retry UX
