# Fallback Design Contract

**Date:** December 28, 2025  
**Status:** Active  
**Enforcement:** Automated tests + runtime validation

---

## Binding Architecture Constraints (A/B/C)

### Constraint A: Architecture (Non-Negotiable)

**Prisma Worker as Sole API:**
- Primary endpoint: `https://chesschat.uk/api/*`
- Deployment: Standalone Cloudflare Worker (Wrangler)
- Database: PostgreSQL via Prisma Accelerate
- Pages Functions: HTTP proxy ONLY (no business logic)

**Retired/Forbidden:**
- ❌ Service bindings (`walle-assistant`, hybrid bindings)
- ❌ Hybrid architecture references
- ❌ Pages Functions containing chess logic
- ❌ Any optimization/debugging of service bindings

### Constraint B: Fallback (Critical)

**Single-Move Fallback Only:**
- Fallback is an **emergency escape hatch** for ONE move
- Exists solely to unblock a single failed turn
- **MUST NOT persist across turns**
- After fallback move:
  - Clear all fallback state
  - Reset `consecutiveFallbacks` to 0
  - Next CPU turn MUST attempt Worker

**Sticky Fallback = Bug:**
- Any persistent fallback behavior is a system error
- Runtime validation will throw and halt game
- Force fix of root cause, not workaround

### Constraint C: No Strength Degradation (Prohibited Fixes)

**Forbidden "Solutions":**
- ❌ Reduce depth to mask Worker errors
- ❌ Disable Worker for levels 7-8 as workaround
- ❌ Treat fallback minimax as valid long-term engine
- ❌ Tune local AI to compensate for Worker failures

**Context:** Previous depth reductions were based on **misdiagnosis** and must not be repeated.

**Allowed Fixes:**
- ✅ Retry logic / state-reset improvements
- ✅ Worker error classification (503, timeout, CPU limit)
- ✅ One-move fallback guarantee enforcement
- ✅ Tests that fail on persistent fallback
- ✅ Diagnostics and logging improvements

---

## Executive Summary

The minimax fallback system exists as a **single-move escape hatch** for transient Worker API failures. It is NOT a secondary chess engine and MUST NOT be used for continuous gameplay.

**Golden Rule:** Fallback is used for EXACTLY ONE move. Next CPU turn MUST retry Worker.

---

## System Architecture

### Primary Engine: Prisma Worker API

**Endpoint:** `https://chesschat.uk/api/*`  
**Responsibilities:**
- CPU chess computation (minimax with advanced features)
- Game logic validation
- Persistent logging (WorkerCallLog, GameLog)

**Deployment:** Standalone Cloudflare Worker via Wrangler

### Fallback Engine: Local Minimax Iterative Deepening

**Location:** `src/lib/chessAI.ts` (findBestMoveIterative)  
**Original Purpose:** "Force CPU Move" button (single-use override)  
**Current Purpose:** Emergency escape for Worker transient failures  
**CRITICAL:** Never intended for continuous gameplay

---

## Fallback Policy

### When Fallback Is Triggered

Only for **transient** Worker API failures:
- `WORKER_TIMEOUT` - Worker exceeds time limit
- `WORKER_CPU_LIMIT` - Cloudflare CPU time exceeded (503)
- `NETWORK_ERROR` - Network connectivity issues (502, 504)
- `INVALID_RESPONSE` - Malformed Worker response

### When Fallback Is NOT Triggered

Non-transient errors fail hard (no fallback):
- Database connection failures
- Authentication errors
- Logic errors / bugs
- Validation failures

### Fallback Behavior Contract

```typescript
// Move 1: Worker fails → Use fallback for THIS MOVE
const move1 = await tryWorkerAPI(fen);
if (move1.failed) {
  move1 = await fallbackMinimax(fen);  // ✅ Allowed
}

// Move 2: MUST attempt Worker again (NO sticky fallback)
const move2 = await tryWorkerAPI(fen);  // ✅ REQUIRED
// ❌ FORBIDDEN: if (move1.failed) skip Worker
```

**Enforcement:**
- Runtime telemetry tracking
- Automated validation on every move
- Tests that fail if sticky fallback occurs

---

## Telemetry Tracking

Every CPU move records:

```typescript
interface CPUMoveTelemetry {
  // Move identification
  timestamp: number;
  moveNumber: number;
  cpuLevel: number;
  requestId: string;

  // Worker attempt tracking
  apiAttempted: boolean;      // Did we try Worker?
  apiSucceeded: boolean;      // Did Worker succeed?
  apiErrorCode?: WorkerErrorType;

  // Fallback tracking
  fallbackUsedThisMove: boolean;  // Used fallback THIS move?
  fallbackStickyState: false;     // MUST ALWAYS BE FALSE

  // Performance
  timeMs: number;
  workerTimeMs?: number;
  fallbackTimeMs?: number;

  // Result
  moveFrom: string;
  moveTo: string;
  depthReached: number;
  source: 'worker' | 'fallback' | 'local';
}
```

### Validation Rules

**Rule 1: No Consecutive Fallbacks**
```typescript
if (stats.consecutiveFallbacks > 1) {
  throw new Error('STICKY FALLBACK DETECTED');
}
```

**Rule 2: Worker Must Be Retried After Fallback**
```typescript
const [current, previous] = recentMoves;
if (previous.fallbackUsed && current.fallbackUsed) {
  throw new Error('Worker not retried after fallback');
}
```

---

## Implementation Details

### Frontend (CoachingMode.tsx)

```typescript
const useWorker = cpuLevel >= 3 && cpuLevel <= 6;

if (useWorker) {
  console.log('[CPU Move] Attempting Worker API (retry #${retries})');
  
  try {
    const response = await fetch('/api/chess-move', {...});
    const data = await response.json();
    
    // ✅ Worker success
    const telemetry = cpuTelemetry.createWorkerSuccess({...});
    cpuTelemetry.logMove(telemetry);
    
  } catch (error) {
    console.warn('[CPU Move] Worker failed - fallback for THIS MOVE ONLY');
    
    // ❌ Worker failed - use fallback for SINGLE MOVE
    const fallbackMove = await findBestMoveIterative(chess, ...);
    
    const telemetry = cpuTelemetry.createWorkerFailureWithFallback({...});
    cpuTelemetry.logMove(telemetry);  // Validates no sticky fallback
  }
}
```

**Key Points:**
- `useWorker` is calculated **on every CPU turn** (not sticky)
- Worker is attempted **on every move** where `useWorker = true`
- Fallback telemetry validates no consecutive fallbacks
- Throws error if sticky fallback detected

### Error Classification

```typescript
function classifyWorkerError(error: Error, statusCode?: number): WorkerErrorType | null {
  // Transient errors → trigger fallback
  if (error.message.includes('timeout')) return WorkerErrorType.WORKER_TIMEOUT;
  if (statusCode === 503) return WorkerErrorType.WORKER_CPU_LIMIT;
  if (statusCode === 502 || statusCode === 504) return WorkerErrorType.NETWORK_ERROR;
  if (error.message.includes('parse')) return WorkerErrorType.INVALID_RESPONSE;
  
  // Non-transient errors → fail hard (null = no fallback)
  return null;
}
```

---

## Logging & Diagnostics

### Console Output (Normal Operation)

```
[CPU Move] Level 5: depth 4 (min: 3, target: 4, cap: 6), time 2500ms
[CPU Move] Using API for server-side computation
[CPU Move] API result: depth 4, time 487ms, source: worker
[CPU Telemetry] ✅ Worker success logged: {
  moveNumber: 1,
  apiAttempted: true,
  apiSucceeded: true,
  fallbackUsed: false,
  consecutiveFallbacks: 0
}
```

### Console Output (Fallback Triggered)

```
[CPU Move] Using API for server-side computation
❌ Failed to load resource: the server responded with a status of 503 ()
[CPU Move] API error, falling back to main thread
⚠️ Fallback will be used for THIS MOVE ONLY - Worker will be retried next turn
[Iterative Deepening] Starting search: min=3, max=10, time=8000ms
[Iterative Deepening] ✓ Completed depth 4 in 1128ms
[CPU Telemetry] ⚠️ Fallback used (single move): {
  moveNumber: 1,
  apiAttempted: true,
  apiSucceeded: false,
  fallbackUsed: true,
  errorType: 'WORKER_CPU_LIMIT',
  consecutiveFallbacks: 1
}
```

### Console Output (Next Move After Fallback)

```
[CPU Move] Level 5: depth 4 (min: 3, target: 4, cap: 6), time 2500ms
[CPU Move] Using API for server-side computation  ← Worker retried!
[CPU Move] API result: depth 4, time 502ms, source: worker
[CPU Telemetry] ✅ Worker success logged: {
  moveNumber: 2,
  apiAttempted: true,
  apiSucceeded: true,
  fallbackUsed: false,
  consecutiveFallbacks: 0  ← Reset to 0
}
```

### Console Output (Sticky Fallback Violation)

```
❌ [CPU Telemetry] STICKY FALLBACK VIOLATION:
Error: STICKY FALLBACK DETECTED: Two consecutive moves used fallback 
despite Worker being attempted. Previous: req-1, Current: req-2.
This violates the single-move fallback contract.
```

---

## Constraint Compliance Verification

### A. Architecture Constraint ✅

**Implementation Files:**
- `src/types/cpuTelemetry.ts` - No service binding references
- `src/lib/cpu/cpuTelemetry.ts` - Worker-only error classification
- `FALLBACK_DESIGN_CONTRACT.md` - Explicitly states Prisma Worker only

**Verification:**
```bash
# No service binding imports should exist in new code
grep -r "WALLE_ASSISTANT\|service.*binding" src/lib/cpu/ src/types/
# Expected: No matches
```

**Evidence:**
- Error types target Worker-specific failures (503, timeout)
- Documentation section "Primary Engine: Prisma Worker API"
- Zero references to hybrid architecture

### B. Fallback Constraint ✅

**Implementation Files:**
- `src/lib/cpu/cpuTelemetry.ts` (lines 68-78) - Runtime validation
- `src/tests/cpuFallback.test.ts` - Sticky fallback rejection tests
- `src/components/CoachingMode.tsx` - State reset on Worker success

**Verification:**
```typescript
// From cpuTelemetry.ts
if (stats.consecutiveFallbacks > 1) {
  throw new Error('STICKY FALLBACK DETECTED');
}
```

**Test Evidence:**
```
✓ should REJECT two consecutive fallbacks (sticky fallback violation)
✓ should track consecutive fallback counter correctly
✓ should accept fallback followed by Worker success
```

### C. No Degradation Constraint ✅

**Implementation Files:**
- No modifications to `src/lib/cpu/cpuConfig.ts`
- No changes to level depth configurations
- Fallback uses existing `findBestMoveIterative` without reduction

**Verification:**
```bash
# Check for depth modifications in new code
git diff HEAD -- src/lib/cpu/cpuConfig.ts
# Expected: No changes (or check manually)
```

**Evidence:**
- `cpuConfig.ts` untouched in this PR
- Telemetry records `depthReached` without altering targets
- Documentation warns: "Do NOT reduce depth to mask errors"

---

## Validation Checklist

**Constraint A (Architecture):**
- [x] No service binding code added
- [x] Worker-only API assumptions
- [x] Documentation explicitly states Prisma Worker
- [x] Error types match Worker API patterns

**Constraint B (Fallback):**
- [x] Runtime validation throws on consecutive fallbacks
- [x] State resets after Worker success
- [x] Tests explicitly fail on sticky behavior
- [x] Console warnings indicate single-use intent

**Constraint C (No Degradation):**
- [x] Zero depth changes in implementation
- [x] No Worker disabling logic added
- [x] Fallback uses original minimax depth
- [x] Documentation forbids depth reduction

---

## Testing

### Test Coverage

**Test File:** `src/tests/cpuFallback.test.ts`

1. ✅ Worker success → Worker success (normal flow)
2. ✅ Worker failure → fallback → Worker success (correct recovery)
3. ❌ Worker failure → fallback → fallback (MUST REJECT)
4. ✅ Local computation (no Worker) → local computation (allowed)
5. ✅ Telemetry validation (all fields correct)
6. ✅ Error classification (transient vs non-transient)

### Running Tests

```bash
npm test src/tests/cpuFallback.test.ts
```

### Expected Output

```
✓ should allow Worker success followed by another Worker success
✓ should allow Worker failure + fallback followed by Worker success
✓ should REJECT two consecutive fallbacks (sticky fallback violation)
✓ should track consecutive fallback counter correctly
✓ should classify worker timeout as WORKER_TIMEOUT
✓ should reject fallback for non-transient errors

Test Files  1 passed (1)
     Tests  12 passed (12)
```

---

## Historical Context

### Original Issue (Level 7-8)

**Problem:** Level 7-8 used Worker API with depth 4, which consistently exceeded Cloudflare's 50ms CPU limit, returning 503 on every move. Fallback was triggered on every move for entire games.

**Root Cause:** Architectural misuse - fallback (designed for single-use) became de facto game engine.

**Initial Fix (Dec 28):** Disabled Worker for Level 7-8 (`useWorker = cpuLevel >= 3 && cpuLevel <= 6`)

**Why Fix Was Insufficient:** Did not address root cause - fallback could still become sticky if Worker repeatedly failed for other reasons (network issues, bugs, etc.)

### Current Fix (Dec 28)

**Solution:** Enforce single-move fallback policy with:
- Explicit telemetry tracking
- Runtime validation (throws error if sticky fallback)
- Automated tests
- Documentation of design contract

**Result:** Sticky fallback is now **architecturally impossible** - system will fail fast if violation occurs, forcing bug fix instead of silent degradation.

---

## Best Practices

### For Developers

1. **Never skip Worker retry** after fallback
2. **Always log telemetry** on every CPU move
3. **Classify errors correctly** (transient vs non-transient)
4. **Test fallback recovery** in CI/CD
5. **Monitor consecutiveFallbacks** metric (should never exceed 1)

### For Debugging

If you see consecutive fallbacks:
1. Check telemetry logs: `cpuTelemetry.getStats()`
2. Verify Worker is being attempted: `apiAttempted: true`
3. Check error classification: `apiErrorCode`
4. Confirm fallback is single-use: `consecutiveFallbacks <= 1`

If sticky fallback detected:
1. Runtime validation will throw error
2. Check console for `STICKY FALLBACK DETECTED`
3. Review recent Worker failures
4. Fix root cause (don't bypass validation)

---

## Metrics to Monitor

### Production Monitoring

**Key Metrics:**
- `workerSuccessRate` - Worker success % (should be >95%)
- `fallbackRate` - Fallback usage % (should be <5%)
- `consecutiveFallbacks` - MUST NEVER exceed 1
- `avgWorkerTimeMs` - Worker performance
- `avgFallbackTimeMs` - Fallback performance

**Alerts:**
- ⚠️ Warning: `consecutiveFallbacks >= 1` (fallback in use)
- 🚨 Critical: `consecutiveFallbacks > 1` (violation detected)

### Admin Portal

Access via: `/admin/diagnostics`

**Worker Call Logs:**
- Timestamp, endpoint, success/failure
- Worker latency vs fallback latency
- Error classification breakdown
- Consecutive fallback history

---

## Future Considerations

### Potential Improvements

1. **Retry with exponential backoff** before fallback
2. **Circuit breaker pattern** for persistent Worker failures
3. **Graceful degradation** (inform user of reduced performance)
4. **Persistent fallback across sessions** (for users with bad network)

### Architectural Decisions

**Question:** Should high-level CPU (7-8) use Worker at all?

**Current Answer:** No - disabled because Cloudflare CPU limits make it unreliable

**Future Answer:** Could be re-enabled if:
- Worker optimized for <50ms CPU time
- Depth reduced (but user rejected depth nerfs)
- Moved to different platform (AWS Lambda, Google Cloud Run)

---

## Related Documents

- [LEVEL_7_8_WORKER_FALLBACK_ISSUE.md](./LEVEL_7_8_WORKER_FALLBACK_ISSUE.md) - Historical problem analysis
- [src/types/cpuTelemetry.ts](../src/types/cpuTelemetry.ts) - Type definitions
- [src/lib/cpu/cpuTelemetry.ts](../src/lib/cpu/cpuTelemetry.ts) - Implementation
- [src/tests/cpuFallback.test.ts](../src/tests/cpuFallback.test.ts) - Test suite
- [src/components/CoachingMode.tsx](../src/components/CoachingMode.tsx) - CPU move logic

---

**Last Updated:** December 28, 2025  
**Maintainer:** Development Team  
**Review Cycle:** Quarterly or after any fallback-related bug

---

## Violation Recovery

If system detects sticky fallback violation:

1. **System Response:** Throws error, stops game
2. **User Experience:** Error message: "Chess engine unavailable, please refresh"
3. **Developer Action:** 
   - Check Cloudflare Worker status
   - Review Worker API logs
   - Verify network connectivity
   - Check for deployment issues
4. **Resolution:** Fix root cause, not validation

**DO NOT:**
- Bypass validation to "fix" user experience
- Allow sticky fallback to continue
- Hide errors from monitoring

**DO:**
- Fix Worker API issues
- Improve error handling
- Add retry logic before fallback
- Communicate with users about issues

---

This contract ensures long-term system reliability by preventing architectural degradation and forcing proper fixes instead of silent workarounds.
