# Architecture Change #3: Stockfish as Sole Move Engine + Learning Backend

**Date:** January 1, 2026  
**Status:** 🚧 Implementation Required  
**Priority:** High

---

## ✅ What's Already Correct

### Current State (Verified):
1. **Worker already uses Stockfish as primary** (`worker-api/src/index-new.ts`)
   - No WalleChessEngine fallback in `/api/chess-move`
   - Direct calls to Render Stockfish `/compute-move`
   - Proper error handling without local fallback

2. **Render Stockfish is functional** (chesschat-stockfish.onrender.com)
   - `/health` endpoint working
   - `/compute-move` endpoint working
   - Native Stockfish 16 binary
   - UCI protocol integration

3. **Worker logging is comprehensive**
   - WorkerCallLog tracking
   - Request ID propagation
   - Latency metrics

---

## 🚧 What Needs Implementation

### A) Add Feature Flags

Add to `worker-api/wrangler.toml`:

```toml
[vars]
# Architecture flags
STOCKFISH_IS_PRIMARY_MOVE_ENGINE = "true"
CPU_MOVE_FALLBACK_LOCAL = "false"
LEARNING_V3_ASYNC_ANALYSIS = "true"
STOCKFISH_GAME_ANALYSIS_ENABLED = "true"

# Cache settings
CHESS_MOVE_CACHE_TTL_SECONDS = "30"
CHESS_MOVE_CACHE_MAX_SIZE = "1000"
```

**Action:** Add these vars and read them in Worker code

---

### B) Add Move Caching (Optional Optimization)

**File:** `worker-api/src/moveCache.ts` (new)

```typescript
/**
 * Simple in-memory move cache
 * Cache key: `${fen}:${cpuLevel}`
 * TTL: 30 seconds (configurable)
 */

interface CachedMove {
  move: string;
  evaluation?: number;
  timestamp: number;
}

export class MoveCache {
  private cache = new Map<string, CachedMove>();
  private maxSize = 1000;
  private ttlMs = 30000;

  constructor(maxSize?: number, ttlSeconds?: number) {
    if (maxSize) this.maxSize = maxSize;
    if (ttlSeconds) this.ttlMs = ttlSeconds * 1000;
  }

  getCacheKey(fen: string, cpuLevel: number): string {
    return `${fen}:${cpuLevel}`;
  }

  get(fen: string, cpuLevel: number): string | null {
    const key = this.getCacheKey(fen, cpuLevel);
    const cached = this.cache.get(key);
    
    if (!cached) return null;
    
    const age = Date.now() - cached.timestamp;
    if (age > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.move;
  }

  set(fen: string, cpuLevel: number, move: string, evaluation?: number): void {
    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    
    const key = this.getCacheKey(fen, cpuLevel);
    this.cache.set(key, {
      move,
      evaluation,
      timestamp: Date.now()
    });
  }

  clear(): void {
    this.cache.clear();
  }
}

// Singleton instance
let cacheInstance: MoveCache | null = null;

export function getMoveCache(maxSize?: number, ttlSeconds?: number): MoveCache {
  if (!cacheInstance) {
    cacheInstance = new MoveCache(maxSize, ttlSeconds);
  }
  return cacheInstance;
}
```

**Action:** Create this file, integrate into `handleChessMove()` before calling Stockfish

---

### C) Add Render Stockfish `/analyze-game` Endpoint

**Location:** Render server (chesschat-stockfish repository)

**New endpoint:** `POST /analyze-game`

```typescript
// Render server: src/routes/analyzeGame.ts

import { Chess } from 'chess.js';
import { StockfishEngine } from '../engine';

interface AnalyzeGameRequest {
  pgn: string;
  playerColor: 'white' | 'black';
  maxPlies?: number; // default 60
  depth?: number; // default 14
  timeMs?: number; // per position, default 250ms
  tags?: ('blunders' | 'keyMoves' | 'accuracy')[]; // default all
}

interface KeyMoment {
  ply: number;
  fen: string;
  move: string;
  evalBeforeCp: number;
  evalAfterCp: number;
  swingCp: number;
  classification: 'blunder' | 'mistake' | 'inaccuracy' | 'good' | 'brilliant';
  principalVariation?: string[];
}

interface AnalyzeGameResponse {
  success: true;
  summary: {
    accuracy: { white: number; black: number };
    counts: {
      blunder: number;
      mistake: number;
      inaccuracy: number;
      goodMove: number;
    };
  };
  keyMoments: KeyMoment[];
  pliesTotalAnalyzed: number;
  timeUsedMs: number;
}

export async function analyzeGame(req: AnalyzeGameRequest): Promise<AnalyzeGameResponse> {
  const startTime = Date.now();
  const chess = new Chess();
  
  try {
    chess.loadPgn(req.pgn);
  } catch (error) {
    throw new Error('Invalid PGN');
  }
  
  const history = chess.history({ verbose: true });
  const maxPlies = Math.min(req.maxPlies || 60, history.length);
  const depth = req.depth || 14;
  const timeMs = req.timeMs || 250;
  
  // Sampling strategy: first 4, last 4, then every 6th
  const pliesToAnalyze = new Set<number>();
  
  // First 4 plies (opening)
  for (let i = 0; i < Math.min(4, maxPlies); i++) {
    pliesToAnalyze.add(i);
  }
  
  // Last 4 plies (endgame)
  if (maxPlies > 4) {
    for (let i = Math.max(4, maxPlies - 4); i < maxPlies; i++) {
      pliesToAnalyze.add(i);
    }
  }
  
  // Every 6th ply in middle
  for (let i = 4; i < maxPlies - 4; i += 6) {
    pliesToAnalyze.add(i);
  }
  
  const keyMoments: KeyMoment[] = [];
  const playerStats = { white: { total: 0, swing: 0 }, black: { total: 0, swing: 0 } };
  const counts = { blunder: 0, mistake: 0, inaccuracy: 0, goodMove: 0 };
  
  // Reset to start
  chess.reset();
  
  for (const plyIndex of Array.from(pliesToAnalyze).sort((a, b) => a - b)) {
    if (plyIndex >= history.length) continue;
    
    // Get FEN before move
    const fenBefore = chess.fen();
    
    // Evaluate before
    const evalBefore = await evaluatePosition(fenBefore, depth, timeMs);
    
    // Make the move
    const move = history[plyIndex];
    chess.move(move);
    
    // Evaluate after
    const fenAfter = chess.fen();
    const evalAfter = await evaluatePosition(fenAfter, depth, timeMs);
    
    // Calculate swing (from player's perspective)
    const swingCp = move.color === 'w' ? 
      (evalAfter - evalBefore) : 
      (evalBefore - evalAfter);
    
    // Classify move
    let classification: KeyMoment['classification'] = 'good';
    if (swingCp < -300) classification = 'blunder';
    else if (swingCp < -100) classification = 'mistake';
    else if (swingCp < -50) classification = 'inaccuracy';
    else if (swingCp > 100) classification = 'brilliant';
    
    // Update counts
    if (classification === 'blunder') counts.blunder++;
    else if (classification === 'mistake') counts.mistake++;
    else if (classification === 'inaccuracy') counts.inaccuracy++;
    else if (classification === 'good' || classification === 'brilliant') counts.goodMove++;
    
    // Update player stats
    const playerKey = move.color === 'w' ? 'white' : 'black';
    playerStats[playerKey].total++;
    playerStats[playerKey].swing += Math.abs(swingCp);
    
    // Add to key moments if significant
    if (Math.abs(swingCp) > 50 || classification === 'brilliant') {
      keyMoments.push({
        ply: plyIndex + 1,
        fen: fenBefore,
        move: move.san,
        evalBeforeCp: evalBefore,
        evalAfterCp: evalAfter,
        swingCp,
        classification,
      });
    }
  }
  
  // Calculate accuracy (0-100, where 100 = no mistakes)
  const whiteAccuracy = playerStats.white.total > 0 ?
    Math.max(0, 100 - (playerStats.white.swing / playerStats.white.total / 10)) : 100;
  const blackAccuracy = playerStats.black.total > 0 ?
    Math.max(0, 100 - (playerStats.black.swing / playerStats.black.total / 10)) : 100;
  
  return {
    success: true,
    summary: {
      accuracy: {
        white: Math.round(whiteAccuracy * 10) / 10,
        black: Math.round(blackAccuracy * 10) / 10,
      },
      counts,
    },
    keyMoments,
    pliesTotalAnalyzed: pliesToAnalyze.size,
    timeUsedMs: Date.now() - startTime,
  };
}

async function evaluatePosition(fen: string, depth: number, timeMs: number): Promise<number> {
  // Call existing Stockfish engine
  const engine = getStockfishEngine();
  const result = await engine.analyze(fen, depth, timeMs);
  return result.evaluation; // centipawns
}
```

**Action:** Add this endpoint to Render Stockfish server

---

### D) Add Worker Learning Ingestion Endpoint

**File:** `worker-api/src/learningIngestion.ts` (new)

```typescript
/**
 * Learning V3 Ingestion Endpoint
 * POST /api/learning/ingest-game
 */

import { Env } from './types';
import { StockfishEngine } from './stockfish';

interface IngestGameRequest {
  userId: string;
  gameId: string;
  pgn: string;
  playerColor: 'white' | 'black';
  result: 'win' | 'loss' | 'draw';
  skillLevel?: 'beginner' | 'intermediate' | 'advanced';
}

export async function handleLearningIngest(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  try {
    const body = await request.json() as IngestGameRequest;
    
    // Validate
    if (!body.userId || !body.gameId || !body.pgn) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400 }
      );
    }
    
    // Persist game record immediately (idempotent)
    const gameRecord = {
      user_id: body.userId,
      game_id: body.gameId,
      pgn: body.pgn,
      player_color: body.playerColor,
      result: body.result,
      skill_level: body.skillLevel || 'intermediate',
      created_at: new Date().toISOString(),
    };
    
    // TODO: Persist to learning_games table via Prisma
    
    // Queue async analysis if enabled
    const asyncAnalysisEnabled = env.LEARNING_V3_ASYNC_ANALYSIS === 'true';
    const stockfishAnalysisEnabled = env.STOCKFISH_GAME_ANALYSIS_ENABLED === 'true';
    
    if (asyncAnalysisEnabled && stockfishAnalysisEnabled) {
      ctx.waitUntil(
        analyzeGameAsync(body, env).catch(error => {
          console.error('[Learning] Async analysis failed:', error);
        })
      );
    }
    
    // Return quickly
    return new Response(
      JSON.stringify({
        success: true,
        analysisMode: asyncAnalysisEnabled ? 'queued' : 'disabled',
        requestId: crypto.randomUUID(),
      }),
      { status: 200 }
    );
    
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500 }
    );
  }
}

async function analyzeGameAsync(request: IngestGameRequest, env: Env): Promise<void> {
  console.log('[Learning] Starting async game analysis:', request.gameId);
  
  const stockfish = new StockfishEngine(env);
  
  // Call Render /analyze-game endpoint
  const analysisResponse = await fetch(`${env.STOCKFISH_SERVER_URL}/analyze-game`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.STOCKFISH_API_KEY}`,
    },
    body: JSON.stringify({
      pgn: request.pgn,
      playerColor: request.playerColor,
      maxPlies: 60,
      depth: 14,
      timeMs: 250,
      tags: ['blunders', 'keyMoves', 'accuracy'],
    }),
  });
  
  if (!analysisResponse.ok) {
    console.error('[Learning] Stockfish analysis failed:', analysisResponse.status);
    return;
  }
  
  const analysis = await analysisResponse.json() as any;
  
  // Convert key moments to learning events
  for (const moment of analysis.keyMoments) {
    const event = {
      user_id: request.userId,
      game_id: request.gameId,
      ply: moment.ply,
      fen: moment.fen,
      move: moment.move,
      eval_swing_cp: moment.swingCp,
      classification: moment.classification,
      concept_tags: inferConceptTags(moment),
      created_at: new Date().toISOString(),
    };
    
    // TODO: Persist to learning_events table via Prisma
  }
  
  console.log('[Learning] Async analysis complete:', {
    gameId: request.gameId,
    eventsCreated: analysis.keyMoments.length,
  });
}

function inferConceptTags(moment: any): string[] {
  const tags: string[] = [];
  
  if (moment.classification === 'blunder') tags.push('tactical-oversight');
  if (moment.classification === 'mistake') tags.push('positional-error');
  if (moment.swingCp < -200) tags.push('piece-hanging');
  if (moment.classification === 'brilliant') tags.push('tactical-shot');
  
  return tags;
}
```

**Action:** Create this file, add route to Worker

---

### E) Improve Postgame Endpoint

**File:** `worker-api/src/postgame.ts` (update)

```typescript
/**
 * POST /api/walle/postgame
 * Returns structured coaching data with Stockfish evidence
 */

export async function handlePostgame(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    const body = await request.json() as { userId: string; gameId: string };
    
    // Fetch Stockfish analysis from DB (if available)
    const analysis = await fetchGameAnalysis(body.gameId, env);
    
    // Fetch user concept mastery
    const mastery = await fetchConceptMastery(body.userId, env);
    
    // Build structured coaching response
    const coaching = {
      keyMistakes: analysis?.keyMoments
        ?.filter(m => m.classification === 'blunder' || m.classification === 'mistake')
        ?.slice(0, 3)
        ?.map(m => ({
          ply: m.ply,
          move: m.move,
          swingCp: m.swingCp,
          classification: m.classification,
          fen: m.fen,
        })) || [],
      
      strengths: analysis?.keyMoments
        ?.filter(m => m.classification === 'brilliant' || m.swingCp > 50)
        ?.slice(0, 2)
        ?.map(m => ({
          ply: m.ply,
          move: m.move,
          description: `Strong ${m.classification} move`,
        })) || [],
      
      nextFocusConcept: identifyWeakestConcept(mastery),
      
      drillSet: {
        topic: 'tactical-patterns',
        count: 10,
        estimatedMinutes: 5,
      },
      
      nextCheckIn: {
        afterGames: 5,
        reason: 'Track tactical improvement',
      },
      
      analysisStatus: analysis ? 'complete' : 'pending',
    };
    
    return new Response(
      JSON.stringify({ success: true, coaching }),
      { status: 200 }
    );
    
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500 }
    );
  }
}

async function fetchGameAnalysis(gameId: string, env: Env): Promise<any | null> {
  // TODO: Query learning_events table via Prisma
  return null;
}

async function fetchConceptMastery(userId: string, env: Env): Promise<any> {
  // TODO: Query concept_mastery table via Prisma
  return {};
}

function identifyWeakestConcept(mastery: any): { id: string; name: string; currentLevel: number } {
  // TODO: Find lowest mastery concept
  return {
    id: 'tactical-patterns',
    name: 'Tactical Pattern Recognition',
    currentLevel: 2,
  };
}
```

**Action:** Update postgame endpoint with this structure

---

## 📋 Implementation Checklist

### Phase 1: Flags & Caching (Low Risk)
- [ ] Add feature flags to `wrangler.toml`
- [ ] Create `moveCache.ts` module
- [ ] Integrate cache into `handleChessMove()`
- [ ] Test: Verify cache hit/miss in logs
- [ ] Deploy to Worker

### Phase 2: Render Stockfish `/analyze-game` (Medium Risk)
- [ ] Add `/analyze-game` endpoint to Render server
- [ ] Implement sampling strategy (first 4, last 4, every 6th)
- [ ] Add position evaluation logic
- [ ] Test locally with sample PGNs
- [ ] Deploy to Render
- [ ] Test from Worker

### Phase 3: Worker Learning Backend (High Risk)
- [ ] Create `learningIngestion.ts` module
- [ ] Add route to Worker: `POST /api/learning/ingest-game`
- [ ] Implement async analysis with `ctx.waitUntil`
- [ ] Test ingestion without DB (stub persistence)
- [ ] Add Prisma queries for learning tables
- [ ] Test end-to-end flow

### Phase 4: Postgame Improvement (Medium Risk)
- [ ] Update `postgame.ts` with structured output
- [ ] Connect to learning tables via Prisma
- [ ] Test with real game data
- [ ] Deploy and verify in production

### Phase 5: Documentation & Cleanup
- [ ] Update `ARCHITECTURE_CLARIFICATION_JAN2026.md`
- [ ] Remove any remaining WalleChessEngine references
- [ ] Add API documentation for new endpoints
- [ ] Update frontend to use new postgame structure

---

## 🧪 Verification Tests

### Test 1: Move Cache
```bash
# Make same request twice
curl -X POST https://chesschat.uk/api/chess-move \
  -H "Content-Type: application/json" \
  -d '{"fen":"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1","cpuLevel":5}'

# Check logs for cache hit on second request
```

### Test 2: Render Analysis
```bash
# Call Render directly
curl -X POST https://chesschat-stockfish.onrender.com/analyze-game \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{"pgn":"1. e4 e5 2. Nf3 Nc6 3. Bb5","playerColor":"white"}'
```

### Test 3: Learning Ingestion
```bash
# Ingest a game
curl -X POST https://chesschat.uk/api/learning/ingest-game \
  -H "Content-Type: application/json" \
  -d '{"userId":"test123","gameId":"game456","pgn":"1. e4 e5","playerColor":"white","result":"win"}'

# Should return: {"success":true,"analysisMode":"queued"}
```

### Test 4: Postgame
```bash
# Get postgame coaching
curl -X POST https://chesschat.uk/api/walle/postgame \
  -H "Content-Type: application/json" \
  -d '{"userId":"test123","gameId":"game456"}'

# Should return structured coaching with keyMistakes, strengths, etc.
```

---

## 🚫 Anti-Patterns to Avoid

1. **Do NOT add LLM calls** - No OpenAI, Claude, or any external AI
2. **Do NOT use WalleChessEngine for moves** - Only for emergency fallback with flag
3. **Do NOT block gameplay on analysis** - Always return quickly, queue with `ctx.waitUntil`
4. **Do NOT analyze all plies** - Use sampling strategy
5. **Do NOT regress the architecture** - Document all changes clearly

---

## 📊 Success Metrics

After implementation:

- [ ] `/api/chess-move` latency: < 300ms average
- [ ] Cache hit rate: > 20% (for repeated positions)
- [ ] `/api/learning/ingest-game` response: < 100ms
- [ ] `/analyze-game` completion: < 5 seconds for 20-move game
- [ ] Postgame endpoint includes Stockfish evidence: 100% when available
- [ ] Zero WalleChessEngine usage in production logs (except fallback flag enabled)

---

**Next Steps:**
1. Review this implementation plan
2. Begin Phase 1 (flags & caching)
3. Test each phase thoroughly before proceeding
4. Update documentation as you go
5. Deploy incrementally with feature flags
