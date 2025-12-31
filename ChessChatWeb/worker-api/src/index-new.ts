/**
 * Worker API - Stockfish Chess Engine + Learning Layer
 * Version: 2.0 - Stockfish Migration
 * 
 * This is the authoritative backend for ChessChat.
 * Owns all /api/* routes:
 * - POST /api/chess-move - Stockfish move generation
 * - POST /api/game/complete - Save game + trigger analysis
 * - GET /api/game/:id - Retrieve game
 * - GET /api/game/:id/analysis - Get analysis results
 * - GET /api/learning/profile - Get player profile
 * - POST /api/learning/ingest-game - Analyze game and update concept states
 * - GET /api/learning/plan - Get practice plan
 * - POST /api/learning/feedback - Record feedback on advice
 * - POST /api/walle/postgame - Generate coaching insights
 * - POST /api/ai/postgame - Trigger AI coaching
 * - GET /api/admin/* - Health, logs, diagnostics
 */

import { PrismaClient } from '@prisma/client/edge';
import { withAccelerate } from '@prisma/extension-accelerate';
import { Chess } from 'chess.js';
import { getStockfishEngine, StockfishMoveRequest } from './stockfish';
import { analyzeGameWithStockfish } from './gameAnalysis';
import { ingestGame, evaluateInterventions, createAdviceIntervention } from './learningIngestion';
import { selectCoachingTargets, generatePracticePlan, loadConceptTaxonomy } from './learningCore';

interface Env {
  DATABASE_URL: string;
  ADMIN_PASSWORD: string;
  ENVIRONMENT: string;
  VERSION: string;
  AI_COACH?: Fetcher; // Service binding to AI coaching worker (optional)
  INTERNAL_AUTH_TOKEN?: string; // Auth token for worker-to-worker communication
}

// Request/Response types
interface ChessMoveRequest {
  fen: string;
  pgn?: string;
  cpuLevel: number; // 1-10
  timeMs?: number; // Requested compute budget in milliseconds
  gameId?: string;
  playerId?: string;
  mode?: 'vs-cpu' | 'coaching';
}

interface GameCompleteRequest {
  pgn: string;
  result: string; // '1-0' | '0-1' | '1/2-1/2' | '*'
  playerColor: string; // 'white' | 'black'
  difficulty: string;
  playerId?: string;
}

interface WorkerCallLogData {
  endpoint: string;
  method: string;
  success: boolean;
  latencyMs: number;
  cpuLevel?: number;
  timeMs?: number;
  mode: string;
  engine: string;
  error?: string;
  requestJson: any;
  responseJson?: any;
  requestId?: string;
}

// Singleton Prisma instance per request  
let prisma: any = null;

function getPrismaClient(env: Env): any {
  if (!prisma) {
    prisma = new PrismaClient({
      datasourceUrl: env.DATABASE_URL,
    }).$extends(withAccelerate());
  }
  return prisma;
}

// Helper to create headers with cache control
function getCacheHeaders(): Headers {
  return new Headers({
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  });
}

// Helper: Generate request ID
function generateRequestId(): string {
  return crypto.randomUUID().slice(0, 13);
}

// Helper: Log to database
async function logWorkerCall(env: Env, logData: WorkerCallLogData): Promise<void> {
  try {
    const prisma = getPrismaClient(env);
    await prisma.workerCallLog.create({
      data: {
        ts: new Date(),
        endpoint: logData.endpoint,
        method: logData.method,
        success: logData.success,
        latencyMs: logData.latencyMs,
        cpuLevel: logData.cpuLevel,
        timeMs: logData.timeMs,
        mode: logData.mode,
        engine: logData.engine,
        error: logData.error,
        requestJson: logData.requestJson,
        responseJson: logData.responseJson,
      },
    });
  } catch (error) {
    console.error('[Worker API] Failed to log worker call to database:', error);
    // Don't throw - we still want to return response even if logging fails
  }
}

// ============================================================================
// ROUTE HANDLERS
// ============================================================================

/**
 * POST /api/chess-move
 * Compute a move using Stockfish engine
 */
async function handleChessMove(request: Request, env: Env): Promise<Response> {
  const startTime = Date.now();
  const requestId = generateRequestId();
  
  let requestBody: ChessMoveRequest;

  try {
    requestBody = await request.json();
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    const logData: WorkerCallLogData = {
      endpoint: '/api/chess-move',
      method: 'POST',
      success: false,
      latencyMs,
      mode: 'worker-api',
      engine: 'stockfish',
      error: 'Invalid JSON request body',
      requestJson: {},
      requestId,
    };
    await logWorkerCall(env, logData);
    
    return new Response(
      JSON.stringify({
        success: false,
        engine: 'stockfish',
        mode: 'worker-api',
        errorCode: 'BAD_REQUEST',
        error: 'Invalid JSON request body',
        diagnostics: {
          requestId,
          latencyMs,
        },
      }),
      { status: 400, headers: getCacheHeaders() }
    );
  }

  const { fen, cpuLevel, timeMs, gameId, playerId, mode } = requestBody;

  // Validate required fields
  if (!fen) {
    const latencyMs = Date.now() - startTime;
    const logData: WorkerCallLogData = {
      endpoint: '/api/chess-move',
      method: 'POST',
      success: false,
      latencyMs,
      mode: 'worker-api',
      engine: 'stockfish',
      error: 'Missing required field: fen',
      requestJson: requestBody,
      requestId,
    };
    await logWorkerCall(env, logData);
    
    return new Response(
      JSON.stringify({
        success: false,
        engine: 'stockfish',
        mode: 'worker-api',
        errorCode: 'BAD_REQUEST',
        error: 'Missing required field: fen',
        diagnostics: {
          requestId,
          latencyMs,
        },
      }),
      { status: 400, headers: getCacheHeaders() }
    );
  }

  if (!cpuLevel || cpuLevel < 1 || cpuLevel > 10) {
    const latencyMs = Date.now() - startTime;
    const logData: WorkerCallLogData = {
      endpoint: '/api/chess-move',
      method: 'POST',
      success: false,
      latencyMs,
      mode: 'worker-api',
      engine: 'stockfish',
      error: 'Invalid cpuLevel (must be 1-10)',
      requestJson: requestBody,
      requestId,
    };
    await logWorkerCall(env, logData);
    
    return new Response(
      JSON.stringify({
        success: false,
        engine: 'stockfish',
        mode: 'worker-api',
        errorCode: 'BAD_REQUEST',
        error: 'Invalid cpuLevel (must be 1-10)',
        diagnostics: {
          requestId,
          latencyMs,
        },
      }),
      { status: 400, headers: getCacheHeaders() }
    );
  }

  try {
    // Get Stockfish engine
    const stockfish = getStockfishEngine();
    
    // Prepare request
    const stockfishRequest: StockfishMoveRequest = {
      fen,
      cpuLevel,
      timeMs: timeMs || 2500,
      gameId,
      playerId,
      mode: mode || 'vs-cpu',
    };
    
    console.log('[Worker API] Computing move with Stockfish:', {
      requestId,
      fen: fen.substring(0, 30) + '...',
      cpuLevel,
      timeMs: stockfishRequest.timeMs,
    });
    
    // Compute move
    const result = await stockfish.computeMove(stockfishRequest);
    
    const latencyMs = Date.now() - startTime;
    
    if (!result.success) {
      // Stockfish failed - return structured error (NO FALLBACK)
      const logData: WorkerCallLogData = {
        endpoint: '/api/chess-move',
        method: 'POST',
        success: false,
        latencyMs,
        cpuLevel,
        timeMs: stockfishRequest.timeMs,
        mode: 'worker-api',
        engine: 'stockfish',
        error: result.error,
        requestJson: requestBody,
        requestId,
      };
      await logWorkerCall(env, logData);
      
      console.error('[Worker API] Stockfish error:', {
        requestId,
        errorCode: result.errorCode,
        error: result.error,
      });
      
      return new Response(
        JSON.stringify({
          success: false,
          engine: 'stockfish',
          mode: 'worker-api',
          errorCode: result.errorCode,
          error: result.error,
          diagnostics: {
            requestId,
            latencyMs,
          },
          workerCallLog: logData,
        }),
        { status: 500, headers: getCacheHeaders() }
      );
    }
    
    // Success response
    const diagnostics = {
      requestId,
      latencyMs,
      cpuLevel,
      requestedTimeMs: stockfishRequest.timeMs,
      effectiveTimeMs: result.time,
      depthReached: result.depth,
      nodes: result.nodes,
      evaluationCp: result.evaluation,
      pv: result.pv,
      mate: result.mate,
      abortReason: result.mate ? 'mate_found' : 'time_exhausted',
    };
    
    const responseData = {
      success: true,
      engine: 'stockfish',
      mode: 'worker-api',
      move: result.move,
      diagnostics,
    };
    
    const logData: WorkerCallLogData = {
      endpoint: '/api/chess-move',
      method: 'POST',
      success: true,
      latencyMs,
      cpuLevel,
      timeMs: stockfishRequest.timeMs,
      mode: 'worker-api',
      engine: 'stockfish',
      requestJson: requestBody,
      responseJson: responseData,
      requestId,
    };
    
    await logWorkerCall(env, logData);
    
    console.log('[Worker API] Move computed successfully:', {
      requestId,
      move: result.move,
      evaluation: result.evaluation,
      depth: result.depth,
      latencyMs,
    });
    
    return new Response(
      JSON.stringify({
        ...responseData,
        workerCallLog: logData,
      }),
      { status: 200, headers: getCacheHeaders() }
    );
    
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    const logData: WorkerCallLogData = {
      endpoint: '/api/chess-move',
      method: 'POST',
      success: false,
      latencyMs,
      cpuLevel,
      timeMs,
      mode: 'worker-api',
      engine: 'stockfish',
      error: errorMessage,
      requestJson: requestBody,
      requestId,
    };
    
    await logWorkerCall(env, logData);
    
    console.error('[Worker API] Unexpected error:', {
      requestId,
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });
    
    return new Response(
      JSON.stringify({
        success: false,
        engine: 'stockfish',
        mode: 'worker-api',
        errorCode: 'INTERNAL',
        error: errorMessage,
        diagnostics: {
          requestId,
          latencyMs,
        },
        workerCallLog: logData,
      }),
      { status: 500, headers: getCacheHeaders() }
    );
  }
}

/**
 * POST /api/game/complete
 * Save completed game and enqueue analysis
 */
async function handleGameComplete(request: Request, env: Env): Promise<Response> {
  const startTime = Date.now();
  const requestId = generateRequestId();
  
  let requestBody: GameCompleteRequest;
  
  try {
    requestBody = await request.json();
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        errorCode: 'BAD_REQUEST',
        error: 'Invalid JSON request body',
        diagnostics: { requestId, latencyMs: Date.now() - startTime },
      }),
      { status: 400, headers: getCacheHeaders() }
    );
  }
  
  const { pgn, result, playerColor, difficulty, playerId } = requestBody;
  
  if (!pgn || !result || !playerColor || !difficulty) {
    return new Response(
      JSON.stringify({
        success: false,
        errorCode: 'BAD_REQUEST',
        error: 'Missing required fields: pgn, result, playerColor, difficulty',
        diagnostics: { requestId, latencyMs: Date.now() - startTime },
      }),
      { status: 400, headers: getCacheHeaders() }
    );
  }
  
  try {
    const prisma = getPrismaClient(env);
    
    // Save game to database
    const game = await prisma.gameRecord.create({
      data: {
        pgn,
        result,
        playerColor,
        difficulty,
      },
    });
    
    console.log('[Worker API] Game saved:', {
      requestId,
      gameId: game.id,
      result,
      difficulty,
    });
    
    // TODO: Enqueue analysis job
    // For now, we'll handle this synchronously in Phase 3
    // In production, use Cloudflare Queue or waitUntil for async processing
    
    const latencyMs = Date.now() - startTime;
    
    return new Response(
      JSON.stringify({
        success: true,
        gameId: game.id,
        analysisQueued: false, // Will be true in Phase 3
        diagnostics: {
          requestId,
          latencyMs,
        },
      }),
      { status: 200, headers: getCacheHeaders() }
    );
    
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    console.error('[Worker API] Failed to save game:', {
      requestId,
      error: errorMessage,
    });
    
    return new Response(
      JSON.stringify({
        success: false,
        errorCode: 'INTERNAL',
        error: errorMessage,
        diagnostics: {
          requestId,
          latencyMs,
        },
      }),
      { status: 500, headers: getCacheHeaders() }
    );
  }
}

/**
 * GET /api/game/:id
 * Retrieve game by ID
 */
async function handleGetGame(request: Request, env: Env, gameId: string): Promise<Response> {
  const startTime = Date.now();
  const requestId = generateRequestId();
  
  try {
    const prisma = getPrismaClient(env);
    
    const game = await prisma.gameRecord.findUnique({
      where: { id: gameId },
    });
    
    if (!game) {
      return new Response(
        JSON.stringify({
          success: false,
          errorCode: 'NOT_FOUND',
          error: `Game not found: ${gameId}`,
          diagnostics: {
            requestId,
            latencyMs: Date.now() - startTime,
          },
        }),
        { status: 404, headers: getCacheHeaders() }
      );
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        game,
        diagnostics: {
          requestId,
          latencyMs: Date.now() - startTime,
        },
      }),
      { status: 200, headers: getCacheHeaders() }
    );
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return new Response(
      JSON.stringify({
        success: false,
        errorCode: 'INTERNAL',
        error: errorMessage,
        diagnostics: {
          requestId,
          latencyMs: Date.now() - startTime,
        },
      }),
      { status: 500, headers: getCacheHeaders() }
    );
  }
}

/**
 * GET /api/learning/profile
 * Get player profile and learning metrics
 */
async function handleGetProfile(request: Request, env: Env): Promise<Response> {
  const startTime = Date.now();
  const requestId = generateRequestId();
  
  const url = new URL(request.url);
  const playerId = url.searchParams.get('playerId');
  
  if (!playerId) {
    return new Response(
      JSON.stringify({
        success: false,
        errorCode: 'BAD_REQUEST',
        error: 'Missing required parameter: playerId',
        diagnostics: {
          requestId,
          latencyMs: Date.now() - startTime,
        },
      }),
      { status: 400, headers: getCacheHeaders() }
    );
  }
  
  try {
    const prisma = getPrismaClient(env);
    
    // Get or create player profile
    let profile = await prisma.playerProfile.findUnique({
      where: { userId: playerId },
      include: {
        coachingMemory: true,
        mistakeSignatures: {
          orderBy: { occurrenceCount: 'desc' },
          take: 10,
        },
      },
    });
    
    if (!profile) {
      // Create new profile
      profile = await prisma.playerProfile.create({
        data: {
          userId: playerId,
          gamesPlayed: 0,
          improvementRate: 0.0,
          playStyle: 'balanced',
        },
        include: {
          coachingMemory: true,
          mistakeSignatures: true,
        },
      });
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        profile,
        diagnostics: {
          requestId,
          latencyMs: Date.now() - startTime,
        },
      }),
      { status: 200, headers: getCacheHeaders() }
    );
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    console.error('[Worker API] Failed to get profile:', {
      requestId,
      playerId,
      error: errorMessage,
    });
    
    return new Response(
      JSON.stringify({
        success: false,
        errorCode: 'INTERNAL',
        error: errorMessage,
        diagnostics: {
          requestId,
          latencyMs: Date.now() - startTime,
        },
      }),
      { status: 500, headers: getCacheHeaders() }
    );
  }
}

/**
 * GET /api/admin/worker-health
 * Health check endpoint
 */
async function handleWorkerHealth(request: Request, env: Env): Promise<Response> {
  const startTime = Date.now();
  const requestId = generateRequestId();
  
  const checks: any = {
    timestamp: new Date().toISOString(),
    version: env.VERSION || '2.0.0',
    environment: env.ENVIRONMENT || 'production',
    requestId,
  };

  // Check database connectivity
  try {
    const prisma = getPrismaClient(env);
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { status: 'ok', message: 'Connected' };
  } catch (error) {
    checks.database = {
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
  
  // Check Stockfish availability
  try {
    const stockfish = getStockfishEngine();
    checks.stockfish = { status: 'ok', message: 'Available' };
  } catch (error) {
    checks.stockfish = {
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }

  // Check environment variables
  checks.env = {
    DATABASE_URL: env.DATABASE_URL ? 'set' : 'missing',
    ADMIN_PASSWORD: env.ADMIN_PASSWORD ? 'set' : 'missing',
    AI_COACH: env.AI_COACH ? 'bound' : 'not-bound',
  };

  const latencyMs = Date.now() - startTime;
  const allHealthy = checks.database.status === 'ok' && 
                     checks.stockfish.status === 'ok' &&
                     env.DATABASE_URL && 
                     env.ADMIN_PASSWORD;

  return new Response(
    JSON.stringify({
      healthy: allHealthy,
      latencyMs,
      checks,
    }),
    {
      status: allHealthy ? 200 : 503,
      headers: getCacheHeaders(),
    }
  );
}

/**
 * GET /api/admin/worker-calls
 * Query worker call logs
 */
async function handleGetWorkerCalls(request: Request, env: Env): Promise<Response> {
  const startTime = Date.now();
  const requestId = generateRequestId();
  
  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '50', 10);

  try {
    const prisma = getPrismaClient(env);
    const logs = await prisma.workerCallLog.findMany({
      orderBy: { ts: 'desc' },
      take: Math.min(limit, 500), // Cap at 500
    });

    return new Response(
      JSON.stringify({
        success: true,
        count: logs.length,
        logs,
        diagnostics: {
          requestId,
          latencyMs: Date.now() - startTime,
        },
      }),
      { status: 200, headers: getCacheHeaders() }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Worker API] Failed to fetch worker calls:', error);

    return new Response(
      JSON.stringify({
        success: false,
        errorCode: 'INTERNAL',
        error: errorMessage,
        diagnostics: {
          requestId,
          latencyMs: Date.now() - startTime,
        },
      }),
      { status: 500, headers: getCacheHeaders() }
    );
  }
}

/**
 * POST /api/learning/ingest-game
 * Analyze game with Stockfish and update concept states
 */
async function handleIngestGame(request: Request, env: Env): Promise<Response> {
  const startTime = Date.now();
  const requestId = generateRequestId();
  
  try {
    const { gameId, userId, pgn, metadata } = await request.json();
    
    if (!gameId || !userId || !pgn) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required fields: gameId, userId, pgn',
          requestId
        }),
        { status: 400, headers: getCacheHeaders() }
      );
    }
    
    // 1. Analyze game with Stockfish
    console.log(`[Learning] Analyzing game ${gameId} for user ${userId}`);
    const analysis = await analyzeGameWithStockfish(pgn, gameId);
    
    // 2. Store analysis in database
    const prisma = getPrismaClient(env);
    await prisma.gameAnalysis.create({
      data: {
        id: analysis.id,
        gameId: analysis.gameId,
        status: 'completed',
        evaluations: JSON.stringify(analysis.evaluations),
        mistakes: JSON.stringify(analysis.mistakes),
        avgCentipawnLoss: analysis.avgCentipawnLoss,
        accuracyScore: analysis.accuracyScore,
        conceptsEncountered: JSON.stringify(analysis.conceptsEncountered),
        analyzedAt: new Date(),
        analysisDuration: Date.now() - startTime
      }
    });
    
    // 3. Update concept states
    const ingestionResult = await ingestGame(prisma, userId, gameId, analysis.mistakes);
    
    // 4. Evaluate pending interventions
    await evaluateInterventions(prisma, userId, gameId);
    
    // 5. Log
    await logWorkerCall(env, {
      endpoint: '/api/learning/ingest-game',
      method: 'POST',
      success: true,
      latencyMs: Date.now() - startTime,
      mode: metadata?.mode || 'unknown',
      engine: 'stockfish',
      requestJson: { gameId, userId },
      responseJson: { conceptsUpdated: ingestionResult.conceptsUpdated },
      requestId
    });
    
    return new Response(
      JSON.stringify({
        success: true,
        requestId,
        gameId,
        analysisId: analysis.id,
        conceptsUpdated: ingestionResult.conceptsUpdated,
        summary: ingestionResult.summary,
        nextDueConcepts: ingestionResult.nextDueConcepts,
        diagnostics: {
          latencyMs: Date.now() - startTime,
          mistakeCount: analysis.mistakes.length,
          avgCentipawnLoss: analysis.avgCentipawnLoss,
          accuracyScore: analysis.accuracyScore
        }
      }),
      { status: 200, headers: getCacheHeaders() }
    );
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Learning] Ingest error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        requestId,
        diagnostics: { latencyMs: Date.now() - startTime }
      }),
      { status: 500, headers: getCacheHeaders() }
    );
  }
}

/**
 * GET /api/learning/plan
 * Get practice plan for user
 */
async function handleGetPracticePlan(request: Request, env: Env): Promise<Response> {
  const startTime = Date.now();
  const requestId = generateRequestId();
  
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    const windowDays = parseInt(url.searchParams.get('window') || '7', 10);
    
    if (!userId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required parameter: userId',
          requestId
        }),
        { status: 400, headers: getCacheHeaders() }
      );
    }
    
    const prisma = getPrismaClient(env);
    
    // Get all concept states for user
    const conceptStates = await prisma.userConceptState.findMany({
      where: { userId }
    });
    
    if (conceptStates.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          plan: null,
          message: 'No learning data yet. Play a few games to get started!',
          requestId
        }),
        { status: 200, headers: getCacheHeaders() }
      );
    }
    
    // Generate practice plan
    const plan = generatePracticePlan(conceptStates, windowDays);
    
    // Store plan in database
    const planStart = new Date();
    const planEnd = new Date(planStart.getTime() + windowDays * 86400000);
    
    const storedPlan = await prisma.practicePlan.create({
      data: {
        userId,
        planStart,
        planEnd,
        targetConcepts: JSON.stringify(plan.targetConcepts),
        suggestedDrills: JSON.stringify(plan.suggestedDrills)
      }
    });
    
    return new Response(
      JSON.stringify({
        success: true,
        requestId,
        plan: {
          id: storedPlan.id,
          planStart: planStart.toISOString(),
          planEnd: planEnd.toISOString(),
          targetConcepts: plan.targetConcepts,
          suggestedDrills: plan.suggestedDrills
        },
        rationale: plan.rationale,
        diagnostics: { latencyMs: Date.now() - startTime }
      }),
      { status: 200, headers: getCacheHeaders() }
    );
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Learning] Plan generation error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        requestId,
        diagnostics: { latencyMs: Date.now() - startTime }
      }),
      { status: 500, headers: getCacheHeaders() }
    );
  }
}

/**
 * POST /api/learning/feedback
 * Record user feedback on advice
 */
async function handleLearningFeedback(request: Request, env: Env): Promise<Response> {
  const startTime = Date.now();
  const requestId = generateRequestId();
  
  try {
    const { interventionId, feedback, notes } = await request.json();
    
    if (!interventionId || !feedback) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required fields: interventionId, feedback',
          requestId
        }),
        { status: 400, headers: getCacheHeaders() }
      );
    }
    
    const prisma = getPrismaClient(env);
    
    // Update intervention with feedback (store in notes field for now)
    await prisma.adviceIntervention.update({
      where: { id: interventionId },
      data: {
        // Store feedback in measurement criteria for now
        measurementCriteria: JSON.stringify({
          userFeedback: feedback,
          userNotes: notes
        })
      }
    });
    
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Feedback recorded',
        requestId,
        diagnostics: { latencyMs: Date.now() - startTime }
      }),
      { status: 200, headers: getCacheHeaders() }
    );
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Learning] Feedback error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        requestId,
        diagnostics: { latencyMs: Date.now() - startTime }
      }),
      { status: 500, headers: getCacheHeaders() }
    );
  }
}

/**
 * POST /api/walle/postgame
 * Generate coaching insights using concept states
 */
async function handleWallePostgame(request: Request, env: Env): Promise<Response> {
  const startTime = Date.now();
  const requestId = generateRequestId();
  
  try {
    const { userId, gameId, includeAdvice } = await request.json();
    
    if (!userId || !gameId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required fields: userId, gameId',
          requestId
        }),
        { status: 400, headers: getCacheHeaders() }
      );
    }
    
    const prisma = getPrismaClient(env);
    
    // Get concept states
    const conceptStates = await prisma.userConceptState.findMany({
      where: { userId }
    });
    
    // Select coaching targets
    const targets = selectCoachingTargets(conceptStates, 3);
    
    if (targets.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          insight: 'Keep playing to build your learning profile!',
          targetConcepts: [],
          requestId
        }),
        { status: 200, headers: getCacheHeaders() }
      );
    }
    
    const primary = targets[0];
    
    // Get game analysis
    const game = await prisma.gameRecord.findUnique({
      where: { id: gameId },
      include: { GameAnalysis: true }
    });
    
    if (!game || !game.GameAnalysis) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Game not found or not analyzed',
          requestId
        }),
        { status: 404, headers: getCacheHeaders() }
      );
    }
    
    const mistakes = JSON.parse(game.GameAnalysis.mistakes || '[]');
    const relevantMistake = mistakes.find((m: any) =>
      m.concepts.includes(primary.conceptId)
    );
    
    // Generate insight (simplified - in production, call Wall-E AI)
    const insight = relevantMistake
      ? `Focus on ${primary.name}: In this game, move ${relevantMistake.moveNumber} (${relevantMistake.moveSAN}) lost ${Math.abs(relevantMistake.delta)} centipawns. ${primary.reason}. Practice checking for ${primary.name.toLowerCase()} before each move.`
      : `Work on ${primary.name}: ${primary.reason}. Your current mastery is ${Math.round(primary.mastery * 100)}%.`;
    
    // Create intervention if advice requested
    let interventionId: string | undefined;
    if (includeAdvice) {
      const baseline = primary.evidence.reduce((sum: number, e: any) => sum + (e.mistakes || 0), 0) / Math.max(1, primary.evidence.length);
      interventionId = await createAdviceIntervention(
        prisma,
        userId,
        gameId,
        [primary.conceptId],
        insight,
        baseline
      );
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        requestId,
        insight,
        targetConcepts: targets.map(t => t.conceptId),
        interventionId,
        evidence: relevantMistake ? [{
          gameId,
          moveNum: relevantMistake.moveNumber,
          description: `${relevantMistake.moveSAN} (${relevantMistake.delta}cp)`
        }] : [],
        diagnostics: { latencyMs: Date.now() - startTime }
      }),
      { status: 200, headers: getCacheHeaders() }
    );
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Wall-E] Postgame error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        requestId,
        diagnostics: { latencyMs: Date.now() - startTime }
      }),
      { status: 500, headers: getCacheHeaders() }
    );
  }
}

/**
 * GET /api/admin/learning-health
 * Health check for learning system
 */
async function handleLearningHealth(request: Request, env: Env): Promise<Response> {
  const startTime = Date.now();
  
  try {
    const prisma = getPrismaClient(env);
    
    // Get counts
    const [userConceptCount, interventionCount, planCount, eventCount] = await Promise.all([
      prisma.userConceptState.count(),
      prisma.adviceIntervention.count(),
      prisma.practicePlan.count(),
      prisma.learningEvent.count()
    ]);
    
    // Get recent activity
    const recentEvents = await prisma.learningEvent.findMany({
      where: {
        ts: { gte: new Date(Date.now() - 3600000) } // Last hour
      }
    });
    
    // Get success rate
    const completedInterventions = await prisma.adviceIntervention.findMany({
      where: { outcome: { not: null } }
    });
    
    const successCount = completedInterventions.filter(i => i.outcome === 'success').length;
    const successRate = completedInterventions.length > 0
      ? successCount / completedInterventions.length
      : 0;
    
    return new Response(
      JSON.stringify({
        status: 'healthy',
        learning: {
          totalConceptStates: userConceptCount,
          totalInterventions: interventionCount,
          totalPlans: planCount,
          totalEvents: eventCount,
          recentActivity: recentEvents.length,
          interventionSuccessRate: Math.round(successRate * 100)
        },
        diagnostics: {
          latencyMs: Date.now() - startTime
        }
      }),
      { status: 200, headers: getCacheHeaders() }
    );
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Learning Health] Error:', error);
    
    return new Response(
      JSON.stringify({
        status: 'degraded',
        error: errorMessage,
        diagnostics: { latencyMs: Date.now() - startTime }
      }),
      { status: 503, headers: getCacheHeaders() }
    );
  }
}

// ============================================================================
// MAIN REQUEST HANDLER
// ============================================================================

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // Handle preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Route to handlers
    let response: Response;

    if (path === '/api/chess-move' && request.method === 'POST') {
      response = await handleChessMove(request, env);
    } else if (path === '/api/game/complete' && request.method === 'POST') {
      response = await handleGameComplete(request, env);
    } else if (path.startsWith('/api/game/') && request.method === 'GET') {
      const gameId = path.split('/')[3];
      response = await handleGetGame(request, env, gameId);
    } else if (path === '/api/learning/profile' && request.method === 'GET') {
      response = await handleGetProfile(request, env);
    } else if (path === '/api/learning/ingest-game' && request.method === 'POST') {
      response = await handleIngestGame(request, env);
    } else if (path === '/api/learning/plan' && request.method === 'GET') {
      response = await handleGetPracticePlan(request, env);
    } else if (path === '/api/learning/feedback' && request.method === 'POST') {
      response = await handleLearningFeedback(request, env);
    } else if (path === '/api/walle/postgame' && request.method === 'POST') {
      response = await handleWallePostgame(request, env);
    } else if (path === '/api/admin/worker-health' && request.method === 'GET') {
      response = await handleWorkerHealth(request, env);
    } else if (path === '/api/admin/learning-health' && request.method === 'GET') {
      response = await handleLearningHealth(request, env);
    } else if (path === '/api/admin/worker-calls' && request.method === 'GET') {
      response = await handleGetWorkerCalls(request, env);
    } else {
      response = new Response(
        JSON.stringify({
          success: false,
          errorCode: 'NOT_FOUND',
          error: 'Not found',
          availableEndpoints: [
            'POST /api/chess-move',
            'POST /api/game/complete',
            'GET /api/game/:id',
            'GET /api/learning/profile?playerId=...',
            'POST /api/learning/ingest-game',
            'GET /api/learning/plan?userId=...',
            'POST /api/learning/feedback',
            'POST /api/walle/postgame',
            'GET /api/admin/worker-health',
            'GET /api/admin/learning-health',
            'GET /api/admin/worker-calls',
          ],
        }),
        { status: 404, headers: getCacheHeaders() }
      );
    }

    // Add CORS headers to response
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  },
};
