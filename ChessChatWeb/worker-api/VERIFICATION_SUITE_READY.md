# Learning Layer V3 - Verification Suite Ready ✅

**Status:** 🟢 All verification scripts prepared and ready to execute  
**Date:** December 30, 2025

---

## 📋 Available Verification Scripts

### Individual Verification Scripts

| Script | Purpose | NPM Command | Direct Command |
|--------|---------|-------------|----------------|
| **Health Check** | Verify system health + table accessibility | `npm run verify:health` | `node scripts/verify-learning-health.mjs` |
| **Ingestion Test** | Test game ingestion pipeline | `npm run verify:ingest` | `node scripts/ingest-sample-game.mjs` |
| **Concept States** | Verify state creation | `npm run verify:concepts` | `node scripts/verify-concept-states.mjs` |
| **Practice Plan** | Validate plan structure | `npm run verify:plan` | `node scripts/verify-practice-plan.mjs` |
| **Intervention Loop** | Test closed-loop learning (5 games) | `npm run verify:intervention` | `node scripts/verify-intervention-loop.mjs` |

### Full Test Suites

| Suite | Purpose | Command |
|-------|---------|---------|
| **Full Verification** | Run all verification scripts | `npm run verify:all` |
| **Staging Verification** | Run all against staging | `npm run verify:all:staging` |
| **E2E Test** | Complete end-to-end test suite | `node test-learning-e2e.js <url> <password>` |

---

## 🚀 Quick Start: Staging Verification

### Prerequisites

1. ✅ Staging deployed (Phase 3 complete)
2. ✅ Admin password configured
3. ✅ Database migration applied

### Execution Steps

```bash
# Set environment
export ADMIN_PASSWORD="your-staging-admin-password"
export BASE_URL="https://chesschat.uk/api-staging"

# Option 1: Run full suite
npm run verify:all:staging

# Option 2: Run individual tests
npm run verify:health -- --base-url=$BASE_URL
npm run verify:ingest -- --base-url=$BASE_URL
npm run verify:concepts -- --base-url=$BASE_URL
npm run verify:plan -- --base-url=$BASE_URL
npm run verify:intervention -- --base-url=$BASE_URL

# Option 3: Run E2E test
node test-learning-e2e.js $BASE_URL $ADMIN_PASSWORD
```

---

## 📊 Expected Test Results

### 1. Health Check (`verify:health`)

**Expected Output:**
```json
{
  "success": true,
  "status": "healthy",
  "config": {
    "enabled": true,
    "readonly": true,
    "shadowMode": true
  },
  "tables": {
    "userConceptStates": 0,
    "adviceInterventions": 0,
    "practicePlans": 0,
    "learningEvents": 0
  }
}
```

**Pass Criteria:**
- ✅ HTTP 200 status
- ✅ `status: "healthy"`
- ✅ All 4 tables accessible
- ✅ Response time < 2000ms

### 2. Ingestion Test (`verify:ingest`)

**Expected Output:**
```json
{
  "success": true,
  "requestId": "uuid",
  "conceptsUpdated": ["tactical-awareness", "piece-safety"],
  "shadowMode": true,
  "durationMs": 4500
}
```

**Pass Criteria:**
- ✅ HTTP 200 status
- ✅ Concepts detected
- ✅ Duration < 8000ms
- ✅ LearningEvent created in DB

### 3. Concept States (`verify:concepts`)

**Expected Output:**
```
✅ Concept states created: 3
✅ Mastery values valid: [0.2, 0.15, 0.3]
✅ Due dates set correctly
```

**Pass Criteria:**
- ✅ States exist in database
- ✅ Mastery in range [0, 1]
- ✅ `nextDue` dates are future timestamps

### 4. Practice Plan (`verify:plan`)

**Expected Output:**
```json
{
  "success": true,
  "plan": {
    "userId": 1,
    "targets": [
      {
        "conceptId": "tactical-awareness",
        "mastery": 0.15,
        "priority": "high"
      }
    ]
  }
}
```

**Pass Criteria:**
- ✅ HTTP 200 status
- ✅ `targets` array non-empty
- ✅ Sorted by priority
- ✅ Response time < 1000ms

### 5. Intervention Loop (`verify:intervention`)

**Expected Output:**
```
Game 1: ✅ Ingested
Game 2: ✅ Ingested
Game 3: ✅ Ingested
Game 4: ✅ Ingested
Game 5: ✅ Ingested

Summary:
- Total games: 5
- Success rate: 100%
- Avg duration: 3800ms
- Concepts updated: 12
```

**Pass Criteria:**
- ✅ All 5 games succeed
- ✅ Success rate > 90%
- ✅ Avg duration < 5000ms
- ✅ Concepts accumulate correctly

### 6. E2E Test (`test-learning-e2e.js`)

**Expected Output:**
```
Test 1: Health Check - PASS
Test 2: Game Ingestion - PASS
Test 3: Practice Plan - PASS
Test 4: Postgame Narrative - PASS

All tests passed! ✅
```

**Pass Criteria:**
- ✅ 4/4 tests pass
- ✅ No exceptions thrown
- ✅ Total time < 15 seconds

---

## 🔍 Verification Script Details

### Health Check Script

**File:** `scripts/verify-learning-health.mjs`

**What it tests:**
- Worker health endpoint reachable
- Feature flags readable
- Database tables accessible
- Correct table counts

**Usage:**
```bash
node scripts/verify-learning-health.mjs --url https://chesschat.uk/api-staging
```

### Ingestion Test Script

**File:** `scripts/ingest-sample-game.mjs`

**What it tests:**
- Game analysis completes
- Concepts detected correctly
- Mastery updates (if not shadow mode)
- Audit trail created

**Sample PGN:** Includes 3-4 tactical mistakes

**Usage:**
```bash
export ADMIN_PASSWORD="password"
node scripts/ingest-sample-game.mjs --url https://chesschat.uk/api-staging
```

### Concept States Script

**File:** `scripts/verify-concept-states.mjs`

**What it tests:**
- UserConceptState creation
- Mastery value ranges
- Due date calculation
- State persistence

**Usage:**
```bash
node scripts/verify-concept-states.mjs --url https://chesschat.uk/api-staging
```

### Practice Plan Script

**File:** `scripts/verify-practice-plan.mjs`

**What it tests:**
- Plan generation endpoint
- Target prioritization
- Plan structure validity
- Response performance

**Usage:**
```bash
node scripts/verify-practice-plan.mjs --url https://chesschat.uk/api-staging
```

### Intervention Loop Script

**File:** `scripts/verify-intervention-loop.mjs`

**What it tests:**
- Multi-game ingestion
- Concept accumulation
- Mastery progression
- System stability under load

**Usage:**
```bash
node scripts/verify-intervention-loop.mjs --url https://chesschat.uk/api-staging
```

### E2E Test Script

**File:** `test-learning-e2e.js`

**What it tests:**
- Complete user journey
- Health → Ingest → Plan → Postgame
- Error handling
- Feature flag respect

**Usage:**
```bash
node test-learning-e2e.js https://chesschat.uk/api-staging your-password
```

---

## ⚠️ Common Issues & Solutions

### Issue: Health check fails with 401 Unauthorized

**Cause:** `ADMIN_PASSWORD` not set or incorrect

**Solution:**
```bash
export ADMIN_PASSWORD="correct-password"
# Or provide --password flag
node scripts/verify-learning-health.mjs --password "correct-password"
```

### Issue: Ingestion test times out

**Cause:** Stockfish server cold start or network issues

**Solution:**
- Wait 30-60 seconds for Stockfish warm-up
- Verify `STOCKFISH_SERVER_URL` in secrets
- Check Stockfish server logs

### Issue: "Table not found" error

**Cause:** Migration not applied to database

**Solution:**
```bash
cd worker-api
export DATABASE_URL="your-staging-db-url"
npx prisma migrate deploy
```

### Issue: All tests return 404

**Cause:** Routes not registered or deployment failed

**Solution:**
- Verify deployment: `wrangler deployments list --env staging`
- Check Worker logs in Cloudflare dashboard
- Confirm routes in `index.ts`

---

## 📈 Success Metrics

After running full verification suite, you should see:

| Metric | Target | Actual |
|--------|--------|--------|
| **Success Rate** | > 95% | ___% |
| **Avg Response Time** | < 5000ms | ___ms |
| **Error Rate** | < 5% | ___% |
| **Concept Detection** | > 0 concepts/game | ___ |
| **Table Accessibility** | 4/4 tables | ___/4 |

---

## ✅ Verification Complete Checklist

- [ ] Health check passes
- [ ] Ingestion test succeeds
- [ ] Concept states verified
- [ ] Practice plan generated
- [ ] Intervention loop completes
- [ ] E2E test passes
- [ ] Manual QA performed
- [ ] Database records confirmed
- [ ] Worker logs reviewed
- [ ] No 500 errors in 24h

**When all checked:** Proceed to Phase 5 (Status Update)

---

## 🎯 Next Steps

1. **Execute Verification**
   ```bash
   npm run verify:all:staging
   ```

2. **Review Results**
   - Check all tests pass
   - Review LearningEvent records
   - Confirm no errors in logs

3. **Manual QA**
   - Play 1-2 games in staging
   - Verify postgame narrative
   - Check concept states

4. **Update Status**
   - Mark staging as verified
   - Document any issues
   - Prepare for production shadow

---

**Status:** Ready for verification once staging is deployed

**Blocked by:** Phase 3 (Owner must deploy to staging)
