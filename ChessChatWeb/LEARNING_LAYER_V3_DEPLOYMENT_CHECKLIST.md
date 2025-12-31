# Learning Layer V3 - Deployment Checklist

**Version:** 3.0.0  
**Date:** December 30, 2025  
**Status:** Ready for Deployment

---

## Pre-Deployment Checklist

### ✅ Code Complete
- [x] Prisma schema updated with new tables
- [x] Migration SQL file created
- [x] Core learning modules implemented (learningCore.ts, gameAnalysis.ts, learningIngestion.ts)
- [x] Concept taxonomy defined (29 concepts)
- [x] API endpoints added to worker
- [x] Local CPU learning deprecated
- [x] CoachingMode updated to remove learning integration
- [x] Tests written and passing
- [x] Documentation complete

### ⚠️ Pre-Deployment Tasks

#### 1. Database Migration
```bash
cd worker-api
npx prisma migrate dev --name learning_layer_v3
npx prisma generate
```

**Verify:**
- [ ] Migration runs without errors
- [ ] All 4 new tables created: `user_concept_states`, `advice_interventions`, `practice_plans`, `learning_events`
- [ ] Indices created correctly
- [ ] No data loss in existing tables

#### 2. Test API Endpoints (Local)
```bash
# Start local worker
npm run dev

# Test health endpoint
curl http://localhost:8787/api/admin/learning-health

# Test ingest-game (requires valid game data)
# Test learning plan (requires user with concept states)
```

**Verify:**
- [ ] Health endpoint returns 200
- [ ] Ingest-game accepts valid PGN
- [ ] Plan endpoint returns practice plan
- [ ] Wall-E postgame generates insights

#### 3. Validate Stockfish Integration
```bash
# Check Stockfish is available in worker
# Run game analysis test
```

**Verify:**
- [ ] Stockfish evaluations work
- [ ] Concept detection functions execute
- [ ] Mistake classification correct

#### 4. Review Environment Variables
```bash
# Ensure these are set:
DATABASE_URL="postgresql://..."
ADMIN_PASSWORD="..."
ENVIRONMENT="production"
VERSION="3.0.0"
```

**Verify:**
- [ ] DATABASE_URL points to correct Postgres instance
- [ ] Connection pooling configured (if using Prisma Accelerate)

---

## Deployment Steps

### Step 1: Deploy Database Migration

```bash
# Staging
cd worker-api
npx prisma migrate deploy

# Production (after staging validation)
DATABASE_URL="<production-url>" npx prisma migrate deploy
```

**Post-Deploy Check:**
- [ ] Run `SELECT * FROM user_concept_states LIMIT 1;` (should return 0 rows)
- [ ] Run `SELECT * FROM learning_events LIMIT 1;` (should return 0 rows)

### Step 2: Deploy Worker API

```bash
# Deploy to Cloudflare Workers (or your platform)
npm run deploy

# Or via Wrangler
npx wrangler deploy
```

**Post-Deploy Check:**
- [ ] GET `/api/admin/learning-health` returns 200
- [ ] GET `/api/admin/worker-health` includes learning status

### Step 3: Deploy Client Updates

```bash
# Update CoachingMode.tsx (already done)
# Deploy frontend
npm run build
npm run deploy
```

**Post-Deploy Check:**
- [ ] Games complete successfully
- [ ] No console errors about learning integration
- [ ] Version string updated in CoachingMode

### Step 4: Smoke Test in Production

**Create Test User:**
- [ ] Play 1 game as test user
- [ ] Check if game analysis runs: `GET /api/game/{gameId}/analysis`
- [ ] Ingest game manually: `POST /api/learning/ingest-game`
- [ ] Check concept states created: `SELECT * FROM user_concept_states WHERE userId = 'test_user';`
- [ ] Generate practice plan: `GET /api/learning/plan?userId=test_user`
- [ ] Generate coaching: `POST /api/walle/postgame`

### Step 5: Monitor Initial Deployment

**For First 24 Hours:**
- [ ] Monitor `/api/admin/learning-health` every hour
- [ ] Check error rates in worker logs
- [ ] Verify learning events are being logged
- [ ] Check database query performance
- [ ] Monitor Stockfish analysis duration

---

## Rollback Plan

If issues arise:

### Option 1: Disable New Endpoints (Quick)
```typescript
// In index-new.ts, add guard:
if (path.startsWith('/api/learning/') || path === '/api/walle/postgame') {
  return new Response(JSON.stringify({ 
    success: false, 
    error: 'Learning system temporarily disabled' 
  }), { status: 503 });
}
```

### Option 2: Revert Database (If Needed)
```sql
-- Only if absolutely necessary
DROP TABLE IF EXISTS user_concept_states;
DROP TABLE IF EXISTS advice_interventions;
DROP TABLE IF EXISTS practice_plans;
DROP TABLE IF EXISTS learning_events;
```

### Option 3: Full Rollback
```bash
# Revert to previous commit
git revert HEAD
git push

# Redeploy previous version
npm run deploy
```

---

## Post-Deployment Validation

### Week 1: Basic Functionality
- [ ] At least 10 games analyzed
- [ ] Concept states created for 5+ users
- [ ] Practice plans generated successfully
- [ ] No critical errors in logs
- [ ] Average analysis latency < 5 seconds

### Week 2: Learning Loop
- [ ] Interventions created for active users
- [ ] First intervention evaluations complete (5 games)
- [ ] Mastery scores changing after games
- [ ] Spaced repetition due dates updating
- [ ] Follow-up interventions created (if failures)

### Week 3: System Health
- [ ] Intervention success rate > 30%
- [ ] Average concept mastery improving
- [ ] Learning event log growing consistently
- [ ] No database performance issues
- [ ] Practice plan adherence tracking

### Week 4: User Feedback
- [ ] Survey active users about coaching quality
- [ ] Check if advice is relevant and helpful
- [ ] Verify concepts make sense to users
- [ ] Gather feedback on practice plans

---

## Monitoring & Alerts

### Set Up Alerts For:
1. **Learning Health Degraded**
   - Trigger: `GET /api/admin/learning-health` returns 503
   - Action: Check database connection, Stockfish availability

2. **High Error Rate**
   - Trigger: > 5% of learning endpoints return 500
   - Action: Check logs, validate Prisma queries

3. **Slow Analysis**
   - Trigger: Average game analysis > 10 seconds
   - Action: Check Stockfish performance, optimize depth

4. **Low Activity**
   - Trigger: No learning events in last 1 hour (during peak)
   - Action: Check ingestion pipeline

### Dashboard Queries
```sql
-- Daily learning activity
SELECT DATE(ts), eventType, COUNT(*) 
FROM learning_events 
WHERE ts > NOW() - INTERVAL '7 days'
GROUP BY DATE(ts), eventType
ORDER BY DATE(ts) DESC;

-- Intervention effectiveness
SELECT 
  COUNT(*) as total,
  SUM(CASE WHEN outcome = 'success' THEN 1 ELSE 0 END) as successes,
  ROUND(100.0 * SUM(CASE WHEN outcome = 'success' THEN 1 ELSE 0 END) / COUNT(*), 1) as success_rate
FROM advice_interventions
WHERE outcome IS NOT NULL;

-- Top concepts needing attention
SELECT conceptId, COUNT(*) as users, AVG(mastery) as avg_mastery
FROM user_concept_states
WHERE mastery < 0.5
GROUP BY conceptId
ORDER BY users DESC
LIMIT 10;
```

---

## Documentation Links

- **Full Specification:** [LEARNING_LAYER_V3.md](./LEARNING_LAYER_V3.md)
- **Implementation Summary:** [LEARNING_LAYER_V3_IMPLEMENTATION_SUMMARY.md](./LEARNING_LAYER_V3_IMPLEMENTATION_SUMMARY.md)
- **Concept Taxonomy:** [worker-api/src/concepts.json](./worker-api/src/concepts.json)
- **API Documentation:** See worker-api/src/index-new.ts comments

---

## Support Contacts

**Technical Issues:**
- Check logs: `npx wrangler tail`
- Database: Prisma Studio `npx prisma studio`
- Worker logs: Cloudflare dashboard

**Learning System Questions:**
- See specification: LEARNING_LAYER_V3.md
- Run tests: `npm test learningCore.test.ts`
- Check health: `/api/admin/learning-health`

---

## Success Criteria for Go-Live

**Minimum Requirements:**
- [ ] All 10 todo items completed
- [ ] Migration runs successfully
- [ ] API endpoints return valid responses
- [ ] Test game completes analysis
- [ ] Concept states created
- [ ] Practice plan generated
- [ ] Health endpoint healthy
- [ ] Tests passing

**Nice to Have:**
- [ ] 5+ real users tested in staging
- [ ] Performance benchmarks documented
- [ ] Error handling validated
- [ ] Rollback plan tested

---

## Sign-Off

**Ready for Deployment:** ✅ YES / ⚠️ WITH CAVEATS / ❌ NOT READY

**Deployment Approved By:**
- [ ] Tech Lead
- [ ] Product Owner
- [ ] QA Team

**Deployment Date:** _________________

**Deployed By:** _________________

**Post-Deployment Notes:**
_______________________________________________________
_______________________________________________________
_______________________________________________________

---

**🚀 Learning Layer V3 is ready to launch!**
