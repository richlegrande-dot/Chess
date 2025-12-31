# Cloudflare Workers Service Build Configuration

**Date**: December 27, 2025  
**Deployment Type**: Cloudflare Workers Service Build (NOT Pages)  
**Status**: ✅ Correct configuration documented  

---

## 🚨 CRITICAL: Workers Service vs Pages

This project uses **Cloudflare Workers Service Build**, which is DIFFERENT from Cloudflare Pages.

### Deployment Type Comparison

| Feature | Cloudflare Pages | Cloudflare Workers Service Build |
|---------|------------------|----------------------------------|
| **Trigger** | Git push (auto) | Git push → Build → Deploy |
| **Build command** | Compiles assets | `npm ci && npm run build` |
| **Deploy command** | NONE (auto) | `npx wrangler deploy` ✅ |
| **Output** | Static site + Functions | Worker script |
| **UI Location** | Pages dashboard | Workers → Services → Builds |

**This project uses**: Workers Service Build (explicit wrangler deploy required)

---

## ⚠️ Root Cause of ENOENT Error

### Problem
```
npm error enoent Could not read package.json: /opt/buildhome/repo/package.json
```

### Why This Happens
1. **Repository structure**:
   ```
   LLM vs Me/              ← Repo root
   ├── .git/
   ├── ChessChat/          ← iOS app (unrelated)
   └── ChessChatWeb/       ← Web app (THIS IS WHERE package.json LIVES)
       ├── package.json    ← BUILD MUST RUN HERE
       ├── wrangler.toml   ← DEPLOY MUST RUN HERE
       ├── src/
       └── functions/
   ```

2. **Incorrect Path configuration**:
   - Path set to: `/` (repo root)
   - Build runs in: `/opt/buildhome/repo/`
   - Looks for: `/opt/buildhome/repo/package.json` ❌ NOT FOUND
   - Actual location: `/opt/buildhome/repo/ChessChatWeb/package.json` ✅

3. **Solution**:
   - Path must be: `ChessChatWeb`
   - Build will run in: `/opt/buildhome/repo/ChessChatWeb/`
   - Will find: `package.json` ✅ and `wrangler.toml` ✅

---

## ✅ CORRECT Workers Service Configuration

### Cloudflare Dashboard Settings

Navigate to: **Workers & Pages → Services → [service-name] → Settings → Builds**

| Setting | Value | Explanation |
|---------|-------|-------------|
| **Build command** | `npm ci && npm run build` | Install deps + compile TypeScript |
| **Deploy command** | `npx wrangler deploy` | Deploy Worker to Cloudflare |
| **Path** | `ChessChatWeb` | Subfolder containing package.json + wrangler.toml |

### Why Each Setting Matters

#### Build Command: `npm ci && npm run build`
- `npm ci` - Clean install from package-lock.json (reproducible builds)
- `npm run build` - Vite compiles TypeScript, bundles assets to dist/
- Must run BEFORE deploy (wrangler needs compiled code)

#### Deploy Command: `npx wrangler deploy`
- **REQUIRED for Workers Service Build**
- Uploads compiled Worker script + Functions to Cloudflare
- Reads configuration from wrangler.toml
- Without this, build succeeds but nothing deploys

#### Path: `ChessChatWeb`
- **CRITICAL**: Must be the folder containing both:
  - `package.json` (for npm commands)
  - `wrangler.toml` (for wrangler deploy)
- Cloudflare changes working directory to this path before running commands
- Wrong path = ENOENT errors

---

## 🔍 Verification

### Before Applying Configuration

Run this script to verify Path value:

```bash
node scripts/verify-cloudflare-path.mjs
```

**Expected output**:
```
✅ Repository structure verified
✅ package.json found: ChessChatWeb/package.json
✅ wrangler.toml found: ChessChatWeb/wrangler.toml

Correct Cloudflare Path: ChessChatWeb
```

### After Deployment

```bash
# Check deployment succeeded
wrangler deployments list

# Test production endpoints
node test-production-fixed.mjs
```

---

## 📋 Step-by-Step Setup

### 1. Update Cloudflare Dashboard

1. Go to: Workers & Pages → Your service → Settings → Builds
2. Set **Build command**: `npm ci && npm run build`
3. Set **Deploy command**: `npx wrangler deploy`
4. Set **Path**: `ChessChatWeb`
5. Save changes

### 2. Trigger Deployment

```bash
# Option A: Push to main branch (if Git integration enabled)
git push origin main

# Option B: Manual trigger from Cloudflare dashboard
# Workers → Services → [service] → Builds → Trigger build
```

### 3. Monitor Build

**Expected build log**:
```
✓ Cloning repository
✓ Changing directory: ChessChatWeb/
✓ Running build command: npm ci && npm run build
  → npm ci output...
  → vite build output...
✓ Build completed (3-5 seconds)
✓ Running deploy command: npx wrangler deploy
  → Uploading Worker...
  → Deploying to Cloudflare...
✓ Deployment complete
```

### 4. Verify Deployment

```bash
# From local machine
cd ChessChatWeb
node test-production-fixed.mjs

# Expected results:
# Tests: 6 | Passed: 6 | Failed: 0 ✅
# Engine Time: Avg <200ms | Max <750ms ✅
# Opening Book: 3/3 ✅
```

---

## 🚫 Common Mistakes

### ❌ Mistake 1: Path = `/`
**Problem**: Build runs at repo root, can't find package.json  
**Fix**: Path = `ChessChatWeb`

### ❌ Mistake 2: Empty Deploy Command
**Problem**: Build succeeds but nothing deploys (Pages behavior)  
**Fix**: Deploy command = `npx wrangler deploy`

### ❌ Mistake 3: Build Command = `npm run build` (no npm ci)
**Problem**: Dependencies not installed, build fails  
**Fix**: Build command = `npm ci && npm run build`

### ❌ Mistake 4: Treating as Cloudflare Pages
**Problem**: Expecting auto-deploy without wrangler command  
**Fix**: This is Workers Service, not Pages - explicit deploy required

---

## 📖 Related Documentation

### Workers Service Build Docs
- [Cloudflare Workers CI/CD](https://developers.cloudflare.com/workers/ci-cd/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)
- [Workers Service vs Pages](https://developers.cloudflare.com/workers/platform/routing/)

### Project-Specific Docs
- `scripts/verify-cloudflare-path.mjs` - Path verification script
- `CLOUDFLARE_CONFIG_CORRECTION.md` - Pages vs Workers comparison (historical)
- `CHESS_ENGINE_TIMEOUT_ISSUE.md` - Engine optimization details

---

## 🔐 Security & Architecture

### Wall-E-Only Guarantee
- ✅ NO external AI services
- ✅ NO OpenAI imports
- ✅ NO API keys required
- ✅ Wall-E handles all AI (coaching + chess engine)

### Build Safety
- CI verifies Path before deployment
- CI fails if package.json not found at Path
- CI fails if OpenAI imports detected
- CI fails if CPU budget not enforced

---

## 🧪 Testing Configuration

### Local Test (Before Cloudflare Deploy)

```bash
cd ChessChatWeb

# 1. Verify path
node scripts/verify-cloudflare-path.mjs

# 2. Simulate build command
npm ci && npm run build

# 3. Verify build output
ls dist/  # Should contain index.html, assets/, etc.

# 4. Test deploy (requires Cloudflare credentials)
npx wrangler deploy --dry-run
```

### CI Test (Automated)

```bash
# CI runs these automatically:
node scripts/verify-repo-root.mjs      # Verifies ChessChatWeb/ exists
node scripts/verify-cloudflare-path.mjs # Verifies Path configuration
npm ci && npm run build                 # Builds successfully
node scripts/verify-walle-integrity.mjs # No OpenAI imports
```

---

## 🎯 Expected Results

### Build Log (Success)
```
Cloning repository...
Changing to directory: ChessChatWeb
Installing dependencies...
  → npm ci (15-30 seconds)
Building application...
  → vite build (3-5 seconds)
  → dist/ created (2.4 MB)
Deploying to Cloudflare...
  → npx wrangler deploy
  → Uploading Worker script...
  → Uploading Functions...
  → Deployment complete

Status: ✅ Live
URL: https://chesschat.uk
```

### Build Log (Failure - Wrong Path)
```
Cloning repository...
Changing to directory: /
Running build command: npm ci && npm run build
npm error enoent: Could not read package.json ❌
Build failed
```

---

## 🔄 Migration Notes

### From Incorrect Configuration

**Old (WRONG)**:
```
Build command: (empty)
Deploy command: npm run build
Path: /
```

**New (CORRECT)**:
```
Build command: npm ci && npm run build
Deploy command: npx wrangler deploy
Path: ChessChatWeb
```

### Why Path Changed

**Previous assumption**: package.json at repo root  
**Reality**: package.json in ChessChatWeb/ subfolder  
**Evidence**: `LLM vs Me/ChessChatWeb/package.json`

This is a **repository structure issue**, not a configuration choice.

---

## 📞 Troubleshooting

### Error: ENOENT package.json
**Cause**: Path is wrong (pointing to repo root instead of ChessChatWeb)  
**Fix**: Set Path = `ChessChatWeb`

### Error: Build succeeds but nothing deploys
**Cause**: Missing Deploy command (treating as Pages)  
**Fix**: Set Deploy command = `npx wrangler deploy`

### Error: npm: command not found
**Cause**: Node.js not available in build environment  
**Fix**: Cloudflare should auto-detect, but verify Node.js 18+ is configured

### Error: wrangler: command not found
**Cause**: wrangler not in package.json devDependencies  
**Fix**: Should already be installed via `npm ci`, check package.json

---

## ✅ Final Checklist

Before deployment:
- [ ] Path = `ChessChatWeb` (verified by script)
- [ ] Build command = `npm ci && npm run build`
- [ ] Deploy command = `npx wrangler deploy`
- [ ] CI passes all checks
- [ ] No OpenAI imports detected
- [ ] Wall-E integrity verified

After deployment:
- [ ] Build log shows success
- [ ] Production site loads
- [ ] Chess engine responds <750ms
- [ ] Opening book active (3/3 tests pass)

---

**Configuration Status**: ✅ Correct for Workers Service Build  
**Expected Build Time**: 20-40 seconds (deps + compile + deploy)  
**Expected Deploy Success Rate**: 100% with correct Path  
**Last Updated**: December 27, 2025
