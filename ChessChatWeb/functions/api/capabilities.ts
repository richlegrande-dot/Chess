/**
 * API Capabilities Endpoint
 * 
 * Returns truthful information about what features are currently enabled
 * on the server side vs what must run client-side only.
 * 
 * This prevents misleading "queued" messages when no actual queue exists.
 */

export async function onRequest(): Promise<Response> {
  const capabilities = {
    learning: {
      local: true,  // Client-side learning always available
      server: false // Server-side learning V3 not deployed
    },
    coaching: {
      local: true,  // Rule-based coaching engine runs client-side
      server: false // No server-side deep coaching
    },
    chat: {
      enabled: false // Chat functionality not implemented
    },
    stockfish: {
      cpuMoves: true,       // Worker can make moves (depth limited to 2)
      deepAnalysis: false   // No deep position analysis (Cloudflare CPU limits)
    },
    serverInfo: {
      version: "1.0.0-stub",
      environment: "cloudflare-pages",
      timestamp: new Date().toISOString()
    }
  };

  return new Response(JSON.stringify(capabilities, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300' // Cache for 5 minutes
    }
  });
}
