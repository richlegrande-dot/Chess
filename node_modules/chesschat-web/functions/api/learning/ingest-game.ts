/**
 * Learning V3 Game Ingestion API endpoint - Proxy to Worker
 * Forwards requests to Worker for real ingestion and analysis
 */

export async function onRequestPost(context: {
  request: Request;
  env: any;
}) {
  try {
    const body = await context.request.json() as any;
    const { userId, gameId, pgn, playerColor, chatContext } = body;
    
    console.log('[Learning V3 Pages] Proxying ingestion request:', { userId, gameId });
    
    // Forward to Worker (deployed at same domain)
    const workerUrl = new URL('/api/learning/ingest-game', context.request.url);
    workerUrl.hostname = context.request.url.includes('localhost') 
      ? 'localhost' 
      : new URL(context.request.url).hostname;
    
    const workerResponse = await fetch(workerUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId, gameId, pgn, playerColor, chatContext }),
    });
    
    // Return Worker response unchanged
    const workerData = await workerResponse.json();
    
    return new Response(
      JSON.stringify(workerData),
      {
        status: workerResponse.status,
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (error) {
    console.error('[Learning V3 Pages] Proxy error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to reach learning backend',
        fallback: true,
      }),
      {
        status: 500,
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
