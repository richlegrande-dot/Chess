# Quick Deployment Guide

**5-Minute Reference for Hybrid Architecture Deployment**

## Critical Steps (Do These First)

### 1. Remove Worker Route ⚠️
Dashboard → walle-assistant-production → Settings → Triggers
- Remove: `chesschat.uk/api/chess-move*`
- Remove: any `/api/*` routes

### 2. Add KV Namespace
```bash
cd ChessChatWeb
npx wrangler kv:namespace create WORKER_CALL_LOGS
```
Then add binding in Dashboard → chesschat-web → Settings → Functions → KV bindings

### 3. Deploy
```bash
# Worker
cd worker-assistant
npx wrangler deploy --env production

# Pages (push to GitHub for auto-deploy)
cd ..
git push origin main
```

## Verification

Test one move in-game, then check:
- [ ] Response `mode: "service-binding"` (not "local-fallback")
- [ ] Admin portal shows persistent logs
- [ ] No 503 errors

## Full Guide

See [HYBRID_ARCHITECTURE_FIX.md](HYBRID_ARCHITECTURE_FIX.md) for complete instructions.
