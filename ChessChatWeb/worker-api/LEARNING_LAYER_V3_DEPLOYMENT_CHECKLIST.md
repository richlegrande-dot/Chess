# Learning Layer V3 - Production Rollout Guide

## Overview
This document provides a complete, step-by-step guide for safely rolling out Learning Layer V3 from staging to production with comprehensive verification and rollback procedures.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Feature Flags Overview](#feature-flags-overview)
3. [Staging Deployment](#staging-deployment)
4. [Manual QA Checklist](#manual-qa-checklist)
5. [Canary Rollout](#canary-rollout)
6. [Production Deployment](#production-deployment)
7. [Verification Steps](#verification-steps)
8. [Rollback Procedures](#rollback-procedures)
9. [Monitoring & Observability](#monitoring--observability)
10. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Access
- [ ] Cloudflare Dashboard access (Workers deployment)
- [ ] Database access (Prisma Accelerate)
- [ ] Admin password for API authentication
- [ ] Stockfish server access credentials

### Database Migration
```bash
# Run migration (production database)
cd worker-api
npx prisma migrate deploy

# Verify tables created
npx prisma studio
# Check for: user_concept_states, advice_interventions, practice_plans, learning_events
```

### Environment Verification
```bash
# Verify Wrangler CLI installed
wrangler --version

# Verify authentication
wrangler whoami

# Verify secrets configured
wrangler secret list
# Required: DATABASE_URL, ADMIN_PASSWORD, STOCKFISH_API_KEY
```

---

## Feature Flags Overview

### Default Configuration (SAFE)
All flags default to the safest possible values:

| Flag | Default | Description |
|------|---------|-------------|
| `LEARNING_V3_ENABLED` | `false` | Master kill switch - disables all endpoints |
| `LEARNING_V3_READONLY` | `true` | Allows reads, blocks writes |
| `LEARNING_V3_SHADOW_MODE` | `true` | Compute analysis but don't update mastery |
| `LEARNING_V3_ASYNC_ANALYSIS` | `true` | Queue analysis (not yet implemented) |
| `LEARNING_V3_MAX_PLY_ANALYSIS` | `40` | Limit analyzed moves |
| `LEARNING_V3_STOCKFISH_DEPTH` | `14` | Stockfish search depth |
| `LEARNING_V3_TIMEOUT_MS` | `8000` | Analysis timeout (8 seconds) |
| `LEARNING_V3_CANARY_ENABLED` | `false` | Canary rollout disabled |
| `LEARNING_V3_CANARY_PERCENTAGE` | `1` | 1% of users in canary |

### Flag Behavior

#### System Disabled (`ENABLED=false`)
- All `/api/learning/*` endpoints return `503` with `{ disabled: true }`
- `/api/walle/postgame` falls back to generic narrative
- No database writes
- LearningEvents logged with `disabled=true` flag

#### Read-Only Mode (`READONLY=true`)
- GET endpoints work normally
- POST endpoints return `403` with `{ readonly: true }`
- LearningEvents logged with `WRITE_BLOCKED` result

#### Shadow Mode (`SHADOW_MODE=true`)
- Full analysis runs
- LearningEvents created
- UserConceptState and AdviceIntervention NOT updated
- Perfect for testing without affecting user data

#### Admin Override
Add header: `X-Learning-V3: on` or `X-Learning-V3: off`
Requires: `Authorization: Bearer {ADMIN_PASSWORD}`

---

## Staging Deployment

### Step 1: Deploy to Staging
```bash
cd worker-api

# Deploy to staging environment
wrangler deploy --env staging

# Verify deployment
curl https://chesschat.uk/api-staging/admin/worker-health
```

### Step 2: Configure Staging Secrets
```bash
# Set secrets for staging (if not inherited)
wrangler secret put DATABASE_URL --env staging
wrangler secret put ADMIN_PASSWORD --env staging
wrangler secret put STOCKFISH_API_KEY --env staging
wrangler secret put STOCKFISH_SERVER_URL --env staging
```

### Step 3: Run Health Check
```bash
node scripts/verify-learning-health.mjs \
  --url https://chesschat.uk/api-staging \
  --password YOUR_ADMIN_PASSWORD
```

**Expected Output:**
```
✅ Health check successful

Configuration:
  - Enabled: true
  - Read-only: false
  - Shadow Mode: true
  - Canary: false (0%)

Table Counts:
  - User Concept States: 0 (or existing count)
  - Advice Interventions: 0
  - Practice Plans: 0
  - Learning Events: 0

Status: healthy
```

### Step 4: Run Verification Scripts
```bash
# 1. Health check
node scripts/verify-learning-health.mjs \
  --url https://chesschat.uk/api-staging \
  --password YOUR_PASSWORD

# 2. Ingest sample game
node scripts/ingest-sample-game.mjs \
  --url https://chesschat.uk/api-staging \
  --user staging-test-user

# 3. Verify concept states
node scripts/verify-concept-states.mjs \
  --url https://chesschat.uk/api-staging \
  --user staging-test-user

# 4. Verify practice plan
node scripts/verify-practice-plan.mjs \
  --url https://chesschat.uk/api-staging \
  --user staging-test-user

# 5. Intervention loop (comprehensive)
node scripts/verify-intervention-loop.mjs \
  --url https://chesschat.uk/api-staging
```

### Step 5: Run E2E Test Suite
```bash
node test-learning-e2e.js \
  https://chesschat.uk/api-staging \
  YOUR_ADMIN_PASSWORD
```

**Expected Result:** All 4 tests pass

---

## Manual QA Checklist

### Test Setup
- [ ] 2 test users created (`test-user-1`, `test-user-2`)
- [ ] Access to production domain via browser
- [ ] DevTools open (Network + Console tabs)

### Test 1: Game Ingestion (Shadow Mode)
**Objective:** Verify ingestion works without updating mastery

1. **Play a test game**
   - [ ] Start game with CPU level 5
   - [ ] Play 10+ moves
   - [ ] Complete game (win/loss/draw)

2. **Check Network tab**
   - [ ] POST to `/api/learning/ingest-game` returns 200
   - [ ] Response includes `shadowMode: true`
   - [ ] Response includes `conceptsUpdated: []` (empty in shadow mode)

3. **Check LearningEvents**
   ```bash
   # Query database
   npx prisma studio
   # Navigate to LearningEvent table
   # Verify: event exists, flagsSnapshot.shadowMode=true, result=success
   ```

4. **Check Concept States**
   - [ ] Query UserConceptState for test user
   - [ ] Confirm: NO new entries (shadow mode blocks writes)

**Expected:** Analysis runs, events logged, but NO mastery updates

### Test 2: Practice Plan (Read-Only Mode)
**Objective:** Verify read endpoints work

1. **Query practice plan**
   ```bash
   curl https://chesschat.uk/api/learning/plan?userId=test-user-1
   ```

2. **Verify response**
   - [ ] Returns 200 (not 503)
   - [ ] Contains `plan` object
   - [ ] Contains `targets` array (may be empty if no prior games)

**Expected:** Read operations work regardless of readonly flag

### Test 3: Postgame Narrative
**Objective:** Verify Wall-E integration

1. **Complete a game**
   - [ ] Play game as `test-user-1`
   - [ ] After game ends, check for postgame message

2. **Inspect narrative**
   - [ ] POST to `/api/walle/postgame` returns 200
   - [ ] Response includes `narrative` field
   - [ ] If system disabled: includes `fallback: true`
   - [ ] If insufficient history: includes `insufficientHistory: true`
   - [ ] Otherwise: narrative cites concepts

**Expected:** Graceful degradation based on system state

### Test 4: Performance Impact
**Objective:** Verify no regression on core gameplay

1. **Measure baseline**
   - [ ] Play 5 games WITHOUT Learning V3 enabled
   - [ ] Record average `/api/chess-move` latency

2. **Enable Learning V3 (shadow mode)**
   - [ ] Update env: `LEARNING_V3_ENABLED=true`
   - [ ] Redeploy

3. **Measure with Learning V3**
   - [ ] Play 5 games WITH Learning V3 enabled
   - [ ] Record average `/api/chess-move` latency

4. **Compare**
   - [ ] Latency increase < 10%
   - [ ] No timeouts or errors
   - [ ] Game playability not affected

**Expected:** Minimal performance impact (analysis is async/post-game)

### Test 5: Multi-User Isolation
**Objective:** Verify users don't see each other's data

1. **User 1: Play 3 games**
   - [ ] Ingest 3 games for `test-user-1`

2. **User 2: Check plan**
   - [ ] Query plan for `test-user-2`
   - [ ] Confirm: empty or unrelated concepts

3. **User 1: Check plan**
   - [ ] Query plan for `test-user-1`
   - [ ] Confirm: concepts from User 1's games only

**Expected:** Complete data isolation between users

---

## Canary Rollout

### Step 1: Enable Canary (1% of Users)
```bash
# Update wrangler.toml for production
[vars]
LEARNING_V3_ENABLED = "true"
LEARNING_V3_READONLY = "false"
LEARNING_V3_SHADOW_MODE = "false"  # 🚨 Real writes enabled
LEARNING_V3_CANARY_ENABLED = "true"
LEARNING_V3_CANARY_PERCENTAGE = "1"

# Deploy
wrangler deploy
```

### Step 2: Monitor Canary Users (24 hours)
```bash
# Query LearningEvents for canary users
SELECT userId, COUNT(*) as events
FROM LearningEvent
WHERE createdAt > NOW() - INTERVAL '24 hours'
AND flagsSnapshot->>'reason' = 'canary-enabled'
GROUP BY userId
ORDER BY events DESC
LIMIT 10;
```

**Success Criteria:**
- [ ] 1% of active users in canary group
- [ ] No increase in error rate
- [ ] LearningEvents showing `result=success` > 95%
- [ ] No user complaints about performance
- [ ] UserConceptState entries created for canary users
- [ ] Mastery values in valid range [0.0, 1.0]

### Step 3: Expand Canary (5% of Users)
```bash
# Update canary percentage
LEARNING_V3_CANARY_PERCENTAGE = "5"

# Deploy
wrangler deploy
```

**Monitor for 48 hours** using same queries

### Step 4: Full Rollout (100% of Users)
```bash
# Disable canary (all users enabled)
LEARNING_V3_CANARY_ENABLED = "false"
LEARNING_V3_ENABLED = "true"

# Deploy
wrangler deploy
```

---

## Production Deployment

### Pre-Deployment Checklist
- [ ] All staging tests passed
- [ ] Manual QA completed
- [ ] Canary rollout successful (or N/A if skipping)
- [ ] Rollback plan documented and understood
- [ ] Database backup taken
- [ ] Monitoring dashboard ready

### Deployment Steps

#### Option A: Direct Deployment (Skip Canary)
```bash
cd worker-api

# Update wrangler.toml
[vars]
LEARNING_V3_ENABLED = "true"
LEARNING_V3_READONLY = "false"
LEARNING_V3_SHADOW_MODE = "true"  # Start in shadow for safety

# Deploy
wrangler deploy

# Verify
curl https://chesschat.uk/api/admin/learning-health \
  -H "Authorization: Bearer $ADMIN_PASSWORD"
```

#### Option B: Canary Deployment (Recommended)
Follow [Canary Rollout](#canary-rollout) steps above.

### Post-Deployment Verification
```bash
# Run all verification scripts against production
node scripts/verify-learning-health.mjs \
  --url https://chesschat.uk \
  --password $ADMIN_PASSWORD

node test-learning-e2e.js \
  https://chesschat.uk \
  $ADMIN_PASSWORD
```

---

## Verification Steps

### Automated Verification
Run all scripts in sequence:
```bash
#!/bin/bash
# verify-all.sh

BASE_URL="https://chesschat.uk"
ADMIN_PW="$ADMIN_PASSWORD"

echo "🔍 Running Learning V3 Verification Suite"
echo "=========================================="

# 1. Health
node scripts/verify-learning-health.mjs --url $BASE_URL --password $ADMIN_PW || exit 1

# 2. Ingestion
node scripts/ingest-sample-game.mjs --url $BASE_URL --user verify-user || exit 1

# 3. Concept States
node scripts/verify-concept-states.mjs --url $BASE_URL --user verify-user || exit 1

# 4. Practice Plan
node scripts/verify-practice-plan.mjs --url $BASE_URL --user verify-user || exit 1

# 5. Intervention Loop
node scripts/verify-intervention-loop.mjs --url $BASE_URL || exit 1

# 6. E2E Suite
node test-learning-e2e.js $BASE_URL $ADMIN_PW || exit 1

echo ""
echo "✅ All verifications passed"
```

### Manual Verification
1. **Play 2-3 games** on production
2. **Check LearningEvents table** - verify events created
3. **Check UserConceptState table** - verify states updated (if not shadow mode)
4. **Query practice plan** - verify plan generated
5. **Check postgame narrative** - verify Wall-E response includes concepts

### Expected Database State

#### After 1 Game (Shadow Mode)
```sql
-- LearningEvents: 1 row
SELECT * FROM LearningEvent WHERE userId = 'your-user-id';
-- Expected: operation=ingest, result=success, flagsSnapshot.shadowMode=true

-- UserConceptState: 0 rows (shadow mode blocks writes)
SELECT COUNT(*) FROM UserConceptState WHERE userId = 'your-user-id';
-- Expected: 0
```

#### After 1 Game (Shadow Mode OFF)
```sql
-- LearningEvents: 1 row
SELECT * FROM LearningEvent WHERE userId = 'your-user-id';

-- UserConceptState: 1-5 rows (depends on concepts detected)
SELECT conceptId, mastery FROM UserConceptState 
WHERE userId = 'your-user-id'
ORDER BY mastery ASC;
-- Expected: mastery values between 0.0 and 1.0
```

---

## Rollback Procedures

### Immediate Rollback (< 5 minutes)

#### Option 1: Disable via Feature Flag
```bash
# Update environment variable in Cloudflare Dashboard
# OR redeploy with flag
[vars]
LEARNING_V3_ENABLED = "false"

wrangler deploy
```

**Result:** All Learning V3 endpoints return 503 immediately

#### Option 2: Previous Deployment Rollback
```bash
# List recent deployments
wrangler deployments list

# Rollback to previous version
wrangler rollback [DEPLOYMENT_ID]
```

#### Option 3: Shadow Mode (Safest)
```bash
# Enable shadow mode to stop writes without disabling reads
[vars]
LEARNING_V3_SHADOW_MODE = "true"

wrangler deploy
```

### Data Rollback (If Needed)

⚠️ **DO NOT DROP TABLES** - This destroys audit trail

Instead:
1. **Disable writes** via feature flag
2. **Investigate** issues via LearningEvents
3. **Correct data** with targeted SQL (if necessary)
4. **Re-enable** when ready

#### Example: Reset User's Concept States
```sql
-- Only if absolutely necessary
DELETE FROM UserConceptState WHERE userId = 'affected-user-id';
-- User will start fresh on next game
```

### Rollback Decision Matrix

| Scenario | Action | Timeline |
|----------|--------|----------|
| High error rate (>5%) | Immediate disable | < 5 min |
| Performance degradation | Shadow mode | < 5 min |
| Data corruption | Disable + investigate | < 10 min |
| User complaints | Shadow mode + investigate | < 10 min |
| Slow rollout desired | Reduce canary % | Gradual |

---

## Monitoring & Observability

### Key Metrics to Track

#### System Health
```sql
-- Event success rate (last 24h)
SELECT 
  result,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM LearningEvent
WHERE createdAt > NOW() - INTERVAL '24 hours'
GROUP BY result;
```

**Target:** `success` > 95%

#### Performance
```sql
-- Average analysis duration
SELECT 
  AVG(durationMs) as avg_ms,
  MAX(durationMs) as max_ms,
  COUNT(*) as total_events
FROM LearningEvent
WHERE operation = 'ingest'
AND createdAt > NOW() - INTERVAL '1 hour';
```

**Target:** avg < 5000ms, max < 8000ms

#### User Engagement
```sql
-- Active learning users (last 7 days)
SELECT 
  COUNT(DISTINCT userId) as active_users,
  COUNT(*) as total_games_analyzed
FROM LearningEvent
WHERE operation = 'ingest'
AND createdAt > NOW() - INTERVAL '7 days';
```

#### Concept Coverage
```sql
-- Most common concepts detected
SELECT 
  jsonb_array_elements_text(conceptKeysDetected) as concept,
  COUNT(*) as occurrences
FROM LearningEvent
WHERE conceptKeysDetected IS NOT NULL
GROUP BY concept
ORDER BY occurrences DESC
LIMIT 10;
```

### Dashboard Queries (Copy to Grafana/DataDog)

```sql
-- Real-time error rate
SELECT 
  time_bucket('5 minutes', createdAt) as time,
  COUNT(*) FILTER (WHERE result = 'failed') as errors,
  COUNT(*) as total
FROM LearningEvent
WHERE createdAt > NOW() - INTERVAL '1 hour'
GROUP BY time
ORDER BY time DESC;
```

### Alerting Thresholds

Set up alerts for:
- **Error rate > 5%** in 15-minute window
- **Average duration > 6000ms** in 5-minute window
- **Zero ingestion events** for > 1 hour (system down?)
- **Mastery values outside [0, 1]** (data corruption)

---

## Troubleshooting

### Issue: "Learning V3 is disabled"

**Symptom:** Endpoints return 503 with `{ disabled: true }`

**Cause:** `LEARNING_V3_ENABLED=false`

**Fix:**
```bash
# Update wrangler.toml or environment variable
LEARNING_V3_ENABLED = "true"
wrangler deploy
```

### Issue: "Learning V3 is in read-only mode"

**Symptom:** POST endpoints return 403 with `{ readonly: true }`

**Cause:** `LEARNING_V3_READONLY=true`

**Fix:**
```bash
LEARNING_V3_READONLY = "false"
wrangler deploy
```

### Issue: No Concept States Created

**Symptom:** UserConceptState table empty after games

**Causes:**
1. Shadow mode enabled
2. Analysis failing (check LearningEvents for errors)
3. No mistakes detected (perfect play!)

**Debug:**
```sql
-- Check LearningEvents for user
SELECT * FROM LearningEvent 
WHERE userId = 'affected-user' 
ORDER BY createdAt DESC 
LIMIT 5;

-- Look for:
-- - flagsSnapshot.shadowMode = true (expected behavior)
-- - result = 'failed' (error in analysis)
-- - conceptKeysDetected = [] (no mistakes found)
```

### Issue: Analysis Timeout

**Symptom:** LearningEvents show `result='partial'` and `error='Analysis timeout'`

**Cause:** Game too long or Stockfish server slow

**Fix:**
```bash
# Increase timeout
LEARNING_V3_TIMEOUT_MS = "12000"  # 12 seconds

# OR reduce analysis depth
LEARNING_V3_MAX_PLY_ANALYSIS = "30"
LEARNING_V3_STOCKFISH_DEPTH = "12"

wrangler deploy
```

### Issue: Postgame Narrative Generic

**Symptom:** Wall-E returns generic message instead of concept-specific

**Causes:**
1. Learning V3 disabled (fallback mode)
2. User has no concept states yet
3. Insufficient game history

**Fix:**
- If disabled: Enable Learning V3
- If new user: Play 2-3 more games
- If shadow mode: Disable shadow mode to update mastery

### Issue: High Error Rate

**Symptom:** > 5% of LearningEvents have `result='failed'`

**Debug:**
```sql
-- Get error messages
SELECT error, COUNT(*) 
FROM LearningEvent 
WHERE result = 'failed'
AND createdAt > NOW() - INTERVAL '1 hour'
GROUP BY error;
```

**Common Errors:**
- `"Analysis timeout"` → Increase timeout or reduce depth
- `"Invalid PGN"` → Frontend sending malformed games
- `"Stockfish unavailable"` → Check Render server status
- `"Database error"` → Check Prisma Accelerate connection

---

## Success Criteria

### Phase 1: Staging (Shadow Mode)
- [ ] All automated tests pass
- [ ] Manual QA complete
- [ ] 10+ test games ingested
- [ ] LearningEvents created for all games
- [ ] No errors in LearningEvents
- [ ] Performance acceptable (< 10% overhead)

### Phase 2: Production Shadow Mode
- [ ] Deployed to production
- [ ] Feature flag: `SHADOW_MODE=true`
- [ ] 100+ real games analyzed
- [ ] Error rate < 2%
- [ ] No user complaints
- [ ] LearningEvents audit trail complete

### Phase 3: Canary (1%)
- [ ] Canary enabled
- [ ] 24 hours monitoring
- [ ] UserConceptState entries created
- [ ] Mastery values valid [0.0, 1.0]
- [ ] No increase in error rate
- [ ] Practice plans generated

### Phase 4: Full Rollout
- [ ] Canary disabled (100% enabled)
- [ ] 7 days monitoring
- [ ] >90% of active users have concept states
- [ ] Postgame narratives cite specific concepts
- [ ] Error rate < 1%
- [ ] Performance within SLA

---

## Follow-Up Patches

Track issues discovered during rollout:

1. **Concept Detection Accuracy**
   - Monitor which concepts are detected most
   - Adjust thresholds if too many false positives

2. **Narrative Quality**
   - Collect user feedback on Wall-E messages
   - Refine narrative templates

3. **Performance Tuning**
   - If timeouts occur, adjust depth/ply limits
   - Consider caching Stockfish evaluations

4. **Mastery Calibration**
   - Monitor mastery convergence rates
   - Adjust learning rate if too fast/slow

5. **Practice Plan Algorithm**
   - Verify users actually practice weak concepts
   - Adjust priority calculation if needed

---

## Appendix: Command Reference

```bash
# Deploy staging
wrangler deploy --env staging

# Deploy production
wrangler deploy

# Rollback
wrangler rollback [DEPLOYMENT_ID]

# Update secret
wrangler secret put LEARNING_V3_ENABLED

# Run health check
node scripts/verify-learning-health.mjs --url https://chesschat.uk --password $ADMIN_PASSWORD

# Run E2E tests
node test-learning-e2e.js https://chesschat.uk $ADMIN_PASSWORD

# Database migration
npx prisma migrate deploy

# Database console
npx prisma studio
```

---

## Contact & Escalation

**For issues during rollout:**
1. Check this guide's troubleshooting section
2. Query LearningEvents for error details
3. Disable system via feature flag if critical
4. Document issue and findings
5. Plan fix and re-enable when ready

**Remember:** Feature flags enable safe, gradual rollout. Use them liberally.
