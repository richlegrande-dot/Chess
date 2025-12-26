/**
 * Health Check API Endpoint
 * 
 * Returns the health status of the application and its dependencies.
 * 
 * Endpoint: GET /api/health
 */

export async function onRequestGet(context) {
  const { env } = context;
  
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: env.ENVIRONMENT || 'unknown',
    checks: {}
  };
  
  // Check KV namespaces
  try {
    if (env.ANALYTICS_KV) {
      // Test write and read
      const testKey = '__health_check__';
      const testValue = Date.now().toString();
      await env.ANALYTICS_KV.put(testKey, testValue);
      const retrieved = await env.ANALYTICS_KV.get(testKey);
      
      health.checks.analytics_kv = {
        status: retrieved === testValue ? 'healthy' : 'degraded',
        message: 'Analytics KV namespace is accessible'
      };
      
      // Clean up test key
      await env.ANALYTICS_KV.delete(testKey);
    } else {
      health.checks.analytics_kv = {
        status: 'unavailable',
        message: 'Analytics KV namespace not bound'
      };
      health.status = 'degraded';
    }
  } catch (error) {
    health.checks.analytics_kv = {
      status: 'unhealthy',
      message: `Analytics KV error: ${error.message}`
    };
    health.status = 'unhealthy';
  }
  
  // Check rate limit KV
  try {
    if (env.RATE_LIMIT_KV) {
      const testKey = '__health_check__';
      const testValue = Date.now().toString();
      await env.RATE_LIMIT_KV.put(testKey, testValue);
      const retrieved = await env.RATE_LIMIT_KV.get(testKey);
      
      health.checks.rate_limit_kv = {
        status: retrieved === testValue ? 'healthy' : 'degraded',
        message: 'Rate limit KV namespace is accessible'
      };
      
      await env.RATE_LIMIT_KV.delete(testKey);
    } else {
      health.checks.rate_limit_kv = {
        status: 'unavailable',
        message: 'Rate limit KV namespace not bound'
      };
      health.status = 'degraded';
    }
  } catch (error) {
    health.checks.rate_limit_kv = {
      status: 'unhealthy',
      message: `Rate limit KV error: ${error.message}`
    };
    health.status = 'unhealthy';
  }
  
  // Check secrets (without exposing values)
  health.checks.secrets = {
    openai_configured: !!env.OPENAI_API_KEY,
    database_configured: !!env.DATABASE_URL,
    admin_configured: !!env.ADMIN_PASSWORD
  };
  
  if (!env.OPENAI_API_KEY || !env.DATABASE_URL || !env.ADMIN_PASSWORD) {
    health.checks.secrets.status = 'degraded';
    health.checks.secrets.message = 'Some secrets are not configured';
    if (health.status === 'healthy') {
      health.status = 'degraded';
    }
  } else {
    health.checks.secrets.status = 'healthy';
    health.checks.secrets.message = 'All required secrets are configured';
  }
  
  // Determine HTTP status code
  const statusCode = health.status === 'healthy' ? 200 : 
                     health.status === 'degraded' ? 200 : 503;
  
  return new Response(JSON.stringify(health, null, 2), {
    status: statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    }
  });
}
