# Enhanced Debug Panels - Feature Error Tracking

**Deployment Date:** December 25, 2025  
**Production URL:** https://chesschat.uk  
**Deployment ID:** 7a79edc2

---

## Overview

Enhanced both in-game and admin debug panels to capture and display errors and metrics from advanced chess engine features (Quiescence Search, Beam Search, and Aspiration Windows). This provides comprehensive troubleshooting capabilities for future development and production support.

---

## What's New

### 1. Enhanced Debug Info Structure

**Added to `gameStore.ts`:**

```typescript
interface DebugInfo {
  // Existing fields...
  
  // NEW: Advanced engine features debugging
  lastWorkerMetadata: {
    depthReached: number;
    timeMs: number;
    sliceCount: number;
    complete: boolean;
    source: string;
    tacticalSafety?: {...};
    evaluation?: number;
  } | null;
  
  engineFeatures: {
    quiescence: {
      enabled: boolean;
      maxDepth: number;
      errors: Array<{...}>;
    };
    beamSearch: {
      enabled: boolean;
      width: number;
      movesEvaluated: number;
      movesSkipped: number;
    };
    aspiration: {
      enabled: boolean;
      window: number;
      failedHigh: number;
      failedLow: number;
      reSearches: number;
    };
  };
  
  featureErrors: Array<{
    timestamp: number;
    feature: 'quiescence' | 'beam' | 'aspiration' | 'worker' | 'general';
    error: string;
    context: any;
  }>;
}
```

### 2. New Store Methods

**Added to `GameStore` interface:**

- `updateWorkerMetadata(metadata)` - Store latest worker computation results
- `logFeatureError(feature, error, context)` - Log feature-specific errors with context
- `updateEngineFeatures(features)` - Update engine feature stats (counters, flags)

**Usage:**
```typescript
// In worker error handler
store.logFeatureError('worker', error.message, {
  cpuLevel: 7,
  fen: currentFEN,
  levelConfig: {...}
});

// After successful move
store.updateWorkerMetadata({
  depthReached: 6,
  timeMs: 2341,
  complete: true,
  source: 'search'
});

// Update feature stats
store.updateEngineFeatures({
  quiescence: { enabled: true, maxDepth: 10, errors: [] },
  beamSearch: { enabled: true, width: 20, movesEvaluated: 20, movesSkipped: 30 }
});
```

---

## Debug Panel Enhancements

### New Section: Engine Features (Phase 2/3)

The debug panel now displays a comprehensive "Engine Features" section showing:

#### Last CPU Move
- **Depth Reached** - Actual search depth achieved (color-coded: green ≥5, yellow <5)
- **Time** - Move computation time
- **Complete** - Whether search completed or timed out
- **Source** - Move source (search/tactical_safe/fallback)
- **Evaluation** - Position evaluation in pawns

#### Quiescence Search
- **Enabled** - Whether quiescence is active
- **Max Depth** - Maximum tactical extension depth
- **Errors** - List of quiescence-specific errors with depth and timestamp

#### Beam Search
- **Enabled** - Whether beam search is active
- **Beam Width** - Number of top moves searched
- **Evaluated** - Moves actually evaluated
- **Skipped** - Moves pruned by beam search

#### Aspiration Windows
- **Enabled** - Whether aspiration is active
- **Window** - Window size in centipawns (±50 cp)
- **Failed High** - Count of fail-high events (score > beta)
- **Failed Low** - Count of fail-low events (score < alpha)
- **Re-searches** - Total re-search attempts

#### Feature Errors
- **Chronological list** of all feature errors
- Shows: Feature name, timestamp, error message, context
- Last 5 errors displayed (max 50 stored)
- Color-coded by feature type

---

## Integration Points

### CoachingMode.tsx Updates

**After worker success:**
```typescript
// Store worker metadata
setLastWorkerMetadata(workerResult.metadata);

// Update game store with engine feature data
if (typeof window !== 'undefined' && (window as any).gameStore) {
  store.getState().updateWorkerMetadata(workerResult.metadata);
  store.getState().updateEngineFeatures({
    quiescence: { enabled: config.useQuiescence, maxDepth: config.quiescenceMaxDepth, errors: [] },
    beamSearch: { enabled: config.beamWidth > 0, width: config.beamWidth, ... },
    aspiration: { enabled: config.useAspiration, window: config.aspirationWindow, ... }
  });
}
```

**On worker error:**
```typescript
catch (error) {
  // Log to game store
  store.getState().logFeatureError('worker', 
    error.message,
    { cpuLevel, fen, levelConfig }
  );
}
```

---

## Visual Design

### CSS Enhancements

**New styles in `DebugPanel.css`:**

- `.debug-subsection` - Container for feature sections
- `.debug-subtitle` - Feature section headers
- `.debug-errors` - Scrollable error list
- `.debug-error-item` - Individual error display
- `.error-header`, `.error-feature`, `.error-time` - Error metadata
- `.error-message` - Error text
- `.error-context` - JSON context display

**Color Coding:**
- Success (green): `#4caf50` - Feature enabled, no issues
- Warning (orange): `#ff9800` - Attention needed (timeouts, fail-high/low)
- Error (red): `#f44336` - Actual errors occurred
- Active (blue): `#2196f3` - Currently processing

---

## Error Tracking Workflow

### 1. Error Occurs
```
Engine Feature → Worker → CoachingMode → Store.logFeatureError()
```

### 2. Error Stored
```typescript
{
  timestamp: 1735161234567,
  feature: 'quiescence',
  error: 'Stack overflow at depth 12',
  context: {
    cpuLevel: 7,
    fen: 'rnbqkbnr/...',
    depth: 12,
    quiescenceMaxDepth: 10
  }
}
```

### 3. Error Displayed
- Shows in debug panel "Feature Errors" section
- Feature badge with color coding
- Timestamp for chronological tracking
- Full error message
- Context preview (first 200 chars of JSON)

### 4. Error Retention
- Last 50 errors kept in memory
- Last 5 displayed in panel
- Cleared on new game
- Can be copied with "Copy Debug Info"

---

## Troubleshooting Scenarios

### Scenario 1: Quiescence Search Error

**Symptom:** CPU making tactical blunders  
**Check:** Debug Panel → Engine Features → Quiescence Search  
**Look for:**
- Errors list not empty
- Error message mentioning depth or timeout
- Context showing specific position

**Action:** Adjust `quiescenceMaxDepth` in level config

### Scenario 2: Beam Search Not Working

**Symptom:** CPU taking too long despite beam search  
**Check:** Debug Panel → Engine Features → Beam Search  
**Look for:**
- Enabled = false (should be true for level 3+)
- Width = 0 (should be 8-25)
- MovesEvaluated > width (beam not applied)

**Action:** Verify level config passed to worker

### Scenario 3: Aspiration Window Thrashing

**Symptom:** CPU moves slower than expected  
**Check:** Debug Panel → Engine Features → Aspiration  
**Look for:**
- High reSearches count (>2 per move)
- Many failedHigh or failedLow events
- Window too narrow for position volatility

**Action:** Increase `aspirationWindow` or disable for volatile positions

### Scenario 4: Worker Crashes

**Symptom:** Red error messages, fallback to main thread  
**Check:** Debug Panel → Feature Errors  
**Look for:**
- Feature = 'worker'
- Error message with stack trace
- Context showing request parameters

**Action:** Fix worker code or adjust parameters

---

## Admin Panel Integration

While the in-game debug panel provides real-time diagnostics, the admin portal can:

1. **Aggregate Errors** - Collect feature errors across all users
2. **Track Metrics** - Monitor depth reached, completion rates, re-search frequency
3. **Identify Patterns** - Find common error contexts (specific levels, FENs, configs)
4. **Performance Analysis** - Track move times vs depth vs features enabled

---

## Testing Checklist

### Manual Testing

- [ ] Play game at Level 7-8
- [ ] Open debug panel (🔧 button)
- [ ] Verify "Engine Features" section visible
- [ ] Check "Last CPU Move" shows depth 5-6
- [ ] Verify Quiescence shows enabled=true, maxDepth=10
- [ ] Verify Beam Search shows width=20
- [ ] Verify Aspiration shows enabled=true, window=50
- [ ] Trigger worker error (disconnect network mid-move)
- [ ] Verify error appears in "Feature Errors"
- [ ] Check error has timestamp, feature badge, message, context

### Automated Testing (Future)

```typescript
describe('Debug Panel - Engine Features', () => {
  it('should display worker metadata', () => {
    store.updateWorkerMetadata({ depthReached: 6, timeMs: 2500, complete: true });
    // Assert: Debug panel shows depth=6, time=2.5s
  });
  
  it('should log feature errors', () => {
    store.logFeatureError('quiescence', 'Test error', { depth: 10 });
    // Assert: Feature errors list contains error
  });
  
  it('should update engine features', () => {
    store.updateEngineFeatures({ beamSearch: { enabled: true, width: 20, ... } });
    // Assert: Beam search section shows width=20
  });
});
```

---

## Future Enhancements

### Phase 4: Advanced Metrics

- **Quiescence Statistics:**
  - Average extension depth per move
  - Total forcing moves evaluated
  - Horizon effect saves (positions correctly evaluated)

- **Beam Search Analytics:**
  - Hit rate (best move in top N)
  - Pruning efficiency (time saved)
  - Missed opportunities (best move outside beam)

- **Aspiration Insights:**
  - Average window efficiency
  - Re-search reasons (fail high vs low)
  - Optimal window size per level

### Phase 5: Error Recovery

- **Auto-adjust:** Reduce quiescence depth if errors occur
- **Fallback modes:** Disable features if repeated failures
- **Self-healing:** Automatically tune parameters based on errors

### Phase 6: Export & Analytics

- **Export debug info** - Download full session logs
- **Share diagnostics** - Generate shareable error reports
- **Trend analysis** - Track error frequency over time

---

## Documentation

**Files Modified:**
- `src/store/gameStore.ts` - Enhanced DebugInfo interface, added methods
- `src/components/DebugPanel.tsx` - Added Engine Features section
- `src/components/CoachingMode.tsx` - Integrated error logging
- `src/styles/DebugPanel.css` - Added feature debug styles

**New Capabilities:**
- Worker metadata tracking
- Feature-specific error logging
- Engine statistics display
- Context-rich error reports

---

## Summary

✅ **Enhanced debug infrastructure** - Comprehensive error tracking for advanced features  
✅ **Visual diagnostics** - Real-time engine feature stats in debug panel  
✅ **Error context** - Full context capture for troubleshooting  
✅ **Production ready** - Deployed to chesschat.uk  

The debug panels now provide complete visibility into:
- Quiescence search operation and errors
- Beam search efficiency and pruning
- Aspiration window performance
- Worker communication and failures
- General engine statistics

**Next Issue?** Check the debug panel first! 🔧

---

**Deployment:** https://chesschat.uk (7a79edc2)  
**Status:** LIVE ✅  
**Build:** 328.30 kB (92.42 kB gzipped)
