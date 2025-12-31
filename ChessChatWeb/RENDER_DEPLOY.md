# Render.com Deployment Guide - Stockfish Server

**Last Updated:** December 29, 2025  
**Service:** chesschat-stockfish  
**Runtime:** Node.js (Stockfish 16 native binary)

## Prerequisites

- GitHub repository with `ChessChatWeb/stockfish-server/` directory
- Render.com account (free tier sufficient for testing)
- Git commit access to main/master branch

## Quick Deploy (New Service)

### Step 1: Connect Repository

1. Visit https://dashboard.render.com/
2. Click **New +** → **Web Service**
3. Connect GitHub repository: `richlegrande-dot/Chess`
4. Or use Public Git URL: `https://github.com/richlegrande-dot/Chess`

### Step 2: Configure Service

**Basic Settings:**
- **Name:** `chesschat-stockfish`
- **Region:** `Oregon (US-West)` (or closest to your primary users)
- **Branch:** `main` or `master`
- **Root Directory:** `ChessChatWeb/stockfish-server` ⚠️ **CRITICAL**
- **Runtime:** `Node`
- **Build Command:** `npm install`
- **Start Command:** `node server.js`

**Plan:**
- Select `Free` for testing
- Or `Starter ($7/month)` for production (1GB RAM, no cold starts)

### Step 3: Environment Variables

Add the following **secrets** via Dashboard → Environment:

| Key | Value | Generate | Notes |
|-----|-------|----------|-------|
| `NODE_ENV` | `production` | No | Standard Node env |
| `PORT` | `3001` | No | Auto-set by Render, optional explicit |
| `STOCKFISH_API_KEY` | *Generate securely* | ✅ Yes | Must match Worker secret |
| `MAX_COMPUTE_TIME` | `3000` | No | Optional: Max engine time (ms) |

**Generate STOCKFISH_API_KEY:**
```bash
# Use a strong random key
openssl rand -hex 32
# Example: a1b2c3d4e5f6...
```

⚠️ **IMPORTANT:** Copy this key! You'll need it for the Cloudflare Worker.

### Step 4: Health Check

Configure auto-restart health check:
- **Health Check Path:** `/health`
- **Timeout:** `30 seconds`
- **Interval:** `60 seconds` (free tier) or `30 seconds` (paid)

### Step 5: Deploy

Click **Create Web Service**.

Render will:
1. Clone repository
2. Run `npm install` (triggers `postinstall` → `install-stockfish.js`)
3. Download Stockfish 16 binary from GitHub releases
4. Extract and chmod +x the binary
5. Start `node server.js`

**Expected Build Time:** 2-3 minutes (first deploy)

**Expected Log Output:**
```
╔════════════════════════════════════════════════════════════╗
║         Stockfish HTTP Server (Option B)                  ║
╠════════════════════════════════════════════════════════════╣
║  Port:        3001                                         ║
║  Status:      Running with REAL Stockfish                  ║
║  Health:      http://localhost:3001/health                 ║
║  Engine Pool: Max 2 concurrent engines                     ║
╠════════════════════════════════════════════════════════════╣
║  Endpoints:                                                ║
║  POST /compute-move  - Compute best move                   ║
║  POST /analyze       - Analyze position (MultiPV)          ║
╚════════════════════════════════════════════════════════════╝

✅ Real Stockfish engine integration active
✅ Structured JSON logging enabled
✅ X-Request-Id tracing enabled

Server ready to accept requests.
```

### Step 6: Verify Deployment

```bash
# Get your service URL from Render dashboard
# Example: https://chesschat-stockfish.onrender.com

# Test health endpoint (no auth required)
curl https://chesschat-stockfish.onrender.com/health

# Expected response:
{
  "status": "healthy",
  "service": "stockfish-server",
  "version": "1.0.0",
  "engines": { "active": 0, "max": 2 },
  "timestamp": "2025-12-29T10:15:30.123Z",
  "requestId": "abc123..."
}

# Test compute-move endpoint (requires auth)
curl -X POST https://chesschat-stockfish.onrender.com/compute-move \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_STOCKFISH_API_KEY" \
  -d '{
    "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    "cpuLevel": 5
  }'

# Expected response (within 1-2 seconds if warm):
{
  "success": true,
  "move": "e2e4",
  "uci": "e2e4",
  "san": "e4",
  "source": "stockfish",
  "diagnostics": {
    "cpuLevel": 5,
    "depth": 10,
    "skillLevel": 10,
    "engineMs": 654,
    "nodes": 45678,
    "evalCp": 15,
    "pv": "e2e4 e7e5 Ng1f3",
    ...
  },
  ...
}
```

## Configure Cloudflare Worker

After Render is live, configure the Worker to use it:

```bash
cd ChessChatWeb/worker-api

# Set Stockfish server URL
wrangler secret put STOCKFISH_SERVER_URL
# Enter: https://chesschat-stockfish.onrender.com

# Set API key (must match Render env var)
wrangler secret put STOCKFISH_API_KEY
# Enter: <the key from Step 3>

# Deploy Worker
npm run deploy
```

## render.yaml (Infrastructure as Code)

The service is defined in `ChessChatWeb/stockfish-server/render.yaml`:

```yaml
services:
  - type: web
    name: chesschat-stockfish
    runtime: node
    env: node
    region: oregon
    plan: free
    buildCommand: npm install
    startCommand: node server.js
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 3001
      - key: STOCKFISH_API_KEY
        generateValue: true
        sync: false
    healthCheckPath: /health
    autoDeploy: true
```

**Using render.yaml:**
1. **Option A:** Render auto-detects `render.yaml` on first deploy
2. **Option B:** Use Render Blueprint (advanced):
   ```bash
   # Deploy via render.yaml directly
   # Dashboard → New → Blueprint
   # Point to repository + select render.yaml
   ```

**Note:** `generateValue: true` for `STOCKFISH_API_KEY` means Render creates a random key. **You must copy it after first deploy and update the Worker secret.**

## File Structure

```
ChessChatWeb/stockfish-server/
├── server.js              # Main HTTP server
├── install-stockfish.js   # Build script (downloads Stockfish binary)
├── package.json           # Dependencies + scripts
├── render.yaml            # Render service definition
├── test-server.js         # Local testing script (optional)
└── stockfish              # Downloaded binary (not in Git, .gitignore)
```

## Local Development

### Prerequisites
- Node.js 18+
- Linux/macOS (Stockfish binary is Linux x86-64)

### Setup
```bash
cd ChessChatWeb/stockfish-server

# Install dependencies (auto-downloads Stockfish)
npm install

# Should see:
# 📥 Downloading Stockfish binary...
# 📦 Extracting Stockfish...
# ✅ Stockfish installed successfully

# Verify binary
ls -lh stockfish
# Should show executable permissions and ~40MB file

# Set local API key
export STOCKFISH_API_KEY=local-dev-key

# Start server
npm start
```

### Test Locally
```bash
# Terminal 1: Server running

# Terminal 2: Test
curl http://localhost:3001/health

curl -X POST http://localhost:3001/compute-move \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer local-dev-key" \
  -d '{"fen":"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1","cpuLevel":5}'
```

## Troubleshooting

### Issue: Build Fails - "Cannot find module 'chess.js'"

**Cause:** `npm install` failed or timed out

**Fix:**
```bash
# Check Render build logs for errors
# If timeout, try manual rebuild:
# Dashboard → Manual Deploy → Deploy Latest Commit
```

### Issue: Build Fails - "Could not find stockfish binary"

**Cause:** `install-stockfish.js` script failed during `postinstall`

**Fix:**
```bash
# Check build logs for download errors
# Possible causes:
# - GitHub releases URL changed
# - Network timeout
# - Tar extraction failed

# Manual verification:
cd ChessChatWeb/stockfish-server
node install-stockfish.js
# Should download + extract without errors
```

### Issue: Server Starts But /compute-move Returns 500

**Cause:** Stockfish binary not executable or wrong architecture

**Fix:**
```bash
# Check Render logs for:
# "Failed to spawn Stockfish: ..."

# Verify binary permissions
ls -l ChessChatWeb/stockfish-server/stockfish
# Should show: -rwxr-xr-x (executable)

# If wrong architecture (e.g., ARM instead of x86-64):
# Edit install-stockfish.js to download correct binary
```

### Issue: Cold Starts Take 60+ Seconds

**Expected Behavior:** Render free tier spins down after 15 minutes idle

**Options:**
1. **Enable keep-warm cron in Worker** (recommended for production)
   ```bash
   # See ARCHITECTURE_STOCKFISH_RENDER.md
   ```

2. **Upgrade to Render Starter plan** ($7/month, no spin-down)

3. **Accept cold starts** (free tier tradeoff)

### Issue: Memory Exhaustion (OOM)

**Symptoms:** Render logs show "Out of memory" or service restarts frequently

**Diagnosis:**
```bash
# Check Render metrics
# Dashboard → chesschat-stockfish → Metrics
# Look for memory spikes to 512MB
```

**Fix:**
```bash
# Option A: Reduce MAX_ENGINES
# Edit server.js:
const MAX_ENGINES = 1; // Down from 2

# Commit + push
git add ChessChatWeb/stockfish-server/server.js
git commit -m "Reduce engine pool for memory"
git push

# Option B: Upgrade to Starter plan (1GB RAM)
```

### Issue: 401 Unauthorized on All Requests

**Cause:** STOCKFISH_API_KEY mismatch or missing

**Fix:**
```bash
# Verify Render env var
# Dashboard → Environment → STOCKFISH_API_KEY
# Should be set and not empty

# Verify Worker secret matches
cd ChessChatWeb/worker-api
wrangler secret put STOCKFISH_API_KEY
# Enter the SAME value from Render
```

## Deployment Best Practices

### 1. Use Environment-Specific Branches

```bash
# Production branch
git checkout main
git push origin main  # Auto-deploys to Render production

# Staging branch (optional)
git checkout staging
git push origin staging  # Deploy to separate Render service
```

### 2. Test Locally Before Deploy

```bash
cd ChessChatWeb/stockfish-server
npm install
npm start

# Run tests
npm test

# Only push if tests pass
git push
```

### 3. Monitor Logs After Deploy

```bash
# Watch Render logs for 2-3 minutes after deploy
# Dashboard → Logs → Live tail

# Look for:
# ✅ "Server ready to accept requests"
# ✅ No repeated errors
# ⚠️ First request may be slow (engine spawn)
```

### 4. Blue-Green Deployment (Advanced)

```bash
# Create second Render service: chesschat-stockfish-v2
# Deploy new code to v2
# Test via direct URL
# Switch Worker STOCKFISH_SERVER_URL to v2
# Delete old service after 24 hours
```

## Cost Analysis

### Free Tier
- **Cost:** $0/month
- **Hours:** 750 hours/month (enough for 24/7 with margin)
- **Memory:** 512MB
- **Bandwidth:** 100GB/month
- **Cold Starts:** After 15 min idle
- **Best For:** Testing, low-traffic sites (<100 moves/day)

### Starter Tier ($7/month)
- **Memory:** 1GB (4 concurrent engines)
- **No cold starts:** Always warm
- **Same bandwidth:** 100GB/month
- **Best For:** Production sites (100-1000 moves/day)

### Pro Tier ($25/month)
- **Memory:** 2GB (8+ concurrent engines)
- **Autoscaling:** Horizontal scaling available
- **Priority support**
- **Best For:** High-traffic sites (1000+ moves/day)

## Migration from Free to Paid

```bash
# Dashboard → Settings → Change Plan → Select tier
# No code changes needed
# Service restarts automatically (30s downtime)

# Adjust MAX_ENGINES in server.js if upgrading to 1GB+:
const MAX_ENGINES = 4; // For Starter (1GB)
# or
const MAX_ENGINES = 8; // For Pro (2GB)

git push  # Triggers redeploy
```

## Auto-Deploy Configuration

Render auto-deploys on every push to `main` branch by default.

**To disable auto-deploy:**
```yaml
# render.yaml
autoDeploy: false
```

**Manual deploy:**
```bash
# Dashboard → Manual Deploy → Deploy Latest Commit
```

**Deploy-time environment variables:**
```bash
# Dashboard → Environment → Edit
# Changes trigger automatic redeploy
```

## Backup & Disaster Recovery

### Backup Strategy
- **Code:** Git repository (source of truth)
- **Binary:** Downloaded on each deploy (no backup needed)
- **Environment Variables:** Document in secure password manager

### Disaster Recovery
If Render service is deleted or account suspended:

```bash
# Option A: Redeploy to new Render service
# Follow "Quick Deploy" steps above

# Option B: Deploy to alternative platform
# - Railway.app
# - Fly.io
# - Self-hosted VPS (see VPS deployment guide)

# Update Worker secret
cd ChessChatWeb/worker-api
wrangler secret put STOCKFISH_SERVER_URL
# Enter new service URL
```

## Security Checklist

- ✅ STOCKFISH_API_KEY is strong random (32+ chars)
- ✅ API key is NOT in Git repository
- ✅ API key matches Worker secret exactly
- ✅ Health endpoint is public (no sensitive data)
- ✅ Compute endpoints require Bearer auth
- ✅ Logs do not contain API keys
- ✅ CORS is restrictive (only chesschat.uk in production)

## Performance Tuning

### Reduce Latency
```javascript
// server.js CPU_CONFIG
// Reduce movetime for levels 1-5:
1: { depth: 4, movetime: 100, skillLevel: 0 },  // Was 150ms
2: { depth: 6, movetime: 150, skillLevel: 3 },  // Was 200ms
// Tradeoff: Faster response, slightly weaker moves
```

### Increase Throughput
```javascript
// server.js
const MAX_ENGINES = 3; // Up from 2 (requires 1GB+ RAM)
```

### Enable Request Queuing (Advanced)
```javascript
// server.js - add queue system
const requestQueue = [];
const MAX_QUEUE_SIZE = 10;

async function getEngine() {
  // ... existing code ...
  
  // If pool full, queue request
  if (requestQueue.length < MAX_QUEUE_SIZE) {
    return new Promise((resolve) => {
      requestQueue.push(resolve);
    });
  } else {
    throw new Error('Server overloaded');
  }
}
```

## Related Documentation

- [ARCHITECTURE_STOCKFISH_RENDER.md](./ARCHITECTURE_STOCKFISH_RENDER.md) - System architecture
- [OPERATIONS_RUNBOOK.md](./OPERATIONS_RUNBOOK.md) - Operations & troubleshooting
- [CLOUDFLARE_WORKER_SETUP.md](./CLOUDFLARE_WORKER_SETUP.md) - Worker configuration

## Support

- **Render Docs:** https://render.com/docs
- **Render Support:** https://render.com/docs/support
- **Stockfish UCI Protocol:** https://www.chessprogramming.org/UCI
- **Repository Issues:** https://github.com/richlegrande-dot/Chess/issues
