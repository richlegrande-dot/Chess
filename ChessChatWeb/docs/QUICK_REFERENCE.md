# Quick Reference: Hardening Features

## 🎯 One-Liner Summary

Production-grade local-first learning with safe storage, evidence-based coaching, and smart caching.

---

## 🔧 Most Common Operations

### Check Server Capabilities

```typescript
import { getServerCapabilities } from '@/lib/api/capabilities';

const caps = await getServerCapabilities();
if (caps.learning.server) {
  // Server available
} else {
  // Local-only mode
}
```

### Safe Storage

```typescript
import * as safeStorage from '@/lib/storage/safeStorage';

// Get with default
const data = safeStorage.getItem<MyType>('namespace:key', validator, defaultValue);

// Set with options
safeStorage.setItem('namespace:key', data, {
  version: 1,
  ttl: 7 * 24 * 60 * 60 * 1000,  // 7 days
  maxBytes: 100 * 1024            // 100KB
});
```

### Update Mastery

```typescript
import * as masteryModel from '@/lib/coaching/masteryModel';

masteryModel.updateMastery({
  conceptKey: 'tactics-fork',
  wasMistake: true,
  severity: 0.7,
  evidenceId: 'game123-move15',
  timestamp: Date.now()
});

// Get focus areas
const priorities = masteryModel.getPracticePriorities();
// priorities[0] = highest priority concept
```

### Cache Coaching Report

```typescript
import * as coachingCache from '@/lib/coaching/coachingCache';

// Check cache
const cached = coachingCache.getCachedReport(pgn);
if (cached) return cached.report;

// Compute + cache
const report = computeReport(pgn);
coachingCache.cacheReport(pgn, report, insights, durationMs);
```

### Rate-Limited Logging

```typescript
import * as logger from '@/lib/logging/rateLimitedLogger';

logger.warn('Connection failed');  // Suppressed if repeated < 30s
logger.always('error', 'Critical failure');  // Never suppressed
```

### Record Diagnostics

```typescript
import * as diagnostics from '@/lib/diagnostics/clientDiagnostics';

diagnostics.recordAnalysisDuration(150);  // ms
diagnostics.recordCacheHit();
diagnostics.recordDegradedResponse('Server unavailable', 200);
```

---

## 🗂️ Namespace Convention

| Namespace | Quota | Purpose |
|-----------|-------|---------|
| `learning:*` | 2MB | Mastery data, player profile, metrics |
| `coaching:*` | 1MB | Cached reports, coaching state |
| `trainingExamples:*` | 2MB | Position snapshots, move history |
| `default` | 512KB | Everything else |

---

## 📊 Debug Panel

Access with `?debug=1` query parameter.

**Sections:**
- 📦 Storage (footprint by namespace)
- 🎓 Coaching (cache stats, hit rate)
- 🧠 Learning (mastery progress)
- ⚡ Performance (analysis duration)
- 📝 Logging (suppression stats)
- 🌐 Server Status (last degraded response)

**Actions:**
- Clear coaching cache
- Reset learning progress
- Clear namespace
- Reset counters

---

## 🎨 Evidence Types

```typescript
import { createMoveEvidence, createMetricEvidence } from '@/lib/coaching/evidenceTypes';

// Move evidence
createMoveEvidence(15, fen, 'Weakened kingside');

// Metric evidence
createMetricEvidence(-2.5, 'Position evaluation after move');

// Pattern evidence
createPatternEvidence('fork-pattern-123', 'Missed knight fork');
```

---

## ⚡ Performance Targets

| Metric | Target | Check |
|--------|--------|-------|
| Modal open | < 100ms | `?debug=1` → Performance |
| Analysis | < 500ms | `?debug=1` → Performance |
| Cache hit rate | > 80% | `?debug=1` → Coaching |
| Storage | < 5MB | `?debug=1` → Storage |

---

## 🚨 Error Handling

### Corruption Detected

```
[SafeStorage] Corruption detected in learning:profile: checksum mismatch
```

**Automatic:** Restores defaults, snapshots corrupt data

**Manual:** Check `localStorage['corrupt:learning:profile:*']`

### Quota Exceeded

**Automatic:** LRU pruning triggered

**Manual:**
```typescript
safeStorage.pruneLRU('learning', 1.5 * 1024 * 1024);  // Prune to 1.5MB
```

### Network Failure

**Automatic:** Falls back to local-only mode

**Check:** `?debug=1` → Server Status

---

## 🔍 Common Troubleshooting

| Problem | Solution |
|---------|----------|
| Modal slow to open | Integrate async analysis + skeleton UI |
| Console spam | Replace `console.*` with rate-limited logger |
| Storage full | Check `?debug=1`, prune or clear namespace |
| Missing capabilities | Check `/api/capabilities` endpoint |
| No mastery updates | Verify `updateMastery()` called with evidence |
| Cache not working | Verify PGN is consistent (check hash) |

---

## 📖 Full Documentation

- **Architecture:** `docs/LEARNING_LOCAL_FIRST.md`
- **Integration:** `docs/INTEGRATION_GUIDE.md`
- **Summary:** `docs/HARDENING_IMPLEMENTATION_SUMMARY.md`
- **Tests:** `tests/*.test.ts`
- **Smoke:** `scripts/manual-postgame-smoke.mjs`

---

## 🎯 Integration Checklist

- [ ] Add `<DiagnosticsPanel />` to layout
- [ ] Update `PostGameCoaching.tsx` for async analysis
- [ ] Replace `localStorage` with `safeStorage`
- [ ] Update pattern tracking with `masteryModel`
- [ ] Replace `console.*` with rate-limited logger
- [ ] Add evidence to coaching reports
- [ ] Test with `?debug=1`
- [ ] Run smoke test: `node scripts/manual-postgame-smoke.mjs`

---

## 💡 Best Practices

1. **Always check capabilities** before server calls
2. **Use namespaces** for storage organization
3. **Include evidence** for all coaching advice
4. **Cache expensive computations** (reports, analysis)
5. **Rate-limit logs** to prevent console spam
6. **Monitor diagnostics** in production with `?debug=1`

---

## 🚀 Quick Deploy

```bash
# Deploy infrastructure (safe, non-breaking)
git add functions/api/capabilities.ts
git add src/lib/**/*.ts
git add src/components/DiagnosticsPanel.tsx
git commit -m "feat: add learning system hardening"
git push

# Test in production
# Visit: https://chesschat.uk/?debug=1

# Integrate features gradually (see INTEGRATION_GUIDE.md)
```

---

**Created:** December 30, 2025  
**Status:** ✅ Ready for deployment
