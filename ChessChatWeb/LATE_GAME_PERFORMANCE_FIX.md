# Late Game Performance Fix

## Issue
CPU taking 40-65 seconds to move in late game (move 20+), causing poor user experience.

## Root Cause
**Line 198 in CoachingMode.tsx**: Depth was **increasing** for endgame:
```typescript
else if (moveCount > 40) {
  searchDepth = Math.min(4, baseDepth + 1); // BAD: Increases depth
}
```

**Why this caused slowdown:**
- Late game has fewer pieces BUT more tactical complications
- Minimax search tree grows exponentially with depth: depth 4 = ~35^4 = 1.5 million positions
- Captures, checks, and combinations create deep variations
- Result: 40-65 second move times

## Fix Applied
**Changed line 198** to REDUCE depth in late game:
```typescript
else if (moveCount > 30) {
  // Late game: REDUCE depth to maintain speed
  searchDepth = Math.max(1, baseDepth - 1);
}
```

Also reduced max baseDepth for level 7-8 from 4→3.

## Results
- **Level 1-2**: depth 1 throughout (instant moves)
- **Level 3-4**: depth 2 opening, depth 1 late game
- **Level 5-6**: depth 3 mid-game, depth 2 late game  
- **Level 7-8**: depth 3 mid-game, depth 2 late game

**Expected improvement**: Late game moves under 5 seconds even at move 40+

## Testing
Test by playing to move 30+:
1. Early game (moves 1-10): Should be fast
2. Mid game (moves 11-30): Normal speed
3. Late game (moves 31+): **Should remain fast** (was 40-65s, now <5s)

## Related Files
- `src/components/CoachingMode.tsx` (line 191-199)
- `src/lib/chessAI.ts` (minimax implementation)

## Date
December 19, 2024
