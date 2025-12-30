import { PrismaClient } from '@prisma/client/edge';
import { withAccelerate } from '@prisma/extension-accelerate';
import { Chess } from 'chess.js';
import { StockfishEngine, StockfishMoveRequest } from './stockfish';

interface Env {
  DATABASE_URL: string;
  ADMIN_PASSWORD: string;
  ENVIRONMENT: string;
  VERSION: string;
  STOCKFISH_SERVER_URL: string;
  STOCKFISH_API_KEY: string;
  AI_COACH?: Fetcher;
  INTERNAL_AUTH_TOKEN?: string;
}

// Request/Response types
interface ChessMoveRequest {
  fen: string;
  pgn?: string;
  difficulty?: string;
  timeMs?: number;
  cpuLevel?: number;
  gameId?: string;
  mode?: 'vs-cpu' | 'coaching';
}

interface WorkerCallLogData {
  endpoint: string;
  method: string;
  success: boolean;
  latencyMs: number;
  cpuLevel?: number;
  timeMs?: number;
  difficulty?: string;
  mode: string;
  engine: string;
  error?: string;
  requestJson: any;
  responseJson?: any;
}

// Singleton Prisma instance per request  
let prisma: any = null;

function getPrismaClient(env: Env): any {
  if (!prisma) {
    // Cloudflare Workers + Prisma Accelerate setup
    // Must use datasourceUrl parameter, not datasources config
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
        difficulty: logData.difficulty,
        mode: logData.mode,
        engine: logData.engine,
        error: logData.error,
        requestJson: logData.requestJson,
        responseJson: logData.responseJson,
      },
    });
  } catch (error) {
    console.error('Failed to log worker call to database:', error);
    // Don't throw - we still want to return response even if logging fails
  }
}

// Chess engine: Optimized alpha-beta minimax with move ordering and timeout protection
let searchStartTime = 0;
let timeoutMs = 10000;

function evaluateBoard(chess: Chess): number {
  const pieceValues: Record<string, number> = {
    p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000,
  };
  
  let score = 0;
  const board = chess.board();
  
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      const piece = board[i][j];
      if (piece) {
        const value = pieceValues[piece.type] || 0;
        score += piece.color === 'w' ? value : -value;
      }
    }
  }
  
  return score;
}

function orderMoves(chess: Chess, moves: any[]): any[] {
  // Simple move ordering: captures first, then center moves
  return moves.sort((a, b) => {
    const aScore = (a.captured ? 100 : 0) + (a.to === 'e4' || a.to === 'e5' || a.to === 'd4' || a.to === 'd5' ? 10 : 0);
    const bScore = (b.captured ? 100 : 0) + (b.to === 'e4' || b.to === 'e5' || b.to === 'd4' || b.to === 'd5' ? 10 : 0);
    return bScore - aScore;
  });
}

function minimax(
  chess: Chess,
  depth: number,
  alpha: number,
  beta: number,
  maximizingPlayer: boolean
): number {
  // Check timeout
  if (Date.now() - searchStartTime > timeoutMs * 0.9) {
    return evaluateBoard(chess);
  }
  
  if (depth === 0 || chess.isGameOver()) {
    return evaluateBoard(chess);
  }

  const moves = orderMoves(chess, chess.moves({ verbose: true }));
  
  if (maximizingPlayer) {
    let maxEval = -Infinity;
    for (const move of moves) {
      chess.move(move);
      const evaluation = minimax(chess, depth - 1, alpha, beta, false);
      chess.undo();
      maxEval = Math.max(maxEval, evaluation);
      alpha = Math.max(alpha, evaluation);
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const move of moves) {
      chess.move(move);
      const evaluation = minimax(chess, depth - 1, alpha, beta, true);
      chess.undo();
      minEval = Math.min(minEval, evaluation);
      beta = Math.min(beta, evaluation);
      if (beta <= alpha) break;
    }
    return minEval;
  }
}

function getBestMove(chess: Chess, depth: number, maxTimeMs: number = 10000): string | null {
  searchStartTime = Date.now();
  timeoutMs = maxTimeMs;
  
  const moves = orderMoves(chess, chess.moves({ verbose: true }));
  if (moves.length === 0) return null;

  const isMaximizing = chess.turn() === 'w';
  let bestMove = moves[0];
  let bestValue = isMaximizing ? -Infinity : Infinity;

  for (const move of moves) {
    // Check timeout between moves
    if (Date.now() - searchStartTime > timeoutMs * 0.9) {
      break;
    }
    
    chess.move(move);
    const boardValue = minimax(chess, depth - 1, -Infinity, Infinity, !isMaximizing);
    chess.undo();

    if (isMaximizing && boardValue > bestValue) {
      bestValue = boardValue;
      bestMove = move;
    } else if (!isMaximizing && boardValue < bestValue) {
      bestValue = boardValue;
      bestMove = move;
    }
  }

  return bestMove.san;
}

function cpuLevelToDepth(cpuLevel?: number): number {
  // CRITICAL: Cloudflare Workers Free Plan = 10ms CPU limit!
  // Paid plan = 50ms. These depths are tuned for FREE plan.
  // Depth 1 = ~1-2ms, Depth 2 = ~5-10ms, Depth 3 = 20-50ms+ (RISKY on free)
  if (!cpuLevel || cpuLevel <= 5) return 1;  // Ultra-fast, stays under 10ms
  if (cpuLevel <= 7) return 2;                // Fast, usually under 10ms
  // Level 8: Depth 2 (will timeout on complex positions, triggering fallback)
  return 2;
}

// Route Handlers
async function handleChessMove(request: Request, env: Env): Promise<Response> {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();
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
      mode: 'vs-cpu',
      engine: 'error',
      error: 'Invalid JSON request body',
      requestJson: {},
    };
    await logWorkerCall(env, logData);
    
    return new Response(
      JSON.stringify({
        success: false,
        errorCode: 'INVALID_REQUEST',
        error: 'Invalid JSON request body',
        source: 'error',
        requestId,
        workerCallLog: logData,
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const { fen, difficulty, cpuLevel, timeMs, gameId, mode } = requestBody;

  if (!fen) {
    const latencyMs = Date.now() - startTime;
    const logData: WorkerCallLogData = {
      endpoint: '/api/chess-move',
      method: 'POST',
      success: false,
      latencyMs,
      mode: mode || 'vs-cpu',
      engine: 'error',
      error: 'Missing required field: fen',
      requestJson: requestBody,
    };
    await logWorkerCall(env, logData);
    
    return new Response(
      JSON.stringify({
        success: false,
        errorCode: 'MISSING_FEN',
        error: 'Missing required field: fen',
        source: 'error',
        requestId,
        workerCallLog: logData,
      }),
      { status: 400, headers: getCacheHeaders() }
    );
  }

  // For vs-cpu mode, use Stockfish (Render.com)
  if (mode === 'vs-cpu' || !mode) {
    try {
      const stockfish = new StockfishEngine(env);
      const effectiveCpuLevel = cpuLevel || 5;
      const effectiveTimeMs = timeMs || 3000;
      
      const result = await stockfish.computeMove({
        fen,
        cpuLevel: effectiveCpuLevel,
        timeMs: effectiveTimeMs,
        gameId,
        mode: 'vs-cpu'
      });

      const latencyMs = Date.now() - startTime;

      if (!result.success) {
        // Stockfish error - return hard error
        const logData: WorkerCallLogData = {
          endpoint: '/api/chess-move',
          method: 'POST',
          success: false,
          latencyMs,
          cpuLevel: effectiveCpuLevel,
          timeMs: effectiveTimeMs,
          difficulty,
          mode: 'vs-cpu',
          engine: 'stockfish',
          error: result.error,
          requestJson: requestBody,
        };
        await logWorkerCall(env, logData);

        // Map error codes to appropriate HTTP status codes
        const statusCode = result.errorCode === 'BAD_FEN' ? 400 : 502;

        return new Response(
          JSON.stringify({
            success: false,
            errorCode: result.errorCode,
            error: result.error,
            source: 'stockfish',
            requestId,
            workerCallLog: logData,
          }),
          { status: statusCode, headers: getCacheHeaders() }
        );
      }

      // Success - Stockfish returned a move
      const responseData = {
        success: true,
        move: result.move,
        source: 'stockfish',
        requestId,
        diagnostics: {
          fen,
          move: result.move,
          cpuLevel: effectiveCpuLevel,
          latencyMs,
          stockfishMs: result.time,
          depth: result.depth,
          nodes: result.nodes,
          evaluation: result.evaluation,
          pv: result.pv,
          mate: result.mate
        },
      };

      const logData: WorkerCallLogData = {
        endpoint: '/api/chess-move',
        method: 'POST',
        success: true,
        latencyMs,
        cpuLevel: effectiveCpuLevel,
        timeMs: effectiveTimeMs,
        difficulty,
        mode: 'vs-cpu',
        engine: 'stockfish',
        requestJson: requestBody,
        responseJson: responseData,
      };
      await logWorkerCall(env, logData);

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
        difficulty,
        mode: 'vs-cpu',
        engine: 'stockfish',
        error: errorMessage,
        requestJson: requestBody,
      };
      await logWorkerCall(env, logData);
      
      console.error('Stockfish error:', {
        error: errorMessage,
        requestId,
        fen,
        timestamp: new Date().toISOString(),
      });

      return new Response(
        JSON.stringify({
          success: false,
          errorCode: 'STOCKFISH_ERROR',
          error: errorMessage,
          source: 'stockfish',
          requestId,
          workerCallLog: logData,
        }),
        { status: 502, headers: getCacheHeaders() }
      );
    }
  }

  // For coaching or other modes, use minimax as lightweight fallback
  try {
    const chess = new Chess(fen);
    const depth = cpuLevelToDepth(cpuLevel);
    const effectiveCpuLevel = cpuLevel || 3;
    const requestedTimeMs = timeMs || 1500;
    const searchStartTime = Date.now();
    
    const move = getBestMove(chess, depth, 8);

    if (!move) {
      throw new Error('No legal moves available');
    }

    const searchTimeMs = Date.now() - searchStartTime;
    const latencyMs = Date.now() - startTime;
    
    const diagnostics = {
      fen,
      move,
      depth,
      cpuLevel: effectiveCpuLevel,
      latencyMs,
      requestedTimeMs,
      effectiveTimeMs: requestedTimeMs,
      cappedTimeMs: Math.min(requestedTimeMs, 10000),
      searchTimeMs,
      difficultyRequested: difficulty || 'medium',
      difficultyMappedTo: difficulty || 'medium',
      openingBook: false,
      nodesSearched: 0,
    };

    const responseData = {
      success: true,
      move,
      source: 'minimax',
      requestId,
      mode: mode || 'coaching',
      diagnostics,
    };

    const logData: WorkerCallLogData = {
      endpoint: '/api/chess-move',
      method: 'POST',
      success: true,
      latencyMs,
      cpuLevel: cpuLevel || 3,
      timeMs,
      difficulty,
      mode: mode || 'coaching',
      engine: 'minimax',
      requestJson: requestBody,
      responseJson: responseData,
    };

    await logWorkerCall(env, logData);

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
      difficulty,
      mode: mode || 'coaching',
      engine: 'minimax',
      error: errorMessage,
      requestJson: requestBody,
    };

    await logWorkerCall(env, logData);
    
    console.error('Chess move error:', {
      error: errorMessage,
      fen,
      timestamp: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        mode: 'worker',
        engine: 'worker',
        workerCallLog: logData,
      }),
      { status: 500, headers: getCacheHeaders() }
    );
  }
}

async function handleWorkerHealth(request: Request, env: Env): Promise<Response> {
  const startTime = Date.now();
  const checks: any = {
    timestamp: new Date().toISOString(),
    version: env.VERSION || '1.0.0',
    environment: env.ENVIRONMENT || 'production',
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

  // Check environment variables
  checks.env = {
    DATABASE_URL: env.DATABASE_URL ? 'set' : 'missing',
    ADMIN_PASSWORD: env.ADMIN_PASSWORD ? 'set' : 'missing',
    STOCKFISH_SERVER_URL: env.STOCKFISH_SERVER_URL ? 'set' : 'missing',
    STOCKFISH_API_KEY: env.STOCKFISH_API_KEY ? 'set' : 'missing',
  };

  const latencyMs = Date.now() - startTime;
  const allHealthy = checks.database.status === 'ok' && 
                     env.DATABASE_URL && 
                     env.ADMIN_PASSWORD &&
                     env.STOCKFISH_SERVER_URL &&
                     env.STOCKFISH_API_KEY;

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

async function handleStockfishHealth(request: Request, env: Env): Promise<Response> {
  // Require admin authentication
  const authHeader = request.headers.get('Authorization');
  const expectedAuth = `Bearer ${env.ADMIN_PASSWORD}`;
  
  if (env.ADMIN_PASSWORD && authHeader !== expectedAuth) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Unauthorized',
      }),
      { status: 401, headers: getCacheHeaders() }
    );
  }

  const startTime = Date.now();
  
  try {
    const stockfish = new StockfishEngine(env);
    await stockfish.init();
    
    const latencyMs = Date.now() - startTime;
    
    return new Response(
      JSON.stringify({
        success: true,
        status: 'healthy',
        serverUrl: env.STOCKFISH_SERVER_URL,
        latencyMs,
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: getCacheHeaders() }
    );
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return new Response(
      JSON.stringify({
        success: false,
        status: 'unhealthy',
        error: errorMessage,
        serverUrl: env.STOCKFISH_SERVER_URL,
        latencyMs,
        timestamp: new Date().toISOString(),
      }),
      { status: 503, headers: getCacheHeaders() }
    );
  }
}

async function handleGetWorkerCalls(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '50', 10);

  try {
    const prisma = getPrismaClient(env);
    const logs = await prisma.workerCallLog.findMany({
      orderBy: { ts: 'desc' },
      take: limit,
    });

    return new Response(
      JSON.stringify({
        success: true,
        count: logs.length,
        logs,
      }),
      { status: 200, headers: getCacheHeaders() }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to fetch worker calls:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      { status: 500, headers: getCacheHeaders() }
    );
  }
}

async function handleClearWorkerCalls(request: Request, env: Env): Promise<Response> {
  // Optional admin authentication
  const authHeader = request.headers.get('Authorization');
  const expectedAuth = `Bearer ${env.ADMIN_PASSWORD}`;
  
  if (authHeader !== expectedAuth) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Unauthorized',
      }),
      { status: 401, headers: getCacheHeaders() }
    );
  }

  try {
    const prisma = getPrismaClient(env);
    const result = await prisma.workerCallLog.deleteMany({});

    return new Response(
      JSON.stringify({
        success: true,
        deleted: result.count,
      }),
      { status: 200, headers: getCacheHeaders() }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to clear worker calls:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      { status: 500, headers: getCacheHeaders() }
    );
  }
}

// Main request handler
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
    } else if (path === '/api/admin/worker-health' && request.method === 'GET') {
      response = await handleWorkerHealth(request, env);
    } else if (path === '/api/admin/stockfish-health' && request.method === 'GET') {
      response = await handleStockfishHealth(request, env);
    } else if (path === '/api/admin/worker-calls' && request.method === 'GET') {
      response = await handleGetWorkerCalls(request, env);
    } else if (path === '/api/admin/worker-calls/clear' && request.method === 'POST') {
      response = await handleClearWorkerCalls(request, env);
    } else {
      response = new Response(
        JSON.stringify({
          success: false,
          error: 'Not found',
          availableEndpoints: [
            'POST /api/chess-move',
            'GET /api/admin/worker-health',
            'GET /api/admin/stockfish-health',
            'GET /api/admin/worker-calls',
            'POST /api/admin/worker-calls/clear',
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
