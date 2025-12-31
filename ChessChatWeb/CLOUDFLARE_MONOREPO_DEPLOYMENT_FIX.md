# Cloudflare Pages Monorepo Deployment Fix - Dec 31, 2025

## Problem Statement

### Original Issue
**Production Error:** `ReferenceError: debugLog is not defined` causing CPU moves to fail
- **Root Cause:** Import statement inside JSDoc comment in `src/lib/tracing.ts`
- **Status:** ✅ Fixed in commit `a40e5ea`
- **Details:** See [DEBUGLOG_IMPORT_FIX_DEC31_2025.md](./DEBUGLOG_IMPORT_FIX_DEC31_2025.md)

### Deployment Blocker Issue
**Problem:** Code fix committed but **old bundle still serving** in production (index-4sfy9DNu.js)

**Symptom:** All Cloudflare deployments failing with:
```
npm error code EUSAGE
npm error The `npm ci` command can only install with an existing package-lock.json
```

**Root Cause:** Monorepo structure not configured in Cloudflare Pages
- Repository: `richlegrand-dot/Chess` (monorepo root)
- Web app location: `ChessChatWeb/` (subdirectory)
- Cloudflare looking for `package-lock.json` at repository root
- Actual location: `ChessChatWeb/package-lock.json`

---

## Environment Details

### Repository Structure
```
Chess/                          # Git repository root
├── ChessChat/                  # iOS app (unrelated to web deployment)
└── ChessChatWeb/              # Web app directory
    ├── src/
    ├── dist/
    ├── package.json
    ├── package-lock.json       # Cloudflare couldn't find this
    └── vite.config.ts
```

### Cloudflare Pages Configuration
- **Platform:** Cloudflare Pages
- **Git Repository:** https://github.com/richlegrand-dot/Chess
- **Production Branch:** main
- **Auto-Deploy:** Enabled via GitHub webhook
- **Build System:** npm
- **Dashboard:** https://dash.cloudflare.com/559ee9fa2c5827d89d4b416991f8360b/pages/view/chess

### Production Site
- **URL:** https://chesschat.uk
- **Current Bundle:** index-4sfy9DNu.js (BROKEN - has debugLog error)
- **Expected Bundle:** index-BMs3-3Jy.js (FIXED - from commit a40e5ea)

---

## Resolution Steps

### Step 1: Code Fix (Completed)
Fixed debugLog import error in commit `a40e5ea`:
```typescript
// BEFORE (BROKEN)
/**
 * CPU Move Pipeline Tracing System
import { debugLog } from './logging/debugLogger';
 */

// AFTER (FIXED)
/**
 * CPU Move Pipeline Tracing System
 */
import { debugLog } from './logging/debugLogger';
```

### Step 2: Nuclear Rebuild (Completed)
Performed complete rebuild to ensure clean artifacts:
```bash
cd ChessChatWeb
Remove-Item dist, node_modules, package-lock.json -Recurse -Force
npm install                    # Generated fresh package-lock.json
npm run build                  # Created new bundle: index-BMs3-3Jy.js
git add .
git commit -m "Fix: Complete rebuild with crash-proof debugLog"
git push origin main
```

### Step 3: Cloudflare Configuration Changes (IN PROGRESS)

#### Required Changes to Cloudflare Pages Settings

Navigate to: https://dash.cloudflare.com/559ee9fa2c5827d89d4b416991f8360b/pages/view/chess/settings

**1. Build Configuration**

| Setting | Old Value | New Value | Status |
|---------|-----------|-----------|--------|
| **Root directory (Path)** | *(empty/root)* | `ChessChatWeb` | ✅ Updated |
| **Build command** | `npm ci && npm run build` | `npm install && npm run build` | ✅ Updated |
| **Build output directory** | `dist` | `dist` | ✅ Correct |
| **Build watch paths** | `*` | `ChessChatWeb/**` | ✅ Updated |

**Rationale for Changes:**
- **Root directory:** Tells Cloudflare to `cd` into `ChessChatWeb/` before running commands
- **Build command:** Changed from `npm ci` to `npm install` because:
  - Cloudflare's auto-install runs `npm ci` BEFORE custom build command
  - Auto-install fails because it runs at repo root (no package-lock.json)
  - Custom `npm install` will run inside ChessChatWeb/ where package-lock.json exists
- **Build watch paths:** Only trigger builds when ChessChatWeb files change (not iOS app changes)

**2. Environment Variables**
*(None required - all settings configured via dashboard)*

**3. Build Cache**
- **Action Required:** Click "Clear Cache" after updating settings
- **Location:** Settings → Build cache section → Red "Clear Cache" link
- **Reason:** Ensures fresh build without stale dependencies

---

## Deployment Verification

### After Configuration Changes

1. **Retry Failed Deployment:**
   - Go to Deployments tab
   - Click "Retry deployment" on latest failed build
   - Expected: Build should succeed in ~90 seconds

2. **Monitor Build Progress:**
   ```
   Initializing build environment... ✅
   Cloning repository... ✅
   Installing dependencies (npm install)... ✅ (should work now)
   Building application (npm run build)... ✅
   Deploying to CDN... ✅
   ```

3. **Test Production Bundle (2-3 minutes after success):**
   ```powershell
   $r = Invoke-WebRequest https://chesschat.uk -UseBasicParsing
   if ($r.Content -match 'index-([a-zA-Z0-9]+)\.js') {
       Write-Host "Bundle: $($matches[1])"
       # Expected: BMs3-3Jy (NEW)
       # Old broken: 4sfy9DNu
   }
   ```

4. **Verify Fix in Browser:**
   - Open https://chesschat.uk in incognito mode (Ctrl+Shift+N)
   - Open DevTools Console (F12)
   - Look for: `🔧 CHESSCHAT BUILD: 2025-12-31-DEBUGLOG-FIX`
   - Test: Start Coaching Mode → Request CPU move
   - Expected: No "debugLog is not defined" error

---

## Troubleshooting

### If Build Still Fails

**Error: "npm ci requires package-lock.json"**
- **Problem:** Root directory not set correctly
- **Solution:** Verify Path = `ChessChatWeb` (exact case)
- **Verification:** Check build logs for `cd ChessChatWeb`

**Error: "Cannot find module 'vite'"**
- **Problem:** Dependencies not installed
- **Solution:** Ensure build command is `npm install && npm run build`
- **Clear cache:** Settings → Build cache → Clear Cache

**Error: "Build output directory not found"**
- **Problem:** Build output path incorrect
- **Solution:** Verify output directory is `dist` (not `ChessChatWeb/dist`)
- **Reason:** Path is relative to root directory

### If Production Still Serves Old Bundle

**Symptom:** Bundle hash still shows 4sfy9DNu after successful deployment

**Causes:**
1. **Deployment not actually successful** - Check deployment status shows green "Success"
2. **CDN cache not purged** - Cloudflare propagation takes 2-3 minutes
3. **Browser cache** - Test in fresh incognito window
4. **Wrong deployment active** - Check "Current active deployment" shows latest commit

**Solutions:**
```powershell
# Wait 3 minutes, then test again
Start-Sleep 180
$r = Invoke-WebRequest https://chesschat.uk -UseBasicParsing
$r.Content -match 'index-([a-zA-Z0-9]+)\.js'
```

---

## Timeline

- **22:00 UTC** - Original debugLog error fixed in code (commit a40e5ea)
- **22:02 UTC** - Deployment failed: package-lock.json not found
- **22:04 UTC** - Cleared build cache, retry failed (same error)
- **22:06 UTC** - Identified monorepo configuration issue
- **22:08 UTC** - Updated Cloudflare settings (Path, Build command, Watch paths)
- **22:10 UTC** - ⏳ **CURRENT STATUS:** Awaiting retry deployment with new settings

---

## Related Documentation

- [DEBUGLOG_IMPORT_FIX_DEC31_2025.md](./DEBUGLOG_IMPORT_FIX_DEC31_2025.md) - Original code fix
- [COMPLETE_REBUILD_DEC31_2025.md](./COMPLETE_REBUILD_DEC31_2025.md) - Nuclear rebuild process
- [CLOUDFLARE_BUILD_CONFIG.md](./CLOUDFLARE_BUILD_CONFIG.md) - Configuration details

---

## Configuration Summary (Copy-Paste Ready)

### Cloudflare Pages Settings

**Build & Deployments:**
```
Root directory: ChessChatWeb
Build command: npm install && npm run build
Build output directory: dist
```

**Build Watch Paths:**
```
Include paths: ChessChatWeb/**
Exclude paths: (empty)
```

**Branch Control:**
```
Production branch: main
Preview branches: Enabled
```

**Required Actions:**
1. ✅ Update Root directory to `ChessChatWeb`
2. ✅ Update Build command to `npm install && npm run build`
3. ✅ Update Build watch paths to `ChessChatWeb/**`
4. ⏳ Clear build cache
5. ⏳ Retry latest deployment
6. ⏳ Wait 2-3 minutes for CDN propagation
7. ⏳ Test production bundle hash
8. ⏳ Verify CPU moves work without errors

---

## Success Criteria

- ✅ Code fix committed (a40e5ea)
- ✅ Fresh build created locally (index-BMs3-3Jy.js)
- ✅ Cloudflare configuration updated
- ⏳ Cloudflare build succeeds
- ⏳ Production serves new bundle (BMs3-3Jy)
- ⏳ Console shows build stamp: 2025-12-31-DEBUGLOG-FIX
- ⏳ CPU moves function without debugLog errors

**Status:** ⏳ **PENDING USER ACTION** - Retry deployment after configuration changes

---

## Contact

For deployment verification assistance:
- Check Cloudflare dashboard for build status
- Monitor bundle hash via PowerShell command above
- Test in fresh incognito browser session
