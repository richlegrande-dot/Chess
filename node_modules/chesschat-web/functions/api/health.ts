/**
 * Health check endpoint for admin diagnostics
 * Proxies to Worker API for comprehensive system health
 */

export async function onRequestGet(context: {
  request: Request;
  env: any;
}) {
  const { env } = context;
  
  try {
    // Call the Worker API health endpoint
    const workerUrl = env.WORKER_API_URL || 'https://chess-chat-worker-api.richl9999.workers.dev';
    const workerResponse = await fetch(`${workerUrl}/api/health`);
    
    if (!workerResponse.ok) {
      throw new Error(`Worker API returned ${workerResponse.status}`);
    }
    
    const healthData = await workerResponse.json();
    
    return new Response(
      JSON.stringify(healthData),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (error) {
    // Fallback if Worker API is unavailable
    return new Response(
      JSON.stringify({
        status: 'degraded',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Worker API unavailable',
        database: {
          dbReady: false,
          error: 'Unable to reach Worker API',
        },
        learning: {
          v3Enabled: false,
          v31SmartSampling: false,
          v31CacheEnabled: false,
        },
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        },
      }
    );
  }
}

