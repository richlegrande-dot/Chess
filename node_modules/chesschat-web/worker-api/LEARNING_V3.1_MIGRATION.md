# Learning V3.1 Database Migration Guide

**Version**: 3.1  
**Target**: PostgreSQL + Prisma  
**Migration Type**: Additive (Non-Breaking)

---

## Overview

Learning V3.1 adds two new tables and does **not** modify existing tables. This is a **safe, non-breaking migration**.

**New Tables**:
1. `analysis_cache` - Stockfish result caching
2. `ingestion_events` - Performance instrumentation

**Modified Tables**: None

**Data Loss Risk**: **None** (no existing data touched)

---

## Pre-Migration Checklist

- [ ] **Backup Production Database**
  ```bash
  pg_dump $DATABASE_URL > chesschat_backup_$(date +%Y%m%d_%H%M%S).sql
  ```

- [ ] **Verify Disk Space**
  ```sql
  SELECT pg_size_pretty(pg_database_size(current_database()));
  
  -- Ensure at least 500MB free for cache growth
  ```

- [ ] **Check Current Schema Version**
  ```sql
  SELECT table_name FROM information_schema.tables 
  WHERE table_schema = 'public' 
  ORDER BY table_name;
  
  -- Verify user_concept_states, advice_interventions exist
  ```

---

## Migration Steps

### Step 1: Update Prisma Schema

The schema file `worker-api/prisma/schema.prisma` already contains the new tables. Verify:

```prisma
model AnalysisCache {
  id          String   @id @default(uuid())
  cacheKey    String   @unique
  fen         String
  depth       Int
  // ... more fields
  
  @@map("analysis_cache")
}

model IngestionEvent {
  id                    String   @id @default(uuid())
  ts                    DateTime @default(now())
  userId                String
  // ... more fields
  
  @@map("ingestion_events")
}
```

### Step 2: Generate Prisma Client

```bash
cd worker-api
npm run prisma:generate
```

**Expected Output**:
```
✔ Generated Prisma Client (5.22.0) to ./node_modules/@prisma/client/edge in 123ms
```

### Step 3: Push Schema to Database

**Option A: Using Prisma (Recommended)**
```bash
npx prisma db push
```

**Expected Output**:
```
Datasource "db": PostgreSQL database "chesschat"

🚀  Your database is now in sync with your Prisma schema. Done in 456ms

✔ Generated Prisma Client (5.22.0)
```

**Option B: Manual SQL (If Prisma Unavailable)**

Run this SQL manually:

```sql
-- Create analysis_cache table
CREATE TABLE IF NOT EXISTS analysis_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key VARCHAR(255) UNIQUE NOT NULL,
  fen TEXT NOT NULL,
  depth INTEGER NOT NULL,
  movetime INTEGER,
  
  eval_cp INTEGER,
  mate INTEGER,
  best_move VARCHAR(10),
  pv TEXT,
  nodes BIGINT,
  
  hit_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  last_used_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL
);

-- Create indexes
CREATE INDEX idx_analysis_cache_key ON analysis_cache(cache_key);
CREATE INDEX idx_analysis_cache_fen ON analysis_cache(fen);
CREATE INDEX idx_analysis_cache_expires ON analysis_cache(expires_at);

-- Create ingestion_events table
CREATE TABLE IF NOT EXISTS ingestion_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ts TIMESTAMP DEFAULT NOW(),
  user_id VARCHAR(255) NOT NULL,
  game_id VARCHAR(255) NOT NULL,
  
  duration_ms INTEGER NOT NULL,
  candidates_selected INTEGER NOT NULL,
  stockfish_calls_made INTEGER NOT NULL,
  cache_hit_rate FLOAT NOT NULL,
  
  tier_selected VARCHAR(10) NOT NULL,
  max_depth INTEGER NOT NULL,
  
  concepts_updated INTEGER NOT NULL,
  positions_analyzed INTEGER NOT NULL,
  event_result VARCHAR(50) NOT NULL,
  error_message TEXT,
  
  smart_sampling_enabled BOOLEAN DEFAULT FALSE,
  cache_enabled BOOLEAN DEFAULT TRUE
);

-- Create indexes
CREATE INDEX idx_ingestion_events_ts ON ingestion_events(ts DESC);
CREATE INDEX idx_ingestion_events_user_ts ON ingestion_events(user_id, ts);
CREATE INDEX idx_ingestion_events_result ON ingestion_events(event_result);
```

### Step 4: Verify Migration

```sql
-- Check tables created
SELECT table_name 
FROM information_schema.tables 
WHERE table_name IN ('analysis_cache', 'ingestion_events');

-- Expected: 2 rows

-- Check indexes
SELECT tablename, indexname 
FROM pg_indexes 
WHERE tablename IN ('analysis_cache', 'ingestion_events');

-- Expected: 6+ indexes

-- Check table structures
\d analysis_cache
\d ingestion_events
```

---

## Post-Migration Validation

### Test 1: Insert Test Data

```sql
-- Test analysis_cache
INSERT INTO analysis_cache (
  cache_key, fen, depth, eval_cp, best_move, expires_at
) VALUES (
  'test_key_123',
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  14,
  20,
  'e2e4',
  NOW() + INTERVAL '7 days'
);

SELECT * FROM analysis_cache WHERE cache_key = 'test_key_123';

-- Expected: 1 row returned

-- Cleanup
DELETE FROM analysis_cache WHERE cache_key = 'test_key_123';
```

```sql
-- Test ingestion_events
INSERT INTO ingestion_events (
  user_id, game_id, duration_ms, candidates_selected,
  stockfish_calls_made, cache_hit_rate, tier_selected,
  max_depth, concepts_updated, positions_analyzed,
  event_result
) VALUES (
  'test_user',
  'test_game',
  1500,
  5,
  3,
  0.4,
  'B',
  14,
  3,
  5,
  'success'
);

SELECT * FROM ingestion_events WHERE user_id = 'test_user';

-- Expected: 1 row returned

-- Cleanup
DELETE FROM ingestion_events WHERE user_id = 'test_user';
```

### Test 2: Verify Existing Tables Unchanged

```sql
-- Check existing tables still work
SELECT COUNT(*) FROM user_concept_states;
SELECT COUNT(*) FROM advice_interventions;
SELECT COUNT(*) FROM learning_events;

-- All should return without error
```

### Test 3: Test Cache Queries

```sql
-- Test cache lookup
SELECT * FROM analysis_cache 
WHERE cache_key = 'nonexistent_key';

-- Expected: 0 rows (no error)

-- Test expired cache detection
SELECT COUNT(*) FROM analysis_cache 
WHERE expires_at < NOW();

-- Expected: 0 (or valid count)
```

---

## Rollback Plan

### If Migration Fails Completely

**Option 1: Restore from Backup**
```bash
psql $DATABASE_URL < chesschat_backup_YYYYMMDD_HHMMSS.sql
```

**Option 2: Drop New Tables Only**
```sql
DROP TABLE IF EXISTS ingestion_events;
DROP TABLE IF EXISTS analysis_cache;

-- Verify existing tables intact
SELECT COUNT(*) FROM user_concept_states;
```

### If Migration Succeeds but Code Has Issues

**Keep tables, disable feature flags**:
```toml
LEARNING_V3_ENABLED = "false"
```

The tables will remain empty but won't cause issues.

---

## Performance Considerations

### Expected Growth Rates

**analysis_cache**:
- Initial: 0 rows
- After 1 week: ~1,000-5,000 rows (common openings)
- After 1 month: ~10,000-30,000 rows
- Steady state: 50,000-100,000 rows (with TTL pruning)

**ingestion_events**:
- Per day: ~500-1,000 rows (depends on game volume)
- Per month: ~15,000-30,000 rows
- **Prune after 90 days**

### Index Maintenance

```sql
-- Rebuild indexes monthly (if performance degrades)
REINDEX TABLE analysis_cache;
REINDEX TABLE ingestion_events;
```

### Storage Estimates

```sql
-- Check table sizes
SELECT 
  table_name,
  pg_size_pretty(pg_total_relation_size(table_name::regclass)) as size
FROM (
  VALUES ('analysis_cache'), ('ingestion_events')
) AS t(table_name);
```

**Expected**:
- `analysis_cache`: ~50-100 MB at steady state
- `ingestion_events`: ~5-10 MB per month

---

## Monitoring Queries

### Cache Health

```sql
-- Cache size and hit statistics
SELECT 
  COUNT(*) as total_entries,
  SUM(hit_count) as total_hits,
  AVG(hit_count) as avg_hits_per_entry,
  MIN(created_at) as oldest_entry,
  MAX(created_at) as newest_entry
FROM analysis_cache;
```

### Ingestion Performance

```sql
-- Recent ingestion performance
SELECT 
  DATE_TRUNC('hour', ts) as hour,
  COUNT(*) as ingestions,
  AVG(duration_ms) as avg_duration,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) as p95_duration,
  AVG(cache_hit_rate) as avg_cache_hit_rate
FROM ingestion_events
WHERE ts > NOW() - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour DESC;
```

### Error Tracking

```sql
-- Errors in last 24 hours
SELECT 
  error_message,
  COUNT(*) as count
FROM ingestion_events
WHERE event_result != 'success'
  AND ts > NOW() - INTERVAL '24 hours'
GROUP BY error_message
ORDER BY count DESC;
```

---

## Troubleshooting

### Issue: `prisma db push` fails with permission error

**Cause**: Database user lacks CREATE TABLE permission

**Solution**:
```sql
GRANT CREATE ON SCHEMA public TO chesschat_user;
```

### Issue: Tables created but indexes missing

**Cause**: Partial migration failure

**Solution**: Run index creation manually (see Step 3 Option B)

### Issue: "relation analysis_cache does not exist"

**Cause**: Migration didn't run or wrong database

**Solution**:
```bash
# Verify connection string
echo $DATABASE_URL

# Check current database
psql $DATABASE_URL -c "\dt"

# Re-run migration
npx prisma db push
```

### Issue: High disk usage after migration

**Cause**: Cache not expiring properly

**Solution**:
```sql
-- Check expired entries
SELECT COUNT(*) FROM analysis_cache WHERE expires_at < NOW();

-- Delete expired
DELETE FROM analysis_cache WHERE expires_at < NOW();

-- Vacuum to reclaim space
VACUUM FULL analysis_cache;
```

---

## Final Checklist

- [ ] Backup created and verified
- [ ] Schema pushed successfully
- [ ] Tables created with correct columns
- [ ] Indexes created
- [ ] Test inserts successful
- [ ] Existing tables unchanged
- [ ] Performance baseline recorded
- [ ] Monitoring queries tested

---

## Appendix: Schema Diagram

```
┌─────────────────────────┐
│   analysis_cache        │
├─────────────────────────┤
│ id (PK)                 │
│ cache_key (UNIQUE)      │
│ fen                     │
│ depth                   │
│ eval_cp                 │
│ best_move               │
│ hit_count               │
│ expires_at (indexed)    │
└─────────────────────────┘

┌─────────────────────────┐
│   ingestion_events      │
├─────────────────────────┤
│ id (PK)                 │
│ ts (indexed DESC)       │
│ user_id (indexed)       │
│ game_id                 │
│ duration_ms             │
│ candidates_selected     │
│ stockfish_calls_made    │
│ cache_hit_rate          │
│ tier_selected           │
│ event_result (indexed)  │
└─────────────────────────┘

┌─────────────────────────┐
│ user_concept_states     │  (EXISTING)
│ advice_interventions    │  (EXISTING)
│ learning_events         │  (EXISTING)
└─────────────────────────┘
```

---

**Migration Guide Version**: 1.0  
**Last Updated**: December 31, 2025  
**Status**: Ready for Production
