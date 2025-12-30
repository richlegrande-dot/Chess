# Option B Deployment Guide: Native Stockfish HTTP Server

**Status**: Ready for deployment  
**Implementation**: Complete  
**Timeline**: 2-4 hours for deployment and testing

## Overview

This guide walks through deploying the Stockfish HTTP server (Option B) with the Cloudflare Worker API integration.

**What was implemented:**
- ✅ Standalone HTTP server (`stockfish-server/server.js`)
- ✅ Worker API integration (`worker-api/src/stockfish.ts`)
- ✅ Docker configuration for production deployment
- ✅ Test suite for validation
- ✅ Complete deployment documentation

## Architecture

```
┌─────────────────┐
│  Cloudflare     │
│  Worker API     │
│  (chess moves)  │
└────────┬────────┘
         │ HTTP
         │ fetch()
         ▼
┌─────────────────┐
│   Stockfish     │
│  HTTP Server    │
│  (Node.js)      │
└────────┬────────┘
         │
         ▼
   Native Stockfish
   Binary/Engine
```

## Prerequisites

1. **Server Environment** (Choose one):
   - VPS/Cloud instance (DigitalOcean, AWS, GCP, etc.)
   - Cloudflare Durable Objects (custom setup)
   - Railway.app, Render.com, or Fly.io
   - Your own server with public IP

2. **Software Requirements**:
   - Node.js 18+ installed
   - npm or yarn
   - (Optional) Docker for containerized deployment

3. **Cloudflare Account**:
   - Workers access
   - Domain configured

## Step 1: Deploy Stockfish HTTP Server

### Option A: Direct Node.js Deployment

```bash
# Navigate to server directory
cd ChessChatWeb/stockfish-server

# Install dependencies
npm install

# Set environment variables
$env:PORT = "3001"
$env:STOCKFISH_API_KEY = "your-secure-api-key-here"  # Generate a strong random key

# Test locally first
npm start

# In another terminal, run tests
node test-server.js
```

If tests pass, the server is ready for production deployment.

### Option B: Docker Deployment (Recommended for Production)

```bash
# Navigate to server directory
cd ChessChatWeb/stockfish-server

# Build Docker image
docker build -t stockfish-server:latest .

# Run with Docker Compose
docker-compose up -d

# Check logs
docker-compose logs -f

# Run tests
node test-server.js
```

### Option C: Deploy to Cloud Platform

**Railway.app** (Easiest):
```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Initialize project
railway init

# Set environment variables
railway variables set PORT=3001
railway variables set STOCKFISH_API_KEY=your-secure-key

# Deploy
railway up
```

**Render.com**:
1. Create new "Web Service"
2. Connect GitHub repo
3. Set build command: `npm install`
4. Set start command: `node server.js`
5. Add environment variables:
   - `PORT=3001`
   - `STOCKFISH_API_KEY=your-secure-key`

**Fly.io**:
```bash
# Install flyctl
# See: https://fly.io/docs/hands-on/install-flyctl/

# Login
fly auth login

# Initialize app
fly launch --dockerfile Dockerfile

# Set secrets
fly secrets set STOCKFISH_API_KEY=your-secure-key

# Deploy
fly deploy
```

## Step 2: Configure Cloudflare Worker

### 2.1 Add Secrets to Worker

```bash
# Navigate to worker-api directory
cd ChessChatWeb/worker-api

# Add Stockfish server URL (use your deployed server URL)
npx wrangler secret put STOCKFISH_SERVER_URL
# Enter: https://your-stockfish-server.com (or http://IP:3001 for VPS)

# Add API key (same key you set on server)
npx wrangler secret put STOCKFISH_API_KEY
# Enter: your-secure-api-key-here
```

### 2.2 Update wrangler.toml (if not already done)

The `wrangler.toml` should already be configured from previous work. Verify these vars exist:

```toml
[vars]
ENVIRONMENT = "production"

# Secrets (set via wrangler secret put):
# - STOCKFISH_SERVER_URL
# - STOCKFISH_API_KEY
# - DATABASE_URL
```

### 2.3 Update Worker Code to Use New Stockfish Integration

The `worker-api/src/index-new.ts` needs to instantiate `StockfishEngine` with environment variables:

```typescript
import { StockfishEngine, type StockfishEnv } from './stockfish';

// Inside your Worker's fetch handler
const stockfish = new StockfishEngine({
  STOCKFISH_SERVER_URL: env.STOCKFISH_SERVER_URL,
  STOCKFISH_API_KEY: env.STOCKFISH_API_KEY
} as StockfishEnv);
```

## Step 3: Deploy Worker API

```bash
# From worker-api directory
cd ChessChatWeb/worker-api

# Test locally first (requires wrangler dev and secrets)
npx wrangler dev

# Deploy to production
npx wrangler deploy
```

## Step 4: Test Production Integration

### 4.1 Test Stockfish Server Health

```bash
# Test server health
curl https://your-stockfish-server.com/health

# Expected response:
# {"status":"healthy","service":"stockfish-server","version":"1.0.0","timestamp":"..."}
```

### 4.2 Test Direct Server API

```bash
# Test compute move endpoint
curl -X POST https://your-stockfish-server.com/compute-move \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-secure-api-key-here" \
  -d '{
    "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    "cpuLevel": 5
  }'

# Expected response:
# {"success":true,"move":"e2e4","cpuLevel":5,"computeTimeMs":250,"timestamp":"..."}
```

### 4.3 Test Worker API Integration

```bash
# Test via Worker API
curl -X POST https://your-domain.com/api/chess-move \
  -H "Content-Type: application/json" \
  -d '{
    "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    "cpuLevel": 5,
    "mode": "vs-cpu"
  }'

# Expected response:
# {"success":true,"move":"e2e4","source":"stockfish","cpuLevel":5,"evaluation":0.2,...}
```

## Step 5: Monitoring and Health Checks

### Set Up Monitoring

1. **Uptime Monitoring**:
   - Use UptimeRobot, Pingdom, or StatusCake
   - Monitor: `https://your-stockfish-server.com/health`
   - Alert on: Status code != 200

2. **Cloudflare Workers Analytics**:
   - Monitor Worker API `/api/chess-move` endpoint
   - Track success rate, latency, errors

3. **Server Logs**:
   ```bash
   # For Docker deployment
   docker-compose logs -f stockfish-server
   
   # For Railway/Render/Fly
   # Use platform's log viewer
   ```

### Health Check Queries

```bash
# Worker API health
curl https://your-domain.com/api/admin/health

# Stockfish server health
curl https://your-stockfish-server.com/health
```

## Troubleshooting

### Issue: Worker can't connect to Stockfish server

**Symptoms**: 
```json
{"success":false,"errorCode":"STOCKFISH_UNAVAILABLE","error":"Failed to connect to Stockfish server"}
```

**Solutions**:
1. Verify server is running: `curl https://your-stockfish-server.com/health`
2. Check `STOCKFISH_SERVER_URL` secret is set correctly in Worker
3. Ensure server allows connections from Cloudflare IPs
4. Check API key matches on both sides

### Issue: Unauthorized errors

**Symptoms**:
```json
{"error":"Missing or invalid authorization header"}
```

**Solutions**:
1. Verify `STOCKFISH_API_KEY` secret matches on both Worker and server
2. Check the key doesn't have extra spaces or newlines
3. Re-set secrets:
   ```bash
   npx wrangler secret put STOCKFISH_API_KEY
   ```

### Issue: Slow move computation

**Symptoms**: Moves taking >5 seconds

**Solutions**:
1. Check server CPU resources (may need larger instance)
2. Reduce CPU levels for testing
3. Monitor server logs for bottlenecks
4. Consider scaling server (more CPU cores)

### Issue: Server crashes or restarts

**Solutions**:
1. Check server logs for errors
2. Ensure sufficient memory (minimum 512MB recommended)
3. Verify Stockfish binary is installed (for Docker)
4. Check for memory leaks (restart server periodically)

## Performance Optimization

### Server Scaling

For high traffic:
1. **Horizontal Scaling**: Run multiple Stockfish servers behind a load balancer
2. **Vertical Scaling**: Use larger instance with more CPU cores
3. **Caching**: Cache common positions (starting position, book moves)

### Worker Optimization

```typescript
// Add timeout to prevent long-running requests
const STOCKFISH_TIMEOUT_MS = 5000;

const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), STOCKFISH_TIMEOUT_MS);

try {
  const response = await fetch(computeUrl, {
    ...options,
    signal: controller.signal
  });
} finally {
  clearTimeout(timeoutId);
}
```

## Cost Estimate

**Stockfish Server**:
- Railway.app: $5-10/month (Hobby plan)
- Render.com: $7/month (Starter)
- Fly.io: ~$5-15/month (shared-cpu-1x)
- DigitalOcean VPS: $6/month (1GB RAM)

**Cloudflare Workers**:
- Free tier: 100,000 requests/day
- Paid: $5/month for 10M requests

**Total**: ~$10-20/month for moderate traffic

## Security Checklist

- [ ] Strong API key generated (32+ characters, random)
- [ ] API key stored as Cloudflare Worker secret (not in code)
- [ ] Server only accepts requests with valid API key
- [ ] Server uses HTTPS (if public)
- [ ] Server firewall configured (only allow ports 80, 443, 3001)
- [ ] Rate limiting enabled (optional, for public servers)
- [ ] Server logs reviewed for suspicious activity

## Next Steps

After successful deployment:

1. **Update Frontend**:
   - Ensure frontend calls `/api/chess-move` (not old endpoints)
   - Test all game modes (vs-cpu, coaching)

2. **Enable Learning Pipeline**:
   - Follow Phase 2 implementation guide
   - Add post-game analysis using Stockfish `/analyze` endpoint

3. **Monitor Performance**:
   - Set up alerts for server downtime
   - Track move computation times
   - Monitor error rates

## Rollback Plan

If issues occur:

1. **Keep old system running** until new system is verified
2. **Switch back**: Change `STOCKFISH_SERVER_URL` to point to fallback
3. **Emergency**: Deploy old Worker code:
   ```bash
   cd worker-api
   npx wrangler rollback
   ```

## Success Criteria

- [ ] Stockfish server health endpoint responds 200
- [ ] Server test suite passes (all tests green)
- [ ] Worker API can compute moves via Stockfish server
- [ ] Move computation time < 2 seconds for CPU level 5
- [ ] Error rate < 1% over 24 hours
- [ ] Frontend chess games work end-to-end

## Support

**Documentation**:
- See [ARCHITECTURE_STOCKFISH_AI_LEARNING.md](./ARCHITECTURE_STOCKFISH_AI_LEARNING.md) for architecture overview
- See [DEPLOYMENT_STATUS_STOCKFISH_OPTIONS.md](./DEPLOYMENT_STATUS_STOCKFISH_OPTIONS.md) for Option A vs B comparison

**Code Files**:
- Stockfish server: `stockfish-server/server.js`
- Worker integration: `worker-api/src/stockfish.ts`
- Test suite: `stockfish-server/test-server.js`

---

**Deployment Status**: ✅ Ready to deploy  
**Last Updated**: December 29, 2025  
**Option**: B (Native Stockfish HTTP Server)
