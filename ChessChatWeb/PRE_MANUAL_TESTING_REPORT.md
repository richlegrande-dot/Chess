# Pre-Manual Testing Report - December 31, 2025

## Automated Test Results

### ✅ **PASSING TESTS**

#### 1. Worker API (Chess Move)
- **Endpoint:** `POST /api/chess-move`
- **Status:** ✅ **FUNCTIONAL**
- **Test Result:** 200 OK
- **Response Time:** ~30ms
- **Details:**
  - Successfully generates moves
  - Stockfish depth: 10
  - Returns proper diagnostics
  - Worker call logging works

#### 2. Learning V3 (Game Ingestion)
- **Endpoint:** `POST /api/learning/ingest-game`
- **Status:** ✅ **FUNCTIONAL**
- **Test Result:** 200 OK
- **Response Time:** ~723ms
- **Details:**
  - Full analysis mode working
  - Stockfish warm: YES
  - Concept mastery updates working
  - Returns proper analysis

#### 3. Frontend
- **URL:** `https://chesschat.uk`
- **Status:** ✅ **ACCESSIBLE**
- **Expected:** Loads properly, serves application

#### 4. 404 Prevention
- **Status:** ✅ **WORKING AS EXPECTED**
- **Details:**
  - `/api/wall-e/mistakes` → 404 (correct, endpoint disabled)
  - `/api/wall-e/profile` → 404 (correct, endpoint disabled)
  - `/api/wall-e/games` → 404 (correct, endpoint disabled)
  - `/api/wall-e/metrics` → 404 (correct, endpoint disabled)
  - `/api/health` → 404 (correct, not deployed)

---

### ⚠️ **NOT YET DEPLOYED** (Expected)

#### 1. Capabilities Endpoint
- **Endpoint:** `GET /api/capabilities`
- **Status:** ⚠️ **404 - NOT DEPLOYED YET**
- **Expected:** This is NORMAL - new hardening infrastructure not yet deployed
- **Action Required:** Deploy new hardening infrastructure when ready

#### 2. Chat Endpoint
- **Endpoint:** `POST /api/chat`
- **Status:** ⚠️ **404 - NOT DEPLOYED YET**
- **Expected:** Stub endpoint not in production yet
- **Note:** This was created in hardening work but not deployed

#### 3. Analyze Game Endpoint
- **Endpoint:** `POST /api/analyze-game`
- **Status:** ⚠️ **404 - NOT DEPLOYED YET**
- **Expected:** Stub endpoint not in production yet
- **Note:** This was created in hardening work but not deployed

---

### 🔒 **PROTECTED ENDPOINTS** (Correct Behavior)

These endpoints correctly return 401/403 (authentication required):

- `/api/admin/learning-health` → 401 ✅
- `/api/admin/worker-health` → 401 ✅
- `/api/admin/stockfish-health` → 401 ✅
- `/api/admin/stockfish-warm-status` → 401 ✅
- `/api/admin/worker-calls` → 401 ✅

---

## 📊 Test Summary

| Category | Status | Count |
|----------|--------|-------|
| **Core Functional** | ✅ PASS | 4 |
| **Not Yet Deployed** | ⚠️ Expected | 3 |
| **Protected Admin** | ✅ Correct | 5 |
| **404 Prevention** | ✅ Working | 5 |

---

## 🧪 Manual Testing Checklist

Before you start, here's what to test:

### 1. **Play a Complete Game**
- [ ] Start a new game against CPU
- [ ] Play at least 10 moves
- [ ] Complete the game (win/lose/draw)
- [ ] Verify post-game coaching modal appears

### 2. **Post-Game Analytics**
- [ ] Check that coaching insights display
- [ ] Verify mistakes are shown with move numbers
- [ ] Check that strengths are highlighted
- [ ] Look for milestone notifications (if patterns detected)
- [ ] Verify learning progress updates

### 3. **Console Error Check**
Open DevTools (F12) → Console tab:
- [ ] **ZERO 404 errors** for `/api/wall-e/*` endpoints
- [ ] No error spam (repeated errors)
- [ ] Clean console output
- [ ] Only expected warnings (if any)

### 4. **Network Tab Check**
DevTools → Network tab:
- [ ] Filter by "XHR" or "Fetch"
- [ ] Play a game and complete it
- [ ] Verify no failed requests (red)
- [ ] Check that `/api/chess-move` calls succeed (200)
- [ ] Check that `/api/learning/ingest-game` succeeds (200)

### 5. **localStorage Check**
DevTools → Application → Local Storage:
- [ ] Verify data is being saved
- [ ] Check for player profile data
- [ ] Check for coaching/learning data
- [ ] Verify no corruption messages in console

### 6. **Performance Check**
- [ ] Post-game modal opens quickly (< 1 second)
- [ ] No UI freezing during analysis
- [ ] Smooth gameplay experience
- [ ] CPU moves arrive promptly

### 7. **Different Game Scenarios**
- [ ] Test with CPU level 1 (easy)
- [ ] Test with CPU level 5 (medium)
- [ ] Test with CPU level 10 (hard)
- [ ] Test a very short game (5 moves)
- [ ] Test a longer game (30+ moves)

### 8. **Edge Cases**
- [ ] Reload page mid-game (should restore)
- [ ] Multiple games in succession
- [ ] Different game outcomes (win/loss/draw)
- [ ] Browser back/forward navigation

---

## 🔍 What to Look For

### ✅ **Good Signs:**
- Post-game coaching appears instantly
- No 404 errors in console
- Learning data persists across page reloads
- Coaching advice is specific (includes move numbers)
- Performance is smooth

### ❌ **Red Flags:**
- 404 errors appearing repeatedly
- Post-game modal doesn't appear
- Console spam (same error repeating)
- Data not persisting (localStorage issues)
- UI freezing or sluggish

---

## 🚨 Known Issues (Expected)

### 1. **Capabilities Endpoint 404**
- **What:** `/api/capabilities` returns 404
- **Why:** New hardening infrastructure not yet deployed
- **Impact:** None - existing functionality unaffected
- **Fix:** Deploy hardening infrastructure when ready

### 2. **Chat/Analyze-Game 404s**
- **What:** These stub endpoints return 404
- **Why:** Not yet deployed to production
- **Impact:** None - these features not actively used
- **Fix:** Deploy with hardening infrastructure

### 3. **Admin Endpoints Protected**
- **What:** Admin endpoints return 401
- **Why:** Correctly protected, requires authentication
- **Impact:** None - admin features not for public use
- **Fix:** None needed - working as designed

---

## 📈 Performance Expectations

Based on current test results:

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Chess Move API | ~30ms | < 100ms | ✅ Excellent |
| Learning Ingest | ~723ms | < 1000ms | ✅ Good |
| Post-Game Modal | N/A | < 500ms | 🧪 Manual test |
| Frontend Load | N/A | < 2s | 🧪 Manual test |

---

## 🎯 Test Focus Areas

### **HIGH PRIORITY:**
1. ✅ Worker functionality (chess moves)
2. ✅ Learning V3 (game ingestion)
3. 🧪 Post-game coaching display
4. 🧪 Console errors (should be zero 404s)

### **MEDIUM PRIORITY:**
5. 🧪 Performance (modal open speed)
6. 🧪 Data persistence (localStorage)
7. 🧪 Multiple game scenarios

### **LOW PRIORITY:**
8. Edge cases (reload, navigation)
9. Different CPU levels
10. Very long games

---

## 📝 Notes for Manual Testing

### Before Starting:
1. Clear browser cache (Ctrl+Shift+Delete)
2. Open DevTools (F12)
3. Go to Console tab - keep it visible
4. Start recording in Network tab

### During Testing:
- Note any errors immediately
- Screenshot any issues
- Check console after every major action
- Monitor Network tab for failed requests

### After Testing:
- Check Application → Local Storage for data
- Review Console for any warnings
- Verify no memory leaks (check Memory in DevTools)
- Document any unexpected behavior

---

## ✅ Ready for Manual Testing

**Current Status:**
- ✅ Backend APIs functional
- ✅ Worker operational
- ✅ Learning V3 working
- ✅ 404 prevention active
- ⚠️ New hardening features not yet deployed (expected)

**Recommendation:**
Proceed with manual testing. Focus on core game flow and post-game analytics. The absence of new hardening endpoints is expected and won't impact current functionality.

**Next Steps After Manual Testing:**
1. If issues found → document and fix
2. If all good → deploy hardening infrastructure
3. Re-test with `?debug=1` to verify new features
4. Full production rollout

---

## 🆕 Learning V3.1 Enhancement Testing (Added: January 2025)

### Automated Validation Results

**Test Script:** `worker-api/validate-v3.1-features.mjs`  
**Test Date:** January 2025  
**Test Results:** ✅ **56/56 PASSED (100%)**

#### ✅ **Smart Sampling Module** (28 tests)
- **Purpose:** Intelligently select tactically rich positions for analysis
- **Status:** ✅ ALL TESTS PASSED
- **Tests Validated:**
  - ✅ Capture detection (Nxf6, exd5, Qxh7+)
  - ✅ Check detection (Nf3+, Qh5+)
  - ✅ Checkmate detection (Qxf7#, Bxf7#)
  - ✅ Promotion detection (e8=Q, e8=N)
  - ✅ Castling detection (O-O, O-O-O)
  - ✅ Material balance calculation (FEN-based)
  - ✅ Priority ordering (checkmate > promotion > check > captures)

**Key Features:**
- Replaces "first 2 moves" limitation with smart tactical position selection
- Detects captures, checks, checkmates, promotions, material swings
- Prioritizes most interesting positions for analysis
- Configurable via `LEARNING_V3_MAX_POSITIONS_PER_GAME` flag (default: 4)

---

#### ✅ **Analysis Tiers Module** (14 tests)
- **Purpose:** Dynamically adjust analysis depth based on time budget
- **Status:** ✅ ALL TESTS PASSED
- **Tests Validated:**
  - ✅ Tier selection logic (A: 2 pos/depth 12, B: 4 pos/depth 14, C: 6 pos/depth 16)
  - ✅ Budget-based position limiting
  - ✅ Cold start adjustments (downgrades tier on cold start)
  - ✅ Tier configuration validation
  - ✅ Dynamic position limit calculation

**Key Features:**
- Three adaptive tiers: A (fast), B (balanced), C (deep)
- Automatically downgrades on cold starts to prevent timeouts
- Uses 80% of time budget to ensure operations complete before timeout
- Balances analysis quality with performance constraints

---

#### ✅ **Cache Key Generation** (5 tests)
- **Purpose:** Deterministic caching of Stockfish analysis results
- **Status:** ✅ ALL TESTS PASSED
- **Tests Validated:**
  - ✅ FEN normalization (ignores move counters)
  - ✅ Position uniqueness (different positions → different keys)
  - ✅ Depth differentiation (same position, different depth → different keys)
  - ✅ Key collision avoidance

**Key Features:**
- SHA256-based cache keys for deterministic lookups
- 7-day TTL for cache entries
- Automatic cache pruning (10,000 entry limit)
- Reduces Stockfish computation costs via cache hits
- Configurable via `LEARNING_V3_CACHE_ENABLED` flag (default: true)

---

#### ✅ **Integration Patterns** (9 tests)
- **Purpose:** Production guardrails and instrumentation
- **Status:** ✅ ALL TESTS PASSED
- **Tests Validated:**
  - ✅ Stockfish call limit enforcement (max 6 per game)
  - ✅ DB write limit enforcement (max 50 per game)
  - ✅ Timeout protection (90% budget usage)
  - ✅ Cache hit rate calculation
  - ✅ Instrumentation tracking (events logged to `ingestion_events` table)

**Key Features:**
- Guardrails prevent runaway operations
- Configurable limits via feature flags:
  - `LEARNING_V3_MAX_STOCKFISH_CALLS` (default: 6)
  - `LEARNING_V3_MAX_DB_WRITES` (default: 50)
- Full instrumentation for monitoring:
  - Cache hit rates
  - Tier selections
  - Duration tracking
  - Error/timeout events

---

### Database Schema Updates

**New Tables Added:**

#### 1. `analysis_cache` (Stockfish result caching)
```sql
- cache_key (TEXT PRIMARY KEY) - SHA256 hash of position+depth
- fen (TEXT NOT NULL) - Chess position
- depth (INT NOT NULL) - Analysis depth
- evaluation_cp (INT) - Centipawn evaluation
- mate_in (INT) - Mate distance (if applicable)
- best_move (TEXT) - Best move in UCI format
- pv_line (TEXT[]) - Principal variation
- hit_count (INT DEFAULT 1) - Number of cache hits
- created_at (TIMESTAMP) - Cache entry creation time
- expires_at (TIMESTAMP) - TTL expiration (7 days)

INDEXES:
- PRIMARY KEY: cache_key
- INDEX: fen (for lookup by position)
- INDEX: expires_at (for cleanup queries)
```

#### 2. `ingestion_events` (Performance instrumentation)
```sql
- id (SERIAL PRIMARY KEY)
- user_id (TEXT NOT NULL) - User who triggered ingestion
- game_id (TEXT) - Game identifier
- candidates_selected (INT) - Number of positions selected by smart sampling
- stockfish_calls_made (INT) - Actual Stockfish API calls
- cache_hits (INT) - Number of cache hits
- cache_misses (INT) - Number of cache misses
- cache_hit_rate (FLOAT) - Calculated hit rate
- tier_selected (TEXT) - Which tier was used (A/B/C)
- max_depth (INT) - Maximum analysis depth used
- positions_analyzed (INT) - Total positions analyzed
- duration_ms (INT) - Total operation duration
- event_result (TEXT) - 'success', 'error', 'timeout', 'guardrail_hit'
- created_at (TIMESTAMP DEFAULT NOW())

INDEXES:
- PRIMARY KEY: id
- INDEX: user_id, created_at (for user performance queries)
- INDEX: event_result (for error tracking)
```

---

### Feature Flags Configuration

**Added to `wrangler.toml`:**

```toml
# Learning V3.1 Feature Flags
LEARNING_V3_SMART_SAMPLING = "false"           # OFF until Phase 2
LEARNING_V3_CACHE_ENABLED = "true"             # ON immediately (safe)
LEARNING_V3_MAX_POSITIONS_PER_GAME = "4"       # Smart sampling limit
LEARNING_V3_MAX_DB_WRITES = "50"               # Write guardrail
LEARNING_V3_MAX_STOCKFISH_CALLS = "6"          # API call guardrail
```

**Safety Notes:**
- Smart sampling disabled by default (requires Phase 2 deployment)
- Caching enabled immediately (no risk, only benefits)
- Guardrails prevent runaway costs
- All limits configurable via environment variables

---

### Manual Testing Checklist for V3.1

#### Phase 1: Cache Validation (Safe to Test Now)
- [ ] Deploy with `LEARNING_V3_CACHE_ENABLED = "true"`
- [ ] Play 2 games with identical opening moves
- [ ] Check `analysis_cache` table for entries
- [ ] Verify `ingestion_events` shows cache hits on second game
- [ ] Confirm cache hit rate > 0% for repeated positions
- [ ] Check `expires_at` timestamps (should be 7 days from creation)

**Expected Outcomes:**
- First game: All cache misses (cold start)
- Second game: Some cache hits for repeated positions
- No performance degradation
- Cache entries visible in database

---

#### Phase 2: Smart Sampling (Requires Schema Migration)
- [ ] Run database migration: `npx prisma migrate deploy`
- [ ] Verify new tables exist: `analysis_cache`, `ingestion_events`
- [ ] Set `LEARNING_V3_SMART_SAMPLING = "true"` in wrangler.toml
- [ ] Deploy to preview environment
- [ ] Play test game with tactical positions (captures, checks)
- [ ] Check `ingestion_events` table for `candidates_selected` > 2
- [ ] Verify analysis covers mid-game tactics, not just opening moves
- [ ] Confirm no timeouts (tier system should prevent them)

**Expected Outcomes:**
- Smart sampling selects 4+ interesting positions (not just first 2 moves)
- Captures, checks, and tactical moments prioritized
- Analysis tier selected based on conditions (A/B/C)
- No 8-second timeouts (90% budget protection)
- Instrumentation logged to `ingestion_events`

---

#### Phase 3: Tier System Validation
- [ ] Cold start test: First game after deployment
  - Expected: Tier A or B selected (safer)
- [ ] Warm test: Second/third game in sequence
  - Expected: Tier B or C selected (more aggressive)
- [ ] Low time budget test: Set shorter timeout
  - Expected: Tier A selected, fewer positions
- [ ] Check `ingestion_events.tier_selected` column
- [ ] Verify `max_depth` matches tier specification

**Expected Tier Behavior:**
- **Tier A:** 2 positions, depth 12, ~1000ms (cold start/low budget)
- **Tier B:** 4 positions, depth 14, ~2500ms (normal conditions)
- **Tier C:** 6 positions, depth 16, ~5000ms (optimal conditions)

---

#### Phase 4: Guardrail Testing
- [ ] Play very long game (50+ moves)
- [ ] Check `ingestion_events.stockfish_calls_made` ≤ 6
- [ ] Verify no DB write errors (should stop at 50 writes max)
- [ ] Check `event_result` column for 'guardrail_hit' events
- [ ] Confirm graceful handling (no crashes, proper logging)

**Expected Guardrail Behavior:**
- Max 6 Stockfish calls per game (even with 50+ moves)
- Max 50 DB writes per game
- Operations stop gracefully when limits hit
- Event logged with `event_result = 'guardrail_hit'`

---

### 🧪 Database Query Samples

#### Check Cache Performance
```sql
SELECT 
  COUNT(*) as total_entries,
  SUM(hit_count) as total_hits,
  AVG(hit_count) as avg_hits_per_entry
FROM analysis_cache
WHERE expires_at > NOW();
```

#### Monitor Instrumentation
```sql
SELECT 
  user_id,
  tier_selected,
  cache_hit_rate,
  duration_ms,
  event_result,
  created_at
FROM ingestion_events
ORDER BY created_at DESC
LIMIT 20;
```

#### Cache Hit Rate by User
```sql
SELECT 
  user_id,
  COUNT(*) as games,
  AVG(cache_hit_rate) as avg_hit_rate,
  AVG(duration_ms) as avg_duration
FROM ingestion_events
WHERE event_result = 'success'
GROUP BY user_id
ORDER BY games DESC;
```

---

### 📊 V3.1 Success Metrics

| Metric | V3.0 Baseline | V3.1 Target | How to Measure |
|--------|---------------|-------------|----------------|
| Positions Analyzed | 2 (first 2 plies) | 4-6 (tactical) | `ingestion_events.positions_analyzed` |
| Cache Hit Rate | 0% (no cache) | 30-50% | `ingestion_events.cache_hit_rate` |
| Analysis Timeouts | ~5% of games | < 1% | `event_result = 'timeout'` count |
| Stockfish Calls/Game | 2 (no cache) | 1-6 (with cache) | `ingestion_events.stockfish_calls_made` |
| DB Writes/Game | ~20 | ~20-50 (capped) | Query `concept_mastery_updates` count |

---

### 🚨 V3.1 Known Limitations

1. **Smart Sampling Disabled by Default**
   - **Why:** Requires database migration + testing
   - **Impact:** Still using "first 2 plies" until Phase 2
   - **Fix:** Set `LEARNING_V3_SMART_SAMPLING = "true"` after migration

2. **Cache Warm-Up Period**
   - **Why:** Cache empty on first deployment
   - **Impact:** No cache hits for first ~100 games
   - **Fix:** Performance improves automatically as cache fills

3. **Tier Selection Conservative on Cold Start**
   - **Why:** Prevents timeouts on fresh deployments
   - **Impact:** First few games use Tier A (less deep analysis)
   - **Fix:** Auto-upgrades to Tier B/C after warm-up

---

### ✅ V3.1 Deployment Readiness

**Automated Tests:** ✅ 56/56 passed (100%)  
**Database Schema:** ✅ Ready (migration script provided)  
**Feature Flags:** ✅ Configured with safe defaults  
**Documentation:** ✅ Complete (4 comprehensive docs)  
**Rollback Plan:** ✅ Documented in `LEARNING_V3.1_MIGRATION.md`

**Recommendation:**
- **Phase 1 (Immediate):** Deploy cache only (`LEARNING_V3_CACHE_ENABLED = "true"`)
- **Phase 2 (After testing):** Enable smart sampling + run migration
- **Phase 3 (Monitor):** Observe cache hit rates and tier selections via `ingestion_events`

---

**V3.1 Test Date:** January 2025  
**V3.1 Test Status:** ✅ Automated validation complete (100% pass rate)  
**Next Step:** Manual testing of cache behavior, then smart sampling deployment

---

**Test Date:** December 31, 2025  
**Tester:** Ready for manual verification  
**Status:** ✅ Automated tests passed, ready for manual testing
