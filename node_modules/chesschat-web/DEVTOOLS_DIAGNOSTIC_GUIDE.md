# DevTools Diagnostic Logging Guide

**Enhanced logging for troubleshooting worker call logging issues**

## What Changed

Added comprehensive diagnostic logging throughout the worker call capture flow to help identify where the logging is failing.

## How to Use

1. Open the game: https://chesschat.uk
2. Open DevTools (F12) → Console tab
3. Start a game vs CPU
4. Make a move (let CPU respond)
5. Look for the diagnostic logs below

## Expected Log Sequence

When a CPU move is made, you should see these logs in order:

### 1. API Response Structure
```
[DIAGNOSTIC] API Response: {
  hasMove: true,
  move: "e2e4",
  hasWorkerCallLog: true,  // ← KEY: Should be true
  workerCallLog: { ... },
  mode: "service-binding",  // ← KEY: Should be "service-binding" not "local-fallback"
  engine: "worker",
  hasDiagnostics: true,
  diagnostics: { depthReached: 3, ... }
}
```

**What to check:**
- `hasWorkerCallLog` should be `true`
- `mode` should be `"service-binding"` (if Worker is working)
- `workerCallLog.success` should be `true`

### 2. GameStore Availability Check
```
[DIAGNOSTIC] gameStore is available, attempting to log worker call
[DIAGNOSTIC] Current worker calls count: 0
```

**What to check:**
- Should say "available" not "❌ gameStore not available"
- Shows current count before logging

### 3. Worker Call Logging
```
[DIAGNOSTIC] Calling logWorkerCall() with: {
  endpoint: "/api/chess-move",
  method: "POST",
  success: false,  // false = fallback, true = worker
  latencyMs: 3421,
  error: "Worker service binding not available...",
  request: { ... },
  response: { ... }
}
```

### 4. logWorkerCall Execution
```
[DIAGNOSTIC] 🎯 logWorkerCall() CALLED with: { ... }
[DIAGNOSTIC] Current state before logging: {
  workerCallsCount: 0,
  workerCalls: []
}
[DIAGNOSTIC] Creating new call object: { ... }
[DIAGNOSTIC] Worker calls array: {
  previousCount: 0,
  newCount: 1,
  newCall: { ... }
}
[Worker Call] POST /api/chess-move: {
  success: false,
  latency: "3421ms",
  error: "Worker service binding not available..."
}
[DIAGNOSTIC] ✅ Returning new state with 1 worker calls
```

**What to check:**
- `logWorkerCall()` is actually called (🎯 emoji)
- `previousCount` increments to `newCount`
- No errors thrown

### 5. Verification After Logging
```
[DIAGNOSTIC] After logging, worker calls count: 1
[CPU Move] ✅ Worker call logged: { ... }
```

**What to check:**
- Count should increment from 0 → 1 → 2, etc.
- Should see ✅ success emoji

## Common Issues & What to Look For

### Issue 1: No workerCallLog in Response
```
[DIAGNOSTIC] API Response: {
  hasMove: true,
  hasWorkerCallLog: false,  // ❌ BAD
  workerCallLog: undefined
}
[DIAGNOSTIC] No workerCallLog in response, logging fallback
```

**Cause:** API endpoint not returning `workerCallLog` field  
**Fix:** Check [functions/api/chess-move.ts](../functions/api/chess-move.ts) - ensure all response paths include `workerCallLog`

### Issue 2: gameStore Not Available
```
[DIAGNOSTIC] ❌ gameStore not available on window
[DIAGNOSTIC] window type: undefined
[DIAGNOSTIC] window.gameStore: undefined
```

**Cause:** gameStore not exposed on window object  
**Fix:** Check [src/App.tsx](../src/App.tsx) - ensure gameStore is attached to window:
```typescript
if (typeof window !== 'undefined') {
  (window as any).gameStore = useGameStore;
}
```

### Issue 3: logWorkerCall Not Called
```
[DIAGNOSTIC] gameStore is available, attempting to log worker call
// ... but no "🎯 logWorkerCall() CALLED" message
```

**Cause:** Exception thrown before logWorkerCall execution  
**Look for:** Error messages between "attempting to log" and the missing 🎯  
**Fix:** Check the error details in console

### Issue 4: State Not Updating
```
[DIAGNOSTIC] 🎯 logWorkerCall() CALLED with: { ... }
[DIAGNOSTIC] Current state before logging: { workerCallsCount: 0 }
[DIAGNOSTIC] ✅ Returning new state with 1 worker calls
// Move 2:
[DIAGNOSTIC] Current state before logging: { workerCallsCount: 0 }  // ❌ Still 0!
```

**Cause:** Zustand store not persisting state  
**Possible causes:**
- State middleware issue
- LocalStorage quota exceeded
- Browser in private/incognito mode

### Issue 5: Admin Portal Not Reading State
```
// Logs show count: 5
[DIAGNOSTIC] After logging, worker calls count: 5

// But admin portal shows: 0 calls
```

**Cause:** Admin portal reading from wrong source  
**Fix:** Check [src/components/admin/WorkerCallsTab.tsx](../src/components/admin/WorkerCallsTab.tsx)  
**Check if:** Using persistent API (`/api/admin/worker-calls`) or in-memory (`debugInfo.workerCalls`)

## Testing Checklist

After deploying, open DevTools and verify:

- [ ] All `[DIAGNOSTIC]` logs appear in sequence
- [ ] `hasWorkerCallLog: true` in API response
- [ ] `mode: "service-binding"` (not "local-fallback")
- [ ] gameStore is available on window
- [ ] `logWorkerCall()` called (see 🎯 emoji)
- [ ] `workerCallsCount` increments after each move
- [ ] Admin portal shows same count as diagnostic logs
- [ ] No JavaScript errors in console

## Disabling Diagnostic Logs

Once the issue is resolved, you can search for `[DIAGNOSTIC]` in the codebase and:
- Comment out the console.log statements
- OR wrap them in a debug flag: `if (DEBUG_LOGGING) console.log(...)`

## Files Modified

Diagnostic logging added to:
- [src/components/CoachingMode.tsx](../src/components/CoachingMode.tsx) - Lines ~400-500
- [src/store/gameStore.ts](../src/store/gameStore.ts) - Lines ~380-420, ~850-900

## Related Documentation

- [TROUBLESHOOTING_WORKER_VS_PAGES.md](./TROUBLESHOOTING_WORKER_VS_PAGES.md) - Full debugging guide
- [HYBRID_ARCHITECTURE_FIX.md](./HYBRID_ARCHITECTURE_FIX.md) - Architecture fixes
- [PROBLEM_STATEMENT.md](./PROBLEM_STATEMENT.md) - Original issue description
