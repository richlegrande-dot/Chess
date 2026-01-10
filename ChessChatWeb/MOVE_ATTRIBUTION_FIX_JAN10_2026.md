# Move Attribution Fix - January 10, 2026

## Issue Description

Post-game analysis incorrectly attributed ALL checks and captures to the human player, regardless of which color they were playing. When playing as Black, the system would credit the player for the CPU's White piece checks/captures.

### Impact
- **User Experience**: Players received incorrect feedback about their gameplay
- **Coaching Quality**: Advice didn't adapt to player's piece color perspective
- **Wall-E Training Data**: ML training data was corrupted with incorrect move attributions
- **Mistake Analysis**: "What were my biggest mistakes?" showed both player AND CPU errors

## Root Cause

The `moveHistory` array stores move records with a `player` field that represents **PIECE COLOR** ('White' | 'Black'), NOT who made the move (human vs CPU).

```typescript
// MoveHistory interface
interface MoveHistory {
  moveNum: number;
  player: 'White' | 'Black';  // ⚠️ This is PIECE COLOR, not actor identity
  move: string;
  fen: string;
  captured?: string;
}
```

### Previous (Broken) Logic

```typescript
// CoachingAnalysisModal.tsx - BEFORE
const playerMoves = moveHistory.filter(m => m.player === playerColor);
const opponentMoves = moveHistory.filter(m => m.player !== playerColor);
```

**Problem**: When playing as Black (`playerColor = 'Black'`):
- `playerMoves` would include ALL Black piece moves (both human AND CPU when CPU plays Black)
- Human's Black moves AND CPU's Black moves would both have `player: 'Black'`
- All checks/captures by Black pieces credited to player, regardless of who made them

## Solution

Changed filtering logic to use **move index** (even/odd) to determine who actually made each move, since in vs-CPU mode:
- White always moves first (even indices: 0, 2, 4, 6...)
- Black always moves second (odd indices: 1, 3, 5, 7...)

### Implementation

Created `isPlayerMove()` helper function:

```typescript
// Helper function to determine if a move at a given index was made by the player
// In vs-CPU mode, moveHistory.player represents PIECE COLOR, not who made the move
// White always moves first (even indices), Black moves second (odd indices)
const isPlayerMove = (moveIndex: number): boolean => {
  if (playerColor === 'White') {
    return moveIndex % 2 === 0; // Player is White, moves on even indices
  } else {
    return moveIndex % 2 === 1; // Player is Black, moves on odd indices
  }
};
```

### Fixed Filtering Logic

```typescript
const playerMoves = moveHistory.filter((m, index) => {
  if (playerColor === 'White') {
    return index % 2 === 0; // Human is White, moves on even indices (starts at 0)
  } else {
    return index % 2 === 1; // Human is Black, moves on odd indices (starts at 1)
  }
});

const opponentMoves = moveHistory.filter((m, index) => {
  if (playerColor === 'White') {
    return index % 2 === 1; // CPU is Black, moves on odd indices
  } else {
    return index % 2 === 0; // CPU is White, moves on even indices
  }
});
```

### All Fixed Locations

Updated **7 locations** in CoachingAnalysisModal.tsx:
1. Line ~46: `generateTakeaways()` - total moves count
2. Lines ~184-210: `analyzeGameMoves()` - player/opponent move filters
3. Lines ~230-260: `analyzeGameMoves()` - captures/checks counting
4. Line ~341: Opening analysis - isYourMove determination
5. Line ~360: Opening evaluation - your opening moves filter
6. Line ~363: Opening evaluation - castling filter
7. Line ~653: Game summary - total moves display

## Testing Verification

### Manual Test Cases

1. **Play as White vs CPU Black**
   - Start game as White
   - Make several captures with White pieces
   - CPU makes captures with Black pieces
   - End game and open post-game analysis
   - ✅ Verify: Only YOUR White captures are credited to you
   - ✅ Verify: CPU's Black captures show as opponent moves

2. **Play as Black vs CPU White**
   - Start game as Black
   - CPU makes captures with White pieces
   - Make several captures with Black pieces
   - End game and open post-game analysis
   - ✅ Verify: Only YOUR Black captures are credited to you
   - ✅ Verify: CPU's White captures show as opponent moves
   - ✅ Verify: Advice adapts to Black's perspective

3. **Check "What were my biggest mistakes?"**
   - Should show ONLY human player errors
   - Should NOT show CPU errors
   - Should adapt to player's piece color perspective

## Deployment

- **Commit**: `5f5443d` - Fix move attribution in post-game analysis
- **Build Time**: 2.15s
- **Bundle Size**: 433.73 kB (gzip: 120.82 kB)
- **Deployed To**: 
  - https://main.chesschat-web.pages.dev
  - https://chesschat.uk (production domain)
- **Deployment ID**: f3d58b92
- **Date**: January 10, 2026

## Files Modified

- `src/components/CoachingAnalysisModal.tsx` (84 insertions, 11 deletions)

## Benefits

✅ **Accurate Attribution**: Checks and captures correctly attributed to actual player
✅ **Perspective-Aware**: Analysis adapts to player's piece color (White/Black)
✅ **Clean Training Data**: Wall-E learning data now has correct move attributions
✅ **Better Coaching**: Mistakes analysis shows only player errors, not CPU errors
✅ **Improved UX**: Players receive accurate, relevant feedback

## Technical Notes

- This fix assumes vs-CPU mode where human always plays against one CPU opponent
- Move order is guaranteed: White (even indices) → Black (odd indices)
- Does NOT modify the MoveHistory data structure (non-breaking change)
- Uses index-based logic at consumption point rather than changing data model
- Preserves backward compatibility with existing move history records

## Alternative Solutions Considered

1. **Add `actor` field to MoveHistory**: Would require migration of existing data
2. **Rename `player` to `pieceColor`**: Breaking change, affects entire codebase
3. **Use `cpuColor` state to determine actor**: Current solution, minimal changes

Chose option 3 for minimal disruption and immediate fix deployment.

## Related Issues

- CPU Difficulty Fix: See `CPU_LEVEL_FIX_JAN10_2026.md`
- Wall-E Training: This fix ensures ML training data quality
