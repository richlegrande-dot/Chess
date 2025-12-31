# Learning V3 - Quick Command Reference

## Deployment Commands

### Deploy to Staging
```bash
cd worker-api
wrangler deploy --env staging
```

### Deploy to Production
```bash
wrangler deploy
```

### Rollback to Previous Version
```bash
wrangler deployments list
wrangler rollback <DEPLOYMENT_ID>
```

---

## Verification Commands

### Health Check
```bash
node scripts/verify-learning-health.mjs \
  --url https://chesschat.uk \
  --password $ADMIN_PASSWORD
```

### Sample Ingestion
```bash
node scripts/ingest-sample-game.mjs \
  --url https://chesschat.uk \
  --user test-user
```

### Concept States
```bash
node scripts/verify-concept-states.mjs \
  --url https://chesschat.uk \
  --user test-user
```

### Practice Plan
```bash
node scripts/verify-practice-plan.mjs \
  --url https://chesschat.uk \
  --user test-user
```

### Intervention Loop
```bash
node scripts/verify-intervention-loop.mjs \
  --url https://chesschat.uk
```

### E2E Test Suite
```bash
node test-learning-e2e.js \
  https://chesschat.uk \
  $ADMIN_PASSWORD
```

### Run All Verifications
```bash
# Bash (Linux/Mac)
./verify-all.sh https://chesschat.uk $ADMIN_PASSWORD

# PowerShell (Windows)
.\verify-all.ps1 -BaseUrl "https://chesschat.uk" -AdminPassword $env:ADMIN_PASSWORD
```

---

## Database Commands

### Run Migration
```bash
cd worker-api
npx prisma migrate deploy
```

### Open Database Console
```bash
npx prisma studio
```

### Check Table Counts
```sql
SELECT 'UserConceptState' as table, COUNT(*) as count FROM UserConceptState
UNION ALL
SELECT 'AdviceIntervention', COUNT(*) FROM AdviceIntervention
UNION ALL
SELECT 'PracticePlan', COUNT(*) FROM PracticePlan
UNION ALL
SELECT 'LearningEvent', COUNT(*) FROM LearningEvent;
```

---

## Monitoring Queries

### Error Rate (Last Hour)
```sql
SELECT 
  result,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as pct
FROM LearningEvent
WHERE createdAt > NOW() - INTERVAL '1 hour'
GROUP BY result;
```

### Performance (Last Hour)
```sql
SELECT 
  AVG(durationMs) as avg_ms,
  MAX(durationMs) as max_ms,
  COUNT(*) as events
FROM LearningEvent
WHERE operation = 'ingest'
AND createdAt > NOW() - INTERVAL '1 hour';
```

### Active Users (Last 7 Days)
```sql
SELECT 
  COUNT(DISTINCT userId) as users,
  COUNT(*) as games
FROM LearningEvent
WHERE operation = 'ingest'
AND result = 'success'
AND createdAt > NOW() - INTERVAL '7 days';
```

---

## Feature Flag Updates

### Enable Learning V3
```bash
# Edit wrangler.toml
LEARNING_V3_ENABLED = "true"

# Deploy
wrangler deploy
```

### Disable Learning V3
```bash
LEARNING_V3_ENABLED = "false"
wrangler deploy
```

### Enable Shadow Mode (Safe Testing)
```bash
LEARNING_V3_ENABLED = "true"
LEARNING_V3_SHADOW_MODE = "true"
wrangler deploy
```

### Disable Shadow Mode (Full Learning)
```bash
LEARNING_V3_SHADOW_MODE = "false"
wrangler deploy
```

### Enable Canary (1%)
```bash
LEARNING_V3_CANARY_ENABLED = "true"
LEARNING_V3_CANARY_PERCENTAGE = "1"
wrangler deploy
```

---

## Troubleshooting

### Check Recent Errors
```sql
SELECT 
  error,
  COUNT(*) as occurrences,
  MAX(createdAt) as last_seen
FROM LearningEvent
WHERE result = 'failed'
AND createdAt > NOW() - INTERVAL '24 hours'
GROUP BY error
ORDER BY occurrences DESC;
```

### Check Specific User's Events
```sql
SELECT 
  operation,
  result,
  conceptKeysDetected,
  durationMs,
  createdAt
FROM LearningEvent
WHERE userId = 'USER_ID_HERE'
ORDER BY createdAt DESC
LIMIT 20;
```

### Check System Status
```bash
curl -s https://chesschat.uk/api/admin/learning-health \
  -H "Authorization: Bearer $ADMIN_PASSWORD" \
  | jq '.'
```

---

## Emergency Procedures

### Immediate Disable (< 1 minute)
```bash
# Option 1: Update flag
echo 'LEARNING_V3_ENABLED = "false"' >> wrangler.toml
wrangler deploy

# Option 2: Rollback deployment
wrangler deployments list
wrangler rollback <PREVIOUS_DEPLOYMENT_ID>
```

### Shadow Mode Rollback (< 1 minute)
```bash
# Keep system running but stop mastery updates
echo 'LEARNING_V3_SHADOW_MODE = "true"' >> wrangler.toml
wrangler deploy
```

---

## Success Indicators

✅ **Health Check Passes**
- All tables accessible
- Status: "healthy"
- Config flags correct

✅ **Ingestion Works**
- Returns 200 or 202
- LearningEvents created
- Concepts detected (if mistakes present)

✅ **Low Error Rate**
- Success rate > 95%
- Failed events < 5%

✅ **Performance Acceptable**
- Avg duration < 5000ms
- Max duration < 8000ms

✅ **User Adoption**
- Active users increasing
- Concept states being created
- Practice plans generated

---

## Useful API Calls

### Check Health
```bash
curl -H "Authorization: Bearer $ADMIN_PASSWORD" \
  https://chesschat.uk/api/admin/learning-health
```

### Ingest Game
```bash
curl -X POST https://chesschat.uk/api/learning/ingest-game \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user",
    "gameId": "test-game",
    "pgn": "1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. O-O"
  }'
```

### Get Practice Plan
```bash
curl "https://chesschat.uk/api/learning/plan?userId=test-user"
```

### Postgame Narrative
```bash
curl -X POST https://chesschat.uk/api/walle/postgame \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user",
    "gameId": "game-123"
  }'
```

---

## Next Steps

1. **Deploy to staging** → Run verifications
2. **Manual QA** → 5 test scenarios
3. **Deploy to production (shadow)** → Monitor 24-48h
4. **Disable shadow mode** → Full learning enabled
5. **Monitor & optimize** → Track metrics

**Full guide:** See `LEARNING_LAYER_V3_DEPLOYMENT_CHECKLIST.md`
