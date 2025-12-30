/**
 * AI Coaching Worker (Refactored)
 * Version: 2.0 - Coaching Only
 * 
 * This worker provides AI-powered coaching narratives and explanations.
 * It does NOT generate chess moves - that's handled by the Stockfish-based Worker API.
 * 
 * Endpoints:
 * - POST /assist/postgame - Generate post-game coaching narrative
 * - POST /assist/explain - Explain a specific position or move
 * 
 * Important: This worker has NO public /api/* routes.
 * It's called internally by the Worker API via service binding.
 */

interface Env {
  OPENAI_API_KEY?: string; // Optional: if using OpenAI for narratives
  ANTHROPIC_API_KEY?: string; // Optional: if using Anthropic
  INTERNAL_AUTH_TOKEN?: string; // Auth token for worker-to-worker communication
}

// Request types
interface PostgameRequest {
  gameId: string;
  pgn: string;
  result: string;
  playerProfile?: {
    gamesPlayed: number;
    commonMistakes: string[];
    weaknessAreas: string[];
    playStyle: string;
  };
  gameAnalysis?: {
    blunders: any[];
    mistakes: any[];
    keyMoments: any[];
    tacticalThemes: string[];
  };
}

interface ExplainRequest {
  fen: string;
  move: string;
  context?: string;
  question?: string;
}

// Response types
interface PostgameResponse {
  success: true;
  mode: 'ai-worker';
  message: string; // Human-friendly coaching narrative
  highlights: Array<{
    moveNumber: number;
    type: 'blunder' | 'mistake' | 'good-move' | 'brilliant';
    why: string;
  }>;
  recommendations: string[];
  diagnostics: {
    requestId: string;
    latencyMs: number;
    model?: string;
    tokensUsed?: number;
  };
}

interface ExplainResponse {
  success: true;
  mode: 'ai-worker';
  explanation: string;
  diagnostics: {
    requestId: string;
    latencyMs: number;
    model?: string;
    tokensUsed?: number;
  };
}

interface ErrorResponse {
  success: false;
  mode: 'ai-worker';
  errorCode: string;
  error: string;
  diagnostics: {
    requestId: string;
    latencyMs: number;
  };
}

// Helper: Generate request ID
function generateRequestId(): string {
  return crypto.randomUUID().slice(0, 13);
}

// Helper: Check internal auth (if configured)
function checkAuth(request: Request, env: Env): boolean {
  if (!env.INTERNAL_AUTH_TOKEN) {
    return true; // Auth not configured, allow all
  }
  
  const authHeader = request.headers.get('X-Internal-Token');
  return authHeader === env.INTERNAL_AUTH_TOKEN;
}

/**
 * POST /assist/postgame
 * Generate post-game coaching narrative
 */
async function handlePostgame(request: Request, env: Env): Promise<Response> {
  const startTime = Date.now();
  const requestId = generateRequestId();
  
  // Check auth
  if (!checkAuth(request, env)) {
    return Response.json({
      success: false,
      mode: 'ai-worker',
      errorCode: 'UNAUTHORIZED',
      error: 'Invalid or missing auth token',
      diagnostics: {
        requestId,
        latencyMs: Date.now() - startTime,
      },
    }, { status: 401 });
  }
  
  let requestBody: PostgameRequest;
  
  try {
    requestBody = await request.json();
  } catch (error) {
    return Response.json({
      success: false,
      mode: 'ai-worker',
      errorCode: 'BAD_REQUEST',
      error: 'Invalid JSON request body',
      diagnostics: {
        requestId,
        latencyMs: Date.now() - startTime,
      },
    }, { status: 400 });
  }
  
  const { gameId, pgn, result, playerProfile, gameAnalysis } = requestBody;
  
  if (!gameId || !pgn || !result) {
    return Response.json({
      success: false,
      mode: 'ai-worker',
      errorCode: 'BAD_REQUEST',
      error: 'Missing required fields: gameId, pgn, result',
      diagnostics: {
        requestId,
        latencyMs: Date.now() - startTime,
      },
    }, { status: 400 });
  }
  
  try {
    console.log('[AI Worker] Generating post-game coaching:', {
      requestId,
      gameId,
      result,
      blunderCount: gameAnalysis?.blunders?.length || 0,
      mistakeCount: gameAnalysis?.mistakes?.length || 0,
    });
    
    // TODO: Call AI service (OpenAI, Anthropic, etc.) to generate narrative
    // This is a placeholder that shows the expected structure
    
    // For now, generate a simple template response
    const highlights: PostgameResponse['highlights'] = [];
    const recommendations: string[] = [];
    
    if (gameAnalysis?.blunders && gameAnalysis.blunders.length > 0) {
      gameAnalysis.blunders.slice(0, 3).forEach((blunder: any) => {
        highlights.push({
          moveNumber: blunder.moveNumber || 0,
          type: 'blunder',
          why: blunder.description || 'Significant material loss',
        });
      });
      
      recommendations.push('Focus on tactics - consider using tactical puzzle trainers');
    }
    
    if (gameAnalysis?.mistakes && gameAnalysis.mistakes.length > 0) {
      recommendations.push('Review key positions where you had better alternatives');
    }
    
    if (playerProfile?.weaknessAreas) {
      const weaknesses = Array.isArray(playerProfile.weaknessAreas) 
        ? playerProfile.weaknessAreas 
        : [];
      
      if (weaknesses.includes('opening')) {
        recommendations.push('Study your opening repertoire more deeply');
      }
      if (weaknesses.includes('endgame')) {
        recommendations.push('Practice endgame fundamentals');
      }
    }
    
    const message = `
Great game! You played ${result === '1-0' || result === '0-1' ? 'a decisive' : 'a fighting'} game.

${highlights.length > 0 ? `Key moments to review:\n${highlights.map(h => `- Move ${h.moveNumber}: ${h.why}`).join('\n')}` : ''}

${recommendations.length > 0 ? `\nRecommendations:\n${recommendations.map(r => `- ${r}`).join('\n')}` : ''}

Keep practicing and you'll continue to improve!
    `.trim();
    
    const latencyMs = Date.now() - startTime;
    
    console.log('[AI Worker] Coaching generated:', {
      requestId,
      latencyMs,
      highlightCount: highlights.length,
      recommendationCount: recommendations.length,
    });
    
    const response: PostgameResponse = {
      success: true,
      mode: 'ai-worker',
      message,
      highlights,
      recommendations,
      diagnostics: {
        requestId,
        latencyMs,
        model: 'template-v1', // Replace with actual AI model when integrated
      },
    };
    
    return Response.json(response);
    
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    console.error('[AI Worker] Error generating coaching:', {
      requestId,
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });
    
    return Response.json({
      success: false,
      mode: 'ai-worker',
      errorCode: 'INTERNAL',
      error: errorMessage,
      diagnostics: {
        requestId,
        latencyMs,
      },
    }, { status: 500 });
  }
}

/**
 * POST /assist/explain
 * Explain a specific position or move
 */
async function handleExplain(request: Request, env: Env): Promise<Response> {
  const startTime = Date.now();
  const requestId = generateRequestId();
  
  // Check auth
  if (!checkAuth(request, env)) {
    return Response.json({
      success: false,
      mode: 'ai-worker',
      errorCode: 'UNAUTHORIZED',
      error: 'Invalid or missing auth token',
      diagnostics: {
        requestId,
        latencyMs: Date.now() - startTime,
      },
    }, { status: 401 });
  }
  
  let requestBody: ExplainRequest;
  
  try {
    requestBody = await request.json();
  } catch (error) {
    return Response.json({
      success: false,
      mode: 'ai-worker',
      errorCode: 'BAD_REQUEST',
      error: 'Invalid JSON request body',
      diagnostics: {
        requestId,
        latencyMs: Date.now() - startTime,
      },
    }, { status: 400 });
  }
  
  const { fen, move, context, question } = requestBody;
  
  if (!fen) {
    return Response.json({
      success: false,
      mode: 'ai-worker',
      errorCode: 'BAD_REQUEST',
      error: 'Missing required field: fen',
      diagnostics: {
        requestId,
        latencyMs: Date.now() - startTime,
      },
    }, { status: 400 });
  }
  
  try {
    console.log('[AI Worker] Explaining position:', {
      requestId,
      fen: fen.substring(0, 30) + '...',
      move,
      question: question?.substring(0, 50),
    });
    
    // TODO: Call AI service to explain the position
    // This is a placeholder
    
    const explanation = question
      ? `Here's an explanation of ${question}: ...`
      : move
      ? `The move ${move} is interesting because...`
      : `This position features...`;
    
    const latencyMs = Date.now() - startTime;
    
    const response: ExplainResponse = {
      success: true,
      mode: 'ai-worker',
      explanation,
      diagnostics: {
        requestId,
        latencyMs,
        model: 'template-v1',
      },
    };
    
    return Response.json(response);
    
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    console.error('[AI Worker] Error explaining:', {
      requestId,
      error: errorMessage,
    });
    
    return Response.json({
      success: false,
      mode: 'ai-worker',
      errorCode: 'INTERNAL',
      error: errorMessage,
      diagnostics: {
        requestId,
        latencyMs,
      },
    }, { status: 500 });
  }
}

// Main request handler
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // IMPORTANT: This worker has NO /api/* routes
    // It's only accessible via service binding from Worker API
    
    if (path === '/assist/postgame' && request.method === 'POST') {
      return handlePostgame(request, env);
    } else if (path === '/assist/explain' && request.method === 'POST') {
      return handleExplain(request, env);
    } else if (path === '/health' && request.method === 'GET') {
      // Simple health check
      return Response.json({
        healthy: true,
        timestamp: new Date().toISOString(),
        version: '2.0-coaching-only',
      });
    } else {
      return Response.json({
        success: false,
        errorCode: 'NOT_FOUND',
        error: 'Not found',
        availableEndpoints: [
          'POST /assist/postgame',
          'POST /assist/explain',
          'GET /health',
        ],
      }, { status: 404 });
    }
  },
};
