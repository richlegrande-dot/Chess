# Chess Engine Timeout Issue - Production Bug Report

**Date**: December 27, 2025  
**Severity**: 🔴 **CRITICAL**  
**Status**: 🔍 **NEEDS INVESTIGATION**  
**Discovered During**: Post-deployment production testing  

---

## Executive Summary

The Wall-E chess engine is **exceeding its 750ms move generation budget by 300-400%** in opening positions, causing unacceptable user experience delays. The `CPU_MOVE_BUDGET_MS` constant exists in the codebase but is **never imported or used** by the chess engine, resulting in unbounded computation time.

---

## Problem Statement

**Expected Behavior**:
- Chess engine should generate moves within **750ms maximum** (configured in `src/lib/cpu/config.ts`)
- Consistent timeout budget across ALL difficulty levels
- Fast, responsive gameplay for users

**Actual Behavior**:
- Opening positions: **2,000-3,000ms** (2-3 seconds) ❌
- Midgame positions: **100-700ms** ✅
- Endgame positions: **80-110ms** ✅

**User Impact**:
- Frustrating delays when game starts (opening moves)
- Users may think application is frozen/broken
- Violates design principle of "Faster" gameplay

---

## Test Results

### Production Domain Tests
**Environment**: https://chesschat-web.pages.dev  
**Test Date**: December 27, 2025  
**Test Script**: `test-production-engine.mjs`

| Test | Position | Difficulty | Time (ms) | Status |
|------|----------|------------|-----------|--------|
| 1 | Opening (e4) | easy | **3,004ms** | ❌ FAIL |
| 2 | Opening (e4) | medium | **2,158ms** | ❌ FAIL |
| 3 | Midgame | medium | 717ms | ✅ PASS |
| 4 | Endgame | hard | 108ms | ✅ PASS |
| 5 | Complex Midgame | expert | 81ms | ✅ PASS |

**Statistics**:
- Total Tests: 5
- Passed: 3/5 (60%)
- Failed: 2/5 (40%)
- Average Time: 1,214ms
- Max Time: 3,004ms
- **Expected Budget**: ≤750ms (engine) + ~500ms network = **~1,500ms acceptable total**

---

## Root Cause Analysis

### 1. Configuration Constant Not Used

**File**: `src/lib/cpu/config.ts` (lines 1-13)
```typescript
export const CPU_MOVE_BUDGET_MS = 750;

export const DIFFICULTY_SETTINGS = {
  beginner: {
    candidatePoolSize: 10,
    useTacticalChecks: true,
    useBlunderGate: true,
    usePositionalHeuristics: false,
  },
  // ... more difficulty settings
```

**Problem**: This constant is **never imported** by the chess engine.

**Verification**:
```bash
# Search for CPU_MOVE_BUDGET_MS usage in functions/
grep -r "CPU_MOVE_BUDGET" functions/
# Result: NO MATCHES
```

### 2. No Timeout Logic in Chess Engine

**File**: `functions/lib/walleChessEngine.ts` (lines 136-138)
```typescript
// Evaluate all legal moves with tactical micro-checks
const evaluations: MoveEvaluation[] = legalMoves.map(move => 
  this.evaluateMove(chess, move, difficulty)
);
```

**Problem**: Engine evaluates **ALL legal moves** without time constraints.

### 3. Opening Position Complexity

Opening positions have **20+ legal moves**:
- Each move requires `evaluateMove()` call
- Each `evaluateMove()` performs `analyzeTactics()` (lines 218-278)
- `analyzeTactics()` checks opponent responses for mate-in-1 (line 239-246)
- **Computational complexity**: O(n × m) where n = our moves, m = opponent responses

**Example**:
- Opening position: 20 legal moves
- Each move generates ~20 opponent responses to check
- Total operations: 20 × 20 = **400 position evaluations**
- Result: 2-3 second delay

### 4. Why Midgame/Endgame Are Fast

Fewer legal moves → less computation:
- Endgame: 3-5 legal moves → fast (108ms)
- Complex midgame: Limited mobility → fast (81ms)
- Opening: 20+ legal moves → slow (3,004ms)

---

## Technical Context

### Current Engine Architecture

**Main Entry Point**: `WalleChessEngine.selectMove()` (line 123)
```typescript
static selectMove(
  fen: string,
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'master' = 'intermediate',
  conversational: boolean = false
): { move: string; commentary?: string }
```

**Move Evaluation Flow**:
1. Get all legal moves (line 130)
2. **Evaluate EVERY move** with full tactical analysis (line 136-138)
3. Apply blunder gate (line 141)
4. Sort by score (line 144)
5. Select based on difficulty with weighted randomness (line 147-176)

**Tactical Analysis Per Move** (`analyzeTactics()` method):
- Create position copy
- Check if move delivers checkmate
- **Iterate through ALL opponent responses** to find mate-in-1
- Check for hanging pieces (queen, rook, bishop, knight)
- Complexity: O(m) where m = opponent legal moves

### What Was Recently Changed

**Optimization Session** (Commit 3878673):
- ✅ Added tactical micro-checks (hanging pieces, mate-in-1)
- ✅ Added blunder gate
- ✅ Created `CPU_MOVE_BUDGET_MS` constant
- ❌ **Did NOT implement timeout enforcement logic**

### Files Involved

1. **`src/lib/cpu/config.ts`** - Contains unused `CPU_MOVE_BUDGET_MS = 750`
2. **`functions/lib/walleChessEngine.ts`** - Chess engine (no timeout logic)
3. **`functions/api/chess-move.ts`** - API endpoint that calls engine

---

## Proposed Solutions

### Option 1: Implement Time-Based Move Selection (RECOMMENDED)

Add timeout logic to `selectMove()`:
```typescript
static selectMove(fen: string, difficulty: string, conversational: boolean) {
  const startTime = Date.now();
  const budget = CPU_MOVE_BUDGET_MS; // Import from config
  
  // Evaluate moves until budget expires
  const evaluations = [];
  for (const move of legalMoves) {
    if (Date.now() - startTime > budget * 0.9) break; // 90% budget threshold
    evaluations.push(this.evaluateMove(chess, move, difficulty));
  }
  
  // If we didn't evaluate all moves, add unevaluated moves with neutral scores
  // ... continue with existing logic
}
```

**Pros**: 
- Guarantees timeout compliance
- Works for all position types
- Graceful degradation (evaluates as many as possible)

**Cons**: 
- May not evaluate all moves in complex positions
- Requires fallback for unevaluated moves

### Option 2: Reduce Tactical Analysis Depth

Simplify `analyzeTactics()` to skip opponent response checking:
```typescript
// Instead of checking ALL opponent moves for mate-in-1:
const opponentMoves = gameCopy.moves({ verbose: true });
for (const opMove of opponentMoves) {
  // ... this loop is expensive
}

// Use faster heuristic: just check if WE'RE in check after our move
if (gameCopy.inCheck()) {
  result.allowsMateIn1 = true; // Approximation
}
```

**Pros**: 
- Much faster (no nested move generation)
- Simpler code

**Cons**: 
- Less accurate mate-in-1 detection
- May miss tactical opportunities

### Option 3: Move Pruning Before Evaluation

Pre-filter obviously bad moves before tactical analysis:
```typescript
// Quick material-only evaluation (fast)
const quickScores = legalMoves.map(m => this.quickEval(chess, m));
const topN = 15; // Only evaluate top 15 moves deeply

// Then do expensive tactical analysis on fewer moves
const evaluations = quickScores
  .sort((a, b) => b.score - a.score)
  .slice(0, topN)
  .map(m => this.evaluateMove(chess, m, difficulty));
```

**Pros**: 
- Reduces computational load
- Still evaluates best candidates thoroughly

**Cons**: 
- Risk of pruning away surprising tactical moves
- Adds complexity

### Option 4: Combine All Approaches

1. Import `CPU_MOVE_BUDGET_MS` from config
2. Add move pruning (top 15 candidates)
3. Implement time-based evaluation loop
4. Simplify tactical analysis (skip some opponent checks)

**Pros**: 
- Defense in depth
- Best performance
- Guaranteed timeout compliance

**Cons**: 
- Most code changes
- More testing required

---

## Questions for Next Agent

1. **Which solution approach should we implement?** (Recommend Option 4)

2. **Should we keep full mate-in-1 detection?** It's expensive but catches critical tactics.

3. **How should we handle unevaluated moves?** Assign neutral score, evaluate with simpler heuristic, or skip entirely?

4. **Do we need different budgets per difficulty?** Currently all levels use same 750ms budget.

5. **Should we add telemetry?** Track actual computation times to monitor improvements.

---

## Verification Steps

After implementing fix:

### 1. Local Testing
```bash
# Run integrity checks
node scripts/verify-walle-integrity.mjs

# Build and check TypeScript
npm run build
```

### 2. Production Testing
```bash
# Run timeout tests
node test-production-engine.mjs

# Expected results:
# - All tests ≤1,500ms (750ms engine + 750ms network buffer)
# - Opening positions ≤1,000ms (improved from 3,000ms)
```

### 3. Functional Testing
- Opening position: Should respond quickly (not 3 seconds)
- Engine should still play reasonable moves (not random garbage)
- Blunder gate should still work (no hanging queen)
- Mate-in-1 detection should work (if kept in solution)

---

## Deployment Checklist

- [ ] Import `CPU_MOVE_BUDGET_MS` from `src/lib/cpu/config.ts`
- [ ] Implement timeout enforcement in `selectMove()`
- [ ] Add move pruning or tactical analysis optimization
- [ ] Update `verify-walle-integrity.mjs` to check timeout compliance
- [ ] Run full test suite locally
- [ ] Test production endpoints after deployment
- [ ] Monitor Cloudflare Workers CPU time metrics

---

## Additional Context

### Recent Optimization Session

This issue was discovered after deploying **Wall-E optimization improvements** (commits 3878673 and 53be211) which added:
- ✅ Tactical micro-checks (hanging pieces detection)
- ✅ Blunder gate (prevents catastrophic mistakes)
- ✅ Positional heuristics (passed pawns, bishop pair, rook activity)
- ✅ CPU config file with `CPU_MOVE_BUDGET_MS = 750`
- ❌ **Missing**: Actual timeout enforcement

The optimizations **improved chess strength** but **degraded performance** by adding expensive analysis without timeout controls.

### Cloudflare Workers Context

**Runtime**: Cloudflare Workers (V8 isolates)  
**CPU Time Limit**: 50ms (after that, billable overage)  
**Request Timeout**: 30 seconds maximum

Our chess engine needs to stay well under Cloudflare's CPU limits to avoid:
1. User-facing timeouts
2. Unexpected billing charges
3. Rate limiting

---

## Test Artifacts

### Test Script
File: `test-production-engine.mjs` (included in repository)

### Sample Production Response
```json
{
  "move": "e7e5",
  "responseTime": 3004
}
```

### Expected Production Response
```json
{
  "move": "e7e5",
  "responseTime": 650
}
```

---

## Priority Assessment

**Business Impact**: HIGH
- Affects every game's opening moves
- First impression for new users
- Violates "Faster" optimization goal

**Technical Complexity**: MEDIUM
- Clear root cause identified
- Multiple solution paths available
- No breaking changes required

**Recommended Timeline**: Immediate hotfix
- Fix can be deployed independently
- No database migrations needed
- CI/CD pipeline already in place

---

## Contact

- **Bug Reporter**: GitHub Copilot (Session 5, December 27, 2025)
- **Production Domain**: https://chesschat.uk
- **Repository**: richlegrande-dot/Chess
- **Latest Commits**: 3878673, 53be211
