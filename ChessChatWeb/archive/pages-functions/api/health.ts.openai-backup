// Cloudflare Pages Function: Health Check and Status Monitoring
// Path: /api/health

import { getDbHealth, checkDbHealth } from '../lib/db';
import { initializeDatabase } from '../lib/dbMiddleware';

interface Env {
  OPENAI_API_KEY: string;
  DATABASE_URL: string;
}

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  checks: {
    apiKey: boolean;
    database: boolean;
    openAIConnectivity?: boolean;
  };
  database?: {
    dbReady: boolean;
    lastPing: Date | null;
    lastError: string | null;
    failureCount: number;
    latencyMs: number | null;
    consecutiveFailures: number;
  };
  circuitBreakers: {
    chessMove: {
      state: string;
      failures: number;
      lastFailureTime: number | null;
    };
    chat: {
      state: string;
      failures: number;
      lastFailureTime: number | null;
    };
  };
  metrics?: {
    chessMove: {
      totalRequests: number;
      successfulRequests: number;
      failedRequests: number;
      successRate: string;
      averageResponseTime: string;
    };
    chat: {
      totalRequests: number;
      successfulRequests: number;
      failedRequests: number;
      successRate: string;
      averageResponseTime: string;
    };
  };
  recommendations?: string[];
}

// Track when the worker started (per-instance)
const startTime = Date.now();

// GET endpoint for health checks
export async function onRequestGet(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  const now = Date.now();
  const uptime = now - startTime;
  
  const url = new URL(context.request.url);
  
  // Initialize database before checking health
  let dbInitError: string | null = null;
  try {
    if (context.env.DATABASE_URL) {
      await initializeDatabase(context.env);
    } else {
      dbInitError = 'DATABASE_URL not found in environment';
      console.error('[Health] DATABASE_URL environment variable is missing');
    }
  } catch (error) {
    dbInitError = (error as Error).message;
    console.error('[Health] Failed to initialize database:', error);
  }
  
  // Check database health
  let dbHealth;
  try {
    dbHealth = await checkDbHealth();
  } catch (error) {
    console.error('[Health] Database health check failed:', error);
    dbHealth = getDbHealth();
  }
  
  const checks = {
    apiKey: !!context.env.OPENAI_API_KEY,
    database: dbHealth.dbReady,
    openAIConnectivity: undefined as boolean | undefined,
  };

  // Optional: Test OpenAI connectivity (only if requested)
  const testConnectivity = url.searchParams.get('test') === 'true';

  if (testConnectivity && checks.apiKey) {
    try {
      const testResponse = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${context.env.OPENAI_API_KEY}`,
        },
        signal: AbortSignal.timeout(5000), // 5s timeout
      });
      checks.openAIConnectivity = testResponse.ok;
    } catch (error) {
      console.error('OpenAI connectivity check failed:', error);
      checks.openAIConnectivity = false;
    }
  }

  // Import circuit breaker states from chess-move and chat functions
  // Note: These are per-worker instance and reset on cold start
  const circuitBreakers = {
    chessMove: {
      state: 'UNKNOWN (per-instance)',
      failures: 0,
      lastFailureTime: null as number | null,
    },
    chat: {
      state: 'UNKNOWN (per-instance)',
      failures: 0,
      lastFailureTime: null as number | null,
    },
  };

  // Determine overall health status
  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  const recommendations: string[] = [];

  if (!checks.apiKey) {
    status = 'degraded';
    recommendations.push('Configure OPENAI_API_KEY environment variable (optional for baseline coach)');
  }

  if (!checks.database) {
    status = 'unhealthy';
    const errorMsg = dbInitError || dbHealth.lastError || 'Database is not ready';
    recommendations.push(`Database error: ${errorMsg}. Check DATABASE_URL and connection.`);
  }

  if (dbHealth.consecutiveFailures > 0) {
    status = 'degraded';
    recommendations.push(`Database health check failures: ${dbHealth.consecutiveFailures}. Last error: ${dbHealth.lastError}`);
  }

  if (checks.openAIConnectivity === false) {
    status = 'degraded';
    recommendations.push('OpenAI API connectivity issues detected. Check API key validity.');
  }

  const healthStatus: HealthStatus = {
    status,
    timestamp: new Date().toISOString(),
    uptime,
    checks,
    database: dbHealth,
    circuitBreakers,
    recommendations: recommendations.length > 0 ? recommendations : undefined,
  };

  // Include detailed metrics if requested
  if (url.searchParams.get('metrics') === 'true') {
    healthStatus.metrics = {
      chessMove: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        successRate: 'N/A (metrics are per-instance)',
        averageResponseTime: 'N/A',
      },
      chat: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        successRate: 'N/A (metrics are per-instance)',
        averageResponseTime: 'N/A',
      },
    };
  }

  const httpStatus = status === 'healthy' ? 200 : status === 'degraded' ? 200 : 503;

  return new Response(JSON.stringify(healthStatus, null, 2), {
    status: httpStatus,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}

// POST endpoint for manual recovery trigger
export async function onRequestPost(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  try {
    const body = await context.request.json() as { action?: string };

    if (body.action === 'reset-circuit-breakers') {
      // Note: Circuit breakers are in-memory per function
      // This endpoint acknowledges the request but actual reset happens per-instance
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Circuit breaker reset acknowledged. Each function instance will reset on next cold start.',
          note: 'Circuit breakers are per-instance and reset automatically after timeout.',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Unknown action. Supported actions: reset-circuit-breakers',
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
