# Worker Call Logging & Usage Problem Statement

**Date:** December 27, 2025  
**Status:** Active Investigation  
**Priority:** High

## Problem Overview

The admin portal's Worker Calls tab consistently shows "No worker calls recorded yet" with 0 total calls, despite CPU moves executing successfully in the application. Additionally, the API is returning 503 Service Unavailable errors, and all moves are falling back to the local main_thread engine instead of using the deployed Cloudflare Worker. Worker call metadata is not being captured, stored, or displayed for debugging and monitoring purposes.

## Expected Behavior

When a CPU move is made (in either vs-cpu or coaching mode):

1. Frontend calls `/api/chess-move` API endpoint
2. Request is intercepted by Cloudflare Worker route (`chesschat.uk/api/chess-move*`)
3. Worker processes the chess move request and returns response with `workerCallLog` metadata
4. Frontend receives response and extracts `workerCallLog` object
5. Frontend stores log via `gameStore.logWorkerCall()` to `debugInfo.workerCalls` array
6. Admin portal's Worker Calls tab reads from `debugInfo.workerCalls` and displays:
   - Total call count
   - Success rate (worker vs fallback %)
   - Average latency
   - Individual call details (timestamp, request, response, errors)

## Actual Behavior

1. ✅ CPU moves execute successfully
2. ✅ Moves complete in 3-4 seconds each
3. ❌ API returns 503 Service Unavailable errors
4. ❌ All moves use "fallback main_thread" source
5. ❌ Worker Calls tab shows 0 total calls
6. ❌ No worker call logs appear in admin portal
7. ❌ Worker dashboard shows requests with 0ms CPU time (immediate failure)

**Production Deployment:** `https://a43f8c95.chesschat-web.pages.dev`  
**Asset Hash:** `index-mCr5YEVY.js`  
**Worker Version:** `a05a0f35-cb70-4cd3-a9ba-ea6a4452d974`

## System Architecture

### Components
- **Cloudflare Pages:** chesschat-web (hosting frontend + Pages Functions)
- **Cloudflare Worker:** walle-assistant-production (chess engine)
- **Worker Route:** `chesschat.uk/api/chess-move*` (specific, intercepts before Pages Functions)
- **Service Binding:** `WALLE_ASSISTANT` → `walle-assistant-production` (configured in Dashboard)
- **Frontend:** React/TypeScript with Zustand store (gameStore)

### Expected Data Flow

```
User Makes Move
    ↓
Frontend (CoachingMode.tsx or gameStore.makeAIMove)
    ↓
POST /api/chess-move
    ↓
Cloudflare Worker Route (chesschat.uk/api/chess-move*)
    ↓
worker-assistant/src/index.ts handleChessMove()
    ↓
Worker returns response with workerCallLog
    ↓
Frontend receives response
    ↓
Extract workerCallLog from response
    ↓
Store to gameStore.debugInfo.workerCalls via logWorkerCall()
    ↓
Admin Portal reads from gameStore.debugInfo.workerCalls
    ↓
Display in Worker Calls tab
```

## Troubleshooting Steps Taken

### Step 1: Initial Discovery (December 27, 2025)
**Action:** Checked admin portal Worker Calls tab  
**Finding:** Tab showed "No worker calls recorded yet" with 0 total calls  
**Observation:** CPU moves were working successfully, but no logging occurred

### Step 2: Verified API Response Structure
**Action:** Reviewed `functions/api/chess-move.ts` fallback response  
**Finding:** When using local fallback engine, response did NOT include `workerCallLog` object  
**Impact:** Frontend had no data to capture, even when fallback was used  
**Code Location:** `functions/api/chess-move.ts` (lines 337-356)

**Fix Applied:** Added `workerCallLog` to fallback response:
```typescript
workerCallLog: {
  endpoint: '/api/chess-move',
  method: 'POST',
  success: false,
  latencyMs: latencyMs,
  error: 'Worker service binding not available - used local fallback engine',
  request: { fen, difficulty: difficultyLevel, gameId: gameSession.gameId },
  response: { move: selectedMove, mode: 'local-fallback', engine: 'wall-e' }
}
```

### Step 3: Verified Frontend Capture Logic (Coaching Mode)
**Action:** Reviewed `src/components/CoachingMode.tsx` worker log handling  
**Finding:** Component was reading `apiData.workerCallLog?.success` to determine source but NEVER stored the full `workerCallLog` object  
**Impact:** Even if API returned workerCallLog, coaching mode wasn't saving it  
**Code Location:** `src/components/CoachingMode.tsx` (lines 400-445)

**Fix Applied:** Added capture and storage logic:
```typescript
if (apiData.workerCallLog) {
  store.getState().logWorkerCall({
    endpoint: apiData.workerCallLog.endpoint,
    method: apiData.workerCallLog.method,
    success: apiData.workerCallLog.success,
    latencyMs: apiData.workerCallLog.latencyMs,
    error: apiData.workerCallLog.error,
    request: apiData.workerCallLog.request,
    response: apiData.workerCallLog.response,
  });
  console.log('[CPU Move] Worker call logged:', apiData.workerCallLog);
}
```

### Step 4: Verified GameStore Logic (VS-CPU Mode)
**Action:** Reviewed `src/store/gameStore.ts` makeAIMove function  
**Finding:** Code already had logging logic at line 397:
```typescript
if (response.workerCallLog) {
  get().logWorkerCall(response.workerCallLog);
}
```
**Observation:** Should have been working for vs-cpu mode once fallback response was fixed  
**Status:** Expected to work after Step 2 fix

### Step 5: First Production Deployment
**Action:** Built and deployed changes from Steps 2-4  
**Deployment:** `2e7d3291.chesschat-web.pages.dev`  
**Testing Result:** Worker Calls tab still showed 0 calls  
**New Finding:** API was returning 503 Service Unavailable errors

### Step 6: Worker Route Investigation
**Action:** Checked Cloudflare Worker dashboard analytics  
**Finding:** Worker was receiving requests but showing 0ms CPU time (immediate failure/404)  
**Analysis:** Worker was intercepting requests but not handling them properly  
**Root Cause:** Worker only had `/assist/chess-move` route, but public requests use `/api/chess-move`

### Step 7: Added Public API Route to Worker
**Action:** Modified `worker-assistant/src/index.ts` to handle both routes  
**Code Added:**
```typescript
// Handle public /api/chess-move route
if (url.pathname === '/api/chess-move') {
  return handleChessMove(request, env);
}

// Handle service binding /assist/chess-move route
if (url.pathname === '/assist/chess-move') {
  return handleChessMove(request, env);
}
```
**Worker Location:** Lines 187-262  
**Deployment:** Worker version `a05a0f35-cb70-4cd3-a9ba-ea6a4452d974`

### Step 8: Added Worker Logs to All Worker Responses
**Action:** Ensured worker returns `workerCallLog` in success, validation error, and exception responses  
**Implementation:** All three response paths in worker include comprehensive logging:
```typescript
workerCallLog: {
  endpoint: '/api/chess-move',
  method: 'POST',
  success: true/false,
  latencyMs: elapsed,
  error: errorMessage, // if applicable
  request: { fen, difficulty, gameId },
  response: { move, depthReached, evaluation }
}
```

### Step 9: Multiple Deployment Attempts
**Deployments Made:**
- `2e7d3291.chesschat-web.pages.dev` (initial fixes)
- `a43f8c95.chesschat-web.pages.dev` (current, with all fixes)

**Worker Deployments:**
- Version: `a05a0f35-cb70-4cd3-a9ba-ea6a4452d974`

**Consistent Issue:** 503 errors persist across all deployments

### Step 10: Added Error Handler Logging
**Action:** Modified `src/store/gameStore.ts` error catch block (lines 470-500)  
**Purpose:** Log failed API calls even when worker/API throws errors  
**Code Added:**
```typescript
catch (error) {
  lastError = error instanceof Error ? error : new Error(String(error));
  cpuLogger.error(`CPU move error (attempt ${retries + 1})`, lastError);
  
  const latencyMs = state.debugInfo.lastApiCall ? Date.now() - state.debugInfo.lastApiCall.timestamp : 0;
  
  // Log failed API call as worker call (even if it didn't reach the worker)
  get().logWorkerCall({
    endpoint: '/api/chess-move',
    method: 'POST',
    success: false,
    latencyMs,
    error: lastError?.message || 'API call failed',
    request: {
      fen: state.chess.getFEN().substring(0, 50),
      model: state.selectedModel.modelIdentifier,
      gameId: state.gameId || 'unknown'
    },
    response: undefined
  });
}
```

### Step 11: Final Production Deployment
**Action:** Built and deployed all fixes  
**Build Output:**
- Hash: `BCxQM6p3` → Asset: `index-mCr5YEVY.js`
- Size: 358.61 kB
- Build successful with CSS warnings (non-blocking)

**Deployment:** `https://a43f8c95.chesschat-web.pages.dev`  
**Files Uploaded:** 7 files (6 already cached)

### Step 12: Production Testing
**Test Performed:** User played 15 moves on latest deployment  
**Game Log Analysis:**
- Moves 1-11: Succeeded with fallback, no API errors logged
- Moves 12-15: 503 Service Unavailable errors, still succeeded with fallback
- All moves showed "fallback main_thread" source
- Response times: 3-4 seconds per move
- **Critical Finding:** Worker Calls tab still showed 0 calls

### Step 13: Verification Check Needed (PENDING)
**Identified Need:** Browser DevTools console inspection  
**Purpose:** Determine if JavaScript errors are preventing `logWorkerCall()` execution  
**Tests Required:**
1. Open browser console (F12) during CPU move
2. Check for JavaScript errors
3. Test gameStore accessibility: `window.gameStore.getState().debugInfo.workerCalls`
4. Verify if logWorkerCall() method exists and is callable

**Status:** Awaiting user completion

## Current State Summary

### What We Know
1. ✅ All code changes deployed to production
2. ✅ Worker deployed with both `/api/chess-move` and `/assist/chess-move` routes
3. ✅ Worker returns `workerCallLog` in all response types
4. ✅ Frontend has capture code in both CoachingMode and gameStore
5. ✅ Error handlers log failed API calls
6. ✅ Admin portal Worker Calls tab UI implemented
7. ❌ API consistently returns 503 Service Unavailable
8. ❌ No logs appear in Worker Calls tab (0 calls)
9. ❌ All moves use fallback instead of worker

### What We Don't Know
1. ❓ Why API returns 503 errors
2. ❓ Why worker shows 0ms CPU time (immediate failure)
3. ❓ Whether `logWorkerCall()` is executing without errors
4. ❓ Whether gameStore is properly initialized
5. ❓ Whether data is being written but not persisting
6. ❓ Whether browser console shows JavaScript errors
7. ❓ Why worker route intercepts but doesn't process requests

### Potential Root Causes (Unconfirmed)
- Worker route configuration issue
- Service binding not properly connected
- API 503 errors returning malformed response bodies
- `await response.json()` throwing before error handler
- gameStore not initialized when logWorkerCall() is called
- State management issue (data written but cleared)
- Timing issue (admin portal reads before data written)
- JavaScript error preventing execution

## Configuration Details

### Worker Route
- **Pattern:** `chesschat.uk/api/chess-move*`
- **Type:** Specific (not broad `/api/*`)
- **Purpose:** Intercept chess move requests before Pages Functions
- **Status:** Deployed and active

### Service Binding
- **Name:** `WALLE_ASSISTANT`
- **Target:** `walle-assistant-production`
- **Configuration:** Cloudflare Dashboard → Pages → Settings → Functions → Bindings
- **Not in wrangler.toml:** Service bindings for Pages configured in Dashboard only

### Deployment URLs
- **Latest Pages:** `https://a43f8c95.chesschat-web.pages.dev`
- **Custom Domain:** `chesschat.uk` (may be cached to older deployment)
- **Worker Dashboard:** Shows requests with 0ms CPU time

## Related Documentation

- [WORKER_LOGGING_PROBLEM.md](WORKER_LOGGING_PROBLEM.md) - Detailed technical documentation and implementation changes
- [HYBRID_DEPLOYMENT_GUIDE.md](HYBRID_DEPLOYMENT_GUIDE.md) - Service binding setup instructions
- [DEBUG_PANEL_ENHANCEMENT.md](DEBUG_PANEL_ENHANCEMENT.md) - Debug panel features and specifications

## Diagnostic Artifacts

### Game Log Sample (Move 12 - 503 Error)
```
[2025-12-27 ~time] Making CPU move...
[2025-12-27 ~time] API returned 503: Service Unavailable
[2025-12-27 ~time] CPU moved: e2e4
[2025-12-27 ~time] Move source: fallback main_thread
[2025-12-27 ~time] Response time: ~3.4 seconds
```

### Worker Dashboard Metrics
- Requests: Multiple (exact count varies)
- CPU Time: 0ms (all requests)
- Status: 404/503 errors
- Pattern: Immediate failure, no processing

### Admin Portal State
- Worker Calls tab: "No worker calls recorded yet"
- Total calls: 0
- Success rate: N/A (no data)
- Debug panel: Shows "fallback main_thread" for all moves

---

**Next Diagnostic Step:** Browser console inspection to verify JavaScript execution and gameStore state
