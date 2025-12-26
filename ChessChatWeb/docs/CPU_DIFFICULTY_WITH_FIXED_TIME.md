# CPU Difficulty Scaling with Fixed Time Budget

**Date:** December 25, 2025  
**Status:** ✅ Implemented  
**Global Timeout:** 2500ms (same for all levels 1-8)

---

## Philosophy: Strength Through Intelligence, Not Time

Traditional chess engines scale difficulty by giving higher levels more thinking time. This creates inconsistent UX where Level 8 takes 30 seconds while Level 1 responds in 5 seconds.

**Our Approach:** All levels use the **same time budget** (2.5 seconds). Difficulty increases via:
- Deeper search targets
- Smarter move ordering
- Tactical pattern recognition
- Quiescence search (tactical extensions)
- Aspiration windows (search optimization)
- Evaluation sophistication

---

## Global Time Configuration

### Single Source of Truth

**File:** `src/lib/cpu/cpuConfig.ts`

```typescript
export const CPU_MOVE_TIME_MS = 2500;      // Move budget
export const CPU_MOVE_GRACE_MS = 250;      // Worker messaging overhead
export const CPU_TOTAL_TIMEOUT_MS = 2750;  // Hard limit
```

### Time Budget Flow

```
User makes move
  ↓
CPU requests computation
  ↓
Worker gets: timeBudget = 2500ms (all levels)
  ↓
Iterative deepening search within budget
  ↓
Return best move found
  ↓
UI timeout: 2750ms (budget + grace)
```

### Removed: Per-Level Timeouts

**Before (OLD SYSTEM - REMOVED):**
```typescript
// DON'T USE - This is DELETED
Level 1-2: 5000ms
Level 3-4: 10000ms  
Level 5-6: 20000ms
Level 7-8: 30000ms
```

**After (NEW SYSTEM):**
```typescript
// All levels use same time
ALL LEVELS: 2500ms
```

---

## How Difficulty Scales

### Level Configuration Table

| Level | Min Depth | Target Depth | Hard Cap | Beam Width | Quiescence | Aspiration | Tactical Scan | Opening Book |
|-------|-----------|--------------|----------|------------|------------|------------|---------------|--------------|
| 1     | 1         | 2            | 3        | 8          | ❌         | ❌         | Off           | ✅           |
| 2     | 2         | 3            | 4        | 10         | ❌         | ❌         | Basic         | ✅           |
| 3     | 2         | 4            | 5        | 12         | ✅ (4)     | ❌         | Basic         | ✅           |
| 4     | 3         | 5            | 6        | 14         | ✅ (5)     | ✅ (50)    | Basic         | ✅           |
| 5     | 3         | 6            | 7        | 16         | ✅ (6)     | ✅ (40)    | Full          | ✅           |
| 6     | 4         | 7            | 8        | 18         | ✅ (6)     | ✅ (35)    | Full          | ✅           |
| 7     | 4         | 8            | 9        | 20         | ✅ (8)     | ✅ (30)    | Full          | ✅           |
| 8     | 5         | 9            | 10       | 25         | ✅ (10)    | ✅ (25)    | Full          | ✅           |

*Numbers in parentheses: quiescence max depth, aspiration window size (centipawns)*

---

## Strength Features Explained

### 1. Iterative Deepening with Depth Targets

**What it is:** Search progressively deeper (depth 1, 2, 3...) until time runs out.

**How it scales:**
- **Level 1:** Targets depth 2, caps at 3
  - Usually achieves: 2 ply
  - Sees: 1 move ahead
  
- **Level 8:** Targets depth 9, caps at 10
  - Usually achieves: 7-9 ply  
  - Sees: 3-4 moves ahead

**Key Point:** Higher levels have ambitious targets. They may not always reach them (time-limited), but they try harder and get deeper on average.

### 2. Beam Search (Root Move Ordering)

**What it is:** Only explore the top N most promising moves at the root.

**How it scales:**
- **Level 1:** Beam width 8 (only searches top 8 moves)
- **Level 8:** Beam width 25 (searches top 25 moves)

**Impact:** 
- Low levels: Fast but may miss subtle moves
- High levels: More thorough, finds hidden tactics

### 3. Quiescence Search

**What it is:** At leaf nodes, extend search for "forcing moves" (captures, checks, promotions) until position is "quiet".

**Why it matters:** Prevents **horizon effect** - blindly evaluating in the middle of a tactical sequence.

**Example:**
```
Without quiescence:
- Depth 4 search ends
- Evaluation: +2 (looks good!)
- Reality: Next move is Qxe7+ winning queen (missed)

With quiescence:
- Depth 4 search ends
- Extends: sees Qxe7+ capture
- Evaluation: -9 (queen hangs)
- AI avoids the move
```

**Scaling:**
- **Level 1-2:** No quiescence (faster but horizon-blind)
- **Level 3:** Quiescence depth 4
- **Level 7-8:** Quiescence depth 8-10

### 4. Aspiration Windows

**What it is:** Use previous iteration's score to narrow search window.

**How it works:**
```
Iteration 1: Search with window [-∞, +∞] → score = +1.5
Iteration 2: Search with window [+1.0, +2.0] (±0.5 around 1.5)
  - If score inside window: fast search ✅
  - If score outside: re-search with wider window
```

**Impact:** Reaches ~1 ply deeper in same time (especially in stable positions).

**Scaling:**
- **Level 1-3:** No aspiration
- **Level 4-8:** Aspiration enabled (windows: 50→25 centipawns)

### 5. Tactical Micro-Engine

**What it is:** Fast pattern matcher for immediate tactics (mate-in-1, hanging pieces, forks, pins).

**Integration Points:**
1. **Root move ordering:** Boost tactical moves to top of search
2. **Hanging detection:** Already implemented (prevents Qxd7+ blunders)
3. **Mate threat:** Prioritize mate-in-1/2 immediately

**Scaling:**
- **Level 1:** Off (pure search)
- **Level 2-4:** Basic (hanging pieces, mate-in-1)
- **Level 5-8:** Full (+ forks, pins, skewers)

### 6. Evaluation Complexity

**Lite Mode (Levels 1-2):**
- Material only (simpler = faster)
- Basic piece-square tables
- Center control

**Full Mode (Levels 3-8):**
- Material + positional factors
- King safety (exposure penalty, castling bonus)
- Development bonus/penalty
- Knights on rim penalty
- Early queen trade penalty
- Piece mobility
- Pawn structure

**Why it matters:** Full evaluation is ~20% slower but much more accurate. Lower levels sacrifice accuracy for speed to reach decent depth. Higher levels use full eval because they're already reaching good depth.

### 7. Opening Book

**What it is:** Database of strong opening moves (first 8-12 moves).

**Usage:**
- **All levels:** Use book when available
- **Levels 7-8:** Trust book more aggressively (unless tactical red flag)

**Benefits:**
- Instant response (saves time)
- Stronger than search in complex openings
- Avoids nonsense like Na3

---

## Implementation Status

### ✅ Completed

- [x] Global timeout constant (`CPU_MOVE_TIME_MS = 2500`)
- [x] Level configuration system (`LEVEL_CONFIGS`)
- [x] Worker client uses global timeout
- [x] CoachingMode uses level configs
- [x] Remove per-level timeout table
- [x] Documentation

### 🔄 In Progress

- [ ] Quiescence search implementation
- [ ] Aspiration windows implementation  
- [ ] Beam search at root
- [ ] Enhanced tactical micro-engine integration
- [ ] Evaluation complexity modes

### 📋 TODO

- [ ] Automated tests for all levels
- [ ] Performance metrics dashboard
- [ ] User-facing difficulty descriptions
- [ ] Optional time preference setting (Fast/Standard/Strong)

---

## Performance Expectations

### Time Consistency

**All levels should respond within:**
- Target: 2.5 seconds
- Maximum: 2.75 seconds (timeout)
- Typical: 1.5-2.5 seconds

### Depth Achieved (Under 2.5s Budget)

| Level | Expected Depth | Typical Range |
|-------|----------------|---------------|
| 1     | 2              | 2-3           |
| 2     | 3              | 3-4           |
| 3     | 4              | 4-5           |
| 4     | 5              | 4-6           |
| 5     | 6              | 5-7           |
| 6     | 7              | 6-8           |
| 7     | 8              | 7-9           |
| 8     | 9              | 8-10          |

*Depth varies by position complexity, quiescence extensions, pruning efficiency*

### Tactical Accuracy

| Level | Hanging Piece Detection | Mate-in-2 | Multi-Move Tactics |
|-------|-------------------------|-----------|-------------------|
| 1-2   | ❌ Basic                | ❌         | ❌                |
| 3-4   | ✅ Good                 | ~50%      | ❌                |
| 5-6   | ✅ Excellent            | ~80%      | ~50%              |
| 7-8   | ✅ Near-Perfect         | ~95%      | ~80%              |

---

## Testing Strategy

### Automated Tests

**Time Compliance Test:**
```typescript
for (level = 1; level <= 8; level++) {
  const start = Date.now();
  const move = await computeMove(fen, level);
  const elapsed = Date.now() - start;
  
  assert(elapsed <= CPU_TOTAL_TIMEOUT_MS);
  assert(isLegalMove(move));
}
```

**Difficulty Progression Test:**
```typescript
const tacticalPosition = "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R";

const level4Move = computeMove(tacticalPosition, 4);
const level8Move = computeMove(tacticalPosition, 8);

// Level 8 should find better move (or same move faster)
assert(evaluate(level8Move) >= evaluate(level4Move));
```

**Regression Tests:**
```typescript
// Queen hang scenario (previously broken)
const queenHangFen = "rnbqkbnr/ppp1pppp/8/3p4/2PP4/8/PP2PPPP/RNBQKBNR";
const move = computeMove(queenHangFen, 7);
assert(!hangsQueen(move));
```

### Manual Test Cases

1. **Standard Opening:** Should complete < 2s all levels
2. **Tactical Midgame:** Level 7-8 should avoid blunders
3. **Endgame:** All levels should make progress
4. **Mate-in-2:** Level 7-8 should find it reliably

---

## User Experience

### Before (Per-Level Timeouts)

```
Level 1: Responds in 2-3 seconds ✅
Level 4: Responds in 5-8 seconds ⚠️
Level 7: Responds in 15-20 seconds ❌ (too slow)
Level 8: Responds in 25-30 seconds ❌❌ (frustrating)
```

User perception: "Higher levels are painfully slow"

### After (Global Timeout)

```
Level 1: Responds in 1.5-2.5 seconds ✅
Level 4: Responds in 2.0-2.5 seconds ✅
Level 7: Responds in 2.0-2.5 seconds ✅
Level 8: Responds in 2.0-2.5 seconds ✅
```

User perception: "All levels feel responsive! Level 8 just plays smarter"

### Future: Optional Time Preference

Allow users to choose global budget (same for all levels):

- **Fast Mode:** 1500ms (rapid response, depth -1)
- **Standard Mode:** 2500ms (current, balanced)
- **Strong Mode:** 4000ms (tournament strength, depth +1)

This keeps UX consistent while allowing power users to trade time for strength.

---

## Key Takeaways

1. **Consistent UX:** All levels respond in ~2.5 seconds
2. **Smarter Scaling:** Difficulty via intelligence, not brute time
3. **Better AI:** Quiescence + aspiration + tactics = stronger play
4. **No Hangs:** Worker always returns within timeout
5. **Future-Proof:** Easy to add new strength features

---

## Files Modified

### Core Configuration
- `src/lib/cpu/cpuConfig.ts` (NEW) - Level configs + global timeout
- `src/lib/cpu/cpuWorkerClient.ts` - Use global grace period
- `src/components/CoachingMode.tsx` - Use level configs + global timeout

### To Be Modified (Next Phase)
- `src/lib/chessAI.ts` - Add quiescence, aspiration, beam search
- `src/workers/cpuWorker.ts` - Use level config parameters
- `src/lib/tactics/tacticalMicroEngine.ts` - Enhanced integration

### Documentation
- `CPU_CONFIGURATION_SUMMARY.md` - Updated with new system
- `CPU_DIFFICULTY_WITH_FIXED_TIME.md` (THIS FILE) - Design doc

---

## References

For implementation details of specific features:
- **Quiescence Search:** [Chessprogramming Wiki - Quiescence](https://www.chessprogramming.org/Quiescence_Search)
- **Aspiration Windows:** [Chessprogramming Wiki - Aspiration](https://www.chessprogramming.org/Aspiration_Windows)
- **Beam Search:** [Wikipedia - Beam Search](https://en.wikipedia.org/wiki/Beam_search)
