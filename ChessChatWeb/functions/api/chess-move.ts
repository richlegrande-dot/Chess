/**
 * Chess Move API - Cloudflare Pages Function
 * Uses Wall-E Chess Engine (NO external APIs required)
 */

import { Chess } from 'chess.js';
import { WalleChessEngine } from '../lib/walleChessEngine';

interface Env {
  CHESS_RATE_LIMIT?: KVNamespace;
  GAME_SESSIONS?: KVNamespace;
}

interface ChessMoveRequest {
  fen: string;
  pgn?: string;
  difficulty?: string;
  gameId?: string;
  userMove?: string;
  chatHistory?: ChatMessage[];
}

interface ChatMessage {
  id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: number;
  moveContext?: string;
}

interface GameSession {
  gameId: string;
  chatHistory: ChatMessage[];
  moveCount: number;
  startTime: number;
}

// Simple FEN validation - just check basic structure
function isValidFEN(fen: string): boolean {
  if (!fen || typeof fen !== 'string') return false;
  const parts = fen.trim().split(/\s+/);
  if (parts.length < 4 || parts.length > 6) return false;
  const rows = parts[0].split('/');
  if (rows.length !== 8) return false;
  return true;
}

// UCI move format validation
function isValidUCI(move: string): boolean {
  return /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move);
}

// Convert UCI move to algebraic notation for chat
function convertUciToAlgebraic(uciMove: string, fen: string): string {
  try {
    const chess = new Chess(fen);
    const move = chess.move(uciMove);
    return move ? move.san : uciMove;
  } catch {
    return uciMove;
  }
}

// Validate if a UCI move is legal in the given position
function isLegalMove(fen: string, uciMove: string): boolean {
  try {
    const chess = new Chess(fen);
    const from = uciMove.substring(0, 2);
    const to = uciMove.substring(2, 4);
    const promotion = uciMove.length === 5 ? uciMove[4] : undefined;
    
    const result = chess.move({ from, to, promotion });
    return result !== null;
  } catch {
    return false;
  }
}

// Get list of legal moves in UCI format
function getLegalMoves(fen: string): string[] {
  try {
    const chess = new Chess(fen);
    return chess.moves({ verbose: true }).map(m => {
      const uci = m.from + m.to + (m.promotion || '');
      return uci;
    });
  } catch {
    return [];
  }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const startTime = Date.now();
  const requestId = crypto.randomUUID().slice(0, 8);

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  try {
    console.log(`[${requestId}] Request started - using Wall-E Chess Engine`);

    // Parse and validate request body
    let body: ChessMoveRequest;
    try {
      body = await context.request.json();
    } catch {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid JSON in request body',
          errorCode: 'INVALID_REQUEST',
          requestId,
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    const { fen, pgn = '', difficulty = 'intermediate', gameId, userMove, chatHistory = [] } = body;

    // Validate FEN
    if (!isValidFEN(fen)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid FEN position',
          errorCode: 'INVALID_FEN',
          requestId,
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Initialize or load game session
    let gameSession: GameSession;
    const sessionKey = gameId || `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      const existingSession = gameId && context.env.GAME_SESSIONS ? 
        await context.env.GAME_SESSIONS.get(gameId) : null;
      gameSession = existingSession ? JSON.parse(existingSession) : {
        gameId: sessionKey,
        chatHistory: [],
        moveCount: 0,
        startTime: Date.now()
      };
    } catch {
      gameSession = {
        gameId: sessionKey,
        chatHistory: [],
        moveCount: 0,
        startTime: Date.now()
      };
    }

    // Get legal moves for validation
    const legalMoves = getLegalMoves(fen);
    console.log(`[${requestId}] Legal moves: ${legalMoves.length} available`);

    if (legalMoves.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No legal moves available (game may be over)',
          errorCode: 'NO_MOVES',
          requestId,
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Initialize chat if this is the first move
    if (gameSession.moveCount === 0) {
      const sideToPlay = fen.includes(' w ') ? 'Black' : 'White';
      const challengeMessage: ChatMessage = {
        id: `msg_${Date.now()}_1`,
        role: 'user',
        content: `Hello! I challenge you to a game of chess. You'll be playing as ${sideToPlay}. Let's have a friendly but competitive match!`,
        timestamp: Date.now(),
        moveContext: 'game_start'
      };
      gameSession.chatHistory.push(challengeMessage);
    }

    // Add user move to conversation if provided
    if (userMove && gameSession.moveCount > 0) {
      const moveNotation = convertUciToAlgebraic(userMove, fen);
      const userMoveMessage: ChatMessage = {
        id: `msg_${Date.now()}_${gameSession.chatHistory.length + 1}`,
        role: 'user',
        content: `I played ${moveNotation}. Your turn!`,
        timestamp: Date.now(),
        moveContext: userMove
      };
      gameSession.chatHistory.push(userMoveMessage);
    }

    // Use Wall-E Chess Engine to select move
    const difficultyLevel = (difficulty as 'beginner' | 'intermediate' | 'advanced' | 'master') || 'intermediate';
    
    let selectedMove: string;
    let commentary: string;
    
    try {
      const result = WalleChessEngine.selectMove(fen, difficultyLevel, true);
      selectedMove = result.move;
      commentary = result.commentary || "Here's my move!";
    } catch (error) {
      console.error(`[${requestId}] Wall-E engine error:`, error);
      // Fallback to random legal move
      selectedMove = legalMoves[Math.floor(Math.random() * legalMoves.length)];
      commentary = "Let me think... here's my move!";
    }

    // Verify move is legal (should always be, but double-check)
    if (!isLegalMove(fen, selectedMove)) {
      console.error(`[${requestId}] Wall-E selected illegal move: ${selectedMove}`);
      // Fallback to random legal move
      selectedMove = legalMoves[Math.floor(Math.random() * legalMoves.length)];
      commentary = "Interesting position! Let me play this.";
    }

    // Add Wall-E's response to chat history
    const moveNotation = convertUciToAlgebraic(selectedMove, fen);
    const fullResponse = `${commentary}\nMOVE: ${selectedMove}`;
    
    const aiMessage: ChatMessage = {
      id: `msg_${Date.now()}_${gameSession.chatHistory.length + 1}`,
      role: 'assistant',
      content: fullResponse,
      timestamp: Date.now(),
      moveContext: selectedMove
    };
    gameSession.chatHistory.push(aiMessage);
    gameSession.moveCount++;

    // Save updated session (if KV is available)
    try {
      if (context.env.GAME_SESSIONS) {
        await context.env.GAME_SESSIONS.put(gameSession.gameId, JSON.stringify(gameSession), {
          expirationTtl: 3600 // 1 hour expiration
        });
      }
    } catch (error) {
      console.warn(`[${requestId}] Failed to save session:`, error);
    }

    const latencyMs = Date.now() - startTime;
    console.log(`[${requestId}] Success: move="${selectedMove}" (${moveNotation}), latency=${latencyMs}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        move: selectedMove,
        engine: 'wall-e',
        difficulty: difficultyLevel,
        latencyMs,
        requestId,
        gameId: gameSession.gameId,
        chatHistory: gameSession.chatHistory,
        conversationalResponse: fullResponse,
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    const latencyMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[${requestId}] Unexpected error: ${errorMessage}`);

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        errorCode: 'INTERNAL_ERROR',
        requestId,
        latencyMs,
      }),
      { status: 500, headers: corsHeaders }
    );
  }
};

// Handle OPTIONS for CORS preflight
export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
};
