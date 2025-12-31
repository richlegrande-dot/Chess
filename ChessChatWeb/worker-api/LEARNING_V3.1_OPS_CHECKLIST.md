# Learning V3.1 Operations Checklist

**Version**: 3.1  
**Target**: Production Deployment  
**Est. Duration**: 2-3 weeks phased rollout

---

## Pre-Deployment Checklist

### 1. Database Migrations

- [ ] **Backup Production Database**
  ```bash
  # Create snapshot of production DB
  # Document backup location and timestamp
  ```

- [ ] **Apply Schema Changes**
  ```bash
  cd worker-api
  npm run prisma:generate
  npx prisma db push
  ```

- [ ] **Verify New Tables Created**
  ```sql
  SELECT table_name FROM information_schema.tables 
  WHERE table_name IN ('analysis_cache', 'ingestion_events');
  ```

- [ ] **Verify Indexes Exist**
  ```sql
  SELECT tablename, indexname FROM pg_indexes 
  WHERE tablename IN ('analysis_cache', 'ingestion_events');
  ```

### 2. Code Deployment

- [ ] **Merge PR to Main Branch**
  - Verify all tests passing
  - Verify no TypeScript errors
  - Get code review approval

- [ ] **Deploy Worker API to Staging**
  ```bash
  cd worker-api
  npm run deploy:staging
  # Or: wrangler deploy --env staging
  ```

- [ ] **Verify Staging Deployment**
  ```bash
  curl https://staging.chesschat.uk/api/health
  # Expected: 200 OK
  ```

### 3. Feature Flag Configuration

- [ ] **Verify Feature Flags in `wrangler.toml`**
  ```toml
  # Phase 1: Caching only
  LEARNING_V3_ENABLED = "true"
  LEARNING_V3_SMART_SAMPLING = "false"  # OFF initially
  LEARNING_V3_CACHE_ENABLED = "true"    # ON for cost savings
  LEARNING_V3_MAX_POSITIONS_PER_GAME = "4"
  LEARNING_V3_MAX_DB_WRITES = "50"
  LEARNING_V3_MAX_STOCKFISH_CALLS = "6"
  ```

- [ ] **Document Flag State**
  - Current values saved in deployment log
  - Rollback values documented

---

## Phase 1: Caching Only (Week 1)

### Day 1: Deploy to Production

- [ ] **Deploy Worker API**
  ```bash
  cd worker-api
  npm run deploy  # Production
  ```

- [ ] **Verify Deployment**
  ```bash
  curl https://chesschat.uk/api/health
  curl https://chesschat.uk/api/admin/learning-health \
    -H "Authorization: Bearer $ADMIN_PASSWORD"
  ```

- [ ] **Monitor Initial Metrics**
  - Check Cloudflare dashboard for Worker CPU usage
  - Verify no immediate errors in logs
  - Check database connection health

### Day 1-3: Initial Monitoring

- [ ] **Check Ingestion Success Rate**
  ```sql
  SELECT 
    event_result,
    COUNT(*) as count,
    COUNT(*) * 100.0 / SUM(COUNT(*)) OVER () as pct
  FROM ingestion_events
  WHERE ts > NOW() - INTERVAL '24 hours'
  GROUP BY event_result;
  
  -- Target: 'success' > 95%
  ```

- [ ] **Monitor Cache Performance**
  ```sql
  SELECT 
    DATE_TRUNC('hour', ts) as hour,
    AVG(cache_hit_rate) as avg_hit_rate,
    COUNT(*) as ingestions
  FROM ingestion_events
  WHERE ts > NOW() - INTERVAL '24 hours'
  GROUP BY hour
  ORDER BY hour DESC;
  
  -- Expected: Hit rate starts at 0%, gradually increases
  ```

- [ ] **Check Error Logs**
  ```bash
  # Cloudflare Dashboard → Workers → Logs
  # Filter for: error, timeout, failed
  ```

- [ ] **Verify No Performance Regression**
  ```sql
  SELECT 
    AVG(duration_ms) as avg_duration,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) as p95_duration
  FROM ingestion_events
  WHERE ts > NOW() - INTERVAL '24 hours';
  
  -- Target: P95 < 3000ms
  ```

### Day 4-7: Cache Warmup

- [ ] **Monitor Cache Growth**
  ```sql
  SELECT COUNT(*) FROM analysis_cache;
  SELECT AVG(hit_count) as avg_hits FROM analysis_cache;
  
  -- Expected: Growing daily
  ```

- [ ] **Check Cache Hit Rate Trend**
  ```sql
  SELECT 
    DATE(ts) as date,
    AVG(cache_hit_rate) as avg_hit_rate
  FROM ingestion_events
  WHERE ts > NOW() - INTERVAL '7 days'
  GROUP BY date
  ORDER BY date;
  
  -- Target: Approaching 30% by day 7
  ```

- [ ] **Verify Cache Expiration Working**
  ```sql
  SELECT COUNT(*) FROM analysis_cache WHERE expires_at < NOW();
  -- Should be 0 or very low (cleanup job working)
  ```

### Phase 1 Go/No-Go Decision

- [ ] **Cache hit rate ≥ 20%** (by end of week)
- [ ] **Success rate ≥ 95%**
- [ ] **P95 latency < 3000ms**
- [ ] **No critical errors**

**If GO**: Proceed to Phase 2  
**If NO-GO**: Investigate issues, delay Phase 2

---

## Phase 2: Enable Smart Sampling (Week 2)

### Day 8: Feature Flag Update

- [ ] **Update `wrangler.toml`**
  ```toml
  LEARNING_V3_SMART_SAMPLING = "true"  # ← ENABLE
  ```

- [ ] **Deploy Updated Config**
  ```bash
  cd worker-api
  wrangler deploy
  ```

- [ ] **Verify Flag Active**
  ```bash
  curl https://chesschat.uk/api/admin/learning-health \
    -H "Authorization: Bearer $ADMIN_PASSWORD" | jq '.featureFlags'
  
  # Expected: "smartSampling": true
  ```

### Day 8-10: Smart Sampling Validation

- [ ] **Check Sampling Distribution**
  ```sql
  SELECT 
    AVG(candidates_selected) as avg_candidates,
    AVG(positions_analyzed) as avg_positions,
    AVG(stockfish_calls_made) as avg_calls
  FROM ingestion_events
  WHERE ts > NOW() - INTERVAL '24 hours'
    AND smart_sampling_enabled = true;
  
  -- Expected: candidates > positions (prioritization working)
  -- Expected: calls < 5 (caching helping)
  ```

- [ ] **Verify Tactical Detection**
  ```sql
  -- Manual inspection: Check `candidatesSelected` in events
  -- Look for moves with captures, checks, promotions
  ```

- [ ] **Compare Performance vs Phase 1**
  ```sql
  SELECT 
    smart_sampling_enabled,
    AVG(duration_ms) as avg_duration,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) as p95
  FROM ingestion_events
  WHERE ts > NOW() - INTERVAL '48 hours'
  GROUP BY smart_sampling_enabled;
  
  -- Expect: Smart sampling P95 ~similar or better (better positions, fewer total calls)
  ```

### Day 11-14: Stability Monitoring

- [ ] **Monitor Timeout Rate**
  ```sql
  SELECT 
    COUNT(*) FILTER (WHERE event_result = 'timeout') * 100.0 / COUNT(*) as timeout_rate
  FROM ingestion_events
  WHERE ts > NOW() - INTERVAL '7 days';
  
  -- Target: < 2%
  ```

- [ ] **Check Tier Distribution**
  ```sql
  SELECT 
    tier_selected,
    COUNT(*) as count,
    COUNT(*) * 100.0 / SUM(COUNT(*)) OVER () as pct
  FROM ingestion_events
  WHERE ts > NOW() - INTERVAL '7 days'
  GROUP BY tier_selected;
  
  -- Expected: Mostly Tier B, some Tier A/C
  ```

### Phase 2 Go/No-Go Decision

- [ ] **Timeout rate < 2%**
- [ ] **P95 latency < 3500ms** (slight increase acceptable)
- [ ] **Success rate ≥ 95%**
- [ ] **Smart sampling detecting tactical moments** (manual spot-check)

**If GO**: Proceed to Phase 3  
**If NO-GO**: Disable smart sampling, investigate

---

## Phase 3: Scale Up Analysis (Week 3+)

### Day 15: Increase Position Limit

- [ ] **Update `wrangler.toml` (Conservative)**
  ```toml
  LEARNING_V3_MAX_POSITIONS_PER_GAME = "6"  # ← INCREASE
  LEARNING_V3_MAX_STOCKFISH_CALLS = "8"
  ```

- [ ] **Deploy**
  ```bash
  wrangler deploy
  ```

### Day 15-21: Performance Monitoring

- [ ] **Monitor Latency Impact**
  ```sql
  SELECT 
    DATE_TRUNC('hour', ts) as hour,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) as p95
  FROM ingestion_events
  WHERE ts > NOW() - INTERVAL '7 days'
  GROUP BY hour
  ORDER BY hour DESC;
  
  -- Watch for P95 spike above 4000ms
  ```

- [ ] **Check Cost Impact**
  ```sql
  SELECT 
    AVG(stockfish_calls_made) as avg_calls_per_game,
    SUM(stockfish_calls_made) as total_calls
  FROM ingestion_events
  WHERE ts > NOW() - INTERVAL '7 days';
  
  -- Compare to baseline (Phase 1-2)
  ```

- [ ] **Verify Learning Quality**
  ```sql
  SELECT 
    AVG(concepts_updated) as avg_concepts,
    AVG(positions_analyzed) as avg_positions
  FROM ingestion_events
  WHERE ts > NOW() - INTERVAL '7 days';
  
  -- Expected: More concepts updated per game
  ```

### Phase 3 Decision Point

**If P95 > 4500ms**:
- [ ] Reduce `MAX_POSITIONS_PER_GAME` back to 4
- [ ] Investigate Stockfish server latency

**If success**:
- [ ] **Mark V3.1 as Stable**
- [ ] Update documentation with final config
- [ ] Schedule postgame endpoint enhancement

---

## Ongoing Maintenance

### Weekly Tasks

- [ ] **Check Cache Size**
  ```sql
  SELECT 
    COUNT(*) as total_entries,
    pg_size_pretty(pg_total_relation_size('analysis_cache')) as size
  FROM analysis_cache;
  
  -- If > 100k entries, run prune
  ```

- [ ] **Prune Cache** (if needed)
  ```sql
  -- Via Worker API cron or manual query
  DELETE FROM analysis_cache 
  WHERE hit_count = 0 AND created_at < NOW() - INTERVAL '30 days';
  ```

- [ ] **Review Error Rates**
  ```sql
  SELECT 
    error_message,
    COUNT(*) as count
  FROM ingestion_events
  WHERE event_result IN ('timeout', 'error')
    AND ts > NOW() - INTERVAL '7 days'
  GROUP BY error_message
  ORDER BY count DESC
  LIMIT 10;
  ```

### Monthly Tasks

- [ ] **Review Cost vs Value**
  - Stockfish API usage
  - Database storage growth
  - Learning signal quality (concept mastery improvements)

- [ ] **Optimize Cache TTL** (if needed)
  ```sql
  -- Check average hit counts
  SELECT 
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY hit_count) as median_hits,
    PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY hit_count) as p90_hits
  FROM analysis_cache;
  
  -- If median < 2, consider longer TTL
  ```

- [ ] **Archive Old Instrumentation**
  ```sql
  DELETE FROM ingestion_events WHERE ts < NOW() - INTERVAL '90 days';
  ```

---

## Rollback Procedures

### Emergency Rollback (Complete Disable)

**If critical issue detected:**

1. **Disable Learning V3**
   ```toml
   LEARNING_V3_ENABLED = "false"
   ```

2. **Deploy Immediately**
   ```bash
   wrangler deploy
   ```

3. **Verify**
   ```bash
   curl https://chesschat.uk/api/learning/ingest-game \
     -X POST -d '{"userId":"test","gameId":"test","pgn":"1. e4"}' \
     -H "Content-Type: application/json"
   
   # Expected: {"success":false,"disabled":true}
   ```

### Partial Rollback (Disable V3.1 Features Only)

**If smart sampling causing issues:**

```toml
LEARNING_V3_SMART_SAMPLING = "false"
LEARNING_V3_MAX_POSITIONS_PER_GAME = "2"  # Back to legacy
```

**If caching causing issues:**

```toml
LEARNING_V3_CACHE_ENABLED = "false"
```

---

## Success Criteria (Final)

### Technical Metrics
- [x] P95 ingestion latency < 3500ms
- [x] Success rate ≥ 95%
- [x] Cache hit rate ≥ 30%
- [x] Timeout rate < 2%

### Business Metrics
- [x] Average Stockfish calls per game < 5
- [x] Concepts updated per game > 2
- [x] No increase in user-reported errors

### Quality Metrics
- [x] Smart sampling detects tactical moments
- [x] Concept mastery scores improving over time
- [x] Evidence refs stored correctly

---

## Contacts & Escalation

**Primary**: Development Team  
**Secondary**: Database Admin (for schema issues)  
**Emergency**: Disable feature flags immediately

---

**Checklist Version**: 1.0  
**Last Updated**: December 31, 2025
