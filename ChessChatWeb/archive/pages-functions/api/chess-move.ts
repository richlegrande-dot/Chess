/**
 * Chess Move API - Cloudflare Pages Function
 * Uses Wall-E Chess Engine via Worker Service Binding
 * Version: 3.0 - Worker Required Mode (No Fallback)
 * 
 * IMPORTANT: This function requires Worker service binding.
 * If Worker fails, the request fails (no local fallback).
 * 
 * Emergency Fallback: Set ALLOW_FALLBACK_MAIN_THREAD=true to re-enable
 * archived fallback (not recommended for production debugging).
 */

import { Chess } from 'chess.js';
import { executeFallbackMove } from '../../archive/fallback/main_thread_chess_move';

interface Env {
  CHESS_RATE_LIMIT?: KVNamespace;
  GAME_SESSIONS?: KVNamespace;
  WORKER_CALL_LOGS?: KVNamespace; // Persistent worker call logs for admin portal
  WALLE_ASSISTANT?: Fetcher; // Service binding to worker (REQUIRED)
  INTERNAL_AUTH_TOKEN?: string; // Optional auth token for worker
  ALLOW_FALLBACK_MAIN_THREAD?: string; // Emergency fallback flag (default: false)
}

interface ChessMoveRequest {
  fen: string;
  pgn?: string;
  difficulty?: string;
  gameId?: string;
  userMove?: string;
  chatHistory?: ChatMessage[];
  timeMs?: number; // Requested compute budget in milliseconds
  cpuLevel?: number; // CPU level (1-8) for diagnostics
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
    console.log(`[${requestId}] Request started - Worker Required Mode`);
    console.log(`[${requestId}] Service binding available:`, !!context.env.WALLE_ASSISTANT);
    console.log(`[${requestId}] Fallback allowed:`, context.env.ALLOW_FALLBACK_MAIN_THREAD === 'true');

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

    const { fen, pgn = '', difficulty = 'intermediate', gameId, userMove, chatHistory = [], timeMs, cpuLevel } = body;

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

    // CRITICAL: Service binding is REQUIRED in worker-required mode
    if (!context.env.WALLE_ASSISTANT) {
      const latencyMs = Date.now() - startTime;
      const errorLog = {
        timestamp: Date.now(),
        endpoint: '/api/chess-move',
        method: 'POST',
        success: false,
        latencyMs,
        error: 'Worker service binding not configured (WALLE_ASSISTANT missing)',
        request: { fen: fen.substring(0, 50), difficulty, gameId, timeMs, cpuLevel },
        response: null
      };
      
      // Store error log in KV
      if (context.env.WORKER_CALL_LOGS) {
        context.waitUntil(
          context.env.WORKER_CALL_LOGS.put(
            `log_no_binding_${Date.now()}_${requestId}`,
            JSON.stringify(errorLog),
            { expirationTtl: 86400 }
          )
        );
      }
      
      console.error(`[${requestId}] FATAL: No Worker service binding available`);
      return new Response(
        JSON.stringify({
          success: false,
          mode: 'worker-required',
          engine: 'none',
          error: 'Worker service binding not configured. Set WALLE_ASSISTANT binding in Cloudflare Dashboard.',
          errorCode: 'NO_WORKER_BINDING',
          requestId,
          workerCallLog: errorLog
        }),
        { status: 503, headers: corsHeaders }
      );
    }

    // Call Worker via service binding
    const workerStartTime = Date.now();
    let workerResponse: Response;
    
    try {
      // Create timeout promise (15 seconds for worker to respond)
      const timeoutMs = 15000;
      const timeoutPromise = new Promise<Response>((_, reject) => 
        setTimeout(() => reject(new Error('Worker timeout after 15s')), timeoutMs)
      );
      
      // Race worker fetch against timeout
      workerResponse = await Promise.race([
        context.env.WALLE_ASSISTANT.fetch('https://internal/assist/chess-move', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(context.env.INTERNAL_AUTH_TOKEN ? { 'X-Internal-Token': context.env.INTERNAL_AUTH_TOKEN } : {})
          },
          body: JSON.stringify({ fen, pgn, difficulty, gameId, timeMs, cpuLevel })
        }),
        timeoutPromise
      ]);
    } catch (fetchError) {
      const workerLatency = Date.now() - workerStartTime;
      const errorMessage = fetchError instanceof Error ? fetchError.message : String(fetchError);
      
      const errorLog = {
        timestamp: Date.now(),
        endpoint: '/assist/chess-move',
        method: 'POST',
        success: false,
        latencyMs: workerLatency,
        error: `Worker fetch failed: ${errorMessage}`,
        request: { fen: fen.substring(0, 50), difficulty, gameId, timeMs, cpuLevel },
        response: null
      };
      
      // Store error log
      if (context.env.WORKER_CALL_LOGS) {
        context.waitUntil(
          context.env.WORKER_CALL_LOGS.put(
            `log_fetch_error_${Date.now()}_${requestId}`,
            JSON.stringify(errorLog),
            { expirationTtl: 86400 }
          )
        );
      }
      
      console.error(`[${requestId}] Worker fetch failed:`, errorMessage);
      
      // Check for emergency fallback flag
      if (context.env.ALLOW_FALLBACK_MAIN_THREAD === 'true') {
        console.warn(`[${requestId}] Emergency fallback enabled - using local engine`);
        const fallbackResult = await executeFallbackMove(
          fen,
          difficulty,
          gameId,
          userMove,
          enableDebug,
          requestId,
          startTime,
          {
            GAME_SESSIONS: context.env.GAME_SESSIONS,
            WORKER_CALL_LOGS: context.env.WORKER_CALL_LOGS
          }
        );
        return new Response(JSON.stringify(fallbackResult), {
          status: 200,
          headers: corsHeaders
        });
      }
      
      return new Response(
        JSON.stringify({
          success: false,
          mode: 'worker-required',
          engine: 'none',
          error: `Worker unreachable: ${errorMessage}`,
          errorCode: 'WORKER_FETCH_FAILED',
          requestId,
          workerCallLog: errorLog
        }),
        { status: 502, headers: corsHeaders }
      );
    }

    const workerLatency = Date.now() - workerStartTime;
    
    // Validate Worker response status
    if (!workerResponse.ok) {
      const errorLog = {
        timestamp: Date.now(),
        endpoint: '/assist/chess-move',
        method: 'POST',
        success: false,
        latencyMs: workerLatency,
        error: `Worker returned ${workerResponse.status}: ${workerResponse.statusText}`,
        request: { fen: fen.substring(0, 50), difficulty, gameId, timeMs, cpuLevel },
        response: null
      };
      
      // Store error log
      if (context.env.WORKER_CALL_LOGS) {
        context.waitUntil(
          context.env.WORKER_CALL_LOGS.put(
            `log_bad_status_${Date.now()}_${requestId}`,
            JSON.stringify(errorLog),
            { expirationTtl: 86400 }
          )
        );
      }
      
      console.error(`[${requestId}] Worker returned non-200 status:`, workerResponse.status);
      
      // Check for emergency fallback flag
      if (context.env.ALLOW_FALLBACK_MAIN_THREAD === 'true') {
        console.warn(`[${requestId}] Emergency fallback enabled - using local engine`);
        const fallbackResult = await executeFallbackMove(
          fen,
          difficulty,
          gameId,
          userMove,
          enableDebug,
          requestId,
          startTime,
          {
            GAME_SESSIONS: context.env.GAME_SESSIONS,
            WORKER_CALL_LOGS: context.env.WORKER_CALL_LOGS
          }
        );
        return new Response(JSON.stringify(fallbackResult), {
          status: 200,
          headers: corsHeaders
        });
      }
      
      return new Response(
        JSON.stringify({
          success: false,
          mode: 'worker-required',
          engine: 'none',
          error: `Worker returned error status: ${workerResponse.status} ${workerResponse.statusText}`,
          errorCode: 'WORKER_ERROR_STATUS',
          requestId,
          workerCallLog: errorLog
        }),
        { status: 502, headers: corsHeaders }
      );
    }
    
    // Parse Worker response JSON
    let workerData: any;
    try {
      const responseText = await workerResponse.text();
      workerData = JSON.parse(responseText);
    } catch (parseError) {
      const errorLog = {
        timestamp: Date.now(),
        endpoint: '/assist/chess-move',
        method: 'POST',
        success: false,
        latencyMs: workerLatency,
        error: `Worker returned invalid JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
        request: { fen: fen.substring(0, 50), difficulty, gameId, timeMs, cpuLevel },
        response: null
      };
      
      // Store error log
      if (context.env.WORKER_CALL_LOGS) {
        context.waitUntil(
          context.env.WORKER_CALL_LOGS.put(
            `log_parse_error_${Date.now()}_${requestId}`,
            JSON.stringify(errorLog),
            { expirationTtl: 86400 }
          )
        );
      }
      
      console.error(`[${requestId}] Worker returned non-JSON response`);
      
      // Check for emergency fallback flag
      if (context.env.ALLOW_FALLBACK_MAIN_THREAD === 'true') {
        console.warn(`[${requestId}] Emergency fallback enabled - using local engine`);
        const fallbackResult = await executeFallbackMove(
          fen,
          difficulty,
          gameId,
          userMove,
          enableDebug,
          requestId,
          startTime,
          {
            GAME_SESSIONS: context.env.GAME_SESSIONS,
            WORKER_CALL_LOGS: context.env.WORKER_CALL_LOGS
          }
        );
        return new Response(JSON.stringify(fallbackResult), {
          status: 200,
          headers: corsHeaders
        });
      }
      
      return new Response(
        JSON.stringify({
          success: false,
          mode: 'worker-required',
          engine: 'none',
          error: 'Worker returned invalid JSON response',
          errorCode: 'WORKER_INVALID_JSON',
          requestId,
          workerCallLog: errorLog
        }),
        { status: 502, headers: corsHeaders }
      );
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
        gameId,
        timeMs, // Include time budget in log
        cpuLevel // Include CPU level in log
      },
      response: workerData.success ? {
        move: workerData.move,
        depthReached: workerData.diagnostics?.depthReached || workerData.depth,
        evaluation: workerData.diagnostics?.eval || workerData.evaluation,
        engine: workerData.engine || 'worker',
        mode: workerData.mode || 'service-binding',
        source: workerData.source
      } : null
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
    
    // Handle Worker success
    if (workerData.success) {
      const responseData = {
        ...workerData,
        requestId,
        workerCallLog, // Include worker call log in response for frontend logging
        mode: 'service-binding',
        engine: workerData.engine || 'worker',
        // Add difficulty diagnostics
        difficultyDiagnostics: {
          requested: difficulty,
          mappedTo: workerData.diagnostics?.mode || 'unknown',
          depthReached: workerData.diagnostics?.depthReached || 0,
          nodesEvaluated: workerData.diagnostics?.nodes || 0,
          engineMs: workerData.diagnostics?.engineMs || 0,
          openingBook: workerData.diagnostics?.openingBook || false,
          reason: workerData.diagnostics?.reason || 'computed'
        },
        ...(enableDebug && { debugMode: true })
      };
      console.log(`[${requestId}] Worker success: move=${workerData.move}, difficulty=${difficulty}, latency=${workerLatency}ms`);
      return new Response(JSON.stringify(responseData), {
        status: 200,
        headers: corsHeaders
      });
    }
    
    // Worker returned success=false (validation error or chess engine error)
    console.error(`[${requestId}] Worker returned success=false:`, workerData.error);
    
    // Check for emergency fallback flag
    if (context.env.ALLOW_FALLBACK_MAIN_THREAD === 'true') {
      console.warn(`[${requestId}] Emergency fallback enabled - using local engine`);
      const fallbackResult = await executeFallbackMove(
        fen,
        difficulty,
        gameId,
        userMove,
        enableDebug,
        requestId,
        startTime,
        {
          GAME_SESSIONS: context.env.GAME_SESSIONS,
          WORKER_CALL_LOGS: context.env.WORKER_CALL_LOGS
        }
      );
      return new Response(JSON.stringify(fallbackResult), {
        status: 200,
        headers: corsHeaders
      });
    }
    
    return new Response(
      JSON.stringify({
        success: false,
        mode: 'worker-required',
        engine: 'none',
        error: workerData.error || 'Worker returned error',
        errorCode: 'WORKER_RETURNED_ERROR',
        requestId,
        workerCallLog
      }),
      { status: 502, headers: corsHeaders }
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
