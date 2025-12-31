/**
 * Learning V3 Game Ingestion API endpoint - Stub implementation
 * Returns a degraded mode response since Stockfish analysis isn't deployed
 */

export async function onRequestPost(context: {
  request: Request;
  env: any;
}) {
  try {
    const body = await context.request.json() as any;
    const { userId, gameId, pgn, chatContext } = body;
    
    console.log('[Learning V3] Game ingestion request:', { userId, gameId, moveCount: pgn?.split('.').length });
    
    // Return degraded mode response (Stockfish not available)
    return new Response(
      JSON.stringify({
        success: true,
        partial: true,
        analysisMode: 'degraded',
        stockfishWarm: false,
        message: 'Game recorded locally. Advanced server-side analysis is queued but not yet available.',
        requestId: `req_${Date.now()}`,
        nextStep: 'Your game patterns are being tracked in your browser storage.',
        conceptsUpdated: 0,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[Learning V3] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Invalid request format or missing parameters',
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

// Also support OPTIONS for CORS
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
