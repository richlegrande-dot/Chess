# Testing CPU Difficulty - Manual Guide

Since the automated test requires API keys, let's test through the web application directly.

## Quick Manual Test (5 minutes)

### Step 1: Check Render Deployment Status

1. Go to: https://dashboard.render.com
2. Look for service: "chesschat-stockfish"
3. Check the status - it should show "Live" with recent deploy activity
4. Wait if it shows "Deploying..." (typically 2-3 minutes)

### Step 2: Test the Web App

1. Open your Chess app at: https://chesschat.uk (or localhost if running locally)
2. Click "**Coaching Mode**"

### Step 3: Test Level 1 (Beginner)

1. Look for the difficulty selector/dropdown
2. Select **Level 1** (or if there's a slider, set it to 1)
3. Play a few moves as White:
   - Move: **e4**
   - CPU responds
   - Move: **Nf3**  
   - CPU responds
   - Move: **Bc4**
   - CPU responds

**What to Look For (Level 1):**
- CPU makes moves VERY quickly (~150ms)
- Moves might seem random or purposeless
- CPU might:
  - Move queen out too early (Qh5, Qf3)
  - Not defend pieces when attacked
  - Make moves that don't develop pieces
  - Hang pieces (leave them undefended)
- Should feel EASY to beat

### Step 4: Test Level 8 (Expert)

1. **Start a completely NEW game** (important - don't continue Level 1 game)
2. Select **Level 8** difficulty
3. Make the SAME opening moves:
   - Move: **e4**
   - CPU responds
   - Move: **Nf3**
   - CPU responds  
   - Move: **Bc4**
   - CPU responds

**What to Look For (Level 8):**
- CPU takes longer to think (~2000ms per move)
- CPU makes solid, principled moves
- CPU should:
  - Respond with e5 or other solid openings
  - Develop knights and bishops to good squares
  - Defend all pieces
  - Control the center
  - Create threats you need to respond to
- Should feel CHALLENGING - you need to think carefully

### Step 5: Compare

If the fix is working, you should notice:

| Aspect | Level 1 | Level 8 |
|--------|---------|---------|
| **Think Time** | Very fast (~150ms) | Slow (~2 seconds) |
| **Move Quality** | Weak/Random | Strong/Logical |
| **Threats** | Misses yours | Never misses |
| **Defense** | Hangs pieces | Defends everything |
| **Your Feeling** | "This is easy" | "This is hard!" |

## Clear Signs the Fix is Working

✅ **Fix IS working if:**
- You can easily beat Level 1 in 10-15 moves
- You struggle or lose against Level 8
- Level 1 makes obvious blunders
- Level 8 punishes your mistakes

❌ **Fix NOT working yet if:**
- Both levels feel the same
- Level 1 plays like an expert
- You can't tell the difference
- Both take similar time to move

## If They Still Feel the Same

1. **Hard Refresh**: Press `Ctrl + Shift + R` (Windows) or `Cmd + Shift + R` (Mac)
2. **Check Render**: Make sure deployment finished (check dashboard.render.com)
3. **Wait**: Render cold start can take 30-60 seconds on first request
4. **Clear Browser Cache**: 
   - Chrome: Settings → Privacy → Clear browsing data → Cached images/files
   - Edge: Settings → Privacy → Choose what to clear → Cached data

## Console Check (Advanced)

1. Open browser DevTools (F12)
2. Go to Console tab
3. Look for messages like:
   ```
   [CPU Move] Level 1: depth 1...
   [CPU Move] Level 8: depth 2...
   ```
4. Check Network tab for `/api/chess-move` calls
5. Look at the request body - should show correct `cpuLevel`

## Expected Timeline

- **Now**: Code is on GitHub ✅
- **+2-3 min**: Render builds and deploys ⏳
- **+4-5 min**: First request wakes server (cold start) ⏳
- **+5-6 min**: Levels should work differently ✅

## Troubleshooting

**Q: How do I know Render finished deploying?**
A: Check https://dashboard.render.com → Your service should show "Live" not "Deploying"

**Q: The app works but levels feel the same**
A: Hard refresh the page (Ctrl+Shift+R) and try again. The old code may be cached.

**Q: I don't see a difficulty selector**
A: You might be in the wrong mode. Make sure you're in "Coaching Mode" not "Chat Mode"

**Q: How long should I wait after the Git push?**
A: 3-5 minutes total. If it's been 10+ minutes and still the same, something went wrong.

---

**Quick Test Summary:**
1. Check Render deployment is "Live"
2. Play Level 1 → Should be easy, CPU makes mistakes
3. NEW game, play Level 8 → Should be hard, CPU plays strong
4. If different = Fix works! ✅
5. If same = Clear cache and retry
