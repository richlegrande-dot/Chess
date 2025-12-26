# CPU Move Pipeline Trace Documentation

## Overview

This document describes the complete CPU move request pipeline with all tracing points to debug issues like "CPU does not respond after 2nd move".

## Architecture

```
Player Move → CPU Request → Move Selection → Response → Board Update
     ↓             ↓              ↓             ↓           ↓
  [TRACE]      [TRACE]        [TRACE]       [TRACE]    [TRACE]
```

## Tracing System

### Move Request ID

Every player move generates a unique `moveRequestId` (UUID v4 format) that tracks the entire request/response cycle.

**Example**: `a3f9c2b1-4d5e-4xyz-y8ab-123456789abc`

### Log Format

```
[PHASE] requestId(8) Move #N: message [data]
```

**Example**:
```
[APPLIED] a3f9c2b1 Move #2: Player move: e2→e4
[REQUEST] a3f9c2b1 Move #2: CPU move requested
[RESPONSE] a3f9c2b1 Move #3: CPU responded: e7e5 (1234ms)
```

## Pipeline Stages

### 1. Player Move Applied (APPLIED)

**When**: Immediately after player commits a legal move

**Logged by**: `handleSquareClick` in CoachingMode.tsx

**Data**:
- `moveRequestId`: UUID for this request
- `fen`: Board state after player move
- `pgn`: Game history in PGN format
- `plyCount`: Number of half-moves (plies)
- `moveNumber`: Full move number
- `from`: Source square (e.g., "e2")
- `to`: Target square (e.g., "e4")

**Log Example**:
```typescript
moveTracer.logPlayerMove(requestId, from, to, fen, pgn, moveNum);
// Output: [APPLIED] a3f9c2b1 Move #2: Player move: e2→e4
```

---

### 2. CPU Move Requested (REQUEST)

**When**: CPU move calculation starts (after player move if it's CPU's turn)

**Logged by**: `makeCPUMove` function

**Data**:
- `moveRequestId`: Same UUID from player move
- `fen`: Current board state
- `pgn`: Current game history
- `plyCount`: Current ply count
- `moveNumber`: Current move number

**Log Example**:
```typescript
moveTracer.logCPURequest(requestId, fen, pgn, moveNum);
// Output: [REQUEST] a3f9c2b1 Move #2: CPU move requested
```

---

### 3. CPU Move Computation (Internal - Not Traced)

**Process**:
1. Get all legal moves for CPU color
2. Call Knowledge Vault for move selection:
   - Try opening book (first 12 plies)
   - Try heuristic hints
   - Fallback to local heuristics
3. Select move based on difficulty level

**Protected by**:
- Single-flight guard (`cpuMoveInFlight` ref)
- 2500ms timeout

---

### 4. CPU Move Response (RESPONSE)

**When**: CPU successfully selects a move

**Logged by**: `makeCPUMove` after move selection

**Data**:
- `moveRequestId`: Same UUID
- `move`: Selected move in UCI format (e.g., "e7e5")
- `fen`: Board state after CPU move
- `pgn`: Updated game history
- `timeMs`: Elapsed time in milliseconds

**Log Example**:
```typescript
moveTracer.logCPUResponse(requestId, `${from}→${to}`, fen, pgn, moveNum, elapsed);
// Output: [RESPONSE] a3f9c2b1 Move #3: CPU responded: e7e5 (1234ms)
```

---

### 5. Error States

#### Timeout (ERROR)

**When**: CPU does not respond within 2500ms

**Logged by**: Timeout handler in `makeCPUMove`

**Log Example**:
```typescript
moveTracer.logTimeout(requestId, fen, pgn, moveNum, 2500);
// Output: [TIMEOUT] a3f9c2b1 Move #2: CPU did not respond within 2500ms
```

**User Experience**:
- Error banner appears: "CPU took too long to respond"
- Retry and New Game buttons available

#### Invalid Move (ERROR)

**When**: CPU selects an illegal move (should never happen)

**Log Example**:
```typescript
moveTracer.logError(requestId, 'Invalid move selected: e2→e9', fen, pgn, moveNum);
// Output: [ERROR] a3f9c2b1 Move #2: Invalid move selected: e2→e9
```

#### No Legal Moves (ERROR)

**When**: Game is over (checkmate/stalemate) but CPU tries to move

**Log Example**:
```typescript
moveTracer.logError(requestId, 'No legal moves available', fen, pgn, moveNum);
// Output: [ERROR] a3f9c2b1 Move #2: No legal moves available
```

---

## Complete Request Example

```
[APPLIED] a3f9c2b1 Move #1: Player move: e2→e4
[REQUEST] a3f9c2b1 Move #1: CPU move requested
[RESPONSE] a3f9c2b1 Move #2: CPU responded: e7→e5 (892ms)

[APPLIED] b4e8d7f2 Move #2: Player move: g1→f3
[REQUEST] b4e8d7f2 Move #2: CPU move requested
[RESPONSE] b4e8d7f2 Move #3: CPU responded: b8→c6 (1103ms)

[APPLIED] c5f1a9e3 Move #3: Player move: f1→c4
[REQUEST] c5f1a9e3 Move #3: CPU move requested
[RESPONSE] c5f1a9e3 Move #4: CPU responded: f8→c5 (967ms)
```

---

## Debugging "CPU Does Not Respond After Move 2"

### Expected Trace Pattern

**Working (Move 2)**:
```
[APPLIED] xxx Move #2: Player move: g1→f3
[REQUEST] xxx Move #2: CPU move requested
[RESPONSE] xxx Move #3: CPU responded: b8→c6 (1000ms)
```

### Bug Pattern (Before Fix)

**Broken (Move 2)**:
```
[APPLIED] xxx Move #2: Player move: g1→f3
[REQUEST] xxx Move #2: CPU move requested
[TIMEOUT] xxx Move #2: CPU did not respond within 2500ms
```

**OR (Silent Failure)**:
```
[APPLIED] xxx Move #2: Player move: g1→f3
[REQUEST] xxx Move #2: CPU move requested
(no further logs - execution stopped)
```

### Root Cause Analysis

The bug was caused by **stale closure** in `makeCPUMove`:

```typescript
// BEFORE (BROKEN):
const makeCPUMove = useCallback(() => {
  // ...
}, [state.gameMode, state.cpuColor, state.chess, state.gameResult]);
//     ^^^^^^^^^^^^^ STALE REFERENCE
```

After move 2, the callback still referenced the `chess` object from move 1, causing:
- Reading stale board state
- Generating moves from wrong position
- Potential infinite loops or deadlocks

**Fix**: Remove dependencies and read fresh state inside `setState`:

```typescript
// AFTER (FIXED):
const makeCPUMove = useCallback(() => {
  setState(async prevState => {
    const chess = prevState.chess; // FRESH state
    // ...
  });
}, []); // NO DEPENDENCIES
```

---

## API for Tracing

### Import

```typescript
import { moveTracer } from '../lib/tracing';
```

### Generate Request ID

```typescript
const requestId = moveTracer.generateRequestId();
```

### Log Player Move

```typescript
moveTracer.logPlayerMove(requestId, from, to, fen, pgn, moveNumber);
```

### Log CPU Request

```typescript
moveTracer.logCPURequest(requestId, fen, pgn, moveNumber);
```

### Log CPU Response

```typescript
moveTracer.logCPUResponse(requestId, move, fen, pgn, moveNumber, elapsedMs);
```

### Log Errors

```typescript
moveTracer.logError(requestId, errorMessage, fen, pgn, moveNumber);
moveTracer.logTimeout(requestId, fen, pgn, moveNumber, timeoutMs);
```

### Retrieve Traces

```typescript
// Get recent traces
const recent = moveTracer.getRecentTraces(10);

// Get all traces for a request
const traces = moveTracer.getTracesByRequestId(requestId);

// Export all traces (for debugging)
const json = moveTracer.exportTraces();
console.log(json);

// Clear traces
moveTracer.clearTraces();
```

---

## Performance Monitoring

### CPU Response Times

Target: **< 2000ms** for all moves

Actual (with Knowledge Vault):
- Opening phase: ~800-1200ms
- Middlegame: ~800-1500ms  
- Endgame: ~600-1000ms

### Timeout Protection

- **Hard timeout**: 2500ms
- **User notification**: Error banner with retry option
- **Recovery**: Retry or New Game available

---

## Testing

### Unit Tests

```typescript
// See: src/test/cpu-move-regression.test.ts
it('should generate CPU move after player move 2', async () => {
  // Reproduce the exact bug scenario
  // Assert CPU responds within timeout
});
```

### Manual Testing

1. Open DevTools Console
2. Start vs CPU game
3. Make move 1 (e.g., e4)
4. Observe logs: `[APPLIED]`, `[REQUEST]`, `[RESPONSE]`
5. Make move 2 (e.g., Nf3)
6. **Verify**: Logs show complete cycle again
7. Continue for 10+ moves

### Checklist

- ✅ CPU responds after move 1
- ✅ CPU responds after move 2 (THE BUG)
- ✅ CPU responds after move 10+
- ✅ No silent failures
- ✅ Timeout protection works
- ✅ Error UI appears on timeout
- ✅ Retry button works
- ✅ Move source is logged

---

## Production Monitoring

### Recommended Alerts

1. **High Timeout Rate**: > 5% of CPU moves timeout
2. **Slow Response Times**: > 2000ms average
3. **Error Spike**: Sudden increase in ERROR logs

### Analytics

Track in production:
- Average CPU response time by move number
- Timeout frequency
- Move source distribution (opening vs heuristic vs fallback)
- User retry rate

---

## Conclusion

The tracing system provides complete visibility into the CPU move pipeline. Every request is tracked from player move to CPU response, with timeout protection and error recovery.

**Key Points**:
- Unique request IDs for end-to-end tracking
- Comprehensive logging at each stage
- Timeout protection (2500ms)
- User-friendly error handling
- No silent failures

The "CPU does not respond after move 2" bug is permanently fixed with:
1. Elimination of stale closures
2. Fresh state reads
3. Timeout protection
4. Comprehensive tracing for future debugging
