/**
 * Wall-E Assistant Worker
 * 
 * Standalone Cloudflare Worker service that provides AI chess coaching.
 * Called by Pages Functions via service binding.
 * 
 * NO EXTERNAL AI DEPENDENCIES - Wall-E only
 * ENFORCES: Provable personalization (≥2 references from history)
 * 
 * Endpoints:
 * - POST /assist/chat
 * - POST /assist/analyze-game
 * - POST /assist/chess-move
 */

// Only import the chess engine (no Prisma dependency)
import { WalleChessEngine } from './shared/walleChessEngine';

// Lazy-load Wall-E engine with database features only when needed
// This avoids importing Prisma at module level, which breaks Workers deployment
import type { 
  WallEChatResponse, 
  WallEAnalysisResponse 
} from './shared/walleEngine';

interface Env {
  DATABASE_URL?: string;
  INTERNAL_AUTH_TOKEN?: string;
}

interface ChatRequest {
  message: string;
  userId?: string;
  gameContext?: any;
  chatHistory?: any[];
}

interface AnalyzeGameRequest {
  pgn: string;
  moveHistory: any[];
  cpuLevel?: number;
  playerColor?: string;
  result?: string;
  userId?: string;
}

interface ChessMoveRequest {
  fen: string;
  pgn?: string;
  difficulty?: string;
  gameId?: string;
  timeMs?: number; // Requested compute budget in milliseconds
  cpuLevel?: number; // CPU level (1-8) for diagnostics
}

/**
 * Validate internal auth token
 * Returns true if auth is valid or not configured (for backward compatibility)
 */
function validateAuth(request: Request, env: Env): boolean {
  // If no token is configured, allow all requests (backward compatibility)
  if (!env.INTERNAL_AUTH_TOKEN) {
    return true;
  }

  const token = request.headers.get('X-Internal-Token');
  return token === env.INTERNAL_AUTH_TOKEN;
}

/**
 * Handle chat requests with Wall-E
 */
async function handleChat(request: Request, env: Env): Promise<Response> {
  try {
    const data = await request.json() as ChatRequest;
    const { message, userId = 'anonymous', gameContext } = data;

    if (!message) {
      return Response.json({
        success: false,
        error: 'Message is required'
      }, { status: 400 });
    }

    // Check if DATABASE_URL is available
    if (!env.DATABASE_URL) {
      return Response.json({
        success: false,
        error: 'Database unavailable - personalized coaching disabled',
        response: 'Wall-E is currently in basic mode. Play some games to unlock personalized coaching!',
        confidenceScore: 0.3,
        sourcesUsed: ['basic_knowledge'],
        learningApplied: false,
        historyEvidence: {
          lastGamesUsed: 0,
          gameIdsUsed: [],
          topMistakePatternsUsed: [],
          personalizedReferenceCount: 0,
          insufficientHistory: true,
          insufficientReason: 'database unavailable'
        },
        personalizedReferences: []
      });
    }

    // Lazy-load Wall-E engine to avoid importing Prisma at module level
    const { getWallEEngine } = await import('./shared/walleEngine');
    const engine = getWallEEngine();
    const response = await engine.chat(
      {
        userId,
        databaseUrl: env.DATABASE_URL
      },
      message,
      gameContext
    );

    return Response.json({
      success: true,
      ...response
    });
  } catch (error: any) {
    console.error('[Worker] Chat error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Internal server error'
    }, { status: 500 });
  }
}

/**
 * Handle game analysis requests
 */
async function handleAnalyzeGame(request: Request, env: Env): Promise<Response> {
  try {
    const data = await request.json() as AnalyzeGameRequest;
    const { pgn, moveHistory, cpuLevel, playerColor, result, userId = 'anonymous' } = data;

    if (!pgn || !moveHistory || !cpuLevel || !playerColor) {
      return Response.json({
        success: false,
        error: 'Missing required parameters: pgn, moveHistory, cpuLevel, playerColor'
      }, { status: 400 });
    }

    // Check if DATABASE_URL is available
    if (!env.DATABASE_URL) {
      return Response.json({
        success: false,
        error: 'Database unavailable - personalized analysis disabled',
        analysis: 'Basic analysis available. Play more games to unlock personalized insights!',
        recommendations: ['Keep playing to build your learning profile'],
        personalizedInsights: [],
        sourcesUsed: ['basic_knowledge'],
        confidenceScore: 0.3,
        historyEvidence: {
          lastGamesUsed: 0,
          gameIdsUsed: [],
          topMistakePatternsUsed: [],
          personalizedReferenceCount: 0,
          insufficientHistory: true,
          insufficientReason: 'database unavailable'
        },
        personalizedReferences: []
      });
    }

    // Lazy-load Wall-E engine to avoid importing Prisma at module level
    const { getWallEEngine } = await import('./shared/walleEngine');
    const engine = getWallEEngine();
    const response = await engine.analyzeGame(
      {
        userId,
        databaseUrl: env.DATABASE_URL
      },
      pgn,
      moveHistory,
      {
        cpuLevel,
        playerColor,
        result
      }
    );

    return Response.json({
      success: true,
      ...response
    });
  } catch (error: any) {
    console.error('[Worker] Analyze game error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Internal server error'
    }, { status: 500 });
  }
}

/**
 * Handle chess move requests (CPU opponent)
 */
async function handleChessMove(request: Request, env: Env): Promise<Response> {
  console.log('[Worker] Handling chess move request');
  const startTime = Date.now();
  
  try {
    const data = await request.json() as ChessMoveRequest;
    const { fen, difficulty = 'medium', gameId, timeMs: requestedTimeMs, cpuLevel } = data;
    console.log('[Worker] Request data:', { fen: fen?.substring(0, 30), difficulty, gameId, requestedTimeMs, cpuLevel });

    if (!fen) {
      console.error('[Worker] Missing FEN in request');
      return Response.json({
        success: false,
        error: 'FEN position is required',
        mode: 'service-binding',
        workerCallLog: {
          endpoint: '/assist/chess-move',
          method: 'POST',
          success: false,
          latencyMs: Date.now() - startTime,
          error: 'FEN position is required',
          request: { fen, difficulty, gameId },
          response: { mode: 'service-binding' }
        }
      }, { status: 400 });
    }

    console.log('[Worker] Generating best move for difficulty:', difficulty);
    
    // Map difficulty levels
    const difficultyMap: Record<string, 'beginner' | 'intermediate' | 'advanced' | 'master'> = {
      'easy': 'beginner',
      'medium': 'intermediate',
      'hard': 'advanced',
      'expert': 'master'
    };
    const difficultyLevel = difficultyMap[difficulty.toLowerCase()] || 'intermediate';
    
    // Calculate effective time budget
    const defaultTimeMs = 750; // Default worker budget
    const effectiveTimeMs = requestedTimeMs && requestedTimeMs > 0 ? requestedTimeMs : defaultTimeMs;
    const cappedTimeMs = Math.min(effectiveTimeMs, 15000); // Cap at 15s for Cloudflare CPU limits
    
    console.log('[Worker] Time budget:', { requested: requestedTimeMs, effective: effectiveTimeMs, capped: cappedTimeMs });
    
    // Generate move using WalleChessEngine
    let result: any;
    let abortReason: string | undefined;
    try {
      result = WalleChessEngine.selectMove(fen, difficultyLevel, true, true, cappedTimeMs);
      console.log('[Worker] Move generated:', result.move);
      
      // Check if computation was cut short
      if (result.debug && result.debug.engineMs < cappedTimeMs * 0.5) {
        if (result.debug.usedOpeningBook) {
          abortReason = 'opening_book';
        } else if (result.debug.mode === 'cheap-fallback') {
          abortReason = 'time_exhausted';
        } else {
          abortReason = 'early_completion';
        }
      }
    } catch (error: any) {
      console.error('[Worker] Chess engine error:', error);
      const latencyMs = Date.now() - startTime;
      return Response.json({
        success: false,
        error: 'Chess engine error: ' + error.message,
        mode: 'service-binding',
        diagnostics: {
          difficultyRequested: difficulty,
          difficultyMappedTo: difficultyLevel,
          cpuLevel: cpuLevel || 'unknown',
          requestedTimeMs: requestedTimeMs || 0,
          effectiveTimeMs: effectiveTimeMs,
          cappedTimeMs: cappedTimeMs,
          searchTimeMs: 0,
          abortReason: 'error'
        },
        workerCallLog: {
          endpoint: '/assist/chess-move',
          method: 'POST',
          success: false,
          latencyMs,
          error: error.message,
          request: { fen: fen.substring(0, 50), difficulty, gameId, timeMs: requestedTimeMs },
          response: { mode: 'service-binding' }
        }
      }, { status: 500 });
    }

    if (!result || !result.move) {
      console.error('[Worker] No legal moves found');
      const latencyMs = Date.now() - startTime;
      return Response.json({
        success: false,
        error: 'No legal moves available',
        mode: 'service-binding',
        workerCallLog: {
          endpoint: '/assist/chess-move',
          method: 'POST',
          success: false,
          latencyMs,
          error: 'No legal moves available',
          request: { fen, difficulty, gameId },
          response: { mode: 'service-binding' }
        }
      }, { status: 400 });
    }

    const latencyMs = Date.now() - startTime;
    const searchTimeMs = result.debug?.engineMs || 0;
    
    console.log('[Worker] Returning successful response with comprehensive diagnostics');
    return Response.json({
      success: true,
      move: result.move,
      engine: 'worker',
      mode: 'service-binding',
      commentary: result.commentary,
      diagnostics: {
        // Difficulty mapping
        difficultyRequested: difficulty,
        difficultyMappedTo: difficultyLevel,
        cpuLevel: cpuLevel || 'unknown',
        
        // Time budget tracking
        requestedTimeMs: requestedTimeMs || 0,
        effectiveTimeMs: effectiveTimeMs,
        cappedTimeMs: cappedTimeMs,
        searchTimeMs: searchTimeMs,
        abortReason: abortReason,
        
        // Engine results
        depthReached: result.debug?.evaluatedMovesCount || 0,
        nodes: result.debug?.legalMovesCount || 0,
        nodesSearched: result.debug?.evaluatedMovesCount || 0,
        eval: 0,
        selectedLine: result.move,
        openingBook: result.debug?.usedOpeningBook || false,
        reason: result.debug?.usedOpeningBook ? 'Opening book move' : 'Computed move',
        engineMs: searchTimeMs,
        mode: result.debug?.mode || 'unknown',
        
        // Engine parameters (from difficulty config)
        engineParamsUsed: {
          difficulty: difficultyLevel,
          timeMs: cappedTimeMs,
          mode: result.debug?.mode || 'unknown'
        }
      },
      workerCallLog: {
        endpoint: '/assist/chess-move',
        method: 'POST',
        success: true,
        latencyMs,
        request: { fen: fen.substring(0, 50), difficulty, gameId, timeMs: requestedTimeMs, cpuLevel },
        response: {
          move: result.move,
          depthReached: result.debug?.evaluatedMovesCount || 0,
          usedOpeningBook: result.debug?.usedOpeningBook || false,
          engine: 'worker',
          mode: 'service-binding',
          searchTimeMs: searchTimeMs,
          abortReason: abortReason
        }
      }
    });
  } catch (error: any) {
    const latencyMs = Date.now() - startTime;
    console.error('[Worker] Chess move error:', error);
    console.error('[Worker] Error stack:', error.stack);
    
    return Response.json({
      success: false,
      error: error.message || 'Chess move generation failed',
      errorDetails: error.stack?.substring(0, 200),
      requestId: request.headers.get('X-Request-Id') || 'unknown',
      mode: 'service-binding',
      workerCallLog: {
        endpoint: '/assist/chess-move',
        method: 'POST',
        success: false,
        latencyMs,
        error: error.message || 'Chess move generation failed',
        request: { difficulty: 'unknown', gameId: 'unknown' },
        response: { mode: 'service-binding' }
      }
    }, { status: 500 });
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Auth guard: validate internal token if configured
    if (!validateAuth(request, env)) {
      // Return 404 instead of 401/403 to avoid exposing worker existence
      return Response.json({
        success: false,
        error: 'Not found'
      }, { status: 404 });
    }

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, X-Internal-Token'
        }
      });
    }

    // Route requests - ONLY internal /assist/* routes (service binding)
    // Public /api/* routes are handled by Pages Functions
    if (url.pathname === '/assist/chat' && request.method === 'POST') {
      return handleChat(request, env);
    }

    if (url.pathname === '/assist/analyze-game' && request.method === 'POST') {
      return handleAnalyzeGame(request, env);
    }

    if (url.pathname === '/assist/chess-move' && request.method === 'POST') {
      return handleChessMove(request, env);
    }

    // 404 for unknown routes
    return Response.json({
      success: false,
      error: 'Not found',
      message: 'This is an internal Worker service. Public API is at /api/*',
      availableEndpoints: [
        'POST /assist/chat',
        'POST /assist/analyze-game',
        'POST /assist/chess-move'
      ]
    }, { status: 404 });
  }
};
