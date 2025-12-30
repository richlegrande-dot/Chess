# Stockfish Server - Render.com Deployment

Simple deployment to Render.com free tier.

## Features
- ✅ Free hosting (with cold starts after 15 min)
- ✅ Automatic HTTPS
- ✅ Auto-deploy from Git
- ✅ Built-in health checks

## Quick Deploy

### Option 1: Blueprint (Recommended)

1. **Fork/Push this repo to GitHub**

2. **Connect to Render:**
   - Go to https://dashboard.render.com
   - Click "New +" → "Blueprint"
   - Connect your GitHub repo
   - Select `stockfish-server` directory
   - Click "Apply"

3. **Done!** Render will:
   - Create the service
   - Generate API key automatically
   - Deploy and start the server
   - Provide you with the URL

### Option 2: Manual Deploy

1. Go to https://dashboard.render.com
2. Click "New +" → "Web Service"
3. Connect your GitHub repo
4. Configure:
   ```
   Name: chesschat-stockfish
   Region: Oregon (closest to you)
   Branch: main
   Root Directory: stockfish-server
   Runtime: Node
   Build Command: npm install
   Start Command: node server.js
   Plan: Free
   ```

5. Add Environment Variable:
   ```
   STOCKFISH_API_KEY = [auto-generated or custom]
   ```

6. Click "Create Web Service"

## Configuration

Render will automatically:
- Install dependencies
- Start the server on port 3001
- Provide HTTPS endpoint
- Monitor health at `/health`

## Get Your Server URL

After deployment:
1. Go to Render Dashboard
2. Click on your service
3. Copy the URL (e.g., `https://chesschat-stockfish.onrender.com`)
4. Use this URL + API key in Worker configuration

## Cold Starts

⚠️ **Free tier limitation:**
- Service spins down after 15 minutes of inactivity
- Takes ~30 seconds to wake up on first request
- All subsequent requests are fast

**Mitigation:**
- Worker includes retry logic for cold starts
- Health check endpoint warms up the service
- Consider upgrading to paid tier ($7/mo) for 24/7 uptime

## Next Steps

Run the deployment script:
```powershell
cd ChessChatWeb
.\deploy-render.ps1
```

This will:
1. Detect your Render URL
2. Configure Worker secrets
3. Test the connection
4. Deploy Worker
