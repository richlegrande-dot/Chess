# Integration Guide: Hardening + Optimization Upgrades

## Overview

This guide shows how to integrate the new hardening and optimization features into your existing ChessChat codebase.

## Quick Start

### 1. Add Diagnostics Panel to Root Layout

```typescript
// src/app/layout.tsx or _app.tsx
import { DiagnosticsPanel } from '@/components/DiagnosticsPanel';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        {children}
        <DiagnosticsPanel />
      </body>
    </html>
  );
}
```

### 2. Update Post-Game Coaching Component

Replace synchronous analysis with async + caching:

```typescript
// src/components/PostGameCoaching.tsx (example integration)

import { useEffect, useState } from 'react';
import * as coachingCache from '@/lib/coaching/coachingCache';
import * as diagnostics from '@/lib/diagnostics/clientDiagnostics';
import { getServerCapabilities } from '@/lib/api/capabilities';

export function PostGameCoaching({ pgn, moveHistory, playerColor }) {
  const [report, setReport] = useState(null);
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [serverCapabilities, setServerCapabilities] = useState(null);

  useEffect(() => {
    analyzeGame();
  }, [pgn]);

  async function analyzeGame() {
    const startTime = performance.now();

    // Step 1: Check cache first
    const cached = coachingCache.getCachedReport(pgn);
    if (cached) {
      diagnostics.recordCacheHit();
      setReport(cached.report);
      setInsights(cached.insights);
      setLoading(false);
      return;
    }

    diagnostics.recordCacheMiss();

    // Step 2: Show skeleton UI immediately
    setLoading(true);

    // Step 3: Run analysis in microtask (non-blocking)
    requestIdleCallback(
      () => {
        try {
          // Run local analysis
          const analysisResult = coachingEngine.analyzeGame(
            moveHistory,
            playerColor,
            { includeEvidence: true }
          );

          const playerInsights = enhancedLearningSystem.getPlayerInsights();

          const duration = performance.now() - startTime;
          diagnostics.recordAnalysisDuration(duration);

          // Cache the results
          coachingCache.cacheReport(pgn, analysisResult, playerInsights, duration);

          setReport(analysisResult);
          setInsights(playerInsights);
          setLoading(false);

          // Step 4: Optionally ping server (non-blocking)
          checkServerCapabilitiesAsync();
        } catch (error) {
          console.error('Analysis failed:', error);
          setLoading(false);
        }
      },
      { timeout: 1000 } // Fallback to timeout if idle callback not supported
    );
  }

  async function checkServerCapabilitiesAsync() {
    try {
      const capabilities = await getServerCapabilities();
      setServerCapabilities(capabilities);

      // Only attempt server ingestion if enabled
      if (capabilities.learning.server) {
        const serverStart = performance.now();
        const response = await fetch('/api/learning/ingest-game', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: 'local',
            gameId: Date.now(),
            pgn,
            chatContext: []
          })
        });

        const responseTime = performance.now() - serverStart;
        const data = await response.json();

        if (data.analysisMode === 'local_only') {
          diagnostics.recordDegradedResponse(data.message, responseTime);
        }
      }
    } catch (error) {
      // Server check failed, continue with local-only mode
      console.warn('Server capabilities check failed:', error);
    }
  }

  return (
    <div>
      {loading ? (
        <SkeletonUI />
      ) : (
        <>
          <CoachingReport report={report} />
          <PlayerInsights insights={insights} />
          {serverCapabilities && !serverCapabilities.learning.server && (
            <div className="text-sm text-gray-500 mt-4">
              Analysis completed locally. Server-side learning is not currently available.
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

### 3. Replace Existing Storage Calls

Find all direct `localStorage.getItem()` / `setItem()` calls and replace with safe storage:

**Before:**
```typescript
const profile = JSON.parse(localStorage.getItem('player_profile') || '{}');
localStorage.setItem('player_profile', JSON.stringify(profile));
```

**After:**
```typescript
import * as safeStorage from '@/lib/storage/safeStorage';

const profile = safeStorage.getItem<PlayerProfile>(
  'learning:profile',
  isValidProfile,
  defaultProfile
);

safeStorage.setItem('learning:profile', profile, {
  version: 1,
  maxBytes: 50 * 1024  // 50KB limit
});
```

### 4. Update Mistake Tracking with Mastery Model

Replace simple pattern counting with evidence-weighted mastery:

**Before:**
```typescript
// signatureEngine.ts - old approach
function trackPattern(patternKey: string) {
  const count = (patterns[patternKey] || 0) + 1;
  patterns[patternKey] = count;
  
  if (count === 3) {
    showMilestone('Pattern confirmed');
  }
}
```

**After:**
```typescript
import * as masteryModel from '@/lib/coaching/masteryModel';

function trackPattern(patternKey: string, wasMistake: boolean, severity: number, evidenceId: string) {
  const updated = masteryModel.updateMastery({
    conceptKey: patternKey,
    wasMistake,
    severity,
    evidenceId,
    timestamp: Date.now()
  });
  
  // Check for milestones based on mastery level
  if (updated.mastery >= 0.8 && updated.confidence >= 0.7) {
    showMilestone('Pattern mastered', patternKey);
  } else if (updated.totalSeen === 3) {
    showMilestone('Pattern confirmed', patternKey);
  }
}
```

### 5. Add Evidence to Coaching Reports

Update your coaching engine to include evidence references:

```typescript
import { createMoveEvidence, createMetricEvidence } from '@/lib/coaching/evidenceTypes';

function analyzeMistakes(moveHistory) {
  const mistakes = [];
  
  moveHistory.forEach((move, idx) => {
    if (isBlunder(move)) {
      mistakes.push({
        key: `blunder-move${idx}`,
        title: 'Material loss',
        severity: calculateSeverity(move),
        evidence: [
          createMoveEvidence(idx + 1, move.fen, `Lost ${move.materialLost} points`),
          createMetricEvidence(move.evaluation, 'Position evaluation')
        ],
        advice: 'Look for hanging pieces before moving',
        category: 'tactical'
      });
    }
  });
  
  return mistakes;
}
```

### 6. Replace Console Logs with Rate-Limited Logger

**Before:**
```typescript
console.warn('Analysis failed for move', moveNumber);
console.error('Network error:', error);
```

**After:**
```typescript
import * as logger from '@/lib/logging/rateLimitedLogger';

logger.warn(`Analysis failed for move ${moveNumber}`);
logger.error('Network error:', error);

// For critical errors that should always log
logger.always('error', 'Critical failure:', details);
```

### 7. Update Wall-E API Sync Functions

Make sync capability-aware:

```typescript
// src/lib/api/walleApiSync.ts

import { getServerCapabilities } from './capabilities';

export async function savePlayerProfileViaAPI(profile: PlayerProfile): Promise<boolean> {
  const capabilities = await getServerCapabilities();
  
  // Only attempt network call if server is available
  if (!capabilities.learning.server) {
    // Save to localStorage only (already done)
    return true;
  }
  
  try {
    const response = await fetch('/api/wall-e/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile)
    });
    
    return response.ok;
  } catch (error) {
    console.warn('Server sync failed, falling back to local:', error);
    return true; // Still return true since local save succeeded
  }
}
```

## Migration Steps

### Phase 1: Non-Breaking Additions (Safe to deploy)

1. ✅ Add new modules (already created):
   - `src/lib/storage/safeStorage.ts`
   - `src/lib/coaching/masteryModel.ts`
   - `src/lib/coaching/coachingCache.ts`
   - `src/lib/coaching/evidenceTypes.ts`
   - `src/lib/logging/rateLimitedLogger.ts`
   - `src/lib/diagnostics/clientDiagnostics.ts`
   - `src/lib/api/capabilities.ts`

2. ✅ Add new API endpoints (already created):
   - `functions/api/capabilities.ts`
   - Updated: `functions/api/learning/ingest-game.ts`
   - Updated: `functions/api/chat.ts`
   - Updated: `functions/api/analyze-game.ts`

3. ✅ Add new components:
   - `src/components/DiagnosticsPanel.tsx`

4. Add to root layout:
   ```typescript
   import { DiagnosticsPanel } from '@/components/DiagnosticsPanel';
   // Add <DiagnosticsPanel /> to your layout
   ```

**Deploy and test** - Everything still works as before, new features just aren't used yet.

### Phase 2: Gradual Integration (Feature by feature)

#### 2A. Enable Diagnostics

1. Import diagnostics in key components
2. Add `recordAnalysisDuration()` calls
3. Add `recordCacheHit/Miss()` calls
4. Test with `?debug=1`

#### 2B. Enable Coaching Cache

1. Update `PostGameCoaching.tsx` to check cache before analysis
2. Add cache write after analysis
3. Test: play same game twice, verify instant second load

#### 2C. Enable Safe Storage

1. Find all `localStorage.getItem/setItem` calls
2. Replace with `safeStorage.getItem/setItem`
3. Add validators where appropriate
4. Test: verify data still loads correctly

#### 2D. Enable Mastery Model

1. Update signature tracking to use `updateMastery()`
2. Replace threshold checks with mastery queries
3. Update UI to show mastery progress
4. Test: verify patterns tracked correctly

#### 2E. Enable Rate-Limited Logging

1. Replace `console.warn/error` with `logger.warn/error`
2. Test: verify console doesn't spam on errors

### Phase 3: Async Analysis (Requires UI changes)

1. Update `PostGameCoaching.tsx` with skeleton UI
2. Move analysis to `requestIdleCallback`
3. Test: verify modal opens instantly
4. Measure: check `?debug=1` for performance improvements

## Testing Checklist

After integration, verify:

### Functional Tests

- [ ] Post-game modal opens instantly
- [ ] Coaching report displays correctly
- [ ] Milestones appear when patterns detected
- [ ] Player insights show recent progress
- [ ] Cached reports load instantly on repeat views
- [ ] Debug panel appears with `?debug=1`
- [ ] Storage quotas enforced (test by filling storage)
- [ ] Corrupted data recovers automatically

### Performance Tests

- [ ] Analysis completes in < 500ms (check debug panel)
- [ ] Storage stays under 5MB typical usage
- [ ] Cache hit rate > 80% for repeat games
- [ ] No UI blocking during analysis

### Network Tests

- [ ] Zero 404 errors in console
- [ ] No API calls if server capabilities disabled
- [ ] Server calls are non-blocking (analysis works if offline)
- [ ] Degraded responses logged correctly

### Edge Cases

- [ ] Works offline (airplane mode)
- [ ] Works with very long games (100+ moves)
- [ ] Handles corrupted localStorage gracefully
- [ ] Handles quota exceeded gracefully
- [ ] Works in private/incognito mode

## Rollback Plan

If issues occur, you can safely rollback:

### Quick Rollback (No data loss)

1. Remove `<DiagnosticsPanel />` from layout
2. Revert `PostGameCoaching.tsx` to synchronous version
3. Revert localStorage calls back to direct access
4. Keep new modules in place (unused is harmless)

### Full Rollback

1. Revert all files to previous commit
2. Redeploy

User data in localStorage is unaffected by rollback.

## Performance Benchmarks

### Before Optimization

- Modal open time: ~200-500ms (blocking)
- Repeat game analysis: ~200ms (recomputed)
- Storage: Unmanaged (can grow unbounded)
- Console: Spammy on errors

### After Optimization (Target)

- Modal open time: < 100ms (async)
- Repeat game analysis: < 10ms (cached)
- Storage: Bounded to quotas (auto-pruned)
- Console: Rate-limited (clean)

## Troubleshooting

### "Cannot find module '@/lib/storage/safeStorage'"

**Solution:** Check your TypeScript path mappings in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### "requestIdleCallback is not defined"

**Solution:** Add polyfill or use setTimeout fallback:

```typescript
const runAsync = typeof requestIdleCallback !== 'undefined'
  ? requestIdleCallback
  : (cb: () => void) => setTimeout(cb, 0);

runAsync(() => {
  // Your analysis code
});
```

### "localStorage quota exceeded"

**Solution:** Check diagnostics panel, manually prune:

```typescript
import { pruneLRU, getStorageFootprint } from '@/lib/storage/safeStorage';

const footprint = getStorageFootprint();
console.log('Storage:', footprint);

// Prune to 80% of quota
pruneLRU('learning', 1.6 * 1024 * 1024);
```

### "Mastery data not persisting"

**Solution:** Verify safe storage is writing:

```typescript
import { setItem, getItem } from '@/lib/storage/safeStorage';

const test = { test: true };
setItem('test:key', test);
const retrieved = getItem('test:key');
console.log('Persisted:', retrieved);
```

## Next Steps

1. **Deploy Phase 1** (non-breaking additions)
2. **Test in production** with `?debug=1`
3. **Gradually enable features** (Phase 2)
4. **Monitor metrics** (storage, performance, errors)
5. **Gather user feedback**
6. **Iterate based on data**

## Support

For questions or issues:

1. Check debug panel (`?debug=1`)
2. Review console for errors
3. Check `docs/LEARNING_LOCAL_FIRST.md`
4. Review test files for examples

## Example: Complete Integration

See `examples/integrated-postgame-component.tsx` (if created) for a fully integrated example showing all features working together.
