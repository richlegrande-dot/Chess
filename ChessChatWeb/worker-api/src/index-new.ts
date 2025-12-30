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
 * - POST /api/ai/postgame - Trigger AI coaching
 * - GET /api/admin/* - Health, logs, diagnostics
 */

import { PrismaClient } from '@prisma/client/edge';
import { withAccelerate } from '@prisma/extension-accelerate';
import { Chess } from 'chess.js';
import { getStockfishEngine, StockfishMoveRequest } from './stockfish';

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
    } else if (path === '/api/admin/worker-health' && request.method === 'GET') {
      response = await handleWorkerHealth(request, env);
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
            'GET /api/admin/worker-health',
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
