# Option B Deployment Quick Reference

**One-page cheat sheet for deploying the hybrid architecture**

## Pre-Deployment Verification

```bash
# Run all checks (must pass before deploy)
npm run verify:all

# Individual checks
npm run verify:worker-path    # Worker structure
npm run verify:hybrid         # No external AI deps
npm run verify:integrity      # Wall-E integrity
```

## Deploy Worker Service (First)

```bash
# Navigate to worker directory
cd worker-assistant

# Install dependencies (first time)
npm install

# Deploy to production
npx wrangler deploy --env production

# Deploy to staging
npx wrangler deploy --env staging

# Verify deployment
npx wrangler deployments list --name walle-assistant
```

## Configure Service Binding (Cloudflare Dashboard)

**Location:** Dashboard → Pages → `chesschat-web` → Settings → Functions → Service bindings

**Add Binding:**
```
Variable name:    WALLE_ASSISTANT
Service:          walle-assistant
Environment:      production
```

**For staging/preview:**
```
Variable name:    WALLE_ASSISTANT
Service:          walle-assistant
Environment:      staging
```

**Save and trigger Pages redeploy**

## Deploy Pages (Second)

```bash
# Automatic (git push)
git push origin main

# OR Manual
npm run build
npm run deploy
```

## Test Deployment

```bash
# Test with debug mode
curl https://your-domain.pages.dev/api/chat?debug=1 \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"message":"test","userId":"test-user"}'

# Expected response includes:
# "mode": "service-binding"  ← Worker is connected
# "historyEvidence": {...}   ← Personalization intact
```

## Critical Paths (Don't Mix These!)

| Component | Build Path | Config File |
|-----------|------------|-------------|
| **Pages Project** | `ChessChatWeb` (root) | `wrangler.toml` |
| **Worker Service** | `ChessChatWeb/worker-assistant` | `worker-assistant/wrangler.toml` |

⚠️ **Pages builds at ROOT, Worker builds at SUBFOLDER**

## Environment Variables

### Pages Dashboard
*(Dashboard → Pages → chesschat-web → Settings → Environment variables)*

```bash
DATABASE_URL=<prisma-connection-string>  # Optional
RATE_LIMIT_PER_IP=30                     # Optional
RATE_LIMIT_WINDOW=60                     # Optional
```

### Worker Secrets
```bash
cd worker-assistant
npx wrangler secret put DATABASE_URL --env production
# Enter database URL when prompted
```

## Troubleshooting

### "Service binding not found"
- Deploy Worker first: `cd worker-assistant && npx wrangler deploy --env production`
- Configure binding in Pages Dashboard (see above)
- Redeploy Pages

### Response shows "mode": "local-fallback"
- Check Worker is deployed: `npx wrangler deployments list --name walle-assistant`
- Verify binding in Pages Dashboard
- Variable name must be exactly: `WALLE_ASSISTANT`

### "Database unavailable"
- This is OK! Graceful degradation working
- To enable personalization: Set DATABASE_URL in both Pages and Worker

### Build fails "path not found"
- Verify Worker build path is: `ChessChatWeb/worker-assistant`
- NOT `ChessChatWeb` (that's for Pages)

## Verification Commands

```bash
# Check Worker deployment
cd worker-assistant
npx wrangler deployments list --name walle-assistant

# Check Pages deployment
# (via Cloudflare Dashboard → Pages → chesschat-web → Deployments)

# Test local Worker
cd worker-assistant
npx wrangler dev
# Then: curl http://localhost:8787/assist/chat -X POST -d '{"message":"test"}'

# Test Pages Functions
npm run dev:pages
# Then: curl http://localhost:3000/api/chat -X POST -d '{"message":"test"}'
```

## CI/CD Status

GitHub Actions runs on every push:
- ✅ Verify worker structure
- ✅ Check for external AI dependencies
- ✅ Validate service binding support
- ✅ Ensure personalization enforcement

**CI must pass before merge to main**

## Non-Negotiables Checklist

Before deploying:
- [ ] `npm run verify:all` passes
- [ ] Worker deployed: `npx wrangler deployments list --name walle-assistant`
- [ ] Service binding configured in Pages Dashboard
- [ ] Test endpoint returns `"mode": "service-binding"`
- [ ] Response includes `historyEvidence`
- [ ] No external AI dependencies (verified by CI)

## Quick Deploy Flow

1. **Verify** → `npm run verify:all`
2. **Deploy Worker** → `cd worker-assistant && npx wrangler deploy --env production`
3. **Configure Binding** → Pages Dashboard → Service bindings
4. **Deploy Pages** → `git push origin main`
5. **Test** → `curl .../api/chat?debug=1`

## Resources

- [OPTION_B_DEPLOYMENT_GUIDE.md](./OPTION_B_DEPLOYMENT_GUIDE.md) - Full guide
- [worker-assistant/README.md](./worker-assistant/README.md) - Worker docs
- [OPTION_B_IMPLEMENTATION_SUMMARY.md](./OPTION_B_IMPLEMENTATION_SUMMARY.md) - Implementation details

---

**Remember:** TWO separate builds. Pages at root, Worker at subfolder. 🚀
