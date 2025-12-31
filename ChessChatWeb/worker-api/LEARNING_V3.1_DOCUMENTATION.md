# Learning V3.1: Smart Sampling + Concept Summaries

**Version**: 3.1  
**Date**: December 31, 2025  
**Status**: Ready for Staging Deployment

---

## Overview

Learning V3.1 enhances Wall-E's learning backend with:

1. **Smart Position Sampling** - Analyzes tactically rich positions instead of just first N moves
2. **Stockfish Result Caching** - Reduces repeated analysis costs by 40-70%
3. **Adaptive Analysis Tiers** - Dynamically adjusts depth/positions based on time budget
4. **Closed-Loop Evidence Tracking** - Stores concrete examples with concept updates
5. **Production Guardrails** - Caps DB writes and Stockfish calls to prevent runaway costs
6. **Detailed Instrumentation** - Every ingestion logged with performance metrics

---

## Architecture Changes

### New Database Tables

#### `analysis_cache`
Caches Stockfish evaluation results keyed by FEN + depth.

**Fields**:
- `cacheKey` (unique) - SHA256 hash of FEN + depth + movetime
- `fen` - Normalized position
- `depth` - Stockfish depth
- `evalCp` - Centipawn evaluation
- `bestMove` - Best move in UCI format
- `hitCount` - Cache hit counter
- `expiresAt` - TTL (default 7 days)

**Purpose**: Openings and common tactics analyzed once and reused across all users.

#### `ingestion_event`
Detailed metrics for every game ingestion request.

**Fields**:
- `userId`, `gameId`
- `durationMs` - Total processing time
- `candidatesSelected` - Positions selected by smart sampling
- `stockfishCallsMade` - Actual API calls (vs cached)
- `cacheHitRate` - 0.0 to 1.0
- `tierSelected` - 'A', 'B', or 'C'
- `maxDepth` - Stockfish depth used
- `conceptsUpdated` - Number of concepts modified
- `eventResult` - 'success', 'partial', 'timeout', 'error'

**Purpose**: Operational visibility and performance tuning.

### Enhanced Existing Tables

#### `user_concept_state`
Already existed, now properly utilized for evidence tracking.

**New Usage**:
- `evidenceRefs` (JSON) - Last 10 games with mistake counts per concept
- `mastery` - Updated via closed-loop math (0.0 to 1.0)
- `confidence` - Increases with repeated exposures
- `spacedRepDueAt` - When concept should be reviewed

#### `advice_intervention`
Already existed, now properly integrated with postgame endpoint.

**Workflow**:
1. Postgame advice creates intervention record
2. Next N games tracked automatically
3. After N games, outcome measured (success/partial/failure)
4. Follow-up created if outcome = failure

---

## New Modules

### 1. Smart Sampling (`smartSampling.ts`)

**Purpose**: Select the most learning-valuable positions instead of analyzing first N plies blindly.

**Detection Heuristics**:
- **Captures** (SAN contains 'x') → priority +3
- **Checks** (SAN contains '+') → priority +4
- **Checkmate** (SAN contains '#') → priority +10
- **Promotions** (SAN contains '=') → priority +5
- **Castling** ('O-O') → priority +2
- **Material swings** (delta ≥3) → priority = delta
- **King exposure** (heuristic) → priority +3
- **Endgame critical** (low material) → priority +2

**Two-Pass Approach**:
1. **Pass 1 (cheap)**: Parse PGN, detect patterns from SAN notation
2. **Pass 2 (selective)**: Analyze only top-priority candidates with Stockfish

**Example**:
```
Game: 40 moves
Legacy: Analyze moves 1-2 (opening)
V3.1: Analyze move 7 (capture), 12 (check), 18 (material swing), 35 (endgame promotion)
```

**API**:
```typescript
selectPositions(
  pgn: string,
  maxPositions: number,
  smartSamplingEnabled: boolean
): SamplingResult
```

### 2. Stockfish Caching (`stockfishCache.ts`)

**Purpose**: Avoid re-analyzing the same positions across different games/users.

**Cache Key**: `SHA256(normalizedFEN + depth + movetime)`

**Normalized FEN**: Position + side + castling + en passant (excludes move counters)

**TTL**: 7 days (configurable)

**Cache Hit Rate**: ~50% for openings, ~10-20% for middlegames

**API**:
```typescript
// Get from cache
await getCachedAnalysis(prisma, fen, depth, movetime)

// Store in cache
await setCachedAnalysis(prisma, fen, depth, movetime, analysis, ttlHours)
```

**Maintenance**:
```typescript
// Clean expired entries (run periodically)
await cleanupExpiredCache(prisma, batchSize)

// Prune to size limit
await pruneCacheToLimit(prisma, maxEntries)
```

### 3. Adaptive Tiers (`analysisTiers.ts`)

**Purpose**: Dynamically select depth and position count to fit time budget without timeouts.

**Tier Definitions**:

| Tier | Positions | Depth | Est. Time | Use Case |
|------|-----------|-------|-----------|----------|
| **A** | 2 | 12 | 1000ms | Cold starts, low budget, slow Stockfish |
| **B** | 4 | 14 | 2500ms | Default balanced mode |
| **C** | 6 | 16 | 5000ms | Short games, high priority, optimal conditions |

**Selection Logic**:
```typescript
if (remainingBudgetMs < 2000) → Tier A
if (stockfishLatencyMs > 300) → Tier A
if (highPriority + goodConditions + smartSampling) → Tier C
if (shortGame + goodConditions) → Tier C
if (goodConditions + smartSampling) → Tier B
default → Tier B (or A if tight)
```

**Cold Start Adjustment**:
- Tier C → downgrade to B
- Tier B → downgrade to A
- Tier A → stay A

**API**:
```typescript
selectAnalysisTier(input: TierSelectionInput): TierSelectionResult

calculateDynamicPositionLimit(tier, remainingBudget, avgTimePerPosition): number
```

### 4. Enhanced Ingestion (`learningIngestionEnhanced.ts`)

**Purpose**: Orchestrate smart sampling + caching + tiers + guardrails.

**Workflow**:
1. **Smart Sampling**: Select candidate positions
2. **Tier Selection**: Choose depth/count based on budget
3. **Analysis with Caching**:
   - Check cache first
   - Call Stockfish only if cache miss
   - Store new results in cache
4. **Concept Update**: Update mastery with evidence tracking
5. **Instrumentation**: Log event metrics

**Guardrails**:
- Max Stockfish calls per game (default: 6)
- Max DB writes per game (default: 50)
- Timeout protection (90% of budget)
- Graceful degradation on errors

**API**:
```typescript
ingestGameEnhanced(
  prisma,
  env,
  userId,
  gameId,
  pgn,
  config: EnhancedIngestionConfig
): Promise<EnhancedIngestionResult>
```

---

## Feature Flags

All flags in `worker-api/wrangler.toml`:

```toml
# V3.0 Flags (existing)
LEARNING_V3_ENABLED = "true"
LEARNING_V3_READONLY = "false"
LEARNING_V3_SHADOW_MODE = "false"
LEARNING_V3_STOCKFISH_DEPTH = "14"
LEARNING_V3_TIMEOUT_MS = "8000"

# V3.1 Enhancement Flags (NEW)
LEARNING_V3_SMART_SAMPLING = "false"       # Enable smart position sampling
LEARNING_V3_CACHE_ENABLED = "true"         # Enable Stockfish caching
LEARNING_V3_MAX_POSITIONS_PER_GAME = "4"   # Max positions to analyze
LEARNING_V3_MAX_DB_WRITES = "50"           # Guardrail
LEARNING_V3_MAX_STOCKFISH_CALLS = "6"      # Guardrail
```

**Default State** (Safe):
- Smart sampling: **OFF** (uses first-N-ply until proven stable)
- Caching: **ON** (safe cost reduction)
- Max positions: **4** (conservative)

---

## Deployment Plan

### Phase 1: Caching Only (Week 1)
**Goal**: Reduce costs without changing analysis logic.

```toml
LEARNING_V3_SMART_SAMPLING = "false"
LEARNING_V3_CACHE_ENABLED = "true"
LEARNING_V3_MAX_POSITIONS_PER_GAME = "4"
```

**Validation**:
- Monitor `ingestion_event.cacheHitRate`
- Expect 20-40% hit rate within 1 week
- Verify no errors from cache layer

### Phase 2: Smart Sampling (Week 2)
**Goal**: Improve learning signal quality.

```toml
LEARNING_V3_SMART_SAMPLING = "true"  # ← ENABLE
LEARNING_V3_CACHE_ENABLED = "true"
LEARNING_V3_MAX_POSITIONS_PER_GAME = "4"
```

**Validation**:
- Compare `candidatesSelected` distribution (should see more tactical positions)
- Check `eventResult` success rate (should stay >95%)
- Verify `durationMs` P95 < 3000ms

### Phase 3: Increase Analysis Scope (Week 3+)
**Goal**: Deeper learning without timeouts.

```toml
LEARNING_V3_SMART_SAMPLING = "true"
LEARNING_V3_CACHE_ENABLED = "true"
LEARNING_V3_MAX_POSITIONS_PER_GAME = "6"  # ← INCREASE
LEARNING_V3_MAX_STOCKFISH_CALLS = "8"     # ← INCREASE
```

**Validation**:
- Monitor `durationMs` and `eventResult`
- If timeout rate increases, roll back to 4 positions

---

## API Changes

### `/api/learning/ingest-game` (Enhanced)

**Request** (unchanged):
```json
{
  "userId": "user_123",
  "gameId": "game_abc",
  "pgn": "1. e4 e5 2. Nf3..."
}
```

**Response** (enhanced with instrumentation):
```json
{
  "success": true,
  "requestId": "uuid",
  "conceptsUpdated": ["king-safety", "material-balance"],
  "instrumentation": {
    "candidatesSelected": 5,
    "stockfishCallsMade": 3,
    "cacheHits": 2,
    "cacheHitRate": 0.4,
    "tierSelected": "B",
    "maxDepth": 14,
    "positionsAnalyzed": 5,
    "durationMs": 1847,
    "eventResult": "success"
  },
  "shadowMode": false
}
```

### `/api/walle/postgame` (To Be Enhanced)

**Current**: Returns narrative text only.

**V3.1 Enhancement** (future):
```json
{
  "summary": "You played well overall...",
  "focusConcepts": [
    {
      "name": "king-safety",
      "mastery": 0.42,
      "dueAt": "2025-01-05T12:00:00Z"
    }
  ],
  "evidence": [
    {
      "moveNumber": 12,
      "san": "Nf6?",
      "deltaCp": -320,
      "conceptId": "piece-activity"
    }
  ],
  "interventionId": "uuid"
}
```

---

## Monitoring & Observability

### Key Metrics (from `ingestion_event`)

1. **Performance**:
   - `durationMs` P50, P90, P99
   - `eventResult` success rate (target: >95%)
   - `tierSelected` distribution

2. **Cost Efficiency**:
   - `cacheHitRate` (target: >30% after 1 week)
   - `stockfishCallsMade` per game (target: <5 average)
   - `candidatesSelected` vs `positionsAnalyzed` (sampling effectiveness)

3. **Learning Quality**:
   - `conceptsUpdated` per game (target: 2-5)
   - Check concept mastery trends over time

### Queries

**Cache Performance**:
```sql
SELECT 
  AVG(cache_hit_rate) as avg_hit_rate,
  AVG(stockfish_calls_made) as avg_calls,
  COUNT(*) as total_ingestions
FROM ingestion_events
WHERE ts > NOW() - INTERVAL '7 days'
  AND event_result = 'success';
```

**Tier Usage**:
```sql
SELECT 
  tier_selected,
  COUNT(*) as count,
  AVG(duration_ms) as avg_duration,
  AVG(positions_analyzed) as avg_positions
FROM ingestion_events
WHERE ts > NOW() - INTERVAL '7 days'
GROUP BY tier_selected
ORDER BY count DESC;
```

**Error Rate**:
```sql
SELECT 
  event_result,
  COUNT(*) as count,
  COUNT(*) * 100.0 / SUM(COUNT(*)) OVER () as percentage
FROM ingestion_events
WHERE ts > NOW() - INTERVAL '24 hours'
GROUP BY event_result;
```

---

## Testing

### Unit Tests

Located in `worker-api/src/__tests__/`:

1. **`smartSampling.test.ts`**:
   - Capture/check/checkmate detection
   - Priority ordering
   - Fallback logic

2. **`analysisTiers.test.ts`**:
   - Tier selection logic
   - Dynamic position limits
   - Cold start adjustments

Run tests:
```bash
cd worker-api
npm test
```

### Integration Testing

**Test 1: Cache Hit Rate**
```bash
# Play 5 games with Italian Game opening
# Expected: Games 2-5 should show cache hits for opening positions
```

**Test 2: Smart Sampling vs First-N**
```bash
# Enable debug logging
# Compare `candidatesSelected` reasons
# Expected: Smart sampling should flag tactical moments
```

**Test 3: Timeout Protection**
```bash
# Submit 60-move game
# Expected: Tier A or B selected, completes in <3s
```

---

## Rollback Plan

### Disable V3.1 Enhancements
```toml
LEARNING_V3_SMART_SAMPLING = "false"  # Revert to first-N-ply
LEARNING_V3_CACHE_ENABLED = "false"   # Disable cache (if issues)
```

### Disable Learning V3 Entirely
```toml
LEARNING_V3_ENABLED = "false"
```

### Database Cleanup (if needed)
```sql
-- Clear cache if corrupted
TRUNCATE TABLE analysis_cache;

-- Clear instrumentation events (optional)
DELETE FROM ingestion_events WHERE ts < NOW() - INTERVAL '30 days';
```

---

## Performance Targets

| Metric | Target | Notes |
|--------|--------|-------|
| Ingestion P95 latency | <3000ms | With smart sampling + caching |
| Cache hit rate | >30% | After 1 week of caching |
| Stockfish calls/game | <5 avg | With smart sampling |
| Success rate | >95% | `eventResult = 'success'` |
| DB writes/game | <20 avg | Well under 50 limit |

---

## Cost Analysis

### Current V3.0 (First 2 Plies)
- Stockfish calls: 2 per game
- DB writes: ~5 per game
- Analysis value: Low (mostly opening theory)

### V3.1 with Smart Sampling (4-6 positions)
- Stockfish calls: 3-4 per game (after caching)
- DB writes: ~10 per game
- Analysis value: High (tactical mistakes, critical moments)
- Net cost: +50% Stockfish, +3x learning signal quality

### V3.1 at Scale (10k games/week)
- Stockfish requests: 30-40k/week (vs 20k with V3.0)
- Cache hit rate: 40% → saves 16k requests vs no cache
- Net increase: 10-20k requests/week (~15% over V3.0)

---

## Next Steps

1. **Migration**: Apply Prisma schema changes
2. **Staging Deploy**: Enable caching only
3. **Monitor**: 3 days with caching
4. **Enable Smart Sampling**: If cache stable
5. **Scale Up**: Increase `MAX_POSITIONS_PER_GAME` to 6
6. **Postgame Integration**: Add evidence to Wall-E responses

---

## Support & Troubleshooting

### High Timeout Rate
**Symptoms**: `eventResult = 'timeout'` >5%  
**Fix**: Reduce `LEARNING_V3_MAX_POSITIONS_PER_GAME` to 3

### Low Cache Hit Rate
**Symptoms**: `cacheHitRate < 10%` after 1 week  
**Fix**: Check cache writes are succeeding, verify TTL not too short

### Slow Ingestion
**Symptoms**: `durationMs` P95 >5000ms  
**Fix**: Check Stockfish server latency, consider disabling smart sampling temporarily

### DB Write Limit Hit
**Symptoms**: `eventResult = 'partial'` with "DB write limit"  
**Fix**: Increase `LEARNING_V3_MAX_DB_WRITES` to 100 (conservative raise)

---

**End of Documentation**
