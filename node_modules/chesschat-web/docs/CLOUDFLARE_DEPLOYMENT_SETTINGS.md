# Cloudflare Pages Deployment Settings

**Last Updated**: December 27, 2025  
**Project**: ChessChat Web  
**Deployment Type**: Cloudflare Pages (NOT Workers Service)

---

## Official Deployment Configuration

This project uses **Cloudflare Pages** with Git integration (automatic deploys from GitHub).

### Required Cloudflare Dashboard Settings

Navigate to: **Pages → chesschat-web → Settings → Builds & deployments**

#### Build Settings

| Setting | Value | Description |
|---------|-------|-------------|
| **Build command** | `npm run build` | Runs Vite production build |
| **Build output directory** | `dist` | Vite outputs here |
| **Root directory** | `/` (repo root) | Where package.json lives |
| **Node.js version** | `18` or higher | Matches package.json engines |

#### Deploy Settings

| Setting | Value | Description |
|---------|-------|-------------|
| **Deploy command** | _(empty/none)_ | Pages auto-deploys after build |
| **Branch deployments** | `main` (production) | Auto-deploy on push to main |
| **Preview branches** | All branches | Preview deploys for PRs |

---

## Environment Variables

**CRITICAL**: This project uses **Wall-E-only architecture** (no external AI services).

### NO API KEYS REQUIRED ✅

The following environment variables should **NOT** be set:
- ❌ `OPENAI_API_KEY` - Not needed (Wall-E handles all AI)
- ❌ `ANTHROPIC_API_KEY` - Not needed
- ❌ Any other external AI service keys

### Optional Environment Variables

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `DATABASE_URL` | Secret | _(optional)_ | Prisma connection (graceful degradation if missing) |
| `RATE_LIMIT_PER_IP` | Public | `30` | Max requests per IP per minute |
| `RATE_LIMIT_WINDOW` | Public | `60` | Rate limit window (seconds) |

**How to set**: Pages → Settings → Environment variables

---

## Functions Configuration

Cloudflare Pages Functions are automatically deployed from the `functions/` directory.

### KV Namespace Bindings (Optional)

If using KV for caching/storage:

1. Go to: **Pages → chesschat-web → Settings → Functions → KV namespace bindings**
2. Add bindings as needed (project currently uses Prisma, not KV)

### Compatibility Date

Set in `wrangler.toml`:
```toml
compatibility_date = "2024-11-21"
```

---

## Build Process

### What Happens During Deploy

1. **Cloudflare clones repo** from GitHub (main branch)
2. **Finds package.json** at repo root
3. **Runs** `npm ci` (installs from lockfile)
4. **Runs** `npm run build` (Vite builds to `dist/`)
5. **Deploys** `dist/` to Cloudflare Pages CDN
6. **Deploys** `functions/` as Cloudflare Workers

### Expected Build Time

- Fresh build: 2-3 minutes
- Cached build: 30-60 seconds

---

## Troubleshooting

### Error: "Could not read package.json"

**Cause**: Cloudflare cannot find package.json at the location it expects.

**Solution**:
1. Verify package.json is at **repository root** (not in a subfolder)
2. Check "Root directory" setting in Cloudflare dashboard is `/`
3. Run verification: `node scripts/verify-repo-root.mjs`

### Error: "npm: command not found"

**Cause**: Node.js environment not properly configured.

**Solution**:
1. Check Cloudflare Pages settings → Build configuration → Node.js version
2. Set to `18` or higher (matches `package.json` engines field)

### Error: Build succeeds but site doesn't work

**Cause**: Build output directory mismatch.

**Solution**:
1. Verify `dist/` directory is created after `npm run build`
2. Check Cloudflare Pages settings → Build output directory is `dist`

### Error: Functions not working (500 errors)

**Cause**: Cloudflare Functions runtime issues.

**Solution**:
1. Check Functions logs: Pages → Deployments → [latest] → Functions logs
2. Verify `functions/` directory exists at repo root
3. Check `wrangler.toml` compatibility date is recent

---

## Verification Checklist

Before deploying, run these checks:

```bash
# 1. Verify repo layout
node scripts/verify-repo-root.mjs

# 2. Verify build works locally
npm ci
npm run build

# 3. Verify Wall-E integrity (no OpenAI)
node scripts/verify-walle-integrity.mjs

# 4. Verify Functions work locally (optional)
npx wrangler pages dev . --port 3000
```

All checks should pass ✅ before pushing to main.

---

## Migration Notes

### From Cloudflare Workers Service

If you previously used `wrangler deploy` (Workers service):

1. **Delete** any Worker service named "chess" or "chesschat"
2. **Create** new Cloudflare Pages project via dashboard
3. **Connect** to GitHub repository
4. **Configure** build settings as documented above
5. **Remove** any `wrangler deploy` commands from CI/scripts

### From Vercel/Netlify

1. Build command: Already correct (`npm run build`)
2. Output directory: Already correct (`dist`)
3. Functions: Migrate to `functions/` directory (Cloudflare Pages Functions format)
4. Environment variables: Remove any API keys (Wall-E-only architecture)

---

## Related Documentation

- [Cloudflare Pages Documentation](https://developers.cloudflare.com/pages)
- [Pages Functions Guide](https://developers.cloudflare.com/pages/platform/functions)
- Project: `CHESS_ENGINE_TIMEOUT_ISSUE.md` - Engine optimization details
- Project: `PHASE5_PRODUCTION_HARDENING.md` - Production architecture

---

## Contact

- **Repository**: richlegrande-dot/Chess
- **Production URL**: https://chesschat.uk
- **Preview URL**: https://chesschat-web.pages.dev

**Status**: ✅ Properly configured for Cloudflare Pages deployment
