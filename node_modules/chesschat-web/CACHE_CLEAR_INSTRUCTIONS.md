# ⚠️ CACHE ISSUE - PLEASE CLEAR YOUR BROWSER CACHE

## The Problem
Your browser may be using an **old cached version** of the site. The timestamps show the CPU is taking 20-23 seconds per move (should be 2.5s), which indicates the performance fixes aren't active.

## ✅ How to Fix - Hard Refresh

### Chrome / Edge / Firefox (Windows/Linux)
1. Go to https://chesschat.uk
2. Press **Ctrl + Shift + R** (or **Ctrl + F5**)
3. This will bypass the cache and load the latest version

### Chrome / Edge / Firefox (Mac)
1. Go to https://chesschat.uk  
2. Press **Cmd + Shift + R**
3. This will bypass the cache and load the latest version

### Safari (Mac)
1. Go to https://chesschat.uk
2. Press **Cmd + Option + R**
3. Or: Hold Shift and click the Reload button

## 🔍 Verify You Have the Latest Version

### Method 1: Check Console Log
1. Open Developer Tools (F12)
2. Go to the **Console** tab
3. Look for these messages at the top:
   ```
   🔧 CHESSCHAT BUILD: 2025-12-25-PERFORMANCE-FIX
   ✅ Opening book integration, feature parameters, beam search optimization
   ```

### Method 2: Test Performance
1. Start a new game at Level 7 or 8
2. First move should be **instant** (opening book)
3. Subsequent moves should take **~2-3 seconds** (not 20+ seconds)

### Method 3: Check Debug Panel
1. During a game, click the 🔧 debug icon
2. Look for "Engine Features" section
3. Should show:
   - **Beam Width**: 20 (Level 7) or 25 (Level 8)
   - **Quiescence**: Enabled with depth 8-10
   - **Aspiration**: Enabled with window 25-30

## 🐛 If Still Slow After Cache Clear

### Enable Debug Mode
1. Open Console (F12)
2. Type: `localStorage.setItem('debug', 'true')`
3. Press Enter
4. Refresh the page
5. Play a few moves
6. Send console logs showing worker configuration

### Check Worker Logs
After enabling debug mode, you should see:
```
[Worker] Configuration: {
  level: 7,
  depth: "4-9",
  timeLimit: "2500ms",
  openingBook: true,
  beamWidth: 20,
  quiescence: "depth 8",
  aspiration: "window ±30"
}
```

If you DON'T see this, the features aren't being passed.

## 📊 Latest Deployment Info

- **Deployment ID**: d13862dd
- **Production URL**: https://chesschat.uk
- **Build Date**: December 25, 2025
- **Fixes Included**:
  1. ✅ Opening book integration (instant opening moves)
  2. ✅ Feature parameters passed to worker (quiescence, beam, aspiration)
  3. ✅ Beam search optimization (apply BEFORE expensive checks)
  4. ✅ Version logging for cache verification

## 🎯 Expected Behavior

### Level 7 (Intermediate-Advanced)
- **Opening moves (1-3)**: Instant (~0ms, from opening book)
- **Middlegame moves**: 2-3 seconds
- **Search depth**: 4-9 with beam width 20
- **Features**: Quiescence depth 8, aspiration ±30

### Level 8 (Expert)
- **Opening moves (1-3)**: Instant (~0ms, from opening book)
- **Middlegame moves**: 2-3 seconds  
- **Search depth**: 5-10 with beam width 25
- **Features**: Quiescence depth 10, aspiration ±25

## 🚨 Known Cache Issues

Cloudflare Pages aggressively caches static assets. If you visited the site before the fix, your browser may have cached:
- Old JavaScript bundles without feature parameters
- Old worker code without opening book
- Old search algorithm without beam optimization

**Solution**: Hard refresh clears ALL cached assets and forces a fresh download.

---

**Need Help?** Open the console (F12) and share any error messages or worker configuration logs.
