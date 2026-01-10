# Quick Verification Guide - CPU Level Fix

## What Was Fixed
The Stockfish engine was reusing the same Skill Level across all games. Now each game properly applies its configured difficulty level.

## How to Test (5 minutes)

### Step 1: Wait for Deployment ⏱️
- Render.com is auto-deploying now (takes ~2-3 minutes)
- Check status at: https://dashboard.render.com
- Look for "chesschat-stockfish" service showing "Deploy successful"

### Step 2: Test Level 1 (Beginner) 🟢

1. Go to your chess app
2. Start a new game in **Coaching Mode**
3. **IMPORTANT:** Look for difficulty selector and choose **Level 1**
4. Make a few moves (e.g., e4, Nf3, Bc4)

**Expected Level 1 Behavior:**
- ✅ Makes weak/questionable moves
- ✅ Might hang pieces or miss obvious threats
- ✅ Moves very quickly (~150ms per move)
- ✅ Plays like ~800-1000 ELO beginner

**Example Level 1 mistakes:**
- Moving queen out early (Qh5)
- Not defending attacked pieces
- Random pawn pushes without purpose

### Step 3: Test Level 8 (Expert) 🔴

1. **Start a NEW game** (don't continue the Level 1 game)
2. Choose **Level 8** difficulty
3. Make the same opening moves (e.g., e4, Nf3, Bc4)

**Expected Level 8 Behavior:**
- ✅ Solid, logical moves (e.g., e5, Nc6, Bc5)
- ✅ Defends all pieces carefully
- ✅ Takes longer to think (~2000ms per move)
- ✅ Plays like ~2200+ ELO expert
- ✅ You should feel significant pressure

**Example Level 8 strengths:**
- Classical opening principles (control center, develop pieces)
- Immediately responds to threats
- Sets up tactical combinations

### Step 4: Compare Side-by-Side

Play 5 moves against each level and compare:

| Aspect | Level 1 | Level 8 |
|--------|---------|---------|
| Move Quality | Weak/Random | Strong/Purposeful |
| Threats | Misses them | Never misses |
| Thinking Time | ~150ms | ~2000ms |
| Difficulty | Very Easy | Very Challenging |

### Quick Confirmation Checks

✅ **Fix is working if:**
- Level 1 makes moves that make you think "that was dumb"
- Level 8 makes moves that make you think "oh no, I didn't see that"
- You can easily beat Level 1 but struggle against Level 8

❌ **Problem still exists if:**
- Both levels play identically strong
- Level 1 never makes mistakes
- You can't tell the difference between levels

## Troubleshooting

### If levels still feel the same:

1. **Hard refresh the app:**
   - Press `Ctrl + Shift + R` (Windows)
   - Or `Cmd + Shift + R` (Mac)

2. **Check Render deployment:**
   - Go to https://dashboard.render.com
   - Verify "chesschat-stockfish" shows "Live"
   - Check deploy logs for errors

3. **Verify health endpoint:**
   ```bash
   curl https://chesschat-stockfish.onrender.com/health
   ```
   Should return `"status": "healthy"`

4. **Check browser console:**
   - Open DevTools (F12)
   - Look for API calls to `/api/chess-move`
   - Verify `cpuLevel` is being sent correctly

### If deployment failed:

1. Check Render logs for errors
2. Verify the commit reached GitHub
3. Try manually triggering deploy in Render dashboard

## Expected Timeline

- **Now:** Code pushed to GitHub ✅
- **+2 min:** Render starts building
- **+3 min:** Render deploys new version
- **+4 min:** Health check passes
- **+5 min:** Ready to test!

## Success Criteria

The fix is successful when:
- [x] Code committed and pushed
- [ ] Render deployment completes
- [ ] Level 1 plays like a beginner (makes mistakes)
- [ ] Level 8 plays like an expert (strong, tactical)
- [ ] Clear skill difference is noticeable

---

**Current Status:** ✅ Deployed to GitHub, waiting for Render.com  
**Next:** Test gameplay in 3-5 minutes  
**Issue:** Should be resolved after deployment completes
