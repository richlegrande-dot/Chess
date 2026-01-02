# Render Stockfish Warm-Start Scripts

## Purpose
These scripts diagnose and wake up the Render.com Stockfish server when it's in a cold start state (sleeping due to inactivity).

## Problem
Render's free tier spins down services after 15 minutes of inactivity. When a user tries to play chess after the server has been sleeping, the first move can take 30-120 seconds to complete while Render starts the container.

## Solution
Run these scripts BEFORE playing chess to warm up the server proactively. This ensures fast response times (<500ms) from the first move.

---

## Available Scripts

### 1. PowerShell Script (Windows)
**File:** `warm-start-render.ps1`

**Usage:**
```powershell
# From ChessChatWeb directory
.\warm-start-render.ps1

# With verbose output
.\warm-start-render.ps1 -Verbose

# Custom timeout and attempts
.\warm-start-render.ps1 -MaxAttempts 10 -TimeoutSeconds 90
```

**Features:**
- ✅ Colored console output
- ✅ Progressive retry with backoff
- ✅ Health check validation
- ✅ Compute-move verification
- ✅ Detailed error reporting
- ✅ Summary statistics

### 2. Batch File Launcher (Windows)
**File:** `warm-start.bat`

**Usage:**
```cmd
# Double-click the file or run from command prompt
warm-start.bat
```

**Features:**
- Simple double-click execution
- Calls PowerShell script automatically
- Pauses at end to review results

### 3. Node.js Script (Cross-platform)
**File:** `warm-start-render.js`

**Usage:**
```bash
# Direct execution
node warm-start-render.js

# Via npm script
npm run warm-start

# From any directory
node "c:\Users\richl\LLM vs Me\ChessChatWeb\warm-start-render.js"
```

**Features:**
- ✅ Cross-platform (Windows, Mac, Linux)
- ✅ No dependencies (uses built-in Node.js modules)
- ✅ ANSI colored output
- ✅ Same functionality as PowerShell version
- ✅ Can be imported as module

---

## How It Works

### Phase 1: Initial Check (10s timeout)
- Quick health check to see if server is already awake
- If healthy: Script exits immediately (no warming needed)
- If not responding: Proceeds to Phase 2

### Phase 2: Wake-up Sequence (30-120s per attempt, up to 5 attempts)
- Sends repeated health check requests
- Waits for Render to start container
- Progressive backoff: 5s → 10s → 15s between retries
- Logs detailed progress and errors

### Phase 3: Verification
- Tests compute-move endpoint
- Validates Stockfish engine is ready
- Reports latency and response time

### Phase 4: Final Check
- Confirms server is fully operational
- Displays summary statistics
- Provides troubleshooting tips if needed

---

## Expected Results

### Cold Start (First Run)
```
⏳ Step 1/4: Initial health check...
⚠️  Server not responding (likely cold start)
⏳ Step 2/4: Starting wake-up sequence...
⏳ Attempt 1/5 - Pinging health endpoint...
✅ Server responded after 45s!
✅ Total wake-up time: 48s
✅ Final verification passed!
🎉 WARMUP COMPLETE! 🎉
```

### Already Warm
```
⏳ Step 1/4: Initial health check...
✅ Server is AWAKE and healthy!
ℹ️   Status: healthy
ℹ️   Latency: 127ms
✅ No cold start needed. Server is ready! 🚀
```

### Failed Wake-up
```
⏳ Step 2/4: Starting wake-up sequence...
⚠️  Attempt 1 failed after 60s
⚠️  Attempt 5 failed after 60s
❌ Failed to wake up server after 5 attempts

🔧 Troubleshooting Steps:
  1. Check Render dashboard: https://dashboard.render.com/
  2. Verify service is not suspended or stopped
  3. Check Render logs for startup errors
  4. Try manual deploy if service is stuck
  5. Contact Render support if issue persists
```

---

## Integration with Chat

To trigger from chat interface, type:
```
warm start
```

This will execute the warm-start script automatically.

---

## Automation Ideas

### 1. Schedule Before Gaming Sessions
```powershell
# Windows Task Scheduler - Run before you typically play
# Example: Every day at 7 PM
schtasks /create /tn "ChessChat Warm Start" /tr "powershell.exe -File 'C:\...\warm-start-render.ps1'" /sc daily /st 19:00
```

### 2. Add to Startup Scripts
```javascript
// In your app's startup code
if (process.env.NODE_ENV === 'production') {
  require('./warm-start-render.js').main();
}
```

### 3. Pre-deployment Hook
```json
// In package.json
{
  "scripts": {
    "predeploy": "npm run warm-start && npm run build"
  }
}
```

---

## Configuration

### Environment Variables
```bash
# Optional: Set API key if required
export STOCKFISH_API_KEY="your-api-key"

# Or in PowerShell
$env:STOCKFISH_API_KEY = "your-api-key"
```

### Customization
Edit the script constants at the top:
```javascript
const RENDER_URL = 'https://chesschat-stockfish.onrender.com';
const MAX_ATTEMPTS = 5;
const TIMEOUT_SECONDS = 60;
```

---

## Troubleshooting

### Script Times Out Every Time
- Render service may be suspended
- Check https://dashboard.render.com/
- Verify service is on "Free" tier and not suspended for overuse
- Try manual redeploy from Render dashboard

### "Connection Refused" Errors
- Render URL may have changed
- Verify `RENDER_URL` constant matches your deployment
- Check DNS resolution: `nslookup chesschat-stockfish.onrender.com`

### Script Succeeds But Game Still Slow
- Clear browser cache (Ctrl+Shift+Delete)
- Hard refresh (Ctrl+Shift+R)
- Check Worker is using correct Render URL
- Verify Architecture Change #3 is deployed

### PowerShell Execution Policy Error
```powershell
# Run this once to allow script execution
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

---

## Performance Metrics

### Typical Cold Start Times
- **Free Tier:** 30-90 seconds
- **Paid Tier:** 10-20 seconds

### Warm Server Response Times
- **Health Check:** 100-200ms
- **Compute Move:** 150-500ms (cache miss)
- **Compute Move:** 50-150ms (cache hit)

---

## Related Documentation
- [MANUAL_TEST_GUIDE_ARCHITECTURE_CHANGE_3.md](MANUAL_TEST_GUIDE_ARCHITECTURE_CHANGE_3.md)
- [ARCHITECTURE_CLARIFICATION_JAN2026.md](ARCHITECTURE_CLARIFICATION_JAN2026.md)
- [Render Cold Start Issue](https://render.com/docs/free#free-web-services)

---

**Created:** January 2, 2026  
**Last Updated:** January 2, 2026  
**Maintainer:** GitHub Copilot
