# Self-Healing Quick Reference

## 🚨 Common Scenarios & Auto-Recovery

### Scenario 1: Rate Limit Hit (429 Error)

**What Happens:**
1. Request fails with 429 status
2. System detects rate limit
3. Waits 1 second, retries
4. If still fails, waits 2 seconds, retries
5. If still fails, waits 4 seconds, final retry
6. Returns success or failure with retry info

**User Impact:** 
- Slightly longer response time (up to ~7 seconds)
- Transparent recovery - no action needed

**Response Example:**
```json
{
  "success": true,
  "move": "e2e4",
  "retryCount": 2,
  "recoveryAction": "Recovered after 2 retries"
}
```

---

### Scenario 2: OpenAI Service Down (500+ Errors)

**What Happens:**
1. Multiple requests fail
2. Circuit breaker tracks failures
3. After 5 failures, circuit opens
4. New requests immediately rejected (503)
5. After 60 seconds, circuit tests recovery
6. If 2 successful requests, circuit closes
7. Normal operation resumes

**User Impact:**
- First 5 users: Retry attempts (~7s each)
- Next users: Immediate rejection message
- After 60s: Automatic recovery testing
- Full recovery when service restored

**Circuit Open Response:**
```json
{
  "success": false,
  "error": "Circuit breaker OPEN. Service temporarily unavailable. Retry after 45s",
  "recoveryAction": "Service in recovery mode. Automatic healing in progress.",
  "circuitBreakerState": "OPEN"
}
```

---

### Scenario 3: Invalid Move from AI

**What Happens:**
1. AI returns move like "Knight to e4" instead of "g1e4"
2. System detects invalid UCI format
3. Records failure, increments circuit breaker
4. Client automatically retries same position
5. Eventually gets valid move

**User Impact:**
- Multiple retry attempts
- Eventually succeeds or suggests new game
- No manual intervention needed

---

### Scenario 4: Network Timeout

**What Happens:**
1. Request times out (30s default)
2. Retry logic kicks in
3. Exponential backoff applied
4. Up to 3 retry attempts

**User Impact:**
- Extended wait time (up to ~90 seconds)
- Automatic recovery on network restoration

---

## 🔍 Monitoring Commands

### Check Current Health
```bash
curl https://chesschat-web.pages.dev/api/health
```

### Test Full Connectivity
```bash
curl "https://chesschat-web.pages.dev/api/health?test=true"
```

### Get Detailed Metrics
```bash
curl "https://chesschat-web.pages.dev/api/health?metrics=true"
```

### Watch Logs (Cloudflare Dashboard)
1. Go to Workers & Pages > chesschat-web
2. Click "Logs" tab
3. Filter by:
   - `Circuit breaker:` - State changes
   - `Attempt` - Retry attempts
   - `Health check` - Scheduled checks
   - `ALERT` - Critical issues

---

## 📊 Circuit Breaker State Machine

```
┌──────────┐
│  CLOSED  │ ← Normal operation
└─────┬────┘
      │
      │ 5+ failures
      ▼
┌──────────┐
│   OPEN   │ ← Blocking requests (60s)
└─────┬────┘
      │
      │ After timeout
      ▼
┌──────────┐
│ HALF_OPEN│ ← Testing recovery
└─────┬────┘
      │
      ├─────────────┬─────────────┐
      │             │             │
2 successes    Any failure   Still working
      │             │             │
      ▼             ▼             ▼
  CLOSED         OPEN         HALF_OPEN
```

---

## 🎯 Response Codes & Meanings

| Code | Status | Circuit Breaker | Retry | User Action |
|------|--------|----------------|-------|-------------|
| 200 | ✅ Success | CLOSED | 0-3 | None - enjoy! |
| 400 | ❌ Bad Request | - | 0 | Check input |
| 401 | ❌ Auth Failed | - | 0 | Fix API key |
| 429 | ⚠️ Rate Limit | CLOSED | 1-3 | Wait ~7s |
| 500 | ❌ Server Error | +1 failure | 1-3 | Auto-retry |
| 503 | 🛑 Unavailable | OPEN | 0 | Wait 60s |

---

## 🔧 Configuration Tuning

### For High Traffic (Increase Tolerance)
```typescript
// functions/api/chess-move.ts
const CIRCUIT_BREAKER_THRESHOLD = 10;        // Was: 5
const MAX_RETRIES = 5;                       // Was: 3
const BASE_RETRY_DELAY = 2000;               // Was: 1000
```

### For Low Traffic (Faster Protection)
```typescript
const CIRCUIT_BREAKER_THRESHOLD = 3;         // Was: 5
const CIRCUIT_BREAKER_TIMEOUT = 30000;       // Was: 60000
const MAX_RETRIES = 2;                       // Was: 3
```

### Scheduled Health Check Frequency
```toml
# wrangler.toml
[triggers]
crons = ["*/15 * * * *"]   # Every 15 minutes (was: 5)
crons = ["0 * * * *"]      # Every hour
crons = ["*/1 * * * *"]    # Every minute (dev only!)
```

---

## 📱 Health Monitor Component

Add to your UI:

```tsx
import { HealthMonitor } from './components/HealthMonitor';

function App() {
  return (
    <div>
      <HealthMonitor />
      {/* Your other components */}
    </div>
  );
}
```

Features:
- Real-time health status
- Circuit breaker states
- Auto-refresh every 30s
- Visual status indicators

---

## 🚀 Testing Self-Healing

### 1. Test Circuit Breaker
```bash
# Make 6 rapid requests with invalid API key
for i in {1..6}; do
  curl -X POST https://chesschat-web.pages.dev/api/chess-move \
    -H "Content-Type: application/json" \
    -d '{"fen":"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1","pgn":"","model":"gpt-4o-mini"}'
done
```

**Expected:**
- First 5: Retry attempts + failure
- 6th: Immediate rejection (circuit OPEN)

### 2. Test Retry Logic
```bash
# Monitor in browser DevTools Network tab
# Look for multiple attempts on same request
```

### 3. Test Health Endpoint
```bash
# Should return healthy status
curl https://chesschat-web.pages.dev/api/health | jq
```

### 4. Monitor Scheduled Checks
```bash
# Check Cloudflare logs at :00, :05, :10, :15, etc.
# Look for: "Health check triggered at..."
```

---

## 🎓 Best Practices

### Development
✅ Test error scenarios locally  
✅ Monitor retry counts in DevTools  
✅ Check health endpoint regularly  
✅ Review Cloudflare logs  

### Production
✅ Set up health check webhook alerts  
✅ Monitor circuit breaker states  
✅ Track average retry counts  
✅ Adjust thresholds based on traffic  

### Debugging
✅ Check `/api/health` first  
✅ Review last 100 logs in Cloudflare  
✅ Look for circuit breaker state changes  
✅ Verify API key is set correctly  

---

## 📞 Support

- **Documentation**: [SELF_HEALING.md](./SELF_HEALING.md)
- **Deployment Guide**: [DEPLOYMENT.md](./DEPLOYMENT.md)
- **Comparison**: [COMPARISON.md](./COMPARISON.md)
- **OpenAI Status**: https://status.openai.com
- **Cloudflare Status**: https://www.cloudflarestatus.com

---

**Last Updated**: December 10, 2025  
**Version**: 1.0.0
