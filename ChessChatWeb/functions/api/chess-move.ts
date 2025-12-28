/**
 * Chess Move API - Cloudflare Pages Function
 * Uses Wall-E Chess Engine (NO external APIs required)
 * Version: 2.0 - Worker Call Tracking Added
 */

import { Chess } from 'chess.js';
import { WalleChessEngine } from '../../shared/walleChessEngine';

interface Env {
  CHESS_RATE_LIMIT?: KVNamespace;
  GAME_SESSIONS?: KVNamespace;
  WORKER_CALL_LOGS?: KVNamespace; // Persistent worker call logs for admin portal
  WALLE_ASSISTANT?: Fetcher; // Service binding to worker
  INTERNAL_AUTH_TOKEN?: string; // Optional auth token for worker
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
    console.log(`[${requestId}] Service binding available:`, !!context.env.WALLE_ASSISTANT);

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

    // Check for debug flag in query params
    const url = new URL(context.request.url);
    const enableDebug = url.searchParams.get('debug') === '1' || url.searchParams.get('debug') === 'true';

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

    // Try service binding first (if available)
    if (context.env.WALLE_ASSISTANT) {
      try {
        const workerStartTime = Date.now();
        
        // Create timeout promise (15 seconds for worker to respond)
        const timeoutMs = 15000;
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Worker timeout after 15s')), timeoutMs)
        );
        
        // Race worker fetch against timeout
        const workerResponse = await Promise.race([
          context.env.WALLE_ASSISTANT.fetch('https://internal/assist/chess-move', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(context.env.INTERNAL_AUTH_TOKEN ? { 'X-Internal-Token': context.env.INTERNAL_AUTH_TOKEN } : {})
            },
            body: JSON.stringify({ fen, pgn, difficulty, gameId })
          }),
          timeoutPromise
        ]) as Response;

        const workerLatency = Date.now() - workerStartTime;
        
        // Defensive parsing: attempt JSON parse with fallback
        let workerData: any;
        try {
          const responseText = await workerResponse.text();
          workerData = JSON.parse(responseText);
        } catch (parseError) {
          throw new Error(`Worker returned non-JSON response: ${workerResponse.status} ${workerResponse.statusText}`);
        }
        
        // Build comprehensive worker call log
        const workerCallLog = {
          timestamp: Date.now(),
          endpoint: '/assist/chess-move',
          method: 'POST',
          success: workerData.success === true,
          latencyMs: workerLatency,
          error: workerData.success ? undefined : (workerData.error || 'Unknown worker error'),
          request: { 
            fen: fen.substring(0, 50), 
            difficulty, 
            gameId 
          },
          response: workerData.success ? {
            move: workerData.move,
            depthReached: workerData.diagnostics?.depthReached || workerData.depth,
            evaluation: workerData.diagnostics?.eval || workerData.evaluation,
            engine: workerData.engine || 'worker',
            mode: workerData.mode || 'service-binding',
            source: workerData.source
          } : undefined
        };
        
        // Store log persistently in KV (fire and forget)
        if (context.env.WORKER_CALL_LOGS) {
          const logKey = `log_${Date.now()}_${requestId}`;
          context.waitUntil(
            context.env.WORKER_CALL_LOGS.put(logKey, JSON.stringify(workerCallLog), {
              expirationTtl: 86400 // 24 hours retention
            })
          );
        }
        
        if (workerData.success) {
          const responseData = {
            ...workerData,
            requestId,
            workerCallLog, // Include worker call log in response for frontend logging
            mode: 'service-binding',
            engine: workerData.engine || 'worker',
            ...(enableDebug && { debugMode: true })
          };
          console.log(`[${requestId}] Worker success: move=${workerData.move}, latency=${workerLatency}ms`);
          return new Response(JSON.stringify(responseData), {
            status: 200,
            headers: corsHeaders
          });
        }
        
        // Worker returned error response
        console.warn(`[${requestId}] Worker returned error, using local fallback:`, workerData.error);
        
        // Store error log
        if (context.env.WORKER_CALL_LOGS) {
          const logKey = `log_error_${Date.now()}_${requestId}`;
          context.waitUntil(
            context.env.WORKER_CALL_LOGS.put(logKey, JSON.stringify(workerCallLog), {
              expirationTtl: 86400
            })
          );
        }
        
      } catch (workerError) {
        const errorMessage = workerError instanceof Error ? workerError.message : String(workerError);
        const workerLatency = Date.now() - startTime;
        
        console.warn(`[${requestId}] Worker binding failed (${errorMessage}), using local fallback`);
        
        // Log worker failure
        const failureLog = {
          timestamp: Date.now(),
          endpoint: '/assist/chess-move',
          method: 'POST',
          success: false,
          latencyMs: workerLatency,
          error: `Worker fetch failed: ${errorMessage}`,
          request: { fen: fen.substring(0, 50), difficulty, gameId },
          response: undefined
        };
        
        if (context.env.WORKER_CALL_LOGS) {
          const logKey = `log_failure_${Date.now()}_${requestId}`;
          context.waitUntil(
            context.env.WORKER_CALL_LOGS.put(logKey, JSON.stringify(failureLog), {
              expirationTtl: 86400
            })
          );
        }
        
        // Log additional context for debugging
        console.log(`[${requestId}] Worker error details:`, {
          errorType: workerError instanceof Error ? workerError.constructor.name : typeof workerError,
          hasBinding: !!context.env.WALLE_ASSISTANT,
          hasAuthToken: !!context.env.INTERNAL_AUTH_TOKEN
        });
      }
    } else {
      console.log(`[${requestId}] No worker service binding available, using local engine`);
    }

    // Local fallback: Run Wall-E chess engine directly

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
    let engineDebug: any = undefined;
    
    try {
      const result = WalleChessEngine.selectMove(fen, difficultyLevel, true, enableDebug);
      selectedMove = result.move;
      commentary = result.commentary || "Here's my move!";
      engineDebug = result.debug;
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

    const responseData: any = {
      success: true,
      move: selectedMove,
      engine: 'wall-e',
      mode: 'local-fallback',
      difficulty: difficultyLevel,
      latencyMs,
      requestId,
      gameId: gameSession.gameId,
      chatHistory: gameSession.chatHistory,
      conversationalResponse: fullResponse,
      diagnostics: {
        depthReached: engineDebug?.depthReached || 0,
        nodes: engineDebug?.nodesEvaluated || 0,
        eval: engineDebug?.evaluation || 0,
        selectedLine: engineDebug?.bestLine || '',
        openingBook: engineDebug?.usedOpeningBook || false,
        reason: 'Local fallback engine'
      },
      workerCallLog: {
        timestamp: Date.now(),
        endpoint: '/api/chess-move',
        method: 'POST',
        success: false,
        latencyMs: latencyMs,
        error: 'Worker service binding not available - used local fallback engine',
        request: { fen: fen.substring(0, 50), difficulty: difficultyLevel, gameId: gameSession.gameId },
        response: { 
          move: selectedMove, 
          mode: 'local-fallback', 
          engine: 'wall-e',
          depthReached: engineDebug?.depthReached || 0
        }
      },
      ...(enableDebug && { debugMode: true })
    };
    
    // Store fallback log
    if (context.env.WORKER_CALL_LOGS) {
      const logKey = `log_fallback_${Date.now()}_${requestId}`;
      context.waitUntil(
        context.env.WORKER_CALL_LOGS.put(logKey, JSON.stringify(responseData.workerCallLog), {
          expirationTtl: 86400
        })
      );
    }

    // Add debug info if requested
    if (enableDebug && engineDebug) {
      responseData.debug = engineDebug;
    }

    return new Response(
      JSON.stringify(responseData),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    const latencyMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[${requestId}] Unexpected error: ${errorMessage}`);
    
    // Store error log
    const errorLog = {
      timestamp: Date.now(),
      endpoint: '/api/chess-move',
      method: 'POST',
      success: false,
      latencyMs,
      error: `Internal server error: ${errorMessage}`,
      request: { fen: 'unknown', difficulty: 'unknown', gameId: 'unknown' },
      response: undefined
    };
    
    if (context.env.WORKER_CALL_LOGS) {
      const logKey = `log_error_${Date.now()}_${requestId}`;
      context.waitUntil(
        context.env.WORKER_CALL_LOGS.put(logKey, JSON.stringify(errorLog), {
          expirationTtl: 86400
        })
      );
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        errorCode: 'INTERNAL_ERROR',
        mode: 'error',
        requestId,
        latencyMs,
        workerCallLog: errorLog
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
