# Hybrid Deployment Quick Reference

## Cloudflare Dashboard Settings

### Pages Project (chesschat-web)
```
Repository: richlegrande-dot/Chess
Branch: main
Root directory: ChessChatWeb
Build command: npm ci && npm run build
Output directory: dist
Framework: Vite
```

**Service Binding** (Settings → Functions → Service bindings):
```
Variable: WALLE_ASSISTANT
Service: walle-assistant
Environment: production
```

### Worker Service (walle-assistant)
```
Repository: richlegrande-dot/Chess
Branch: main
Path: ChessChatWeb/worker-assistant
Build command: npm ci
Deploy command: npx wrangler deploy --env production
Preview deploy: npx wrangler deploy --env staging
```

## Manual Deployment

### Worker
```bash
cd ChessChatWeb/worker-assistant
npm ci
npx wrangler deploy --env production
```

### Pages
```bash
cd ChessChatWeb
npm ci
npm run build
wrangler pages deploy dist
```

## Verification

```bash
cd ChessChatWeb
npm run verify:hybrid-deploy
```

Expected: `✅ ALL CHECKS PASSED`

## Secrets

### Worker
```bash
wrangler secret put DATABASE_URL --env production
wrangler secret put INTERNAL_AUTH_TOKEN --env production
```

### Pages
Set in Dashboard → Settings → Environment variables → Production:
- `DATABASE_URL` (optional)
- `INTERNAL_AUTH_TOKEN` (if worker has auth)

## Architecture

```
Client → Pages Frontend (React/Vite)
         ↓
      Pages Functions (/api/*)
         ↓ (service binding: WALLE_ASSISTANT)
      Worker Service (/assist/*)
         ↓
      Wall-E Engine (src/shared/)
         ↓
      Database (optional)
```

## Key Changes (Dec 27, 2025)

✅ Worker is **self-contained** - builds from own directory  
✅ Build command simplified: `npm ci` (no parent dependency)  
✅ Auth guard added: Optional `X-Internal-Token` validation  
✅ CI verification: Catches config issues before deployment  
✅ All shared code in `worker-assistant/src/shared/`  

## Troubleshooting

### Worker build fails
```bash
cd ChessChatWeb/worker-assistant
npm install  # Regenerate lockfile
npm run verify:hybrid-deploy
```

### Import errors
Check that worker uses `./shared/` not `../../shared/`:
```bash
grep -r "from '\.\./\.\./shared" worker-assistant/src/
# Should return no results
```

### Service binding not working
1. Verify Pages wrangler.toml has `[[services]]` block
2. Check service name matches: `walle-assistant-production`
3. Verify worker is deployed and running

## Documentation

- Worker README: `ChessChatWeb/worker-assistant/README.md`
- Full guide: `ChessChatWeb/HYBRID_DEPLOYMENT_HARDENING_COMPLETE.md`
- Original deployment: `ChessChatWeb/HYBRID_DEPLOYMENT_COMPLETE_DEC27.md`
