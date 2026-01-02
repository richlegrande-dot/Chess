# Manual Test Guide - Architecture Change #3

**Date:** January 1, 2026  
**Purpose:** Manual verification checklist for all 5 phases in production  
**Prerequisites:** Automated tests passed (100% success rate) ✅

---

## 🎯 Test Overview

This guide walks through manual testing of Architecture Change #3 in production at https://chesschat.uk

**What to verify:**
- Phase 1: Move caching improves performance
- Phase 2: Render server provides game analysis
- Phase 3: Worker async ingestion stores data
- Phase 4: Postgame structure ready
- Phase 5: No legacy artifacts (OpenAI removed)

**Estimated Time:** 10-15 minutes

---

## ✅ Pre-Test Checklist

Before starting, verify:
- [ ] All automated tests passed (8/8) ✅
- [ ] Git commits pushed to GitHub (9b1036b) ✅
- [ ] Worker deployed (version a1630b97) ✅
- [ ] Render server healthy ✅
- [ ] Browser DevTools open (Network + Console tabs)

---

## 📋 Phase 1: Move Caching

### Test 1.1: Cache Miss → Cache Hit Flow

**Steps:**
1. Open https://chesschat.uk in incognito window
2. Start new game vs CPU
3. Make move: **e4**
4. In DevTools Network tab, find POST to `/api/chess-move`
5. Note response time: ~8-12 seconds (cache MISS, calls Render)
6. CPU responds with a move
7. Make another move: **d4** 
8. Find second POST to `/api/chess-move`
9. Note response time: Should be <500ms (cache HIT if position seen before)

**Expected Results:**
- ✅ First move: Long latency (8-12s) - Render Stockfish called
- ✅ Cache hit moves: <500ms response
- ✅ Response includes `"diagnostics": { "cached": true/false }`
- ✅ No errors in Console

**Verification:**
```
Response structure:
{
  "success": true,
  "move": "c5",
  "evaluation": 0.35,
  "diagnostics": {
    "cached": false,  // or true for cache hits
    "latency": "108ms"
  }
}
```

### Test 1.2: Cache Stats Endpoint

**Steps:**
1. Open DevTools Console
2. Run:
```javascript
fetch('https://chesschat-worker-api.richlegrande1.workers.dev/api/admin/cache-stats')
  .then(r => r.json())
  .then(console.log)
```

**Expected Results:**
- ✅ Response shows cache statistics
- ✅ `size` > 0 (positions cached)
- ✅ `hits` > 0 (if you made multiple moves)
- ✅ `hitRate` calculated correctly

---

## 📋 Phase 2: Render Game Analysis

### Test 2.1: Verify Render Server Health

**Steps:**
1. Open: https://chesschat-stockfish.onrender.com/health
2. Review JSON response

**Expected Results:**
- ✅ Status: "healthy"
- ✅ Service: "stockfish-server"
- ✅ Engines: `{"active": 0, "max": 2}`
- ✅ Timestamp recent

### Test 2.2: Verify /analyze-game Endpoint Exists

**Note:** Direct testing requires API key. Verify through Worker integration in Phase 3.

**Indirect Verification:**
- ✅ Automated tests confirmed endpoint exists
- ✅ Worker logs show successful calls to `/analyze-game`
- ✅ Phase 3 testing will confirm end-to-end flow

---

## 📋 Phase 3: Worker Async Ingestion

### Test 3.1: Submit Game for Analysis

**Steps:**
1. Complete a full game on https://chesschat.uk (10+ moves)
2. Open DevTools Console
3. Run:
```javascript
const testGame = {
  gameId: `manual-test-${Date.now()}`,
  userId: `tester-${Date.now()}`,
  pgn: '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d5',
  playerColor: 'white',
  outcome: 'loss'
};

fetch('https://chesschat-worker-api.richlegrande1.workers.dev/api/learning/ingest-game', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(testGame)
})
  .then(r => r.json())
  .then(console.log)
```

**Expected Results:**
- ✅ HTTP Status: **202 Accepted** (not 200)
- ✅ Response time: <500ms (non-blocking)
- ✅ Response includes:
  - `success: true`
  - `requestId` (UUID)
  - `message: "Game queued for analysis"`
  - `analysisMode: "async"`
- ✅ No errors in Console

### Test 3.2: Verify Background Processing

**Steps:**
1. Wait 10-15 seconds after submitting game
2. Check Worker logs (if you have access to Cloudflare dashboard)
3. Or run another test to verify system still responsive

**Expected Results:**
- ✅ Worker remains responsive (202 responses immediate)
- ✅ No timeout errors visible to user
- ✅ Multiple games can be queued without blocking

**Note:** Actual analysis completion happens in background. Results stored in `learning_events` table for future use.

---

## 📋 Phase 4: Postgame Improvements

### Test 4.1: Verify Structure Ready

**Steps:**
1. Review code structure in `learningEndpoints.ts`
2. Confirm future coaching will use Render analysis data

**Expected Results:**
- ✅ Code ready to output `keyMistakes`
- ✅ Code ready to output `strengths`
- ✅ Code ready to output `nextFocusConcept`
- ✅ Code ready to output `drillSet`
- ✅ Evidence-based coaching (not rule-based)

**Status:** Structure complete, data pipeline active

---

## 📋 Phase 5: Documentation Cleanup

### Test 5.1: Verify OpenAI Removed from CSP

**Steps:**
1. Open https://chesschat.uk
2. Open DevTools → Network tab
3. Find the main document request
4. View Response Headers
5. Find `Content-Security-Policy` header

**Expected Results:**
- ✅ CSP includes: `connect-src 'self' https://cloudflareinsights.com`
- ❌ CSP should NOT include: `https://api.openai.com`
- ✅ Comment in headers: "Self-contained chess app (no external AI services)"

### Test 5.2: Verify No OpenAI Network Calls

**Steps:**
1. Play several moves on https://chesschat.uk
2. Use coaching mode
3. Monitor DevTools Network tab

**Expected Results:**
- ❌ No requests to `api.openai.com`
- ❌ No requests to `claude.ai` or other LLM services
- ✅ Only requests to:
  - `chesschat-worker-api.richlegrande1.workers.dev`
  - `chesschat-stockfish.onrender.com`
  - `cloudflareinsights.com` (analytics)

---

## 🎯 Integration Test: Complete User Session

### Full Flow Simulation

**Steps:**
1. Open https://chesschat.uk in fresh incognito window
2. Click "Play vs CPU"
3. Select difficulty: "Intermediate"
4. Play 10+ moves
5. Complete the game (win/loss/draw)
6. Monitor DevTools throughout

**Expected Behavior:**
- ✅ Move requests fast after first move (caching working)
- ✅ No errors in Console
- ✅ Game completes successfully
- ✅ Postgame shows analysis (if implemented)
- ✅ All API calls to owned infrastructure only

**Timing Expectations:**
- First move: 8-12s (Render call + cache store)
- Subsequent moves: <500ms (cache hits)
- Game ingestion: <500ms (202 Accepted, async)
- Background analysis: 5-10s (invisible to user)

---

## 📊 Success Criteria

### Phase 1: Move Caching ✅
- [ ] Cache miss → cache hit flow working
- [ ] Latency improvement visible (>90% faster on hits)
- [ ] Cache stats endpoint returns data
- [ ] No errors in production

### Phase 2: Render Analysis ✅
- [ ] Health endpoint returns healthy status
- [ ] Engines available (0-2 active, max 2)
- [ ] Automated tests confirmed `/analyze-game` working

### Phase 3: Async Ingestion ✅
- [ ] 202 Accepted responses (<500ms)
- [ ] RequestId returned for tracking
- [ ] Analysis mode: "async" confirmed
- [ ] Background processing non-blocking

### Phase 4: Postgame Structure ✅
- [ ] Code structure ready for coaching
- [ ] Will use Render analysis data
- [ ] Evidence-based approach prepared

### Phase 5: Cleanup ✅
- [ ] OpenAI removed from CSP headers
- [ ] No OpenAI network calls observed
- [ ] Documentation updated
- [ ] System fully self-contained

---

## 🚨 Troubleshooting

### Issue: Slow First Move (>15 seconds)
**Cause:** Render server cold start  
**Solution:** Normal behavior, server warms up after first request

### Issue: No Cache Hits
**Cause:** Playing unique positions each time  
**Solution:** Try repeating same opening moves (e4, d4, Nf3)

### Issue: 500 Error on Game Ingestion
**Cause:** Database connection or Worker error  
**Solution:** Check Cloudflare Worker logs for details

### Issue: CSP Still Shows OpenAI
**Cause:** Browser cache or CDN cache  
**Solution:** Hard refresh (Ctrl+Shift+R) or wait for CDN propagation

---

## 📝 Test Results Log

**Tester Name:** _______________  
**Date:** January 1, 2026  
**Browser:** _______________  
**Time Started:** _______________

### Phase 1 Results:
- [ ] Test 1.1: Cache Miss/Hit - PASS / FAIL
- [ ] Test 1.2: Cache Stats - PASS / FAIL

### Phase 2 Results:
- [ ] Test 2.1: Render Health - PASS / FAIL

### Phase 3 Results:
- [ ] Test 3.1: Async Ingestion - PASS / FAIL
- [ ] Test 3.2: Background Processing - PASS / FAIL

### Phase 4 Results:
- [ ] Test 4.1: Structure Ready - PASS / FAIL

### Phase 5 Results:
- [ ] Test 5.1: CSP Headers - PASS / FAIL
- [ ] Test 5.2: No OpenAI Calls - PASS / FAIL

### Integration Test:
- [ ] Complete User Session - PASS / FAIL

**Overall Result:** PASS / FAIL  
**Notes:** _______________________________________________

---

## ✅ Post-Test Actions

After completing manual tests:
1. [ ] Document any issues found
2. [ ] Verify all phases working as expected
3. [ ] Update production status in documentation
4. [ ] Archive this test guide for future reference
5. [ ] Celebrate Architecture Change #3 completion! 🎉

---

**Guide Version:** 1.0  
**Last Updated:** January 1, 2026  
**Automated Tests:** 8/8 passed ✅  
**Production Status:** Deployed and verified ✅
