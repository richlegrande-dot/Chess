# Admin Learning Diagnostics - User Guide

**Last Updated:** January 2, 2026  
**Status:** ✅ Production-Grade  
**Access:** Admin Portal → 🤖 Wall-E Learning Tab

---

## 📋 Overview

The Wall-E Learning Diagnostics Tab is a production-hardened admin tool for troubleshooting the learning system end-to-end. It answers critical questions:

1. **Did the system ingest?** (Recent Events panel)
2. **Did it analyze?** (Event payload inspection)
3. **Did it write?** (Configuration + Database Tables)
4. **Why does user see "0 concepts updated"?** (Troubleshooting Guide)

---

## 🎯 Access & Authentication

**URL:** `https://chesschat.uk/admin` (or your domain)  
**Auth:** Requires admin token (same as other admin tabs)  
**Tab:** "🤖 Wall-E Learning" (7th tab)

**First Time Setup:**
1. Navigate to admin portal
2. Unlock with admin password
3. Click "🤖 Wall-E Learning" tab
4. Health and events load automatically

---

## 📊 Panel Breakdown

### 1. System Health Dashboard

**Purpose:** Quick health check of Learning V3 system

**Metrics:**
- **Overall Status:** Healthy/Unhealthy visual indicator
- **Configuration Display:**
  - Enabled: Is learning system turned on?
  - Read-Only Mode: Are writes disabled?
  - Shadow Mode: Is system logging but not writing?
  - Canary Testing: Is gradual rollout active?
- **Database Table Counts:**
  - User Concept States (mastery records)
  - Learning Events (audit trail)
  - Advice Interventions (coaching recommendations)
  - Practice Plans (generated training plans)

**How to Read:**
- ✅ **Green + Healthy:** System functional, writes enabled
- ⚠️ **Yellow + Read-Only:** System logging but not writing
- 🔍 **Shadow Mode:** Ingesting but not persisting (testing)
- ❌ **Red + Unhealthy:** Database connection or auth issue

**Troubleshooting:**
- If status shows "Endpoint not deployed (404)": Health endpoint not in Worker
- If status shows "Admin auth required": Token expired, re-unlock
- If status shows "Backend error (500)": Check Worker logs for database issues

---

### 2. Proof of Learning (Recent Events)

**Purpose:** Show actual ingestion attempts to diagnose "Did it work?"

**Features:**
- Last 50 learning events (most recent first)
- Status badges: SUCCESS (green), PARTIAL (yellow), FAILED (red)
- Filters: All / Failed Only / Last Hour / Last 24h
- Event details:
  - Event type (GAME_INGESTED, CONCEPT_UPDATED, etc.)
  - Hashed user ID (privacy-safe, first 8 chars of hash)
  - Game ID (first 8 chars)
  - Concepts updated count
  - Duration in milliseconds
  - Error codes (if failed)
  - Flags snapshot (enabled, shadow, readonly, async, maxPly)

**How to Use:**
1. Click **"🔄 Events"** button to refresh
2. Use filters to find specific issues (e.g., "Failed Only")
3. Click **"📋 Copy JSON"** on any event to get full payload
4. Check timestamps to verify async processing delay

**Interpreting Results:**
- **SUCCESS events appearing:** Ingestion is working ✅
- **No events at all:** Postgame UI not calling ingestion endpoint ❌
- **PARTIAL events:** Analysis started but incomplete (timeout likely)
- **FAILED events:** Check errorCode in payload (e.g., "TIMEOUT", "DB_WRITE_FAILED")
- **Flags show shadow=true:** Writes disabled, explains "0 concepts updated"

**Privacy Note:**
- User IDs are hashed by default (e.g., `a1b2c3d4`)
- To see full user IDs (for debugging), add `?includeUserIds=true` to endpoint call (admin auth required)

---

### 3. User Progress Lookup

**Purpose:** Inspect specific user's learning data for support tickets

**How to Use:**
1. Enter user ID in input field (e.g., `guest-1704240000000`)
2. Click **"🔍 Look Up"** button
3. Or click **"👤 Get My ID"** to auto-fill current browser's user ID

**Results Display:**
- **Games Analyzed:** Total games ingested (if 0, ingestion not wired)
- **Concepts Tracked:** Number of concepts with mastery data
- **Avg Mastery:** Overall skill level (0-100%)
- **Last Ingested:** Timestamp of most recent game analysis
- **Weakest Concepts:** Top 5 areas to improve (red/yellow bars)
- **Strongest Concepts:** Top 5 mastered skills (green bars)
- **Recent Key Moments:** Last 5 games with blunders/mistakes/accuracy

**Validation Tip:**
- Test endpoint directly: Click link to `/api/learning/progress?userId=test`
- Should return 404 if user doesn't exist, or valid JSON with data
- If endpoint returns 404 always, it's not deployed yet

**Common Patterns:**
- **Games Analyzed = 0:** Postgame not calling ingestion (expected per docs)
- **Games Analyzed > 0 but user reports "no progress":** Learning is working, UI showing stale localStorage
- **All mastery = 0:** User just started, not enough data yet
- **Last Ingested = "Never":** User exists but no games recorded

---

### 4. Troubleshooting Guide (Expandable Sections)

**Built-in Solutions for Top 5 Issues:**

#### Issue #1: "0 concepts updated" in postgame
**Symptoms:** User finishes game, postgame shows "0 concepts updated" message  
**Root Causes:**
- Shadow mode enabled (system logging but not writing)
- Readonly mode enabled (writes blocked)
- Async processing queued (not yet complete)
- Render cold start (timeout)
- Environment variable `STOCKFISH_GAME_ANALYSIS_ENABLED` not set

**Diagnostic Steps:**
1. Check System Health → Configuration → Shadow Mode (should be ✅ No)
2. Check Recent Events panel for user's game (look for SUCCESS status)
3. Look up user ID → verify gamesAnalyzed increments after games
4. If gamesAnalyzed > 0 but UI says "0", it's a stub endpoint issue (not a bug)

**Solution:**
- If shadow mode: Disable it (`STOCKFISH_SHADOW_MODE=false`)
- If async delay: Wait 30-60s, check again
- If always 0 but Recent Events show SUCCESS: Postgame message is from stub, learning IS working

---

#### Issue #2: Training Portal shows "32 games tracked"
**Symptoms:** User's training portal stuck at "32 games" no matter how many games played  
**Root Cause:** localStorage sample data from migration, not server data

**Diagnostic Steps:**
1. Check user's actual gamesAnalyzed in User Progress Lookup
2. If it shows correct count (e.g., 50), localStorage is stale

**Solution:**
- Instruct user to hard refresh (Ctrl+Shift+R on Windows, Cmd+Shift+R on Mac)
- This clears cache and loads new bundle that fetches from server
- Training portal should now show real data from `/api/learning/progress`

---

#### Issue #3: No concept states for active user
**Symptoms:** User plays 10 games, lookup shows 0 concepts tracked  
**Root Causes:**
- Ingestion not wired (postgame not calling endpoint)
- Read-only mode blocking writes
- Render timeout preventing analysis
- Database connectivity issues

**Diagnostic Steps:**
1. Check Recent Events panel for any events with user's ID hash
2. If no events: Ingestion flow NOT wired (expected per architecture docs)
3. If events exist but FAILED: Check errorCode in payload
4. If events exist with SUCCESS: Check Learning Events table count (should increment)

**Solution:**
- If no events: This is the documented "UI disconnect" - postgame doesn't call ingestion
- If FAILED events: Check Worker logs for Render timeout or database errors
- If SUCCESS events but 0 concepts: Check shadow mode or readonly mode

---

#### Issue #4: How to verify ingestion wiring
**Symptoms:** Unsure if postgame flow is calling ingestion endpoint

**Test Process:**
1. Play a complete game (any difficulty)
2. Note your user ID (click "Get My ID" button)
3. Wait 30-60 seconds (async processing delay)
4. Look up your user ID in this admin panel
5. Check gamesAnalyzed stat
6. Check Recent Events panel (filter by Last Hour)

**Expected Results:**
- **If gamesAnalyzed = 0 AND no events:** Ingestion NOT wired (documented state)
- **If gamesAnalyzed > 0 AND events exist:** Ingestion IS wired (working correctly)
- **If gamesAnalyzed = 0 BUT events show FAILED:** Ingestion wired but failing (check errorCode)

**DevTools Verification:**
- Open browser DevTools → Network tab
- Play a game
- Filter for `/api/learning/ingest-game`
- If no POST request appears: Postgame UI not calling endpoint

---

#### Issue #5: How to enable learning if disabled
**Symptoms:** Configuration shows "❌ Disabled" or "⚠️ Read-Only Mode"

**Required Environment Variables (Worker):**
```bash
STOCKFISH_GAME_ANALYSIS_ENABLED=true
DATABASE_URL=prisma://accelerate.prisma-data.net/?api_key=your_key
STOCKFISH_SERVER_URL=https://chesschat-stockfish.onrender.com
STOCKFISH_API_KEY=your_stockfish_key
```

**Optional Flags:**
```bash
# Disable shadow mode (allow writes)
STOCKFISH_SHADOW_MODE=false

# Disable readonly mode (allow writes)
STOCKFISH_READONLY_MODE=false

# Enable canary testing (gradual rollout)
STOCKFISH_CANARY_ENABLED=true
STOCKFISH_CANARY_PERCENTAGE=10
```

**Deployment Steps:**
1. Set environment variables in Cloudflare Worker dashboard
2. Redeploy: `cd worker-api && wrangler deploy`
3. Or push to main branch (auto-deploy)
4. Refresh admin portal → verify Configuration shows "✅ Active"

---

## 🔧 Technical Implementation Details

### Hardening Features (Production-Grade)

**Type Safety:**
- All API responses defensively parsed with fallbacks
- Mastery values clamped between 0 and 1
- Safe date formatters handle invalid/null timestamps
- Defensive checks for missing/undefined fields

**Request Management:**
- AbortController for all fetch requests (cancel on unmount)
- Request sequence counter prevents race conditions
- Latest response wins if multiple requests in-flight
- Separate loading states for health/progress/events

**Error Handling:**
- Specific error messages for 401/403/404/5xx
- HTTP status displayed in error banner
- Request ID shown for backend correlation
- Network timeouts handled gracefully
- Aborted requests don't trigger errors

**Privacy & Security:**
- Admin auth required (Bearer token in header)
- User IDs hashed in Recent Events (default)
- No secrets in URLs (Authorization header only)
- Rate limiting via input debounce (300ms)
- No auto-polling (manual refresh only)

**UX Improvements:**
- Loading spinners per-section (health, progress, events)
- Last known good health data shown while refreshing
- Dismissable error banner
- Keyboard support (Enter key to submit)
- Responsive layout (mobile/tablet friendly)
- Mastery bars color-coded (red < 30%, yellow < 70%, green ≥ 70%)

---

## 🚀 Endpoints Used

### Frontend → Worker API

**1. GET /api/admin/learning-health**
- **Auth:** Bearer token required
- **Returns:** System configuration + database table counts
- **Used by:** System Health panel
- **Refresh:** Manual via "🔄 Health" button

**2. GET /api/learning/progress?userId=X**
- **Auth:** None (user-safe endpoint)
- **Returns:** User's games, concepts, mastery, recent moments
- **Used by:** User Progress Lookup panel
- **Refresh:** Per-lookup (not cached)

**3. GET /api/admin/learning-recent?limit=50**
- **Auth:** Bearer token required
- **Returns:** Recent 50 learning events with hashed user IDs
- **Query params:**
  - `limit` (max 100)
  - `includeUserIds=true` (show full IDs, admin only)
- **Used by:** Recent Events panel
- **Refresh:** Manual via "🔄 Events" button

---

## 📈 Interpreting System State

### Healthy System (All Green)
```
Status: HEALTHY
Configuration:
  - Enabled: ✅ Yes
  - Read-Only: ✅ No
  - Shadow Mode: ✅ No
  
Recent Events: SUCCESS events appearing regularly
User Lookup: gamesAnalyzed incrementing after games
```

### Testing/Staging System (Yellow)
```
Status: HEALTHY
Configuration:
  - Enabled: ✅ Yes
  - Read-Only: ⚠️ Yes (or Shadow Mode: 🔍 Yes)
  
Recent Events: Events appearing but conceptsUpdated = 0
User Lookup: gamesAnalyzed increments, but concepts stay at 0
```
**Interpretation:** System is logging but not persisting (intentional for testing)

### Disabled System (Red)
```
Status: UNHEALTHY or UNKNOWN
Configuration:
  - Enabled: ❌ No
  
Recent Events: No events
User Lookup: All users show 0 games
```
**Interpretation:** Environment variable `STOCKFISH_GAME_ANALYSIS_ENABLED` not set

### Ingestion Not Wired (Architecture Disconnect)
```
Status: HEALTHY
Configuration: All ✅ (enabled, no shadow, no readonly)
Recent Events: No events at all
User Lookup: All users show 0 games
```
**Interpretation:** Backend ready, but postgame UI not calling `/api/learning/ingest-game`  
**This is documented behavior** per AGENT_HANDOFF_JAN2_2026.md

---

## 🧪 Testing Workflow (Post-Deployment)

### 1. Verify Tab Appears
- [ ] Navigate to admin portal
- [ ] Unlock with admin token
- [ ] See "🤖 Wall-E Learning" tab (7th position)
- [ ] Click tab, no console errors

### 2. Test Health Check
- [ ] Health panel loads automatically
- [ ] Status shows "HEALTHY" (green)
- [ ] Configuration shows correct values
- [ ] Database tables show non-zero counts
- [ ] Click "🔄 Health" button, data refreshes

### 3. Test Recent Events
- [ ] Events panel shows recent events (if any exist)
- [ ] User IDs are hashed (e.g., `a1b2c3d4`)
- [ ] Filter buttons work (All / Failed / 1h / 24h)
- [ ] "Copy JSON" button copies event to clipboard
- [ ] If no events: Shows "No recent events found" message

### 4. Test User Lookup
- [ ] Click "👤 Get My ID", fills input with localStorage user ID
- [ ] Enter valid user ID, click "🔍 Look Up"
- [ ] Results show correct stats (gamesAnalyzed, concepts, mastery)
- [ ] Concept bars render correctly (color-coded)
- [ ] Enter invalid ID, shows error message

### 5. Test Error States
- [ ] Disconnect network, click refresh → shows timeout error
- [ ] Use expired admin token → shows auth error
- [ ] Look up non-existent user → shows 404 error
- [ ] All errors dismissable via X button

### 6. Test with Real User Data
- [ ] Play a game on chesschat.uk
- [ ] Get user ID from DevTools: `localStorage.getItem('userId')`
- [ ] Look up user ID in admin panel
- [ ] Verify gamesAnalyzed increments (if ingestion wired)
- [ ] Check Recent Events for game (if ingestion wired)

---

## 🐛 Known Limitations

1. **No Real-Time Updates:** Must manually refresh health/events
2. **Limited History:** Only shows last 50 events (configurable via `?limit`)
3. **No Export:** Can't download CSV of events or user data
4. **No Filtering by User:** Must look up one user at a time
5. **Hashed User IDs:** Recent Events hides full IDs by default (privacy)

**Workarounds:**
- For real-time monitoring: Poll health endpoint externally (e.g., cron job)
- For bulk exports: Query database directly via Prisma Studio
- For user filtering: Use Worker logs or database queries
- For full user IDs: Add `?includeUserIds=true` to `/api/admin/learning-recent`

---

## 🔮 Future Enhancements (Not Yet Implemented)

- [ ] Auto-refresh toggle (30s interval)
- [ ] WebSocket connection for live events
- [ ] CSV export of events/progress
- [ ] Batch user lookup (search by date range, mastery level)
- [ ] Event filtering by event type (GAME_INGESTED vs CONCEPT_UPDATED)
- [ ] Concept distribution chart (mastery histogram)
- [ ] Practice plan preview
- [ ] Database reset tools (clear test data)
- [ ] Enable/disable learning system from admin UI (not just env vars)

---

## 📞 Support

**Issues to Report:**
- Tab doesn't load → Check browser console for errors
- Health shows 404 → Endpoint not deployed, redeploy Worker
- Auth errors → Re-unlock admin portal
- Events empty but learning should work → Check Worker logs for ingestion calls

**Debug Checklist:**
1. Check [AGENT_HANDOFF_JAN2_2026.md] for known UI disconnect
2. Check Worker logs in Cloudflare dashboard
3. Check Render Stockfish logs (if analysis timeout suspected)
4. Check database connectivity (DATABASE_URL env var)
5. Use this admin tab to verify end-to-end flow

**Contact:**
- Refer to AGENT_HANDOFF_LEARNING_TAB_JAN2_2026.md for implementation details
- Refer to ARCHITECTURE_CLARIFICATION_JAN2026.md for Wall-E system architecture

---

**Document Version:** 1.0  
**Last Updated:** January 2, 2026  
**Status:** Production-Ready ✅
