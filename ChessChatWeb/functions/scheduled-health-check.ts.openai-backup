// Cloudflare Scheduled Worker: Recurring Health Checks
// This runs on a schedule (cron) to monitor service health

export interface Env {
  OPENAI_API_KEY: string;
  HEALTH_CHECK_WEBHOOK?: string; // Optional webhook URL for alerts
}

interface ScheduledEvent {
  scheduledTime: number;
  cron: string;
}

// This function runs on a schedule defined in wrangler.toml
export default {
  async scheduled(
    event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    console.log(`Health check triggered at ${new Date(event.scheduledTime).toISOString()}`);
    console.log(`Cron: ${event.cron}`);

    try {
      // Perform health check
      const healthCheckResult = await performHealthCheck(env);

      // Log results
      console.log('Health check result:', JSON.stringify(healthCheckResult, null, 2));

      // Send alert if unhealthy
      if (healthCheckResult.status === 'unhealthy' || healthCheckResult.status === 'degraded') {
        await sendAlert(env, healthCheckResult);
      }

      // If healthy but was previously unhealthy, log recovery
      if (healthCheckResult.status === 'healthy') {
        console.log('✅ Service is healthy');
      }
    } catch (error) {
      console.error('Health check failed:', error);
      
      // Send critical alert
      await sendAlert(env, {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    }
  },
};

// Perform comprehensive health check
async function performHealthCheck(env: Env): Promise<any> {
  const checks: any = {
    timestamp: new Date().toISOString(),
    apiKey: !!env.OPENAI_API_KEY,
    openAI: false,
    status: 'healthy',
    errors: [],
  };

  // Test OpenAI connectivity
  if (checks.apiKey) {
    try {
      const openAIResponse = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        },
        signal: AbortSignal.timeout(10000), // 10s timeout
      });

      checks.openAI = openAIResponse.ok;
      
      if (!openAIResponse.ok) {
        checks.errors.push(`OpenAI API returned ${openAIResponse.status}`);
        checks.status = 'degraded';
      }
    } catch (error) {
      checks.openAI = false;
      checks.errors.push(`OpenAI connectivity failed: ${error instanceof Error ? error.message : 'Unknown'}`);
      checks.status = 'degraded';
    }
  } else {
    checks.errors.push('OpenAI API key not configured');
    checks.status = 'unhealthy';
  }

  return checks;
}

// Send alert via webhook or logging
async function sendAlert(env: Env, healthResult: any): Promise<void> {
  const alertMessage = {
    service: 'ChessChat Web',
    alert: 'Health check alert',
    status: healthResult.status,
    timestamp: healthResult.timestamp,
    details: healthResult,
  };

  console.error('🚨 ALERT:', JSON.stringify(alertMessage, null, 2));

  // Send to webhook if configured
  if (env.HEALTH_CHECK_WEBHOOK) {
    try {
      await fetch(env.HEALTH_CHECK_WEBHOOK, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(alertMessage),
      });
      console.log('Alert sent to webhook');
    } catch (error) {
      console.error('Failed to send webhook alert:', error);
    }
  }
}
