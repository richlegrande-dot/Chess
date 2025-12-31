// Cloudflare Pages Function: Health Check and Status Monitoring
// Path: /api/health
// Wall-E System - No OpenAI required

import { getDbHealth, checkDbHealth, db } from '../lib/db';
import { initializeDatabase } from '../lib/dbMiddleware';

interface Env {
  DB?: D1Database;
  DATABASE_URL?: string;
}

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  checks: {
    database: boolean;
    walleEngine: boolean;
  };
  database?: {
    dbReady: boolean;
    lastPing: Date | null;
    lastError: string | null;
    failureCount: number;
    latencyMs: number | null;
    consecutiveFailures: number;
    dbType: string;
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
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  const now = Date.now();
  const uptime = now - startTime;
  
  const url = new URL(context.request.url);
  
  // Initialize database (optional)
  let dbInitError: string | null = null;
  try {
    await initializeDatabase(context.env);
  } catch (error) {
    dbInitError = error instanceof Error ? error.message : 'Database initialization failed';
    console.warn('[Health] Database not available:', dbInitError);
  }
  
  // Check database health
  let dbHealth;
  try {
    if (db.isAvailable()) {
      dbHealth = await checkDbHealth();
    } else {
      dbHealth = getDbHealth();
    }
  } catch (error) {
    console.error('[Health] Database health check failed:', error);
    dbHealth = getDbHealth();
  }
  
  const checks = {
    database: dbHealth.dbReady,
    walleEngine: true, // Wall-E is always available (no external dependencies)
  };

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

  if (!checks.database) {
    status = 'degraded'; // Degraded not unhealthy - Wall-E works without DB
    const errorMsg = dbInitError || dbHealth.lastError || 'Database is not ready';
    recommendations.push(`Database error: ${errorMsg}. Wall-E will work with general advice (no personalization).`);
  }

  if (dbHealth.consecutiveFailures > 0) {
    status = 'degraded';
    recommendations.push(`Database health check failures: ${dbHealth.consecutiveFailures}. Last error: ${dbHealth.lastError}`);
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
    headers: corsHeaders,
  });
}

// OPTIONS handler for CORS preflight
export async function onRequestOptions(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
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
