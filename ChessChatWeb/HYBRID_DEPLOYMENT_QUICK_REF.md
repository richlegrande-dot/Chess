# Hybrid Deployment Quick Reference

## Critical Configuration (Copy-Paste Ready)

### Cloudflare Pages Dashboard Settings

```
Project Type: Cloudflare Pages
Repository: richlegrande-dot/Chess
Branch: main
Root directory: ChessChatWeb
Build command: npm ci && npm run build
Build output directory: dist
Deploy command: (leave empty)
Framework preset: Vite
```

### Cloudflare Worker Service Build Dashboard Settings

```
Project Type: Worker Service Builds
Repository: richlegrande-dot/Chess
Branch: main
Path: ChessChatWeb/worker-assistant
Build command: npm ci
Deploy command: npx wrangler deploy --env production
```

### Service Binding (Pages Dashboard)

```
Location: Pages Settings → Functions → Service bindings
Variable name: WALLE_ASSISTANT
Service: walle-assistant
Environment: production
```

---

## Pre-Deployment Verification

Run this before pushing:
```bash
node scripts/verify-hybrid-deploy-paths.mjs
```

Expected output: `✅ ALL CHECKS PASSED - Ready for deployment!`

---

## Common Errors & Fixes

| Error | Fix |
|-------|-----|
| `ENOENT: package.json not found` | Wrong path in dashboard. Pages=`ChessChatWeb`, Worker=`ChessChatWeb/worker-assistant` |
| `npm ci failed - lockfile missing` | Lockfile now committed. If still fails, change to `npm install` |
| Worker build succeeds but deploy fails | Add deploy command: `npx wrangler deploy --env production` |
| `env.WALLE_ASSISTANT is undefined` | Configure service binding in Pages dashboard |

---

## Key Files

| Purpose | Path |
|---------|------|
| Pages config | `ChessChatWeb/wrangler.toml` |
| Pages build | `ChessChatWeb/package.json` |
| Worker config | `ChessChatWeb/worker-assistant/wrangler.toml` |
| Worker code | `ChessChatWeb/worker-assistant/src/index.ts` |
| Shared logic | `ChessChatWeb/shared/walleEngine.ts` |

---

## Architecture Rules

✅ **DO**:
- Keep Pages and Worker configs separate
- Use service binding for Pages→Worker communication
- Maintain Wall-E-only architecture (no external AI)
- Enforce ≥2 history references in personalization

❌ **DON'T**:
- Add `pages_build_output_dir` to Worker config
- Add `[build]` commands to wrangler.toml (use dashboard)
- Expose Worker endpoints publicly (service binding only)
- Add OpenAI or external AI dependencies

---

## Manual Deploy Commands

### Pages (local)
```bash
cd ChessChatWeb
npm ci && npm run build
npx wrangler pages deploy dist --project-name=chesschat-web
```

### Worker (local)
```bash
cd ChessChatWeb/worker-assistant
npm ci
npx wrangler deploy --env production
```

---

## Full Documentation

See [HYBRID_DEPLOYMENT_GUIDE.md](./HYBRID_DEPLOYMENT_GUIDE.md) for complete details.

---

**Updated**: December 27, 2024  
**Status**: ✅ Verified and CI-tested
