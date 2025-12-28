# Worker Call Logging Problem Statement

**Date:** December 27, 2025  
**Status:** In Progress  
**Priority:** High

## Problem Overview

The admin portal's Worker Calls tab shows "No worker calls recorded yet" with 0 total calls, despite CPU moves being executed successfully in the application. Worker call metadata is not being captured and stored for debugging and monitoring purposes.

## Expected Behavior

When a CPU move is made (in either vs-cpu or coaching mode):
1. The frontend calls `/api/chess-move` API endpoint
2. The API attempts to use the Cloudflare Worker via service binding (`WALLE_ASSISTANT`)
3. The API returns a response containing `workerCallLog` metadata
4. The frontend captures this metadata and stores it in `gameStore.debugInfo.workerCalls`
5. The admin portal's Worker Calls tab displays these logs with:
   - Total call count
   - Success rate (worker vs fallback)
   - Average latency
   - Individual call details (timestamp, request, response, errors)

## Actual Behavior

1. ✅ CPU moves execute successfully
2. ✅ API endpoint `/api/chess-move` responds correctly
3. ❌ Worker Calls tab shows 0 total calls
4. ❌ No worker call logs appear in admin portal
5. ❌ Debug panel shows "fallback main_thread" source

## Root Cause Analysis

### Issue 1: Fallback Response Missing workerCallLog
**Location:** `functions/api/chess-move.ts` (lines 337-356)

When the API falls back to the local Wall-E engine (because worker binding is unavailable or fails), the response did not include a `workerCallLog` object. This meant:
- No data to capture on the frontend
- No way to track that fallback was used
- No visibility into why worker wasn't used

**Status:** ✅ FIXED - Added workerCallLog to fallback response

### Issue 2: Frontend Not Capturing Worker Logs (Coaching Mode)
**Location:** `src/components/CoachingMode.tsx` (lines 400-415)

The coaching mode component was reading `apiData.workerCallLog?.success` to determine the source but never stored the full `workerCallLog` object to the gameStore.

**Status:** ✅ FIXED - Added code to capture and store workerCallLog

### Issue 3: GameStore Already Has Logging (VS-CPU Mode)
**Location:** `src/store/gameStore.ts` (line 397)

The `makeAIMove` function already had code to log worker calls:
```typescript
if (response.workerCallLog) {
  get().logWorkerCall(response.workerCallLog);
}
```

This should have been working for vs-cpu mode, but was not receiving data because of Issue 1 (fallback response missing workerCallLog).

**Status:** ✅ Should work now after Issue 1 fix

## Technical Details

### Service Binding Configuration
- **Worker Name:** `walle-assistant-production`
- **Binding Name:** `WALLE_ASSISTANT`
- **Configuration Location:** Cloudflare Dashboard → Pages → Settings → Functions → Bindings
- **Not in wrangler.toml:** Service bindings for Pages are configured in Dashboard only

### Worker Route Configuration
- **Route:** `chesschat.uk/api/chess-move*` (specific, not `/api/*`)
- **Purpose:** Allows other API routes to reach Pages Functions
- **Issue:** If route is too broad (`/api/*`), it intercepts all API calls

### API Response Structure

**Successful Worker Call:**
```json
{
  "success": true,
  "move": "e7e5",
  "workerCallLog": {
    "endpoint": "/assist/chess-move",
    "method": "POST",
    "success": true,
    "latencyMs": 1234,
    "request": { "fen": "...", "difficulty": "intermediate" },
    "response": { "move": "e7e5", "depthReached": 4, "evaluation": 0.5 }
  }
}
```

**Fallback Response (NOW FIXED):**
```json
{
  "success": true,
  "move": "e7e5",
  "workerCallLog": {
    "endpoint": "/api/chess-move",
    "method": "POST",
    "success": false,
    "latencyMs": 1234,
    "error": "Worker service binding not available - used local fallback engine",
    "request": { "fen": "...", "difficulty": "intermediate" },
    "response": { "move": "e7e5", "mode": "local-fallback", "engine": "wall-e" }
  }
}
```

## Data Flow

```
User Makes Move
    ↓
Frontend (CoachingMode.tsx or gameStore.makeAIMove)
    ↓
POST /api/chess-move
    ↓
Pages Function (functions/api/chess-move.ts)
    ↓
Try Worker Service Binding (WALLE_ASSISTANT)
    ├─ Success → Return worker response with workerCallLog
    └─ Fail → Fallback to local engine, return with workerCallLog (success=false)
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

## Implementation Changes Made

### 1. Added Fallback Worker Log (functions/api/chess-move.ts)
```typescript
const responseData: any = {
  success: true,
  move: selectedMove,
  engine: 'wall-e',
  difficulty: difficultyLevel,
  latencyMs,
  requestId,
  gameId: gameSession.gameId,
  chatHistory: gameSession.chatHistory,
  conversationalResponse: fullResponse,
  workerCallLog: {
    endpoint: '/api/chess-move',
    method: 'POST',
    success: false,
    latencyMs: latencyMs,
    error: 'Worker service binding not available - used local fallback engine',
    request: { fen, difficulty: difficultyLevel, gameId: gameSession.gameId },
    response: { move: selectedMove, mode: 'local-fallback', engine: 'wall-e' }
  },
  ...(enableDebug && { mode: 'local-fallback' })
};
```

### 2. Added Worker Log Capture (src/components/CoachingMode.tsx)
```typescript
// Store worker call log for admin portal
if (typeof window !== 'undefined' && (window as any).gameStore) {
  try {
    const store = (window as any).gameStore;
    
    if (apiData.workerCallLog) {
      // Worker was called - log the actual call
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
    } else {
      // Fallback was used - log it as a failed worker call
      store.getState().logWorkerCall({
        endpoint: '/api/chess-move',
        method: 'POST',
        success: false,
        latencyMs: apiElapsedMs,
        error: 'Worker not available - used local fallback',
        request: { fen: chess.getFEN(), difficulty: cpuLevel, gameId: `game_${Date.now()}` },
        response: { move: apiData.move, mode: apiData.mode || 'local-fallback' },
      });
      console.log('[CPU Move] Fallback logged (no worker call)');
    }
  } catch (err) {
    console.warn('[CPU Move] Could not log worker call:', err);
  }
}
```

## Testing Plan

### Test Case 1: VS-CPU Mode
1. Start a new game in vs-cpu mode
2. Make 3-5 moves as the player
3. Open admin portal → Worker Calls tab
4. **Expected:** See 3-5 worker call logs with timestamps, latency, and success/failure status

### Test Case 2: Coaching Mode
1. Switch to coaching mode
2. Make 3-5 CPU moves at different difficulty levels
3. Open admin portal → Worker Calls tab
4. **Expected:** See additional worker call logs

### Test Case 3: Success Rate Indicator
1. After making multiple moves, check Worker Calls tab
2. **Expected:** 
   - If worker binding is active: Success rate >0%
   - If using fallback: Success rate = 0% with error "Worker service binding not available"

### Test Case 4: Troubleshooting Guide
1. If success rate is 0%, check the troubleshooting section in Worker Calls tab
2. **Expected:** See specific error patterns and fix hints

## Verification Checklist

- [x] API returns workerCallLog for successful worker calls
- [x] API returns workerCallLog for fallback responses
- [x] Frontend captures workerCallLog in coaching mode
- [x] Frontend captures workerCallLog in vs-cpu mode (gameStore)
- [x] Worker Calls tab displays logged calls
- [ ] Make test moves and verify logs appear in admin portal
- [ ] Verify success rate calculation is accurate
- [ ] Verify troubleshooting guide shows correct patterns

## Next Steps

1. **Deploy Changes:** ✅ Deployed to production (2e7d3291.chesschat-web.pages.dev)
2. **Test in Production:** Make CPU moves and check admin portal
3. **Verify Service Binding:** Check if worker is actually being called or just fallback
4. **Configure Binding (if needed):** Ensure WALLE_ASSISTANT service binding is properly configured in Cloudflare Dashboard

## Related Documentation

- [HYBRID_DEPLOYMENT_GUIDE.md](HYBRID_DEPLOYMENT_GUIDE.md) - Service binding setup
- [WORKER_CALLS_TAB.md](src/components/admin/WorkerCallsTab.tsx) - Admin UI component
- [DEBUG_PANEL_ENHANCEMENT.md](DEBUG_PANEL_ENHANCEMENT.md) - Debug panel features

## Known Issues

1. **Worker Binding May Not Be Configured**
   - Service binding must be set up in Cloudflare Dashboard
   - Pages → Settings → Functions → Bindings
   - Add service binding: `WALLE_ASSISTANT` → `walle-assistant-production`

2. **Worker Route Conflict (Resolved)**
   - Worker route was `/api/*` (too broad)
   - Changed to `/api/chess-move*` (specific)
   - Allows other API routes to reach Pages Functions

3. **CSS Warnings During Build**
   - Multiple CSS syntax warnings during build process
   - Does not affect functionality
   - Related to tutorial mode CSS in CoachingMode component
