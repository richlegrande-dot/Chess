# Stockfish Render.com Architecture - Production System

**Last Updated:** December 29, 2025  
**Status:** Production Ready ✅

## Overview

ChessChat uses a distributed architecture with Stockfish hosted on Render.com for all vs-cpu gameplay. This document describes the complete system architecture, request flows, and operational characteristics.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Browser                             │
│                    https://chesschat.uk                          │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ HTTPS
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Cloudflare Pages                              │
│           Frontend (React + TypeScript + Vite)                   │
│  - Static assets served from edge                                │
│  - Client-side chess rendering                                   │
│  - WebSocket fallback for realtime                               │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ POST /api/chess-move
                             │ { fen, cpuLevel, mode }
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                 Cloudflare Worker API                            │
│              chesschat-worker-api (index.ts)                     │
│                                                                   │
│  Routes:                                                          │
│  - POST /api/chess-move        → handleChessMove()              │
│  - GET  /api/admin/worker-health                                 │
│  - GET  /api/admin/stockfish-health (auth required)              │
│  - GET  /api/admin/worker-calls                                  │
│                                                                   │
│  Logic:                                                           │
│  - mode="vs-cpu"   → StockfishEngine (HTTP to Render)           │
│  - mode="coaching" → Minimax fallback (lightweight)             │
│  - Logs all calls to WorkerCallLog table via Prisma             │
│  - Cold start handling with retries                              │
│  - RequestId propagation for tracing                             │
└────────┬────────────────────────────────────┬───────────────────┘
         │                                    │
         │ HTTP POST                          │ Prisma Accelerate
         │ Authorization: Bearer <key>        │ (DATABASE_URL)
         │ X-Request-Id: <uuid>               │
         ▼                                    ▼
┌──────────────────────────────┐    ┌─────────────────────────────┐
│   Render.com Web Service     │    │   PostgreSQL (Neon/Supabase) │
│  chesschat-stockfish         │    │                              │
│  (Node.js + Stockfish 16)    │    │  Tables:                     │
│                               │    │  - WorkerCallLog             │
│  Endpoints:                   │    │  - Game, Player, Move, etc   │
│  - GET  /health              │    │                              │
│  - POST /compute-move        │    │  Accessed via:               │
│  - POST /analyze (optional)  │    │  Prisma Accelerate           │
│                               │    │  (connection pooling)        │
│  Native Stockfish binary:    │    └─────────────────────────────┘
│  - Max 2 concurrent engines  │
│  - Skill Levels 1-10         │
│  - Depth-limited search      │
│  - UCI protocol              │
│  - Structured JSON logs      │
│                               │
│  Free tier limits:           │
│  - 512MB RAM                 │
│  - Cold start after idle     │
│  - Spins down after 15 min   │
└──────────────────────────────┘
```

## Request Flow: Compute Chess Move

### 1. Client Request
```http
POST https://chesschat.uk/api/chess-move
Content-Type: application/json

{
  "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  "cpuLevel": 5,
  "mode": "vs-cpu",
  "timeMs": 3000
}
```

### 2. Worker Processing

**Phase A: Routing**
- Worker receives request at Cloudflare edge
- Generates unique `requestId` (UUID)
- Routes to `handleChessMove()`
- Checks mode: `vs-cpu` → Stockfish path

**Phase B: Stockfish Call**
```typescript
const stockfish = new StockfishEngine(env);
const result = await stockfish.computeMove({
  fen, cpuLevel, timeMs, gameId, mode
});
```

**Phase C: Cold Start Handling**
- Attempt 1: 10s timeout (fast path)
- If timeout → Attempt 2: 60s timeout (cold start tolerance)
- Retries with exponential backoff: 5s, 10s
- If all fail → return 502 with `STOCKFISH_TIMEOUT`

**Phase D: Error Mapping**
- `BAD_FEN` → HTTP 400 (client error)
- `STOCKFISH_UNAUTHORIZED` → HTTP 502 (config error)
- `STOCKFISH_TIMEOUT` → HTTP 502 (upstream error)
- `STOCKFISH_UNAVAILABLE` → HTTP 502 (service down)
- Network errors → HTTP 502

**Phase E: Success Response**
```json
{
  "success": true,
  "move": "e2e4",
  "source": "stockfish",
  "requestId": "abc-123-def",
  "diagnostics": {
    "fen": "...",
    "move": "e2e4",
    "cpuLevel": 5,
    "latencyMs": 1234,
    "stockfishMs": 987,
    "depth": 10,
    "nodes": 45678,
    "nps": 46234,
    "evaluation": 0.15,
    "pv": "e2e4 e7e5 Ng1f3",
    "mate": null
  }
}
```

**Phase F: Database Logging**
```typescript
await prisma.workerCallLog.create({
  data: {
    ts: new Date(),
    endpoint: '/api/chess-move',
    method: 'POST',
    success: true,
    latencyMs: 1234,
    cpuLevel: 5,
    mode: 'vs-cpu',
    engine: 'stockfish',
    requestJson: { fen, cpuLevel },
    responseJson: { success: true, move: 'e2e4' }
  }
});
```

### 3. Render Server Processing

**Step 1: Authentication**
- Validates `Authorization: Bearer <STOCKFISH_API_KEY>`
- Returns 401 if missing or invalid

**Step 2: FEN Validation**
- Uses chess.js to validate FEN
- Returns 400 if invalid: `{ success: false, error: "Invalid FEN notation" }`

**Step 3: Cold Start Detection**
```javascript
const now = Date.now();
const coldStartDetected = (now - lastRequestTime) > 60000;
lastRequestTime = now;
```

**Step 4: Engine Pool Management**
- Check for idle engines (MAX_ENGINES=2)
- Spawn new engine if under limit
- Wait for available engine if at capacity
- Queue timeout: 10s

**Step 5: Stockfish Computation**
```javascript
// Configure deterministic play
engine.send(`setoption name Skill Level value ${skillLevel}`);
engine.send(`setoption name MultiPV value 1`);
engine.send(`setoption name Contempt value 0`);

// Start search
engine.send(`go movetime ${movetime} depth ${depth}`);
```

**Step 6: Response with Diagnostics**
```json
{
  "success": true,
  "move": "e2e4",
  "uci": "e2e4",
  "san": "e4",
  "source": "stockfish",
  "diagnostics": {
    "cpuLevel": 5,
    "depth": 10,
    "skillLevel": 10,
    "movetimeMs": 700,
    "engineMs": 654,
    "nodes": 45678,
    "nps": 69843,
    "evalCp": 15,
    "mate": null,
    "pv": "e2e4 e7e5 Ng1f3",
    "totalMs": 687,
    "coldStartDetected": false,
    "requestId": "abc-123-def"
  },
  "timestamp": "2025-12-29T10:15:30.123Z",
  "requestId": "abc-123-def"
}
```

## Engine Configuration

### CPU Levels → Stockfish Parameters

| Level | Depth | Movetime (ms) | Skill Level | Expected Strength |
|-------|-------|---------------|-------------|-------------------|
| 1     | 4     | 150           | 0           | ~800 ELO (beginner) |
| 2     | 6     | 200           | 3           | ~1000 ELO |
| 3     | 6     | 300           | 6           | ~1200 ELO |
| 4     | 8     | 400           | 8           | ~1400 ELO |
| 5     | 10    | 700           | 10          | ~1600 ELO (intermediate) |
| 6     | 12    | 1000          | 12          | ~1800 ELO |
| 7     | 14    | 1500          | 15          | ~2000 ELO |
| 8     | 16    | 2000          | 17          | ~2200 ELO |
| 9     | 18    | 2500          | 19          | ~2400 ELO (advanced) |
| 10    | 20    | 3000          | 20          | ~2800+ ELO (near-maximum) |

### Determinism Strategy

Stockfish is configured for **maximum determinism**:
- `Skill Level`: Controls strength (0-20)
- `MultiPV = 1`: Single best line only (no randomization from multi-PV)
- `Contempt = 0`: Neutral draw evaluation
- Fixed `movetime` and `depth` per level

**Note:** Stockfish Skill Level includes some intentional randomization at lower levels to simulate human mistakes. Perfect determinism is not guaranteed at Skill Level < 10.

## Error Handling Matrix

| Error Scenario | HTTP Status | Error Code | Worker Behavior | Client Impact |
|----------------|-------------|------------|-----------------|---------------|
| Invalid FEN | 400 | `BAD_FEN` | Return immediately | Show "Invalid position" |
| Missing FEN | 400 | `MISSING_FEN` | Return immediately | Show "Missing data" |
| Bad API Key | 502 | `STOCKFISH_UNAUTHORIZED` | Log + return | Show "Server config error" |
| Render timeout | 502 | `STOCKFISH_TIMEOUT` | Retry once, then fail | Show "Server busy, try again" |
| Render down | 502 | `STOCKFISH_UNAVAILABLE` | Retry once, then fail | Show "Service unavailable" |
| Bad response | 502 | `STOCKFISH_BAD_RESPONSE` | Log + return | Show "Server error" |
| Network error | 502 | `INTERNAL` | Log + return | Show "Connection error" |
| Game over | 400 | N/A | Return with reason | Show game over state |

**Key Rule:** Worker **NEVER** falls back to minimax for vs-cpu mode. All vs-cpu failures are hard errors (502).

## Concurrency & Resource Management

### Render Free Tier Limits
- **Memory:** 512MB RAM
- **CPUs:** Shared CPU (throttled)
- **Concurrent Engines:** MAX_ENGINES=2
- **Idle Timeout:** ~15 minutes → cold start
- **Cold Start Time:** 30-60 seconds (binary download + spawn)

### Engine Pool Strategy
```javascript
const enginePool = [];
const MAX_ENGINES = 2;

async function getEngine() {
  // Try idle engine
  for (const engine of enginePool) {
    if (engine.idle) {
      engine.idle = false;
      return engine;
    }
  }
  
  // Create new if under limit
  if (enginePool.length < MAX_ENGINES) {
    const engine = new StockfishEngine();
    await engine.spawn();
    enginePool.push(engine);
    return engine;
  }
  
  // Wait for available (with timeout)
  return waitForEngine();
}
```

### Concurrent Request Handling
- **0-2 requests:** Instant (idle engines available)
- **3-4 requests:** Queue for 100ms-10s (waiting for engine)
- **5+ requests:** HTTP 429 or queue indefinitely (degraded)

**Mitigation:** Keep-warm cron job prevents cold starts during active hours.

## Observability

### Logs: Cloudflare Worker
```json
{
  "timestamp": "2025-12-29T10:15:30Z",
  "requestId": "abc-123",
  "endpoint": "/api/chess-move",
  "method": "POST",
  "mode": "vs-cpu",
  "engine": "stockfish",
  "cpuLevel": 5,
  "latencyMs": 1234,
  "success": true
}
```

**Location:** Cloudflare Dashboard → Workers & Pages → chesschat-worker-api → Logs

### Logs: Render Service
```json
{
  "timestamp": "2025-12-29T10:15:30.123Z",
  "requestId": "abc-123",
  "action": "compute_move_complete",
  "move": "e2e4",
  "san": "e4",
  "durationMs": 687,
  "engineMs": 654,
  "coldStartDetected": false
}
```

**Location:** Render Dashboard → chesschat-stockfish → Logs

### Database: WorkerCallLog
```sql
SELECT
  ts,
  endpoint,
  method,
  success,
  latency_ms,
  cpu_level,
  mode,
  engine,
  error,
  request_json,
  response_json
FROM "WorkerCallLog"
WHERE ts > NOW() - INTERVAL '1 hour'
ORDER BY ts DESC
LIMIT 100;
```

**Access:** Prisma Studio or SQL client via DATABASE_URL

### Admin Endpoints

#### GET /api/admin/worker-health
**Auth:** Required (`Authorization: Bearer <ADMIN_PASSWORD>`)

```json
{
  "healthy": true,
  "latencyMs": 45,
  "checks": {
    "timestamp": "2025-12-29T10:15:30Z",
    "version": "2.0.0",
    "environment": "production",
    "database": { "status": "ok", "message": "Connected" },
    "env": {
      "DATABASE_URL": "set",
      "ADMIN_PASSWORD": "set",
      "STOCKFISH_SERVER_URL": "set",
      "STOCKFISH_API_KEY": "set"
    }
  }
}
```

#### GET /api/admin/stockfish-health
**Auth:** Required (`Authorization: Bearer <ADMIN_PASSWORD>`)

```json
{
  "success": true,
  "status": "healthy",
  "serverUrl": "https://chesschat-stockfish.onrender.com",
  "latencyMs": 234,
  "timestamp": "2025-12-29T10:15:30Z"
}
```

## Deployment Topology

| Component | Platform | Region | URL |
|-----------|----------|--------|-----|
| Frontend | Cloudflare Pages | Global Edge | https://chesschat.uk |
| Worker API | Cloudflare Workers | Global Edge | (attached to /api/*) |
| Database | Neon/Supabase | US-West | (via Prisma Accelerate) |
| Stockfish | Render.com | Oregon (US-West) | https://chesschat-stockfish.onrender.com |

**Latency Profile:**
- Frontend → Worker: <10ms (edge)
- Worker → Database: 50-150ms (Prisma Accelerate)
- Worker → Stockfish: 200-500ms (cross-service HTTP + compute)
- **Total:** 300-700ms for typical move (warm start)
- **Cold Start:** 30-60s first request after idle

## Security

### Authentication Flows
1. **Client → Worker:** No auth required (public API)
2. **Worker → Render:** Bearer token (`STOCKFISH_API_KEY`)
3. **Client → Admin Endpoints:** Bearer token (`ADMIN_PASSWORD`)

### Secret Management
- **Cloudflare Secrets:** `wrangler secret put <KEY>`
  - `DATABASE_URL` (Prisma Accelerate connection string)
  - `ADMIN_PASSWORD`
  - `STOCKFISH_API_KEY`
  - `INTERNAL_AUTH_TOKEN` (optional, for AI Coach)

- **Render Secrets:** Dashboard → Environment Variables
  - `STOCKFISH_API_KEY` (must match Worker)
  - `NODE_ENV=production`

### Logging Safety
- **Never Log:** API keys, tokens, DATABASE_URL
- **Safe to Log:** RequestId, FEN (truncated), CPU levels, timings
- **Render Logs:** Structured JSON without secrets
- **Worker Logs:** Structured JSON without secrets

## Keep-Warm Strategy (Optional)

### Scheduled Cron (Cloudflare)
```toml
# wrangler.toml
[[triggers.crons]]
cron = "*/10 * * * *"  # Every 10 minutes

[vars]
ENABLE_STOCKFISH_KEEPWARM = "true"
```

### Scheduled Handler
```typescript
async scheduled(event: ScheduledEvent, env: Env) {
  if (env.ENABLE_STOCKFISH_KEEPWARM !== 'true') return;
  
  const stockfish = new StockfishEngine(env);
  await stockfish.init(); // Pings /health
}
```

**Tradeoffs:**
- ✅ Eliminates cold starts during active hours
- ✅ Consistent <1s response times
- ⚠️ Uses Render free tier hours faster
- ⚠️ Increases Cloudflare Worker invocations

**Recommendation:** Enable during peak hours, disable overnight to save resources.

## Migration from Option A (VPS)

This architecture replaced the original VPS deployment:

| Aspect | Option A (VPS) | Option B (Render) |
|--------|----------------|-------------------|
| Hosting | Self-managed VPS | Render.com PaaS |
| Scalability | Manual | Automatic (within limits) |
| Maintenance | SSH + manual updates | Git push auto-deploy |
| Cold Starts | Never | After 15 min idle |
| Cost | $5-20/month | Free tier + premium if needed |
| Observability | Manual logging | Integrated logs + metrics |
| Reliability | Single point of failure | Managed platform + health checks |

**Migration Date:** December 27-29, 2025

## Troubleshooting

See [OPERATIONS_RUNBOOK.md](./OPERATIONS_RUNBOOK.md) for detailed troubleshooting procedures.

## References

- [RENDER_DEPLOY.md](./RENDER_DEPLOY.md) - Deployment guide
- [OPERATIONS_RUNBOOK.md](./OPERATIONS_RUNBOOK.md) - Operations & troubleshooting
- [CLOUDFLARE_WORKER_SETUP.md](./CLOUDFLARE_WORKER_SETUP.md) - Worker configuration
- [RENDER_MIGRATION_COMPLETE.md](./RENDER_MIGRATION_COMPLETE.md) - Migration status report
