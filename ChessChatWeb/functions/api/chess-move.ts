/**
 * Chess Move API - Cloudflare Pages Function
 * With server-side move validation using chess.js
 */

import { Chess } from 'chess.js';

interface Env {
  OPENAI_API_KEY?: string;
  CHESS_RATE_LIMIT?: KVNamespace;
  GAME_SESSIONS?: KVNamespace;
}

interface ChessMoveRequest {
  fen: string;
  pgn?: string;
  model?: string;
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

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAIRequest {
  model: string;
  messages: OpenAIMessage[];
  temperature: number;
  max_tokens: number;
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

// Fetch with timeout using AbortController
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
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
    // Get API key from environment
    const apiKey = context.env.OPENAI_API_KEY;

    console.log(`[${requestId}] Request started, API key present: ${!!apiKey}`);

    if (!apiKey) {
      console.error(`[${requestId}] Missing OPENAI_API_KEY in environment`);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing configuration: OPENAI_API_KEY',
          errorCode: 'MISSING_CONFIG',
          requestId,
        }),
        { status: 500, headers: corsHeaders }
      );
    }

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

    const { fen, pgn = '', model = 'gpt-4o-mini', difficulty = 'intermediate', gameId, userMove, chatHistory = [] } = body;

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

    // Get legal moves for validation and to help the AI
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

    // Map difficulty to temperature
    const temperatureMap: Record<string, number> = {
      beginner: 0.9,
      intermediate: 0.5,
      advanced: 0.2,
      master: 0.1,
    };
    const temperature = temperatureMap[difficulty] ?? 0.5;

    // Initialize chat if this is the first move
    if (gameSession.moveCount === 0) {
      const challengeMessage: ChatMessage = {
        id: `msg_${Date.now()}_1`,
        role: 'user',
        content: `Hello! I challenge you to a game of chess. You'll be playing as ${fen.includes(' w ') ? 'Black' : 'White'}. Let's have a friendly but competitive match! I'll tell you my moves and you respond with yours. Ready to play?`,
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
        content: `I played ${moveNotation}. Your turn! What's your response?`,
        timestamp: Date.now(),
        moveContext: userMove
      };
      gameSession.chatHistory.push(userMoveMessage);
    }

    // Build the prompt - include legal moves to guide the AI
    const sideToMove = fen.includes(' w ') ? 'White' : 'Black';
    
    // For simple positions, list all moves. For complex, list a sample.
    const movesHint = legalMoves.length <= 15 
      ? `Legal moves: ${legalMoves.join(', ')}`
      : `Sample legal moves: ${legalMoves.slice(0, 10).join(', ')} (and ${legalMoves.length - 10} more)`;

    const systemPrompt = `You are playing chess and having a friendly conversation. Respond conversationally to the human's challenge and moves, then provide your move in UCI format at the end.

Format your response as:
1. A brief conversational comment about the position or their move
2. Your move in UCI format on a new line starting with "MOVE: "

UCI FORMAT: 4-5 lowercase characters like e2e4, g1f3, e7e8q
Example: "Nice opening! I'll develop my knight.\\nMOVE: g1f3"`;

    const gameContext = `Current position (FEN): ${fen}
${sideToMove} to move.
${movesHint}
${pgn ? `\nGame so far:\n${pgn}` : ''}`;

    // Build conversation messages
    const messages: OpenAIMessage[] = [
      { role: 'system', content: systemPrompt },
      ...gameSession.chatHistory.map(msg => ({ 
        role: msg.role, 
        content: msg.content 
      })),
      { role: 'user', content: gameContext }
    ];

    const openAIRequest: OpenAIRequest = {
      model,
      messages,
      temperature,
      max_tokens: 150,
    };

    console.log(`[${requestId}] Calling OpenAI with model: ${model}`);

    // Retry loop for getting a valid UCI move
    let attempts = 0;
    const MAX_ATTEMPTS = 2;
    let lastRawMove = '';

    while (attempts < MAX_ATTEMPTS) {
      attempts++;

      // Call OpenAI with 15 second timeout
      let response: Response;
      try {
        response = await fetchWithTimeout(
          'https://api.openai.com/v1/chat/completions',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(openAIRequest),
          },
          15000 // 15 second timeout
        );
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          console.error(`[${requestId}] OpenAI request timed out after 15s`);
          return new Response(
            JSON.stringify({
              success: false,
              error: 'AI request timed out',
              errorCode: 'TIMEOUT',
              requestId,
              latencyMs: Date.now() - startTime,
            }),
            { status: 504, headers: corsHeaders }
          );
        }
        throw error;
      }

      // Handle non-OK responses
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[${requestId}] OpenAI error: ${response.status} - ${errorText}`);

        // For rate limiting, fall back to random move instead of failing
        if (response.status === 429) {
          console.warn(`[${requestId}] Rate limited - falling back to random legal move`);
          const randomMove = legalMoves[Math.floor(Math.random() * legalMoves.length)];
          const latencyMs = Date.now() - startTime;
          
          return new Response(
            JSON.stringify({
              success: true,
              move: randomMove,
              model: 'fallback-random',
              difficulty,
              latencyMs,
              requestId,
              note: 'Rate limited - used random move',
            }),
            { status: 200, headers: corsHeaders }
          );
        }

        let errorCode = 'API_ERROR';
        if (response.status === 401) errorCode = 'AUTH_ERROR';
        else if (response.status >= 500) errorCode = 'SERVICE_UNAVAILABLE';

        return new Response(
          JSON.stringify({
            success: false,
            error: `OpenAI API error: ${response.status}`,
            errorCode,
            requestId,
            latencyMs: Date.now() - startTime,
          }),
          { status: response.status >= 500 ? 503 : response.status, headers: corsHeaders }
        );
      }

      // Parse OpenAI response
      const data = await response.json() as {
        choices?: Array<{ message?: { content?: string } }>;
      };

      const fullResponse = data.choices?.[0]?.message?.content?.trim() ?? '';
      lastRawMove = fullResponse;
      console.log(`[${requestId}] Attempt ${attempts}: Full response="${fullResponse}"`);

      // Extract UCI move from "MOVE: " format or find UCI pattern
      let extractedMove = '';
      const moveLineMatch = fullResponse.match(/MOVE:\s*([a-h][1-8][a-h][1-8][qrbn]?)/i);
      if (moveLineMatch) {
        extractedMove = moveLineMatch[1].toLowerCase();
      } else {
        // Fallback: find any UCI pattern in the response
        const uciPattern = fullResponse.match(/([a-h][1-8][a-h][1-8][qrbn]?)/);
        extractedMove = uciPattern ? uciPattern[1].toLowerCase() : '';
      }

      console.log(`[${requestId}] Extracted move: "${extractedMove}"`);

      if (extractedMove && isValidUCI(extractedMove) && isLegalMove(fen, extractedMove)) {
        // Add AI's conversational response to chat history
        const aiMessage: ChatMessage = {
          id: `msg_${Date.now()}_${gameSession.chatHistory.length + 1}`,
          role: 'assistant',
          content: fullResponse,
          timestamp: Date.now(),
          moveContext: extractedMove
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
          console.warn(`[${requestId}] Failed to save session: ${error}`);
        }

        const latencyMs = Date.now() - startTime;
        console.log(`[${requestId}] Success: move="${extractedMove}", latency=${latencyMs}ms`);

        return new Response(
          JSON.stringify({
            success: true,
            move: extractedMove,
            model,
            difficulty,
            latencyMs,
            requestId,
            gameId: gameSession.gameId,
            chatHistory: gameSession.chatHistory,
            conversationalResponse: fullResponse,
          }),
          { status: 200, headers: corsHeaders }
        );
      } else {
        console.warn(`[${requestId}] Move "${extractedMove}" is invalid or illegal`);
      }

      // If not valid UCI or illegal move, try again with slightly higher temperature
      console.warn(`[${requestId}] Retrying with higher temperature...`);
      openAIRequest.temperature = Math.min(openAIRequest.temperature + 0.2, 1.0);
    }

    // All attempts failed - fall back to a random legal move
    if (legalMoves.length > 0) {
      const randomMove = legalMoves[Math.floor(Math.random() * legalMoves.length)];
      console.log(`[${requestId}] Falling back to random legal move: ${randomMove}`);
      
      return new Response(
        JSON.stringify({
          success: true,
          move: randomMove,
          model,
          difficulty,
          latencyMs: Date.now() - startTime,
          requestId,
          fallback: true,
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // No legal moves available (shouldn't happen if we checked earlier)
    console.error(`[${requestId}] All attempts failed, last raw: "${lastRawMove}"`);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'AI could not find a valid move',
        errorCode: 'INVALID_MOVE',
        rawResponse: lastRawMove,
        requestId,
        latencyMs: Date.now() - startTime,
      }),
      { status: 422, headers: corsHeaders }
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
