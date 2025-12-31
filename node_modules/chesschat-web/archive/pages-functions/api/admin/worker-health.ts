/**
 * Worker Health Check API - Cloudflare Pages Function
 * Verifies that Worker service binding is functional
 * 
 * Endpoint: GET /api/admin/worker-health
 * Auth: Uses ADMIN_PASSWORD if configured (matches existing admin routes)
 */

interface Env {
  WALLE_ASSISTANT?: Fetcher; // Service binding to worker
  INTERNAL_AUTH_TOKEN?: string; // Optional auth token for worker
  ADMIN_PASSWORD?: string; // Admin authentication
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const startTime = Date.now();
  
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  };

  try {
    // Simple auth check (if ADMIN_PASSWORD exists)
    if (context.env.ADMIN_PASSWORD) {
      const url = new URL(context.request.url);
      const providedPassword = url.searchParams.get('password') || 
                               context.request.headers.get('Authorization')?.replace('Bearer ', '');
      
      if (providedPassword !== context.env.ADMIN_PASSWORD) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Unauthorized - invalid admin password',
          }),
          { status: 401, headers: corsHeaders }
        );
      }
    }

    // Check if binding exists
    const bindingPresent = !!context.env.WALLE_ASSISTANT;
    
    if (!bindingPresent) {
      return new Response(
        JSON.stringify({
          success: false,
          bindingPresent: false,
          error: 'Worker service binding (WALLE_ASSISTANT) not configured',
          recommendation: 'Configure service binding in Cloudflare Dashboard: Pages > Settings > Functions > Service Bindings',
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Make a test call to Worker with starting position
    const testFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'; // Starting position
    const testDifficulty = 'beginner';
    
    let workerHttpStatus: number;
    let workerStatusText: string;
    let parsedJsonOk: boolean = false;
    let workerMode: string | undefined;
    let workerEngine: string | undefined;
    let workerError: string | undefined;
    let latencyMs: number;
    
    try {
      const workerStartTime = Date.now();
      
      // Create timeout (10 seconds for health check)
      const timeoutMs = 10000;
      const timeoutPromise = new Promise<Response>((_, reject) => 
        setTimeout(() => reject(new Error('Worker health check timeout after 10s')), timeoutMs)
      );
      
      // Call Worker
      const workerResponse = await Promise.race([
        context.env.WALLE_ASSISTANT.fetch('https://internal/assist/chess-move', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(context.env.INTERNAL_AUTH_TOKEN ? { 'X-Internal-Token': context.env.INTERNAL_AUTH_TOKEN } : {})
          },
          body: JSON.stringify({ 
            fen: testFen, 
            difficulty: testDifficulty,
            gameId: 'health-check'
          })
        }),
        timeoutPromise
      ]);
      
      latencyMs = Date.now() - workerStartTime;
      workerHttpStatus = workerResponse.status;
      workerStatusText = workerResponse.statusText;
      
      // Try to parse response
      try {
        const responseText = await workerResponse.text();
        const workerData = JSON.parse(responseText);
        parsedJsonOk = true;
        
        workerMode = workerData.mode;
        workerEngine = workerData.engine;
        
        if (!workerData.success) {
          workerError = workerData.error || 'Worker returned success=false';
        }
      } catch (parseError) {
        parsedJsonOk = false;
        workerError = `Failed to parse Worker response as JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`;
      }
      
    } catch (fetchError) {
      latencyMs = Date.now() - startTime;
      workerHttpStatus = 0; // Indicates fetch failed before getting response
      workerStatusText = 'Fetch Failed';
      parsedJsonOk = false;
      workerError = fetchError instanceof Error ? fetchError.message : String(fetchError);
    }

    // Build health check response
    const healthOk = bindingPresent && 
                     workerHttpStatus === 200 && 
                     parsedJsonOk && 
                     !workerError;

    return new Response(
      JSON.stringify({
        success: healthOk,
        bindingPresent,
        workerHttpStatus,
        workerStatusText,
        parsedJsonOk,
        latencyMs,
        ...(workerMode && { workerMode }),
        ...(workerEngine && { workerEngine }),
        ...(workerError && { error: workerError }),
        timestamp: Date.now(),
        testRequest: {
          fen: testFen.substring(0, 50),
          difficulty: testDifficulty
        },
        ...(healthOk ? {} : {
          troubleshooting: [
            !bindingPresent && 'Configure WALLE_ASSISTANT service binding in Dashboard',
            workerHttpStatus !== 200 && `Worker returned HTTP ${workerHttpStatus}`,
            !parsedJsonOk && 'Worker response is not valid JSON',
            workerError && `Worker error: ${workerError}`
          ].filter(Boolean)
        })
      }),
      { 
        status: 200, 
        headers: corsHeaders 
      }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[worker-health] Unexpected error:', errorMessage);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: `Health check failed: ${errorMessage}`,
        timestamp: Date.now(),
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
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
};
