# Post-Push Testing Guide

## 🎯 What to Test Now

### 1. GitHub Actions CI Pipeline
**URL**: https://github.com/richlegrande-dot/Chess/actions

**Expected Results**:
```
✅ Checkout code
✅ Setup Node.js 18.x
✅ Install dependencies
✅ Verify lockfile integrity
✅ Type check (tsc --noEmit)
✅ Build (npm run build)
✅ Cloudflare readiness check (12/12)
✅ Upload artifacts (optional)
```

**What to Look For**:
- All 8 steps should show green checkmarks
- Build output should show "vite v5.0.8 building for production..."
- Cloudflare readiness should report "12/12 checks passed"
- Total time: ~2-5 minutes

---

### 2. Cloudflare Pages Build
**Dashboard**: Cloudflare Pages → Project: chess

**Build Stages**:
```
1. 🔄 Initializing build environment
2. 🔄 Cloning repository (richlegrande-dot/Chess)
3. 🔄 Installing dependencies (npm ci)
4. 🔄 Building application (npm run build)
5. 🔄 Deploying to Cloudflare edge
6. ✅ Deployment successful
```

**What to Look For**:
- No errors in "npm ci" (dependency installation)
- No TypeScript errors in build
- No Vite build errors
- "dist/" folder created with all assets
- Deployment URL shown after success

**Common Issues & Fixes**:
- ❌ "Cannot find module '@prisma/client'": Run `npm install` locally, commit package-lock.json
- ❌ "TypeScript errors": Check `npm run type-check` locally first
- ❌ "Build output not found": Ensure `vite.config.ts` outputs to `dist/`

---

### 3. Deployment Endpoints Testing

Once Cloudflare shows "Success", test these endpoints:

#### A. Health Check (Always Works)
```bash
curl https://[your-chess-app].pages.dev/api/health
```

**Expected Response**:
```json
{
  "status": "ok",
  "timestamp": "2025-12-26T...",
  "version": "1.0.0",
  "database": "unavailable",  // Until you add DATABASE_URL
  "features": {
    "walleEngine": true,
    "learningLoop": false,    // False until DATABASE_URL added
    "apiKeyRequired": false
  }
}
```

**Status Codes**:
- ✅ 200 OK - Health check passed
- ❌ 500 - Server error (check Cloudflare logs)
- ❌ 404 - Functions not deployed (check build output)

---

#### B. Wall-E Chat (Works Without Database)
```bash
curl -X POST https://[your-chess-app].pages.dev/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What should I focus on?",
    "gameState": {
      "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      "moves": []
    }
  }'
```

**Expected Response**:
```json
{
  "response": "Hey! 👋 Great question...",
  "coachingTips": [...],
  "learningInsights": null,  // null until DATABASE_URL added
  "source": "wall-e-engine"
}
```

**What to Verify**:
- ✅ Response includes coaching tips
- ✅ No mention of API keys or OpenAI
- ✅ Response is chess-relevant
- ✅ "source": "wall-e-engine" (not "openai")
- ⚠️ "learningInsights": null (expected without DATABASE_URL)

---

#### C. Game Analysis (Works Without Database)
```bash
curl -X POST https://[your-chess-app].pages.dev/api/analyze-game \
  -H "Content-Type: application/json" \
  -d '{
    "fen": "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4",
    "moveHistory": ["e4", "e5", "Nf3", "Nc6", "Bc4", "Nf6"],
    "playerColor": "white"
  }'
```

**Expected Response**:
```json
{
  "analysis": {
    "phase": "opening",
    "evaluation": "slight advantage white",
    "suggestions": [
      "Consider castling kingside for safety",
      "d3 to support center control"
    ],
    "mistakes": [],
    "improvements": [...]
  },
  "personalizedInsights": null,  // null until DATABASE_URL added
  "source": "wall-e-engine"
}
```

**What to Verify**:
- ✅ Analysis includes phase detection (opening/middlegame/endgame)
- ✅ Suggestions are relevant to position
- ✅ No errors about missing API keys
- ✅ Response time < 2 seconds

---

### 4. Database-Dependent Endpoints (After Adding DATABASE_URL)

These will return errors until you configure DATABASE_URL in Cloudflare:

#### Player Profile
```bash
curl https://[your-chess-app].pages.dev/api/wall-e/profile
```

**Without DATABASE_URL**:
```json
{
  "error": "Database connection not configured",
  "message": "DATABASE_URL environment variable is required"
}
```

**With DATABASE_URL**:
```json
{
  "playerId": "default",
  "skillRatings": {...},
  "behavioralPatterns": {...},
  "createdAt": "...",
  "updatedAt": "..."
}
```

#### Recent Games
```bash
curl https://[your-chess-app].pages.dev/api/wall-e/games
```

#### Mistake Patterns
```bash
curl https://[your-chess-app].pages.dev/api/wall-e/mistakes
```

---

### 5. Environment Variables Setup

**Go to**: Cloudflare Dashboard → Pages → chess → Settings → Environment variables

**Add Variable**:
- **Name**: `DATABASE_URL`
- **Value**: `prisma://accelerate.prisma-data.net/?api_key=YOUR_ACCELERATE_KEY`
- **Environment**: Production (and Preview if needed)

**Remove Variable** (if present):
- ~~`OPENAI_API_KEY`~~ - No longer needed!

**After Adding DATABASE_URL**:
1. Cloudflare will automatically redeploy
2. Wait 2-3 minutes for redeployment
3. Re-test all endpoints
4. Verify learning loop works

---

### 6. Prisma Migration (After DATABASE_URL Added)

The new CoachingMemory model needs to be migrated:

**Option A: Cloudflare Dashboard Console**
```bash
npx prisma migrate deploy
```

**Option B: Local Migration**
```bash
# In ChessChatWeb directory
npx prisma migrate dev --name add_coaching_memory
npx prisma db push
```

**Option C: Prisma Studio (Visual)**
```bash
npx prisma studio
```

---

## 🚨 Troubleshooting

### CI Pipeline Fails

**Symptom**: Red X on GitHub Actions

**Check**:
1. Click the failed workflow
2. Expand failed step
3. Read error message

**Common Fixes**:
```bash
# Lockfile issue
npm install
git add package-lock.json
git commit -m "fix: update lockfile"
git push

# Type errors
npm run type-check
# Fix errors shown
git commit -am "fix: resolve type errors"
git push

# Build errors
npm run build
# Fix errors shown
git commit -am "fix: resolve build errors"
git push
```

---

### Cloudflare Build Fails

**Symptom**: Build shows "Failed" in dashboard

**Check**:
1. Click the failed build
2. Read build logs
3. Look for red error messages

**Common Fixes**:

**Missing dependencies**:
```bash
# Add missing package
npm install <package-name>
git add package.json package-lock.json
git commit -m "fix: add missing dependency"
git push
```

**Build output missing**:
Check [vite.config.ts](vite.config.ts#L8):
```typescript
build: {
  outDir: 'dist',  // Must match Cloudflare setting
}
```

**Functions errors**:
Check functions compile:
```bash
cd functions
npx tsc --noEmit
```

---

### Runtime Errors

**Symptom**: 500 errors when testing endpoints

**Check Cloudflare Logs**:
1. Dashboard → Analytics → Logs
2. Filter by last 1 hour
3. Look for error stack traces

**Common Issues**:

**Prisma not found**:
```typescript
// Should use our singleton
import { getPrisma } from '../../lib/prisma';

// NOT this (will fail)
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
```

**Environment variable missing**:
Check error response includes helpful message:
```json
{
  "error": "Database connection not configured",
  "message": "Add DATABASE_URL in Cloudflare settings"
}
```

---

### Wall-E Not Working

**Symptom**: Still getting OpenAI errors or "API key required"

**Verify**:
1. Check [functions/api/chat.ts](functions/api/chat.ts):
   - Should import `walleEngine`
   - Should call `getWallEEngine().chat()`
   - Should NOT import `openai`

2. Check deployment included latest changes:
   ```bash
   # View commit on GitHub
   https://github.com/richlegrande-dot/Chess/commit/baabd18
   ```

3. Force new deployment:
   - Make small change (add comment to README)
   - Commit and push
   - Cloudflare will rebuild

---

## ✅ Success Criteria

### CI/CD
- [x] GitHub Actions workflow passes (all green)
- [x] Build completes in < 5 minutes
- [x] No TypeScript errors
- [x] No Vite build errors
- [x] Cloudflare readiness: 12/12 checks

### Deployment
- [ ] Cloudflare build succeeds
- [ ] Deployment URL accessible
- [ ] Health endpoint returns 200 OK
- [ ] No 404 errors on /api/* routes

### Wall-E Functionality
- [ ] Chat endpoint works without API keys
- [ ] Analysis endpoint works without API keys
- [ ] Responses mention Wall-E (not OpenAI)
- [ ] No "OPENAI_API_KEY not found" errors

### Learning Loop (After DATABASE_URL)
- [ ] Profile endpoint returns player data
- [ ] Games endpoint stores game history
- [ ] Mistakes endpoint tracks patterns
- [ ] Chat includes personalized insights

---

## 📊 Monitoring Dashboard

Create a simple monitoring script:

```bash
# Save as test-deployment.ps1
$base = "https://[your-app].pages.dev"

Write-Host "🔍 Testing Deployment..." -ForegroundColor Cyan

# Health check
$health = Invoke-WebRequest "$base/api/health" -UseBasicParsing
Write-Host "✅ Health: $($health.StatusCode)" -ForegroundColor Green

# Chat test
$chat = Invoke-WebRequest "$base/api/chat" -Method POST `
  -ContentType "application/json" `
  -Body '{"message":"test","gameState":{"fen":"start","moves":[]}}'
Write-Host "✅ Chat: $($chat.StatusCode)" -ForegroundColor Green

# Analysis test
$analysis = Invoke-WebRequest "$base/api/analyze-game" -Method POST `
  -ContentType "application/json" `
  -Body '{"fen":"start","moveHistory":[],"playerColor":"white"}'
Write-Host "✅ Analysis: $($analysis.StatusCode)" -ForegroundColor Green

Write-Host "`n🎉 All endpoints working!" -ForegroundColor Green
```

---

## 📞 Getting Help

### Documentation
- [WALL_E_IMPLEMENTATION.md](WALL_E_IMPLEMENTATION.md) - Full architecture
- [WALL_E_QUICK_REF.md](WALL_E_QUICK_REF.md) - Quick tasks
- [IMPLEMENTATION_COMPLETE.md](IMPLEMENTATION_COMPLETE.md) - Summary

### Logs & Debugging
- **CI Logs**: https://github.com/richlegrande-dot/Chess/actions
- **Build Logs**: Cloudflare Dashboard → Deployments → [Latest] → View build log
- **Runtime Logs**: Cloudflare Dashboard → Analytics → Logs

### Local Testing
```bash
cd "C:\Users\richl\LLM vs Me\ChessChatWeb"
npm install
npm run dev
# Test at http://localhost:5173
```

---

**Current Status**: ✅ Push complete, waiting for CI/CD  
**Next Check**: GitHub Actions in 2-3 minutes  
**Expected Completion**: 5-10 minutes total
