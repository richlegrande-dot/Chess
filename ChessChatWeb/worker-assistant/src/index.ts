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

import { getWallEEngine } from './shared/walleEngine';
import { WalleChessEngine } from './shared/walleChessEngine';
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
    const { fen, difficulty = 'medium', gameId } = data;
    console.log('[Worker] Request data:', { fen: fen?.substring(0, 30), difficulty, gameId });

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

    console.log('[Worker] Creating WalleChessEngine instance');
    const engine = new WalleChessEngine();
    console.log('[Worker] Getting best move for difficulty:', difficulty);
    const move = await engine.getBestMove(fen, difficulty);
    console.log('[Worker] Move generated:', move?.move);

    if (!move) {
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
    console.log('[Worker] Returning successful response with workerCallLog');
    return Response.json({
      success: true,
      move: move.move,
      evaluation: move.evaluation,
      depth: move.depth,
      timeMs: move.timeMs,
      source: move.source,
      openingName: move.openingName,
      engine: 'worker',
      mode: 'service-binding',
      diagnostics: {
        depthReached: move.depth || 0,
        nodes: move.nodes || 0,
        eval: move.evaluation || 0,
        selectedLine: move.pv || '',
        openingBook: move.source === 'opening_book',
        reason: move.source === 'opening_book' ? 'Opening book move' : 'Computed move'
      },
      workerCallLog: {
        endpoint: '/assist/chess-move',
        method: 'POST',
        success: true,
        latencyMs,
        request: { fen: fen.substring(0, 50), difficulty, gameId },
        response: {
          move: move.move,
          depthReached: move.depth,
          evaluation: move.evaluation,
          source: move.source,
          engine: 'worker',
          mode: 'service-binding'
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
