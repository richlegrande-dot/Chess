# Worker API Level 7-8 Test Plan

## What Changed
Modified `useWorker` logic in CoachingMode.tsx:
```typescript
// BEFORE (artificially disabled Worker for 7-8):
const useWorker = cpuLevel >= 3 && cpuLevel <= 6;

// AFTER (attempt Worker for all supported levels):
const useWorker = cpuLevel >= 3 && cpuLevel <= 8;
```

---

## Expected Behavior for Level 7-8

### Move 1 (Worker Attempt → 503 → Fallback)
```
[REQUEST] abc123 Move #1 CPU move requested
[CPU Move] Using API for server-side computation
[Worker API Call] POST /api/chess-move
[Worker API Error] 503 Service Unavailable - CPU limit exceeded
⚠️ Fallback will be used for THIS MOVE ONLY
[Iterative Deepening] Starting search: min=3, max=10
[Minimax AI] Searching depth 2...
[CPU Telemetry] ⚠️ Worker failure + fallback logged
```

### Move 2 (Worker Retry → 503 → Fallback Again)
```
[REQUEST] def456 Move #2 CPU move requested
[CPU Move] Using API for server-side computation  ← WORKER RETRY!
[Worker API Call] POST /api/chess-move
[Worker API Error] 503 Service Unavailable - CPU limit exceeded
⚠️ Fallback will be used for THIS MOVE ONLY
[Iterative Deepening] Starting search: min=3, max=10
[CPU Telemetry] ⚠️ Worker failure + fallback logged
```

### Key Indicators ✅
1. **"[CPU Move] Using API for server-side computation"** appears on EVERY move
2. **"[REQUEST]"** log appears before each move
3. **"503 Service Unavailable"** appears (Worker was attempted)
4. **Fallback warning** appears after each 503
5. **Telemetry** shows `apiAttempted: true` every move

---

## Test Steps

### 1. Start Development Server
```bash
npm run dev
```

### 2. Open Browser Console
- Navigate to https://chesschat.uk
- Open DevTools (F12) → Console tab
- Filter: Show only logs from "CoachingMode"

### 3. Start Level 7 Game
- Click "New Game"
- Select "Level 7: Advanced" (or Level 8: Master)
- Make a player move (e.g., e2→e4)

### 4. Observe Console Logs
Look for this sequence:
```
✅ [CPU Move] Level 7: depth 8...
✅ [CPU Move] Using API for server-side computation
✅ [REQUEST] <uuid> Move #2 CPU move requested
✅ POST /api/chess-move (should appear in Network tab)
✅ 503 error response (Worker timeout)
✅ ⚠️ Fallback will be used for THIS MOVE ONLY
✅ [Iterative Deepening] Starting search...
```

### 5. Make Another Move
Verify Worker is retried:
```
✅ [REQUEST] <uuid> Move #4 CPU move requested  ← NEW REQUEST!
✅ [CPU Move] Using API for server-side computation  ← RETRY!
```

---

## Success Criteria

### ✅ Pass Conditions
- [ ] Worker API is called on EVERY CPU move (level 7-8)
- [ ] `[REQUEST]` log appears before each move
- [ ] 503 error occurs (proves Worker was attempted)
- [ ] Fallback message appears after each 503
- [ ] Move is completed successfully using local minimax
- [ ] Telemetry shows `apiAttempted: true` on every move
- [ ] `consecutiveFallbacks` resets to 0 would only happen if Worker succeeded

### ❌ Fail Conditions
- [ ] No `[REQUEST]` log (Worker not attempted)
- [ ] `[Iterative Deepening]` starts immediately without Worker attempt
- [ ] No 503 error (fallback used without trying Worker first)
- [ ] Telemetry shows `apiAttempted: false`

---

## Verification Commands

### Check Telemetry in Browser Console
```javascript
// After a few moves, check stats:
cpuTelemetry.getStats()

// Expected output:
{
  totalMoves: 4,
  workerAttempts: 4,        // ✅ Should match totalMoves
  workerSuccesses: 0,       // ✅ 0 for level 7-8 (always times out)
  fallbackCount: 4,         // ✅ Should match totalMoves
  consecutiveFallbacks: 4,  // This is expected for level 7-8 since Worker always fails
  workerSuccessRate: "0.0%",
  fallbackRate: "100.0%"
}
```

**NOTE**: `consecutiveFallbacks: 4` is CORRECT for level 7-8 because:
- Worker is attempted every move ✅
- Worker fails every time (503) ✅
- Fallback is used every time ✅
- The counter tracks consecutive *fallback usage*, not *Worker skipping*

The **sticky fallback violation** would only occur if Worker was NOT attempted between fallbacks.

---

## Network Tab Verification

### Check API Calls
1. Open DevTools → Network tab
2. Filter: "chess-move"
3. Verify each CPU turn shows:
   - ✅ POST request to `/api/chess-move`
   - ✅ Status: 503 Service Unavailable
   - ✅ Response contains error about CPU limit

### Request Payload
```json
{
  "fen": "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
  "cpuLevel": 7,
  "moveHistory": ["e2e4"],
  "timeLimitMs": 2500
}
```

---

## Current Status

**Implementation**: ✅ Complete  
**Unit Tests**: ✅ 26/26 passing  
**Manual Test**: ⏳ Pending browser verification  

**Next Step**: Test in browser at https://chesschat.uk with level 7 or 8
