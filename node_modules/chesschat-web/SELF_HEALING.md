# Self-Healing Features Documentation

## Overview

ChessChat Web includes comprehensive self-healing capabilities to ensure reliable service even under adverse conditions. The system automatically detects, recovers from, and reports various failure scenarios.

## Core Self-Healing Components

### 1. Circuit Breaker Pattern 🔌

Prevents cascading failures by temporarily blocking requests when error rates are high.

#### States

- **CLOSED** (Normal operation)
  - All requests are processed normally
  - Failures increment the failure counter
  - After `CIRCUIT_BREAKER_THRESHOLD` (5) failures, transitions to OPEN

- **OPEN** (Service protection mode)
  - Requests are immediately rejected with 503 status
  - Prevents overwhelming a failing downstream service
  - After `CIRCUIT_BREAKER_TIMEOUT` (60 seconds), transitions to HALF_OPEN

- **HALF_OPEN** (Recovery testing)
  - Limited requests are allowed through to test service recovery
  - After `CIRCUIT_BREAKER_HALF_OPEN_SUCCESS_THRESHOLD` (2) consecutive successes, transitions to CLOSED
  - Any failure immediately returns to OPEN state

#### Configuration

```typescript
const CIRCUIT_BREAKER_THRESHOLD = 5;              // Failures before opening
const CIRCUIT_BREAKER_TIMEOUT = 60000;            // 1 minute in OPEN state
const CIRCUIT_BREAKER_HALF_OPEN_SUCCESS_THRESHOLD = 2;  // Successes to close
```

#### Per-Endpoint Circuit Breakers

- **Chess Move Endpoint** (`/api/chess-move`)
  - Independent circuit breaker
  - Protects AI move generation
  
- **Chat Endpoint** (`/api/chat`)
  - Independent circuit breaker
  - Protects post-game analysis

### 2. Retry Logic with Exponential Backoff 🔄

Automatically retries failed requests with increasing delays.

#### Configuration

```typescript
const MAX_RETRIES = 3;              // Maximum retry attempts
const BASE_RETRY_DELAY = 1000;      // Base delay: 1 second
```

#### Retry Schedule

1. **First attempt**: Immediate
2. **Retry 1**: After 1 second (1s × 2^0)
3. **Retry 2**: After 2 seconds (1s × 2^1)
4. **Retry 3**: After 4 seconds (1s × 2^2)

**Total retry time**: ~7 seconds maximum

#### Error-Specific Recovery

Different error types trigger different recovery actions:

```typescript
// Rate Limit (429)
recoveryAction: 'Rate limit exceeded. Retrying with exponential backoff.'

// Service Error (500-599)
recoveryAction: 'OpenAI service error. Retrying request automatically.'

// Authentication Error (401)
recoveryAction: 'Authentication failed. Check API key configuration.'

// Bad Request (400)
recoveryAction: 'Invalid request. Check model availability.'
```

### 3. Health Monitoring 🏥

Continuous monitoring of service health with automatic reporting.

#### Health Check Endpoint

**GET** `/api/health`

Returns current service status:

```json
{
  "status": "healthy | degraded | unhealthy",
  "timestamp": "2025-12-10T10:30:00.000Z",
  "uptime": 3600000,
  "checks": {
    "apiKey": true,
    "openAIConnectivity": true
  },
  "circuitBreakers": {
    "chessMove": {
      "state": "CLOSED",
      "failures": 0,
      "lastFailureTime": null
    },
    "chat": {
      "state": "CLOSED",
      "failures": 0,
      "lastFailureTime": null
    }
  },
  "recommendations": []
}
```

#### Query Parameters

- `?test=true` - Test OpenAI connectivity (adds 5s to response time)
- `?metrics=true` - Include detailed metrics (per-instance)

#### Status Codes

- **200 OK**: Service is healthy or degraded (still functional)
- **503 Service Unavailable**: Service is unhealthy (critical issues)

### 4. Scheduled Health Checks ⏰

Automated health checks run every 5 minutes via Cloudflare Cron Triggers.

#### Configuration (wrangler.toml)

```toml
[triggers]
crons = ["*/5 * * * *"]  # Every 5 minutes
```

#### What It Checks

1. ✅ API key configuration
2. ✅ OpenAI API connectivity
3. ✅ Response times
4. ✅ Error rates

#### Alert Mechanism

When issues are detected:

1. **Log to Cloudflare Workers Logs**
   ```
   🚨 ALERT: Service status degraded
   ```

2. **Optional Webhook Notification**
   - Set `HEALTH_CHECK_WEBHOOK` environment variable
   - Receives POST with health status JSON

#### Customizing Schedule

Edit `wrangler.toml` triggers:

```toml
# Examples:
crons = ["*/5 * * * *"]    # Every 5 minutes
crons = ["*/15 * * * *"]   # Every 15 minutes
crons = ["0 * * * *"]      # Every hour
crons = ["0 0 * * *"]      # Daily at midnight
```

### 5. Automatic Error Recovery 🔧

The system automatically recovers from various failure scenarios.

#### Invalid Move Detection

When AI returns an invalid UCI move:

1. ❌ Move fails UCI validation
2. 🔄 Response includes `recoveryAction`
3. 🎯 Client automatically retries with same position
4. ✅ Eventually succeeds or reaches max retries

#### Rate Limit Handling

When OpenAI rate limits are hit:

1. ❌ Receives 429 status code
2. 🔄 Automatic retry with exponential backoff
3. ⏱️ Delays increase: 1s, 2s, 4s
4. ✅ Succeeds when rate limit window resets

#### Service Degradation

When OpenAI service has issues:

1. ❌ Receives 500+ status codes
2. 🔄 Automatic retry with backoff
3. 📊 Circuit breaker tracks failures
4. 🛡️ If failures persist, circuit opens to protect service
5. ⏰ After timeout, circuit tests recovery
6. ✅ Service automatically resumes when OpenAI recovers

## Response Format with Self-Healing Info

### Successful Response

```json
{
  "success": true,
  "move": "e2e4",
  "retryCount": 1,
  "responseTime": 1250,
  "recoveryAction": "Recovered after 1 retry",
  "circuitBreakerState": "CLOSED"
}
```

### Failed Response with Recovery Info

```json
{
  "success": false,
  "error": "Rate limit: 429",
  "retryCount": 3,
  "recoveryAction": "All retry attempts exhausted. Service will auto-recover.",
  "circuitBreakerState": "OPEN"
}
```

### Circuit Breaker Rejection

```json
{
  "success": false,
  "error": "Circuit breaker OPEN. Service temporarily unavailable. Retry after 45s",
  "recoveryAction": "Service in recovery mode. Automatic healing in progress.",
  "circuitBreakerState": "OPEN"
}
```

## Monitoring and Observability

### Cloudflare Dashboard

1. Navigate to **Workers & Pages** > **chesschat-web**
2. Click **Logs** tab (real-time)
3. Filter by:
   - `Circuit breaker:` - Circuit state changes
   - `Attempt` - Retry attempts
   - `Health check` - Scheduled checks
   - `ALERT` - Critical issues

### Log Patterns

**Circuit Breaker Transitions:**
```
Circuit breaker: CLOSED -> OPEN (5 failures)
Circuit breaker: OPEN -> HALF_OPEN (testing recovery)
Circuit breaker: HALF_OPEN -> CLOSED (service recovered)
Circuit breaker: HALF_OPEN -> OPEN (recovery failed)
```

**Retry Attempts:**
```
Attempt 1/4 failed: Error: Rate limit: 429
Retrying in 1000ms...
Attempt 2/4 failed: Error: Rate limit: 429
Retrying in 2000ms...
```

**Health Checks:**
```
Health check triggered at 2025-12-10T10:30:00.000Z
Health check result: { "status": "healthy", ... }
✅ Service is healthy
```

### Metrics Collection

Health metrics are tracked per-instance (reset on cold start):

- **Total Requests**: All incoming requests
- **Successful Requests**: Completed successfully
- **Failed Requests**: All failures (including after retries)
- **Success Rate**: `(successful / total) × 100%`
- **Average Response Time**: Mean response time in ms

Access metrics via health endpoint:
```bash
curl https://chesschat-web.pages.dev/api/health?metrics=true
```

## Configuration

### Environment Variables

```bash
# Required
OPENAI_API_KEY=sk-your-api-key-here

# Optional (for webhook alerts)
HEALTH_CHECK_WEBHOOK=https://your-webhook-url.com/alerts
```

### Tuning Self-Healing Behavior

Edit configuration constants in function files:

**Circuit Breaker** (`functions/api/chess-move.ts`, `functions/api/chat.ts`):
```typescript
const CIRCUIT_BREAKER_THRESHOLD = 5;              // Increase for more tolerance
const CIRCUIT_BREAKER_TIMEOUT = 60000;            // Increase for longer protection
const CIRCUIT_BREAKER_HALF_OPEN_SUCCESS_THRESHOLD = 2;  // Increase for safer recovery
```

**Retry Logic**:
```typescript
const MAX_RETRIES = 3;              // Increase for more retry attempts
const BASE_RETRY_DELAY = 1000;      // Increase for longer delays
```

**Health Check Schedule** (`wrangler.toml`):
```toml
[triggers]
crons = ["*/5 * * * *"]  # Adjust frequency
```

## Testing Self-Healing Features

### 1. Test Circuit Breaker

Simulate failures:

```bash
# Make 6 requests with invalid API key (triggers circuit breaker)
for i in {1..6}; do
  curl -X POST https://chesschat-web.pages.dev/api/chess-move \
    -H "Content-Type: application/json" \
    -d '{"fen":"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1","pgn":"","model":"gpt-4o-mini"}'
done
```

Expected behavior:
- First 5 requests: Fail with retry attempts
- 6th request: Immediate rejection with circuit breaker message

### 2. Test Retry Logic

Use a rate-limited scenario:

```bash
# Make rapid requests to trigger rate limiting
for i in {1..10}; do
  curl -X POST https://chesschat-web.pages.dev/api/chess-move \
    -H "Content-Type: application/json" \
    -d '{"fen":"rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1","pgn":"1. e4","model":"gpt-4o-mini"}' &
done
```

Check logs for retry attempts.

### 3. Test Health Check

```bash
# Basic health check
curl https://chesschat-web.pages.dev/api/health

# With connectivity test
curl https://chesschat-web.pages.dev/api/health?test=true

# With metrics
curl https://chesschat-web.pages.dev/api/health?metrics=true
```

### 4. Monitor Scheduled Checks

View logs in Cloudflare Dashboard:

1. Go to **Workers & Pages** > **chesschat-web**
2. Click **Logs** tab
3. Wait for next scheduled run (every 5 minutes)
4. Look for: `Health check triggered at...`

## Best Practices

### For Development

1. **Use Local Health Checks**
   ```bash
   npm run dev
   # In another terminal:
   curl http://localhost:3000/api/health
   ```

2. **Monitor Retry Behavior**
   - Check browser DevTools Network tab
   - Look for `retryCount` in responses

3. **Test Error Scenarios**
   - Temporarily use invalid API key
   - Make rapid requests to trigger rate limits

### For Production

1. **Set Up Webhook Alerts**
   ```bash
   wrangler pages secret put HEALTH_CHECK_WEBHOOK
   # Enter your webhook URL (e.g., Slack, Discord, PagerDuty)
   ```

2. **Monitor Cloudflare Logs**
   - Enable log retention in Cloudflare
   - Set up log streaming to external service

3. **Adjust Thresholds**
   - Start conservative, tune based on actual traffic
   - Higher threshold = more tolerance, slower reaction
   - Lower threshold = faster protection, more false positives

4. **Regular Health Checks**
   - Manually check `/api/health` periodically
   - Set up external monitoring (UptimeRobot, Pingdom)

## Troubleshooting

### Circuit Breaker Won't Close

**Symptoms**: Circuit stays OPEN even after timeout

**Causes**:
- OpenAI API still failing
- API key invalid
- Network issues

**Solutions**:
1. Check health endpoint: `/api/health?test=true`
2. Verify API key: `wrangler pages secret list`
3. Check OpenAI status: https://status.openai.com
4. Wait for automatic recovery (circuit will test every 60s)

### High Retry Counts

**Symptoms**: Every request retrying 2-3 times

**Causes**:
- Rate limits too low for traffic
- Network latency issues
- OpenAI service degradation

**Solutions**:
1. Upgrade OpenAI plan for higher rate limits
2. Reduce concurrent requests
3. Increase `BASE_RETRY_DELAY` to spread out retries
4. Check OpenAI status page

### Health Check Failing

**Symptoms**: Health endpoint returns "unhealthy"

**Causes**:
- Missing OPENAI_API_KEY
- Invalid API key
- OpenAI API down

**Solutions**:
1. Set API key: `wrangler pages secret put OPENAI_API_KEY`
2. Test API key manually with OpenAI CLI
3. Check recommendations in health response
4. Review Cloudflare logs for details

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Client Request                            │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │  Circuit Breaker     │
              │  Check               │
              └──────────┬───────────┘
                         │
                    OPEN │ CLOSED/HALF_OPEN
                         │
          ┌──────────────┴──────────────┐
          ▼                             ▼
    ┌──────────┐              ┌──────────────────┐
    │  Reject  │              │  Process Request │
    │  503     │              └────────┬─────────┘
    └──────────┘                       │
                                       ▼
                            ┌────────────────────┐
                            │  Retry Loop        │
                            │  (Max 3 attempts)  │
                            └────────┬───────────┘
                                     │
                        ┌────────────┼────────────┐
                        ▼            ▼            ▼
                   ┌─────────┐  ┌─────────┐  ┌─────────┐
                   │ Attempt │  │ Attempt │  │ Attempt │
                   │    1    │  │    2    │  │    3    │
                   └────┬────┘  └────┬────┘  └────┬────┘
                        │            │            │
                        └────────────┼────────────┘
                                     │
                        ┌────────────┴────────────┐
                        ▼                         ▼
                   ┌─────────┐              ┌──────────┐
                   │ Success │              │ Failure  │
                   │         │              │          │
                   │ Record  │              │ Record   │
                   │ Metrics │              │ Failure  │
                   └─────────┘              └──────────┘
```

## Summary

ChessChat Web's self-healing features provide:

✅ **Automatic failure recovery** via retry logic
✅ **Service protection** via circuit breakers
✅ **Continuous monitoring** via health checks
✅ **Proactive alerts** via scheduled checks
✅ **Detailed observability** via structured logging
✅ **Zero-downtime recovery** via graceful degradation

The system is designed to handle:
- OpenAI API rate limits
- Temporary service outages
- Network issues
- Invalid responses
- High traffic spikes

All without manual intervention! 🎯
