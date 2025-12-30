/**
 * Cloudflare Pages Function to proxy specific /api/* requests to the Worker API via service binding
 */

export async function onRequest(context: {
  request: Request;
  params: { path: string[] };
  env: any;
  next: () => Promise<Response>;
}) {
  const { request, params, env, next } = context;
  
  // Construct the path
  const path = params.path ? params.path.join('/') : '';
  
  // Only proxy chess-move requests to the worker
  // All other /api/* requests pass through to other Functions or return 404
  if (path !== 'chess-move') {
    console.log(`[API Proxy] Passing through ${request.method} /api/${path} to next handler`);
    return next();
  }
  
  const fullPath = `/assist/${path}`;
  
  console.log(`[API Proxy] Forwarding ${request.method} ${request.url} → Worker service binding ${fullPath}`);
  
  try {
    // Check if service binding is available
    if (!env.WALLE_ASSISTANT) {
      console.error('[API Proxy] WALLE_ASSISTANT service binding not available');
      return new Response(
        JSON.stringify({ 
          error: 'Worker service not available',
          message: 'WALLE_ASSISTANT binding not configured'
        }), 
        { 
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Create a new request with the correct path for the worker
    const workerRequest = new Request(`https://worker${fullPath}`, {
      method: request.method,
      headers: request.headers,
      body: request.method !== 'GET' && request.method !== 'HEAD' ? await request.clone().arrayBuffer() : undefined,
    });
    
    // Call the Worker via service binding
    const workerResponse = await env.WALLE_ASSISTANT.fetch(workerRequest);
    
    // Return the Worker's response
    return new Response(workerResponse.body, {
      status: workerResponse.status,
      statusText: workerResponse.statusText,
      headers: workerResponse.headers,
    });
  } catch (error) {
    console.error('[API Proxy] Error calling Worker service:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to call Worker service',
        message: error instanceof Error ? error.message : String(error)
      }), 
      { 
        status: 502,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}