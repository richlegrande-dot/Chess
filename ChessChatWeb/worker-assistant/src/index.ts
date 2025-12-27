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

import { getWallEEngine } from '../../shared/walleEngine';
import { WalleChessEngine } from '../../shared/walleChessEngine';
import type { 
  WallEChatResponse, 
  WallEAnalysisResponse 
} from '../../shared/walleEngine';

interface Env {
  DATABASE_URL?: string;
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
  try {
    const data = await request.json() as ChessMoveRequest;
    const { fen, difficulty = 'medium', gameId } = data;

    if (!fen) {
      return Response.json({
        success: false,
        error: 'FEN position is required'
      }, { status: 400 });
    }

    const engine = new WalleChessEngine();
    const move = await engine.getBestMove(fen, difficulty);

    if (!move) {
      return Response.json({
        success: false,
        error: 'No legal moves available'
      }, { status: 400 });
    }

    return Response.json({
      success: true,
      move: move.move,
      evaluation: move.evaluation,
      depth: move.depth,
      timeMs: move.timeMs,
      source: move.source,
      openingName: move.openingName
    });
  } catch (error: any) {
    console.error('[Worker] Chess move error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Internal server error'
    }, { status: 500 });
  }
}

/**
 * Main request handler
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        }
      });
    }

    // Route requests
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
      availableEndpoints: [
        'POST /assist/chat',
        'POST /assist/analyze-game',
        'POST /assist/chess-move'
      ]
    }, { status: 404 });
  }
};
