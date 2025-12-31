# Architecture: Stockfish Engine + AI Coaching + Learning Layer

**Date:** December 29, 2025  
**Version:** 2.0 - Post-Weekend Refactor  
**Status:** Implementation in Progress

---

## Executive Summary

This document describes the refactored architecture for ChessChat, pivoting from an AI-based chess engine to a **deterministic Stockfish engine** for move generation, with AI relegated to **post-game coaching and narrative**, plus a **server-side learning layer** that builds persistent player models over time.

### Key Changes

1. **Stockfish** becomes the sole chess engine (deterministic, non-AI)
2. **Worker API** (`worker-api/`) owns all `/api/*` routes and becomes the authoritative backend
3. **AI Worker** (`worker-assistant/`) is repurposed for coaching narratives only (no move generation)
4. **Learning Layer** persists player analytics, game analysis, and builds player profiles over time
5. **Cloudflare Pages** serves the frontend with no business logic
6. **Strong observability**: structured errors, no silent fallbacks, comprehensive diagnostics

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│                    (Cloudflare Pages)                            │
│                   https://chesschat.uk                           │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     │ All /api/* requests
                     ↓
┌─────────────────────────────────────────────────────────────────┐
│                      WORKER API                                  │
│                 (Cloudflare Worker)                              │
│              chesschat.uk/api/*                                  │
│                                                                   │
│  Routes:                                                         │
│  • POST /api/chess-move      → Stockfish move generation        │
│  • POST /api/game/complete   → Save game + enqueue analysis     │
│  • GET  /api/game/:id        → Retrieve game                    │
│  • GET  /api/game/:id/analysis → Get analysis results           │
│  • GET  /api/learning/profile → Get player profile              │
│  • POST /api/ai/postgame     → Trigger AI coaching narrative    │
│  • GET  /api/admin/*         → Health, logs, diagnostics        │
│                                                                   │
│  Internal Services:                                              │
│  • Stockfish Server (Node.js or WASM)                           │
│  • Prisma Client (DB access)                                    │
│  • Analysis Pipeline (async processing)                         │
└────────┬────────────────────────────────────┬───────────────────┘
         │                                    │
         │ Service Binding                    │ Database (Prisma)
         ↓                                    ↓
┌────────────────────────┐        ┌──────────────────────────┐
│    AI WORKER           │        │   PostgreSQL Database     │
│  (walle-assistant)     │        │   (via Prisma Accelerate) │
│                        │        │                           │
│  Endpoints:            │        │  Tables:                  │
│  • /assist/postgame    │        │  • Game                   │
│  • /assist/explain     │        │  • GameAnalysis           │
│                        │        │  • PlayerProfile          │
│  No /api/* routes!     │        │  • LearningEvent          │
└────────────────────────┘        │  • WorkerCallLog          │
                                   │  • AICallLog              │
                                   └──────────────────────────┘
```

---

## Request Flows

### 1. Move Generation (Deterministic)

```
Frontend → POST /api/chess-move
         ↓
Worker API receives request:
  {
    "fen": "...",
    "cpuLevel": 1-10,
    "timeMs": 1500,
    "gameId": "...",
    "playerId": "..."
  }
         ↓
Worker API calls Stockfish Server:
  - Parse FEN
  - Set depth/time based on cpuLevel
  - Compute move using Stockfish
  - Extract evaluation, PV, depth, nodes
         ↓
Worker API logs to database (WorkerCallLog)
         ↓
Worker API returns:
  {
    "success": true,
    "engine": "stockfish",
    "mode": "worker-api",
    "move": "e2e4",
    "diagnostics": {
      "requestId": "...",
      "latencyMs": 123,
      "depthReached": 14,
      "evaluationCp": 32,
      "pv": "e2e4 e7e5 ...",
      "nodes": 123456
    }
  }
```

**No Fallback:** If Stockfish fails, return structured error. Do NOT switch engines.

### 2. Post-Game Analysis & Learning

```
Frontend → POST /api/game/complete
         ↓
Worker API:
  - Save game to DB (Game table)
  - Enqueue analysis job (Cloudflare Queue or waitUntil)
         ↓
Analysis Pipeline (async):
  - Run Stockfish analysis pass on key positions
  - Compute centipawn loss per move
  - Classify mistakes (blunder/mistake/inaccuracy)
  - Detect tactical themes (hanging pieces, forks, pins, etc.)
  - Update PlayerProfile aggregates
  - Save GameAnalysis to DB
         ↓
Frontend polls GET /api/game/:id/analysis
         ↓
Returns analysis results when ready
```

### 3. Post-Game Coaching Chat

```
Frontend → POST /api/ai/postgame
         ↓
Worker API:
  - Fetch game summary from DB
  - Fetch player profile signals
  - Fetch game analysis (mistakes, themes)
         ↓
Worker API → Service Binding → AI Worker:
  POST /assist/postgame
  {
    "gameId": "...",
    "playerProfile": {...},
    "keyMoments": [...]
  }
         ↓
AI Worker:
  - Generate narrative coaching message
  - Highlight key mistakes + improvements
  - Provide personalized recommendations
         ↓
AI Worker returns:
  {
    "success": true,
    "mode": "ai-worker",
    "message": "human-friendly coaching narrative",
    "highlights": [...],
    "recommendations": [...]
  }
         ↓
Worker API logs to DB (AICallLog)
         ↓
Worker API returns coaching to frontend
```

---

## Components

### 1. Worker API (`worker-api/`)

**Purpose:** Authoritative backend for all business logic

**Routes:**
- `POST /api/chess-move` - Stockfish move generation
- `POST /api/game/complete` - Save game + trigger analysis
- `GET /api/game/:id` - Retrieve game
- `GET /api/game/:id/analysis` - Get analysis results
- `GET /api/learning/profile?playerId=...` - Get player profile
- `POST /api/ai/postgame` - Trigger coaching narrative
- `GET /api/admin/worker-health` - Health check
- `GET /api/admin/worker-calls` - Query logs
- `GET /api/admin/learning-health` - Analysis pipeline status

**Technologies:**
- Cloudflare Worker (TypeScript)
- Prisma Client (DB access via Prisma Accelerate)
- Stockfish integration (Node.js server or WASM)
- Service binding to AI Worker

**Configuration:**
- `wrangler.toml`: Routes, secrets, service bindings
- `prisma/schema.prisma`: Database schema
- Deployment: `wrangler deploy` (from `worker-api/`)

### 2. AI Worker (`worker-assistant/`)

**Purpose:** Generate coaching narratives and explanations (NO move generation)

**Endpoints:**
- `POST /assist/postgame` - Generate post-game coaching
- `POST /assist/explain-move` - Explain a specific move/position

**Key Constraint:** NO `/api/*` routes. Only called internally by Worker API via service binding.

**Technologies:**
- Cloudflare Worker (TypeScript)
- AI SDK (for narrative generation)
- No chess engine, no move generation

**Configuration:**
- `wrangler.toml`: Service name, compatibility
- Deployment: `wrangler deploy --env production` (from `worker-assistant/`)

### 3. Stockfish Server

**Options:**
1. **Separate Node.js server** (preferred for reliability + debugging)
   - Run Stockfish as subprocess
   - Expose HTTP API for move computation
   - Easy to monitor and log
   - Can run locally or on separate service

2. **WASM Stockfish in Worker** (if feasible)
   - Embed Stockfish WASM in Worker
   - Call directly from Worker API
   - More integrated but harder to debug

**API Contract:**
```
POST /compute-move
{
  "fen": "...",
  "depth": 14,
  "timeMs": 2000
}

Response:
{
  "move": "e2e4",
  "evaluation": 32,
  "pv": "e2e4 e7e5 g1f3 ...",
  "depth": 14,
  "nodes": 123456,
  "time": 1987
}
```

### 4. Learning Layer

**Purpose:** Build persistent player models and insights over time

**Data Model:**
- `Game` - PGN, result, timestamps, userId
- `GameAnalysis` - Per-move eval deltas, blunders, mistakes, key moments
- `PlayerProfile` - Aggregate counters, openings, blunder types, themes
- `LearningEvent` - Append-only events for recomputing profiles

**Pipeline:**
1. Game completes → Save to DB
2. Enqueue analysis job (Cloudflare Queue or `waitUntil`)
3. Analysis job runs:
   - Stockfish analysis pass
   - Compute metrics
   - Detect patterns
   - Update PlayerProfile
4. Frontend polls for analysis results

**Metrics Tracked:**
- Openings frequency
- Average centipawn loss
- Blunders by theme (tactical, positional, endgame)
- Tactical motifs missed (forks, pins, skewers)
- Endgame weakness tags
- Time pressure patterns
- Accuracy trends

### 5. Observability & Diagnostics

**Required in Every Response:**
- `requestId` - UUID for correlation
- `mode` - "worker-api" or "ai-worker"
- `engine` - "stockfish" or "ai"
- `latencyMs` - Request duration
- `diagnostics` - Detailed metrics

**Logging:**
- Worker API logs → Cloudflare Worker logs + DB table `WorkerCallLog`
- AI Worker logs → Cloudflare Worker logs + DB table `AICallLog`
- Learning logs → DB tables + Worker logs

**Admin Endpoints:**
- `GET /api/admin/worker-health` - Stockfish reachable, DB reachable
- `GET /api/admin/worker-calls` - Query WorkerCallLog
- `GET /api/admin/learning-health` - Analysis pipeline status, queue depth

**Structured Errors (NO silent fallback):**
```json
{
  "success": false,
  "engine": "stockfish",
  "mode": "worker-api",
  "errorCode": "STOCKFISH_UNAVAILABLE|ENGINE_TIMEOUT|BAD_FEN|INTERNAL",
  "error": "message",
  "diagnostics": {
    "requestId": "...",
    "latencyMs": 123
  }
}
```

---

## Deployment

### 1. Worker API Deployment

```bash
cd worker-api
npm run prisma:generate
wrangler deploy
```

**Cloudflare Dashboard:**
- Route: `chesschat.uk/api/*` → Worker API
- Secrets:
  - `DATABASE_URL` (Prisma Accelerate)
  - `ADMIN_PASSWORD`
  - `INTERNAL_AUTH_TOKEN` (optional, for AI Worker communication)

### 2. AI Worker Deployment

```bash
cd worker-assistant
wrangler deploy --env production
```

**Cloudflare Dashboard:**
- Service binding: `WALLE_ASSISTANT` → `walle-assistant` (production)
- Secrets:
  - `AI_*` secrets (if needed)
  - `INTERNAL_AUTH_TOKEN` (optional)

### 3. Pages Deployment

```bash
npm run build
wrangler pages deploy dist
```

**Cloudflare Dashboard:**
- Root directory: `ChessChatWeb`
- Build command: `npm run build`
- Build output directory: `dist`

### 4. Stockfish Server Deployment

If using separate Node.js server:
- Deploy to separate service (e.g., Fly.io, Railway, etc.)
- Set `STOCKFISH_SERVER_URL` in Worker API secrets

If using WASM in Worker:
- Include Stockfish WASM in Worker bundle
- Configure in Worker API code

---

## Hard Lessons from Weekend Debugging

### 1. No Silent Fallback

**Problem:** Fallback behavior masked Worker failures, making troubleshooting impossible.

**Solution:** If Stockfish fails, return structured error. Do NOT switch to minimax or any fallback engine. Fail loudly.

### 2. Single Source of Truth for Routes

**Problem:** Multiple workers intercepting `/api/*` caused routing conflicts.

**Solution:** Worker API is the ONLY owner of `/api/*`. AI Worker has NO public routes.

### 3. Persistent Logging

**Problem:** Logs disappeared, making it impossible to debug production issues.

**Solution:** Log every Worker call to database (WorkerCallLog, AICallLog). Include requestId for correlation.

### 4. Cache Confusion

**Problem:** Browser cache masked API changes.

**Solution:** All API responses include `Cache-Control: no-store` headers.

### 5. Automated Verification

**Problem:** Manual verification missed configuration drift.

**Solution:** Automated verification scripts run in CI. Fail builds on architecture violations.

---

## Migration Plan

### Phase 1: Deploy Worker API with Stockfish

1. Implement Stockfish integration in Worker API
2. Deploy Worker API with health checks
3. Verify Stockfish endpoint works: `POST /api/chess-move`
4. Monitor logs and diagnostics

**Rollback:** Revert Worker API to previous version

### Phase 2: Switch Frontend to Worker API

1. Update frontend to call Worker API endpoint
2. Remove any Pages Functions that duplicate logic
3. Verify frontend works end-to-end
4. Monitor error rates

**Rollback:** Revert frontend to previous API endpoint

### Phase 3: Enable Learning Pipeline

1. Deploy database schema updates
2. Enable analysis pipeline
3. Verify games are analyzed
4. Verify player profiles update

**Rollback:** Disable analysis pipeline, keep games saving

### Phase 4: Enable AI Worker for Coaching

1. Deploy AI Worker with coaching endpoints
2. Add service binding to Worker API
3. Enable post-game coaching chat
4. Monitor AI Worker logs

**Rollback:** Remove service binding, disable coaching chat

---

## Success Criteria

1. ✅ Stockfish generates all moves (no AI)
2. ✅ Worker API owns all `/api/*` routes
3. ✅ AI Worker is coaching-only (no move generation)
4. ✅ Learning pipeline persists player profiles
5. ✅ All responses include diagnostics + requestId
6. ✅ Structured errors (no silent fallback)
7. ✅ Logs persisted to database
8. ✅ Admin endpoints for health + diagnostics
9. ✅ Verification scripts pass in CI
10. ✅ End-to-end integration tests pass

---

## References

- Stockfish Integration: https://official-stockfish.github.io/docs/stockfish-wiki/Developers.html
- Prisma Accelerate: https://www.prisma.io/docs/accelerate
- Cloudflare Workers: https://developers.cloudflare.com/workers/
- Cloudflare Queues: https://developers.cloudflare.com/queues/

---

**Next Steps:** See individual implementation todos in the repository.
