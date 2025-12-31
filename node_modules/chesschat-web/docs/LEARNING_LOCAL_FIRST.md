# Learning System: Local-First Architecture

## Overview

ChessChat uses a **local-first** architecture for learning and coaching. All player data is stored in the browser's localStorage, and analysis runs entirely client-side. This ensures privacy, offline functionality, and zero server costs.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                   ChessChat Client                       │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │          Post-Game Flow                         │    │
│  │                                                  │    │
│  │  1. Local Analysis (sync)                       │    │
│  │     - Rule-based coaching engine                │    │
│  │     - Pattern detection                          │    │
│  │     - Mistake identification                     │    │
│  │     - Evidence collection                        │    │
│  │                                                  │    │
│  │  2. Mastery Updates (sync)                      │    │
│  │     - Update concept mastery scores             │    │
│  │     - Apply spaced repetition                    │    │
│  │     - Track confidence & recency                │    │
│  │                                                  │    │
│  │  3. Storage (sync)                              │    │
│  │     - Safe localStorage with integrity          │    │
│  │     - Version management                         │    │
│  │     - Automatic pruning                          │    │
│  │                                                  │    │
│  │  4. Optional Server Ping (async)                │    │
│  │     - Check capabilities                         │    │
│  │     - No blocking                                │    │
│  │                                                  │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │        Safe Storage Layer                       │    │
│  │                                                  │    │
│  │  - Schema versioning & migrations               │    │
│  │  - Checksum integrity checks                     │    │
│  │  - Corruption detection & recovery              │    │
│  │  - Namespace quotas & LRU pruning               │    │
│  │  - TTL support                                   │    │
│  │                                                  │    │
│  │  Namespaces:                                     │    │
│  │  • learning:* (2MB quota)                       │    │
│  │  • coaching:* (1MB quota)                       │    │
│  │  • trainingExamples:* (2MB quota)               │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │        Mastery Model                            │    │
│  │                                                  │    │
│  │  Evidence-weighted learning:                     │    │
│  │  • Mastery score (0-1)                          │    │
│  │  • Confidence score (0-1)                       │    │
│  │  • Recency decay                                 │    │
│  │  • Spaced repetition scheduling                 │    │
│  │  • Severity-weighted updates                     │    │
│  │                                                  │    │
│  │  Priority = (1-mastery) * confidence + overdue  │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │        Coaching Cache                           │    │
│  │                                                  │    │
│  │  • PGN hash-based caching                       │    │
│  │  • 30 report limit (LRU)                        │    │
│  │  • 7-day TTL                                     │    │
│  │  • Performance metrics tracking                 │    │
│  └────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
                           │
                           │ (optional, non-blocking)
                           ↓
┌─────────────────────────────────────────────────────────┐
│              Cloudflare Pages Functions                  │
│                                                          │
│  /api/capabilities (GET)                                │
│    → Returns truthful feature flags                      │
│                                                          │
│  /api/learning/ingest-game (POST)                       │
│    → Stub: acknowledges but does nothing                │
│                                                          │
│  /api/chat (POST)                                       │
│    → Stub: returns "unavailable" message                │
│                                                          │
│  /api/analyze-game (POST)                               │
│    → Stub: returns "unavailable" message                │
└─────────────────────────────────────────────────────────┘
```

## What's Local vs Server

### ✅ Runs Locally (Client-Side)

1. **Rule-Based Coaching Engine**
   - Analyzes games for tactical and positional mistakes
   - Identifies patterns (forks, pins, king safety, etc.)
   - Generates coaching advice
   - Fully functional without network

2. **Mastery Tracking**
   - Evidence-weighted concept mastery (0-1 scale)
   - Confidence scores based on evidence quantity/recency
   - Spaced repetition scheduling
   - Priority calculation for practice focus

3. **Pattern Recognition**
   - Detects recurring mistake signatures
   - Tracks pattern reliability over time
   - Milestone notifications (detected → confirmed → reliable → mastered)

4. **Data Storage**
   - Player profile (games, W/L, performance)
   - Mistake signatures (recurring patterns)
   - Training examples (position snapshots)
   - Learning metrics (progress tracking)
   - All stored in browser localStorage with integrity protection

5. **Coaching Cache**
   - Caches analysis results by PGN hash
   - Instant re-display of previous game analyses
   - 30 report limit, 7-day TTL

### ❌ NOT Available Server-Side

1. **Deep Stockfish Analysis**
   - Would require compute resources
   - Cloudflare CPU limits prevent deep search
   - Local analysis uses heuristics instead

2. **Server-Side Learning V3**
   - Advanced ML-based pattern learning
   - Cross-player insights
   - Not deployed

3. **AI Chat**
   - Natural language coaching conversations
   - Not implemented

4. **Cross-Device Sync**
   - No database backend
   - Each browser has independent data

## Capability Flags

The system exposes truthful capability flags via `/api/capabilities`:

```json
{
  "learning": {
    "local": true,
    "server": false
  },
  "coaching": {
    "local": true,
    "server": false
  },
  "chat": {
    "enabled": false
  },
  "stockfish": {
    "cpuMoves": true,
    "deepAnalysis": false
  }
}
```

Frontend code should:
1. Fetch capabilities once on load (cached 5 minutes)
2. Adjust UI messaging based on flags
3. Skip server API calls if `server: false`
4. Never suggest "retry later" if feature is disabled

## Safe Storage Layer

### Features

- **Schema Versioning**: Each entry has a version number for migrations
- **Integrity Checks**: Checksum validation on every read
- **Corruption Recovery**: Auto-repair with defaults + snapshot of bad data
- **Namespace Quotas**: Per-namespace size limits with LRU pruning
- **TTL Support**: Optional expiration for temporary data
- **Merge Mode**: Update objects without full replacement

### API

```typescript
import * as safeStorage from '@/lib/storage/safeStorage';

// Get with validation and default
const data = safeStorage.getItem<UserProfile>(
  'learning:profile',
  isUserProfile,  // optional validator
  defaultProfile  // optional default
);

// Set with options
safeStorage.setItem('coaching:report', report, {
  version: 2,
  ttl: 7 * 24 * 60 * 60 * 1000,  // 7 days
  maxBytes: 100 * 1024,            // 100KB limit
  merge: true                      // merge with existing
});

// Migrate between versions
safeStorage.migrate<V1, V2>(
  'learning:settings',
  1,  // from version
  2,  // to version
  (old) => transformToV2(old)
);

// Check footprint
const footprint = safeStorage.getStorageFootprint();
console.log(`Total: ${footprint.totalMB} MB`);
console.log(footprint.namespaces);

// Prune if needed
safeStorage.pruneLRU('learning', 1.5 * 1024 * 1024); // Keep 1.5MB
```

### Namespace Quotas

- `learning:*` → 2MB
- `coaching:*` → 1MB
- `trainingExamples:*` → 2MB
- `default` → 512KB

When quota exceeded, oldest entries are pruned via LRU.

## Mastery Model

Replaces simple count thresholds (1/3/5/10) with evidence-weighted scoring.

### Concepts

- **Mastery (0-1)**: How well the player understands a concept
  - 0 = not understood
  - 0.5 = partially understood
  - 0.8+ = mastered

- **Confidence (0-1)**: Quality of evidence
  - Based on # observations and recency
  - Decays if concept not seen in 30+ days

- **Spaced Repetition**: Concepts due for review
  - Due date calculated based on mastery level
  - Overdue concepts get priority boost

### Updates

```typescript
import * as masteryModel from '@/lib/coaching/masteryModel';

// Record performance
const updated = masteryModel.updateMastery({
  conceptKey: 'tactics-fork',
  wasMistake: true,
  severity: 0.7,  // 0-1, where 1 = critical
  evidenceId: 'game123-move15',
  timestamp: Date.now()
});

// Get practice priorities
const priorities = masteryModel.getPracticePriorities();
// Returns: [{ conceptKey, priority, data }, ...]
// Sorted by: (1-mastery) * confidence + overdueBoost

// Get stats
const stats = masteryModel.getLearningStats();
// { totalConcepts, masteredConcepts, averageMastery, ... }
```

### Priority Formula

```
priority = (1 - mastery) * confidence + overdueBoost

where:
  overdueBoost = min(daysOverdue / 7, 0.5)
```

High-priority concepts are:
- Low mastery (many mistakes)
- High confidence (strong evidence)
- Overdue for review

## Coaching Cache

Avoid recomputing analysis for the same game.

```typescript
import * as coachingCache from '@/lib/coaching/coachingCache';

// Check for cached report
const cached = coachingCache.getCachedReport(pgn);
if (cached) {
  return cached.report;
}

// Compute new report
const report = computeAnalysis(pgn);

// Cache it
coachingCache.cacheReport(pgn, report, insights, durationMs);
```

- Cache key: PGN hash (simple hash function)
- Max entries: 30 (LRU eviction)
- TTL: 7 days
- Tracks: compute duration, hit rate

## Evidence-Based Coaching

All coaching advice must include evidence or be marked as general tip.

### Report Structure

```typescript
interface CoachingReport {
  summary: string;
  topMistakes: Array<{
    key: string;
    title: string;
    severity: number;  // 0-1
    evidence: EvidenceRef[];  // REQUIRED
    advice: string;
    category: 'opening' | 'middlegame' | 'endgame' | 'tactical' | 'positional';
  }>;
  strengths: Array<{
    key: string;
    title: string;
    evidence: EvidenceRef[];  // REQUIRED
    description: string;
  }>;
  nextFocus: Array<{
    key: string;
    title: string;
    drill: string;           // REQUIRED
    expectedOutcome: string; // REQUIRED
    priority: number;
  }>;
  milestones: Array<{
    kind: 'pattern_detected' | 'pattern_confirmed' | 'pattern_reliable' | 'concept_mastered';
    text: string;
    conceptKey: string;
  }>;
  generalTips: string[];  // For advice without evidence
  metadata: {
    analyzedMoves: number;
    engine: 'local' | 'server';
    engineVersion: string;
    generatedAt: number;
    computeDuration: number;
  };
}
```

### Evidence Types

```typescript
type EvidenceRef = 
  | { type: 'move'; moveNumber: number; fen: string; description?: string }
  | { type: 'position'; fen: string; description: string }
  | { type: 'pattern'; patternId: string; description: string }
  | { type: 'metric'; value: number | string; description: string };
```

### Validation

```typescript
import { validateCoachingReport } from '@/lib/coaching/evidenceTypes';

const validation = validateCoachingReport(report);
if (!validation.valid) {
  console.warn('Report issues:', validation.issues);
}
```

## Rate-Limited Logging

Prevent console spam from repeated errors.

```typescript
import * as logger from '@/lib/logging/rateLimitedLogger';

// These will be suppressed if repeated within 30s
logger.warn('Connection failed');
logger.error('Analysis error:', details);

// Always log (bypass rate limit)
logger.always('error', 'Critical failure', details);

// Get stats
const stats = logger.getCacheStats();
// { uniqueMessages, totalSuppressed }
```

## Client Diagnostics

Hidden panel accessible via `?debug=1` query parameter.

```typescript
import * as diagnostics from '@/lib/diagnostics/clientDiagnostics';

// Check if debug mode
if (diagnostics.isDebugMode()) {
  // Show diagnostics panel
}

// Collect data
const data = diagnostics.collectDiagnostics();
// Returns: storage, coaching, learning, performance, logging, serverStatus

// Format for display
const text = diagnostics.formatDiagnostics(data);
console.log(text);

// Record metrics
diagnostics.recordAnalysisDuration(150); // ms
diagnostics.recordCacheHit();
diagnostics.recordCacheMiss();
diagnostics.recordDegradedResponse('Server learning disabled', 250);
```

## How to Enable Server Features Later

### Step 1: Deploy Backend Service

Deploy Learning V3 or other server-side features.

### Step 2: Update Capability Endpoint

Edit `functions/api/capabilities.ts`:

```typescript
const capabilities = {
  learning: {
    local: true,
    server: true  // ← Enable
  },
  // ...
};
```

### Step 3: Update Sync Logic

Edit `src/lib/api/walleApiSync.ts` (currently disabled):

```typescript
export async function savePlayerProfileViaAPI(profile: PlayerProfile) {
  const capabilities = await getServerCapabilities();
  
  if (!capabilities.learning.server) {
    // Server not available, skip
    return true;
  }
  
  // Make actual API call
  const response = await fetch('/api/wall-e/profile', {
    method: 'POST',
    body: JSON.stringify(profile)
  });
  
  return response.ok;
}
```

### Step 4: Deploy + Test

- Deploy updated code
- Check `/api/capabilities` returns `server: true`
- Verify network calls succeed
- Monitor for errors

## Performance Metrics

### Post-Game Modal

- **Target**: Open in < 100ms
- **Current**: Depends on game length (typical: 50-200ms)
- **Optimization**: Async analysis with skeleton UI

### Storage

- **Target**: < 5MB total
- **Current**: Typical 1-2MB per user
- **Optimization**: Automatic LRU pruning

### Cache Hit Rate

- **Target**: > 80% for repeat game views
- **Current**: Depends on usage pattern
- **Measurement**: Via diagnostics panel

## Troubleshooting

### Console Shows 404 Errors

**Problem**: Sync functions trying to call non-existent APIs

**Solution**: Ensure `walleApiSync.ts` checks capabilities before network calls

### Storage Quota Exceeded

**Problem**: localStorage full

**Solution**: 
1. Check footprint: `safeStorage.getStorageFootprint()`
2. Prune manually: `safeStorage.pruneLRU(namespace, targetBytes)`
3. Clear old data: `safeStorage.clearNamespace('learning')`

### Corrupted Data

**Problem**: JSON parse errors or checksum failures

**Solution**: 
1. Auto-recovery kicks in (logs warning)
2. Check corruption snapshots: `localStorage['corrupt:*']`
3. Clear if needed: `localStorage.removeItem(key)`

### Slow Analysis

**Problem**: Post-game modal takes too long

**Solution**:
1. Check diagnostics: `?debug=1`
2. Review `lastAnalysisDuration`
3. Consider reducing analysis depth
4. Check for large move histories (100+ moves)

## Testing

### Unit Tests

```bash
npm run test
```

Runs:
- `tests/safeStorage.test.ts`
- `tests/masteryModel.test.ts`
- `tests/coachingCache.test.ts` (if added)

### Smoke Test

```bash
node scripts/manual-postgame-smoke.mjs
```

Verifies:
- PGN parsing
- Local analysis
- Evidence requirements
- Storage footprint
- No network calls
- Cache functionality

### Manual Testing

1. Play a game
2. Open DevTools → Network tab
3. Complete game
4. Verify:
   - ✅ Post-game modal appears instantly
   - ✅ No 404 errors in console
   - ✅ Coaching report has evidence
   - ✅ Milestones appear if patterns detected
   - ✅ Storage stays under 5MB

## Future Enhancements

### Potential Server Features

1. **Cross-Device Sync**
   - Backup localStorage to server
   - Restore on new device
   - Requires authentication

2. **Deep Stockfish Analysis**
   - Queue games for batch analysis
   - Return results asynchronously
   - Display in UI when ready

3. **AI Chat**
   - Natural language Q&A about games
   - Personalized coaching conversations
   - Requires LLM integration

4. **Community Insights**
   - Anonymous aggregation of common mistakes
   - Personalized practice recommendations
   - Privacy-preserving analytics

### Local Improvements

1. **Web Worker Analysis**
   - Move coaching engine to worker thread
   - Prevent UI blocking on long games
   - Parallel analysis of multiple games

2. **IndexedDB Migration**
   - Move from localStorage to IndexedDB
   - Support larger datasets
   - Better query performance

3. **Visualization**
   - Mastery progress charts
   - Pattern heatmaps
   - Timeline of improvements

4. **Export/Import**
   - Download all local data as JSON
   - Import on new device
   - Privacy-preserving backup

## References

- [Safe Storage API](../src/lib/storage/safeStorage.ts)
- [Mastery Model API](../src/lib/coaching/masteryModel.ts)
- [Capabilities Client](../src/lib/api/capabilities.ts)
- [Diagnostics Panel](../src/lib/diagnostics/clientDiagnostics.ts)
- [Evidence Types](../src/lib/coaching/evidenceTypes.ts)
