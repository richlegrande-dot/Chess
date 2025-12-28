/**
 * Admin API: Worker Call Logs
 * 
 * Fetches persistent worker call logs from KV storage.
 * Provides aggregated stats and individual call details.
 */

interface Env {
  WORKER_CALL_LOGS?: KVNamespace;
  ADMIN_PASSWORD?: string;
}

interface WorkerCallLog {
  timestamp: number;
  endpoint: string;
  method: string;
  success: boolean;
  latencyMs: number;
  error?: string;
  request?: any;
  response?: any;
}

interface WorkerCallsResponse {
  success: boolean;
  totalCalls: number;
  successRate: number;
  avgLatency: number;
  successfulCalls: number;
  failedCalls: number;
  calls: WorkerCallLog[];
  errorPatterns: Record<string, number>;
  lastUpdated: number;
}

/**
 * Validate admin authentication
 */
function validateAdmin(request: Request, env: Env): boolean {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }

  const token = authHeader.substring(7);
  const adminPassword = env.ADMIN_PASSWORD || 'admin';
  
  return token === adminPassword;
}

/**
 * Analyze error patterns from failed calls
 */
function analyzeErrorPatterns(calls: WorkerCallLog[]): Record<string, number> {
  const patterns: Record<string, number> = {};
  
  calls.filter(c => !c.success).forEach(call => {
    const error = call.error || 'unknown';
    
    if (error.includes('timeout') || error.includes('Timeout')) {
      patterns['timeout'] = (patterns['timeout'] || 0) + 1;
    } else if (error.includes('404') || error.includes('not found')) {
      patterns['404-not-found'] = (patterns['404-not-found'] || 0) + 1;
    } else if (error.includes('500') || error.includes('server error')) {
      patterns['500-server-error'] = (patterns['500-server-error'] || 0) + 1;
    } else if (error.includes('binding') || error.includes('Worker') || error.includes('service')) {
      patterns['binding-issue'] = (patterns['binding-issue'] || 0) + 1;
    } else if (error.includes('fallback')) {
      patterns['fallback-used'] = (patterns['fallback-used'] || 0) + 1;
    } else if (error.includes('parse') || error.includes('JSON')) {
      patterns['parse-error'] = (patterns['parse-error'] || 0) + 1;
    } else {
      patterns['other'] = (patterns['other'] || 0) + 1;
    }
  });
  
  return patterns;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  };

  try {
    // Validate authentication
    if (!validateAdmin(context.request, context.env)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Unauthorized - invalid or missing admin token'
        }),
        { status: 401, headers: corsHeaders }
      );
    }

    // Check if KV namespace is available
    if (!context.env.WORKER_CALL_LOGS) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'WORKER_CALL_LOGS KV namespace not configured',
          hint: 'Add KV binding in Cloudflare Dashboard: Pages > Settings > Functions > Bindings'
        }),
        { status: 503, headers: corsHeaders }
      );
    }

    // Parse query parameters
    const url = new URL(context.request.url);
    const limit = parseInt(url.searchParams.get('limit') || '100', 10);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);

    // List all log keys from KV
    const listResult = await context.env.WORKER_CALL_LOGS.list({
      limit: Math.min(limit + offset, 1000) // KV list max is 1000
    });

    // Fetch individual logs (in parallel batches)
    const logKeys = listResult.keys
      .slice(offset, offset + limit)
      .map(k => k.name);

    const logPromises = logKeys.map(key => 
      context.env.WORKER_CALL_LOGS!.get(key, 'json')
    );
    
    const logs = (await Promise.all(logPromises)).filter(Boolean) as WorkerCallLog[];

    // Sort by timestamp (newest first)
    logs.sort((a, b) => b.timestamp - a.timestamp);

    // Calculate aggregated stats
    const totalCalls = logs.length;
    const successfulCalls = logs.filter(c => c.success).length;
    const failedCalls = logs.filter(c => !c.success).length;
    const successRate = totalCalls > 0 ? (successfulCalls / totalCalls) * 100 : 0;
    const avgLatency = totalCalls > 0
      ? logs.reduce((sum, c) => sum + c.latencyMs, 0) / totalCalls
      : 0;

    const errorPatterns = analyzeErrorPatterns(logs);

    const response: WorkerCallsResponse = {
      success: true,
      totalCalls,
      successRate,
      avgLatency,
      successfulCalls,
      failedCalls,
      calls: logs,
      errorPatterns,
      lastUpdated: Date.now()
    };

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Admin API] Error fetching worker call logs:', errorMessage);

    return new Response(
      JSON.stringify({
        success: false,
        error: `Failed to fetch worker call logs: ${errorMessage}`
      }),
      { status: 500, headers: corsHeaders }
    );
  }
};

// Handle CORS preflight
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
