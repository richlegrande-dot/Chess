# Cloudflare Pages Build Configuration
# This file documents the required settings for monorepo deployment

## Build Settings (Set in Cloudflare Dashboard)

**Framework preset:** None (custom build)

**Build command:** 
```bash
cd ChessChatWeb && npm ci && npm run build
```

**Build output directory:** 
```
ChessChatWeb/dist
```

**Root directory (project directory):** 
```
(leave empty or set to /)
```

**Environment variables:**
- `NODE_VERSION=18`
- `NPM_VERSION=latest`

## Alternative: Using Root Package.json

If monorepo issues persist, use:

**Build command:**
```bash
npm run build
```

**Build output directory:**
```
ChessChatWeb/dist
```

This uses the root package.json which delegates to ChessChatWeb.

## Deployment Trigger

Cloudflare should automatically deploy on:
- Push to `main` branch
- Pull request preview deployments

## Verification

After configuration change:
1. Go to Deployments tab
2. Click "Retry deployment" on latest build
3. Monitor build logs for errors
4. Build should complete in ~90 seconds
5. Check https://chesschat.uk for new bundle hash
