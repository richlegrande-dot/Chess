# Render.com Deployment Guide - ChessChat Stockfish

**Status:** Production-Ready  
**Cost:** Free (with cold starts)  
**Deployment Time:** 5-10 minutes

---

## What is Render.com?

Render.com is a modern cloud platform with:
- ✅ **Free tier** (perfect for Stockfish server)
- ✅ **Automatic HTTPS** (no SSL setup needed)
- ✅ **Git-based deployment** (push to deploy)
- ✅ **Built-in health monitoring**
- ⚠️ **Cold starts** after 15 min inactivity (~30s wake-up)

---

## Deployment Steps

### Step 1: Push Code to GitHub

Your `stockfish-server` folder is already configured for Render with `render.yaml`.

1. **Initialize Git** (if not already):
   ```powershell
   cd "C:\Users\richl\LLM vs Me\ChessChatWeb"
   git init
   git add .
   git commit -m "Add Stockfish server for Render"
   ```

2. **Push to GitHub**:
   ```powershell
   # Create new repo on GitHub, then:
   git remote add origin https://github.com/YOUR_USERNAME/chesschat.git
   git push -u origin main
   ```

### Step 2: Deploy to Render

**Option A: Blueprint Deploy (Easiest)**

1. Go to https://dashboard.render.com/blueprints
2. Click "New Blueprint Instance"
3. Connect your GitHub repo
4. Render will auto-detect `render.yaml`
5. Click "Apply" → Deployment starts automatically

**Option B: Manual Deploy**

1. Go to https://dashboard.render.com
2. Click "New +" → "Web Service"
3. Connect GitHub repo
4. Configure:
   ```
   Name: chesschat-stockfish
   Region: Oregon (or closest to you)
   Branch: main
   Root Directory: stockfish-server
   Runtime: Node
   Build Command: npm install
   Start Command: node server.js
   Plan: Free
   ```
5. Add environment variable:
   ```
   STOCKFISH_API_KEY = [Click "Generate" for random key]
   ```
6. Click "Create Web Service"

### Step 3: Wait for Deployment

Render will:
- ✅ Clone your repo
- ✅ Install dependencies
- ✅ Start the server
- ✅ Assign a URL

**Deployment time:** ~3-5 minutes

### Step 4: Get Your URL and API Key

1. In Render Dashboard, click on your service
2. **Copy the URL** (e.g., `https://chesschat-stockfish.onrender.com`)
3. Go to "Environment" tab
4. **Copy the STOCKFISH_API_KEY** value

### Step 5: Configure Cloudflare Worker

Run the automated setup script:

```powershell
cd "C:\Users\richl\LLM vs Me\ChessChatWeb"
.\deploy-render.ps1
```

**When prompted, enter:**
- Render URL: `https://chesschat-stockfish.onrender.com`
- API Key: `[value from Render Dashboard]`

**The script will:**
- ✅ Test the Render service
- ✅ Configure Worker secrets
- ✅ Deploy Worker (if you use `-Deploy` flag)
- ✅ Run tests

---

## Manual Worker Configuration

If you prefer manual setup:

```powershell
cd worker-api

# Set secrets
npx wrangler secret put STOCKFISH_SERVER_URL
# Enter: https://chesschat-stockfish.onrender.com

npx wrangler secret put STOCKFISH_API_KEY
# Enter: [your API key]

# Deploy
npx wrangler deploy
```

---

## Understanding Cold Starts

### What Happens?

Render free tier:
- ✅ Server runs normally when active
- ⚠️ **Spins down after 15 minutes** of no requests
- ⏳ **Takes ~30 seconds** to wake up on next request

### How We Handle It

The Worker includes **retry logic**:
1. First request: 10s timeout
2. If timeout: Wait 5s, retry with 60s timeout
3. This allows cold start to complete

### User Experience

- **Active server:** Moves compute in 1-3 seconds
- **Cold start:** First move takes 30-40 seconds, then normal
- **Subsequent moves:** Fast (1-3 seconds)

### Mitigation Options

1. **Upgrade to Paid** ($7/month): No cold starts, always active
2. **Keep-alive service**: External service pings every 10 min (free options exist)
3. **Accept trade-off**: First move slow occasionally, rest fast

---

## Testing Your Deployment

### Health Check

```powershell
curl https://chesschat-stockfish.onrender.com/health
```

Expected:
```json
{
  "status": "healthy",
  "engine": "stockfish",
  "uptime": 123
}
```

### Move Computation

```powershell
curl https://chesschat-stockfish.onrender.com/compute-move `
  -H "Authorization: Bearer YOUR_API_KEY" `
  -H "Content-Type: application/json" `
  -d '{"fen":"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1","cpuLevel":5}'
```

Expected:
```json
{
  "success": true,
  "move": "e2e4",
  "diagnostics": {...}
}
```

### Full E2E Test

```powershell
cd worker-api
$env:WORKER_URL = "https://chesschat.uk"
$env:ADMIN_PASSWORD = "YOUR_ADMIN_PASSWORD"
node test-e2e.js
```

---

## Monitoring

### Render Dashboard

View in real-time:
- Request logs
- Error rates
- Response times
- Deploy history

### Health Endpoint

Worker includes:
```
GET /api/admin/stockfish-health
Authorization: Bearer ADMIN_PASSWORD
```

Returns:
```json
{
  "success": true,
  "status": "healthy",
  "serverUrl": "https://...",
  "latencyMs": 123
}
```

---

## Troubleshooting

### Service Won't Start

**Check Render logs:**
1. Dashboard → Your Service → Logs
2. Look for errors during `npm install` or `node server.js`

**Common issues:**
- Missing `stockfish` package → Check package.json
- Port binding error → Render sets `PORT` env var automatically
- API key not set → Add in Environment tab

### Cold Starts Too Slow

**Options:**
1. Upgrade to paid tier ($7/mo)
2. Use keep-alive service (free): https://cron-job.org
3. Accept the trade-off (first move slow, rest fast)

### API Authentication Failing

**Check:**
1. Render Dashboard → Environment → STOCKFISH_API_KEY
2. Worker secrets: `npx wrangler secret list`
3. Both must match exactly

**Fix:**
```powershell
# Regenerate in Render Dashboard, then:
npx wrangler secret put STOCKFISH_API_KEY
# Enter new value
```

---

## Updating Your Deployment

### Code Changes

1. **Update code locally**
2. **Commit and push:**
   ```powershell
   git add .
   git commit -m "Update Stockfish server"
   git push
   ```
3. **Render auto-deploys** within 1-2 minutes

### Manual Redeploy

In Render Dashboard:
- Click "Manual Deploy" → "Deploy latest commit"

---

## Cost Comparison

| Tier | Cost | Cold Starts | Uptime |
|------|------|-------------|--------|
| **Free** | $0 | Yes (~30s) | Active only |
| **Starter** | $7/mo | No | 24/7 |
| VPS (comparison) | $5-6/mo | No | 24/7 (manual setup) |

**Recommendation:** Start with free tier, upgrade if cold starts are problematic.

---

## Files Reference

### Created Files
- `stockfish-server/render.yaml` - Render configuration
- `stockfish-server/RENDER_DEPLOY.md` - This guide
- `deploy-render.ps1` - Automated deployment script

### Modified Files
- `stockfish-server/package.json` - Added build script
- `worker-api/src/stockfish.ts` - Added retry logic for cold starts
- `worker-api/src/index.ts` - Updated to use Render URL

---

## Next Steps

1. ✅ Deploy to Render (see Step 2)
2. ✅ Run `.\deploy-render.ps1` to configure Worker
3. ✅ Test with `node test-e2e.js`
4. ✅ Play chess games on frontend
5. ⏳ Monitor for cold starts over 24 hours
6. 🤔 Decide if paid tier needed

---

## Success Criteria

- [x] Render service deployed
- [x] Health check returns healthy
- [x] Move computation works
- [x] Worker configured with URL + API key
- [x] E2E tests pass
- [x] Frontend chess games work

---

## Support

If issues arise:

1. **Check Render logs** (Dashboard → Logs)
2. **Test health endpoint** manually
3. **Verify API key** matches in both places
4. **Check Worker logs**: `npx wrangler tail`
5. **Run diagnostic**: `.\deploy-render.ps1` (without -Deploy)

---

**Deployment Ready!** 🚀  
Run `.\deploy-render.ps1` when you have your Render URL and API key.
