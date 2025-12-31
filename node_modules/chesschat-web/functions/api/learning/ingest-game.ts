/**
 * Learning V3 Game Ingestion API endpoint - Stub implementation
 * Returns honest response about capabilities since server-side learning is not deployed
 */

export async function onRequestPost(context: {
  request: Request;
  env: any;
}) {
  try {
    const body = await context.request.json() as any;
    const { userId, gameId, pgn, chatContext } = body;
    
    console.log('[Learning V3] Game ingestion request:', { userId, gameId, moveCount: pgn?.split('.').length });
    
    // Return truthful response about server capabilities
    return new Response(
      JSON.stringify({
        success: true,
        analysisMode: 'local_only',
        message: 'Game received. Server-side learning is not enabled yet; your local learning remains active.',
        requestId: `req_${Date.now()}`,
        serverCapabilities: {
          serverLearningEnabled: false,
          serverAnalysisEnabled: false,
          localLearningEnabled: true
        },
        recommendation: 'Continue playing! Your browser is tracking patterns and providing coaching.',
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
